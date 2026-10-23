import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { App } from "antd";
import { nanoid } from "nanoid";

import { NODE_DEFAULT_SIZE } from "@/constant/canvas";
import {
    backendProviderConfig,
    buildGenerationConfig,
    generationTaskMetadata,
    resetGenerationTaskMetadata,
    logicalModelIDForConfig,
} from "@/lib/canvas/canvas-project-generation";
import {
    cinematicStoryboardColumns,
    applyNodeConfigPatch,
    createCanvasNode,
    createStoryboardRow,
    expandStoryboardTextMentions,
    storyboardRowsFromTask,
    storyboardPromptTemplateMetadata,
} from "@/lib/canvas/canvas-project-domain";
import { buildNodeMentionReferences } from "@/lib/canvas/canvas-resource-references";
import { buildStoryboardAssetCatalog } from "@/lib/canvas/canvas-storyboard-assets";
import { buildStoryboardGenerationPrompt, resolveStoryboardGenerationContext } from "@/lib/canvas/canvas-storyboard-context";
import { reconcileStoryboardRowOutputs, reconcileStoryboardTargetConnections, storyboardComposerContent, storyboardRowReferenceNodeIds } from "@/lib/canvas/canvas-storyboard-materializer";
import { createStoryboardRegenerationNode, hasStoryboardMedia, storyboardGenerationRows } from "@/lib/canvas/canvas-storyboard-regeneration";
import { storyboardMediaModel, storyboardMediaParameters } from "@/lib/canvas/canvas-storyboard-models";
import { runCanvasGenerationSubmissionOnce } from "@/lib/canvas/canvas-generation-submission";
import { storyboardSubmissionKey } from "@/lib/canvas/canvas-storyboard-generation-state";
import { generationErrorMessage } from "@/lib/generation-error";
import { navigateToSettings } from "@/lib/settings-navigation";
import type { Skill } from "@/services/api/skills";
import { createGenerationTask, waitForGenerationTask } from "@/services/api/task-center";
import { skillRuntime } from "@/services/skill-runtime";
import { submitStoryboardTask } from "@/services/storyboard-submission";
import { getActiveUserScope } from "@/lib/user-scope";
import { configuredModelMatchesCapability, resolveModelRequestConfig, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import {
    CanvasNodeType,
    type CanvasConnection,
    type CanvasGenerationBatchMode,
    type CanvasNodeData,
    type StoryboardRow,
} from "@/types/canvas";

type UseCanvasStoryboardOptions = {
    projectId: string;
    addedSkills: Skill[];
    nodesRef: { current: CanvasNodeData[] };
    connectionsRef: { current: CanvasConnection[] };
    setNodes: Dispatch<SetStateAction<CanvasNodeData[]>>;
    setConnections: Dispatch<SetStateAction<CanvasConnection[]>>;
    setSelectedNodeIds: Dispatch<SetStateAction<Set<string>>>;
    enqueueGenerationBatch: (sourceNodeId: string, mode: CanvasGenerationBatchMode, targets: Array<{ rowId: string; nodeId: string }>) => string | undefined;
};

const NODE_STATUS_IDLE = "idle" as const;
const NODE_STATUS_LOADING = "loading" as const;
const NODE_STATUS_SUCCESS = "success" as const;
const NODE_STATUS_ERROR = "error" as const;

export function useCanvasStoryboard({
    projectId,
    addedSkills,
    nodesRef,
    connectionsRef,
    setNodes,
    setConnections,
    setSelectedNodeIds,
    enqueueGenerationBatch,
}: UseCanvasStoryboardOptions) {
    const { message } = App.useApp();
    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const storyboardRequests = useRef(new Set<string>());
    const mediaSubmissionLocks = useRef(new Map<string, Promise<unknown>>());
    const storyboardLifetime = useRef(new AbortController());
    useEffect(() => {
        const controller = new AbortController();
        storyboardLifetime.current = controller;
        return () => controller.abort();
    }, [projectId]);

    const updateScriptRows = useCallback((nodeId: string, updater: (rows: StoryboardRow[]) => StoryboardRow[]) => {
        const source = nodesRef.current.find((node) => node.id === nodeId);
        if (!source) return;
        const previousRows = source.metadata?.storyboard?.rows || [];
        const previousById = new Map(previousRows.map((row) => [row.id, row]));
        const nextRows = updater(previousRows).map((row) => invalidateEditedPromptVariables(previousById.get(row.id), row));
        const result = reconcileStoryboardRowOutputs(nodeId, previousRows, nextRows, connectionsRef.current);
        connectionsRef.current = result.connections;
        setConnections(result.connections);
        setNodes((current) => current.map((node) => node.id === nodeId ? {
            ...node,
            metadata: {
                ...node.metadata,
                storyboard: {
                    rows: result.rows,
                    visibleColumns: node.metadata?.storyboard?.visibleColumns || ["shotNumber", "durationSeconds", "videoMotionPrompt", "dialogue", "assets"],
                    referenceNodeIds: node.metadata?.storyboard?.referenceNodeIds || [],
                },
            },
        } : node));
    }, [connectionsRef, nodesRef, setConnections, setNodes]);

    const replaceScriptRows = useCallback((nodeId: string, rows: StoryboardRow[]) => {
        updateScriptRows(nodeId, () => rows);
    }, [updateScriptRows]);

    const addScriptRow = useCallback((nodeId: string) => {
        updateScriptRows(nodeId, (rows) => [...rows, createStoryboardRow(rows.length + 1)]);
    }, [updateScriptRows]);

    const updateScriptRow = useCallback((nodeId: string, rowId: string, patch: Partial<StoryboardRow>) => {
        updateScriptRows(nodeId, (rows) => rows.map((row) => row.id === rowId ? invalidateEditedPromptVariables(row, { ...row, ...patch }) : row));
    }, [updateScriptRows]);

    const removeScriptRow = useCallback((nodeId: string, rowId: string) => {
        const node = nodesRef.current.find((item) => item.id === nodeId);
        const rows = (node?.metadata?.storyboard?.rows || []).filter((row) => row.id !== rowId).map((row, index) => ({ ...row, shotNumber: index + 1 }));
        replaceScriptRows(nodeId, rows);
    }, [nodesRef, replaceScriptRows]);

    const generateScriptRows = useCallback(async (nodeId: string, prompt: string, callerSignal?: AbortSignal) => {
        const scriptNode = nodesRef.current.find((node) => node.id === nodeId && node.type === CanvasNodeType.Script);
        if (!scriptNode || !prompt.trim()) return;
        if (storyboardRequests.current.has(nodeId) || scriptNode.metadata?.status === NODE_STATUS_LOADING) { message.warning("当前分镜正在处理，请等待原任务完成"); return false; }
        const lifetimeSignal = storyboardLifetime.current.signal;
        const signal = callerSignal ? AbortSignal.any([lifetimeSignal, callerSignal]) : lifetimeSignal;
        const scope = getActiveUserScope();
        const originalRows = JSON.stringify(scriptNode.metadata?.storyboard?.rows || []);
        const assertCurrent = () => {
            signal.throwIfAborted();
            const current = nodesRef.current.find((node) => node.id === nodeId);
            if (getActiveUserScope() !== scope || !current || JSON.stringify(current.metadata?.storyboard?.rows || []) !== originalRows) throw new Error("画布、账号或分镜内容已变化，未覆盖现有镜头，请重新读取后处理");
        };
        let storyboardContext: ReturnType<typeof resolveStoryboardGenerationContext>;
        try {
            storyboardContext = resolveStoryboardGenerationContext(nodesRef.current);
        } catch (error) {
            message.warning(error instanceof Error ? error.message : "分镜上下文不完整");
            return;
        }
        const shotDuration = scriptNode.metadata?.storyboardShotDuration || "auto";
        const shotDurationSeconds = shotDuration === "auto" ? 0 : Number(shotDuration);
        const shotCount = scriptNode.metadata?.storyboardShotCount || "auto";
        const requestedShotCount = shotCount === "auto" ? 0 : Number(shotCount);
        const expandedPrompt = expandStoryboardTextMentions(prompt, buildNodeMentionReferences(scriptNode, nodesRef.current, connectionsRef.current));
        const generationConfig = buildGenerationConfig(effectiveConfig, scriptNode, "text");
        if (!isAiConfigReady(generationConfig, generationConfig.model)) {
            navigateToSettings({ continueCreation: true });
            return;
        }
        storyboardRequests.current.add(nodeId);
        try {
            const skillExecution = await skillRuntime.prepare({
                profile: "shortDrama",
                prompt: expandedPrompt,
                skills: addedSkills,
            });
            const generationPrompt = buildStoryboardGenerationPrompt(skillExecution.prompt, storyboardContext, { shotCount: requestedShotCount, shotDurationSeconds });
            assertCurrent();
            setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, metadata: { ...node.metadata, composerContent: prompt, status: NODE_STATUS_LOADING, taskStage: "正在创建任务", taskProgress: 0, errorDetails: undefined, ...skillExecution.metadata } } : node));
            assertCurrent();
            const request = {
                projectId,
                type: "canvas_text",
                operation: "storyboard",
                prompt: generationPrompt,
                model: generationConfig.model,
                ...(logicalModelIDForConfig(generationConfig) ? { logicalModelId: logicalModelIDForConfig(generationConfig) } : {}),
                input: {
                    mode: "text",
                    prompt: generationPrompt,
                    canvasAssets: buildStoryboardAssetCatalog(nodesRef.current),
                    requirements: "输出可直接编辑并用于批量生成图片和视频的分镜表。",
                    projectStyle: storyboardContext.projectStyle,
                    characters: storyboardContext.characters,
                    shotDurationSeconds,
                    shotCount: requestedShotCount,
                    config: backendProviderConfig(generationConfig, "text"),
                    metadata: { nodeId, ...skillExecution.metadata },
                },
            };
            const managed = Boolean(logicalModelIDForConfig(generationConfig) || resolveModelRequestConfig(generationConfig, generationConfig.model).channelId);
            const task = managed ? await submitStoryboardTask(request, { signal, assertCurrent }) : await createGenerationTask(request);
            if (!task) {
                if (!signal.aborted && scope === getActiveUserScope()) setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: scriptNode.metadata?.status || NODE_STATUS_IDLE, taskStage: undefined } } : node));
                return false;
            }
            assertCurrent();
            setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, metadata: { ...node.metadata, ...generationTaskMetadata(task), status: NODE_STATUS_LOADING } } : node));
            const completed = await waitForGenerationTask(task.id, {
                initialTask: task,
                signal,
                useTextEvents: true,
                onTaskUpdate: (next) => { if (!signal.aborted && scope === getActiveUserScope()) setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, metadata: { ...node.metadata, ...generationTaskMetadata(next), status: NODE_STATUS_LOADING } } : node)); },
            });
            const result = storyboardRowsFromTask(completed);
            assertCurrent();
            replaceScriptRows(nodeId, result.rows);
            setNodes((current) => current.map((node) => node.id === nodeId ? {
                ...node,
                title: result.title || node.title,
                metadata: {
                    ...node.metadata,
                    status: NODE_STATUS_SUCCESS,
                    errorDetails: undefined,
                    ...generationTaskMetadata(completed),
                    storyboard: {
                        rows: result.rows,
                        visibleColumns: cinematicStoryboardColumns(node.metadata?.storyboard?.visibleColumns),
                        referenceNodeIds: node.metadata?.storyboard?.referenceNodeIds || [],
                    },
                },
            } : node));
            message.success(`已生成 ${result.rows.length} 个镜头`);
            return true;
        } catch (error) {
            if (signal.aborted || scope !== getActiveUserScope()) return false;
            const details = generationErrorMessage(error);
            setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: NODE_STATUS_ERROR, errorDetails: details } } : node));
            message.error(details);
            return false;
        } finally {
            if (signal.aborted && !lifetimeSignal.aborted && scope === getActiveUserScope()) setNodes((current) => current.map((node) => {
                if (node.id !== nodeId) return node;
                const active = node.metadata?.taskStatus === "queued" || node.metadata?.taskStatus === "running";
                return { ...node, metadata: { ...node.metadata, status: active ? NODE_STATUS_LOADING : NODE_STATUS_IDLE, taskStage: active ? "已提交后台任务，等待结果" : undefined } };
            }));
            storyboardRequests.current.delete(nodeId);
        }
    }, [addedSkills, connectionsRef, effectiveConfig, isAiConfigReady, message, nodesRef, projectId, replaceScriptRows, setNodes]);

    const ensureScriptImageNodes = useCallback((nodeId: string, rowIds: string[], regenerate = false) => {
        const scriptNode = nodesRef.current.find((node) => node.id === nodeId && node.type === CanvasNodeType.Script);
        const rows = (scriptNode?.metadata?.storyboard?.rows || []).filter((row) => rowIds.includes(row.id));
        if (!scriptNode || !rows.length) return [];
        const imageSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
        const imageModel = storyboardMediaModel(effectiveConfig, scriptNode, "image");
        const startX = scriptNode.position.x + scriptNode.width + 120;
        const nextNodes = [...nodesRef.current];
        let nextConnections = [...connectionsRef.current];
        const targets: Array<{ row: StoryboardRow; node: CanvasNodeData; prompt: string }> = [];
        rows.forEach((row, index) => {
            const prompt = (row.imageGenerationPrompt || row.plotDescription).trim();
            const existing = row.imageNodeId ? nextNodes.find((node) => node.id === row.imageNodeId && node.type === CanvasNodeType.Image) : undefined;
            const parameters = storyboardMediaParameters(effectiveConfig, scriptNode, "image");
            const configured = existing ? applyNodeConfigPatch(existing, { model: imageModel, ...parameters }) : undefined;
            const existingMetadata = configured?.metadata?.content ? configured.metadata : resetGenerationTaskMetadata(configured?.metadata);
            const referenceIds = storyboardRowReferenceNodeIds(scriptNode, row, nextNodes, nextConnections, false, existing?.id);
            const composerContent = storyboardComposerContent(prompt, referenceIds, nextNodes);
            let imageNode = existing
                ? { ...configured!, metadata: { ...existingMetadata, prompt, composerContent, ...storyboardPromptTemplateMetadata(row, "image"), workflowKind: "shot" as const, workflowTitle: `镜头 ${row.shotNumber} 分镜图`, shotIndex: row.shotNumber } }
                : createCanvasNode(CanvasNodeType.Image, { x: startX + imageSpec.width / 2, y: scriptNode.position.y + index * (imageSpec.height + 36) + imageSpec.height / 2 }, { prompt, composerContent, model: imageModel, ...parameters, ...storyboardPromptTemplateMetadata(row, "image"), workflowKind: "shot", workflowTitle: `镜头 ${row.shotNumber} 分镜图`, shotIndex: row.shotNumber, status: NODE_STATUS_IDLE });
            if (existing && regenerate && hasStoryboardMedia(existing)) {
                imageNode = createStoryboardRegenerationNode(imageNode, nextNodes);
                nextNodes.push(imageNode);
            } else if (!existing) {
                imageNode.title = `镜头 ${row.shotNumber} · 分镜图`;
                nextNodes.push(imageNode);
            } else {
                const existingIndex = nextNodes.findIndex((node) => node.id === existing.id);
                nextNodes[existingIndex] = imageNode;
            }
            nextConnections = reconcileStoryboardTargetConnections(nextConnections, scriptNode, row, imageNode.id, referenceIds);
            targets.push({ row, node: imageNode, prompt });
        });
        const imageNodeByRowId = new Map(targets.map((target) => [target.row.id, target.node.id]));
        const scriptIndex = nextNodes.findIndex((node) => node.id === scriptNode.id);
        nextNodes[scriptIndex] = {
            ...scriptNode,
            metadata: {
                ...scriptNode.metadata,
                storyboard: {
                    rows: (scriptNode.metadata?.storyboard?.rows || []).map((row) => imageNodeByRowId.has(row.id) ? { ...row, imageNodeId: imageNodeByRowId.get(row.id), imageBindingStale: undefined } : row),
                    visibleColumns: scriptNode.metadata?.storyboard?.visibleColumns || ["shotNumber", "durationSeconds", "videoMotionPrompt", "dialogue", "assets"],
                    referenceNodeIds: scriptNode.metadata?.storyboard?.referenceNodeIds || [],
                },
            },
        };
        nodesRef.current = nextNodes;
        connectionsRef.current = nextConnections;
        setNodes(nextNodes);
        setConnections(nextConnections);
        return targets;
    }, [connectionsRef, effectiveConfig, nodesRef, setConnections, setNodes]);

    const createScriptImageNodes = useCallback((nodeId: string, rowIds?: string[]) => {
        const scriptNode = nodesRef.current.find((node) => node.id === nodeId && node.type === CanvasNodeType.Script);
        const rows = scriptNode?.metadata?.storyboard?.rows || [];
        const selectedRows = rowIds?.length ? rows.filter((row) => rowIds.includes(row.id)) : rows;
        if (!scriptNode || !selectedRows.length) return;
        const missing = selectedRows.filter((row) => !(row.imageGenerationPrompt || row.plotDescription).trim());
        if (missing.length) return message.warning(`有 ${missing.length} 个镜头缺少画面描述或图片提示词`);
        const createdCount = selectedRows.filter((row) => !row.imageNodeId || !nodesRef.current.some((node) => node.id === row.imageNodeId && node.type === CanvasNodeType.Image)).length;
        ensureScriptImageNodes(nodeId, selectedRows.map((row) => row.id));
        message.success(createdCount ? `已创建 ${createdCount} 个图片节点` : "已同步现有图片节点的提示词");
    }, [ensureScriptImageNodes, message, nodesRef]);

    const generateScriptImages = useCallback((nodeId: string, rowIds: string[], regenerate = false) => runCanvasGenerationSubmissionOnce(mediaSubmissionLocks.current, storyboardSubmissionKey(nodeId, "image", rowIds), async () => {
        const scriptNode = nodesRef.current.find((node) => node.id === nodeId && node.type === CanvasNodeType.Script);
        const rows = (scriptNode?.metadata?.storyboard?.rows || []).filter((row) => rowIds.includes(row.id));
        if (!scriptNode || !rows.length) return;
        const missing = rows.filter((row) => !(row.imageGenerationPrompt || row.plotDescription).trim());
        if (missing.length) return message.warning(`有 ${missing.length} 个镜头缺少画面描述或图片提示词`);
        const imageModel = storyboardMediaModel(effectiveConfig, scriptNode, "image");
        if (!isAiConfigReady(effectiveConfig, imageModel)) {
            navigateToSettings({ continueCreation: true });
            return;
        }
        const eligibleRows = storyboardGenerationRows(scriptNode, nodesRef.current, rowIds, "image", regenerate);
        if (!configuredModelMatchesCapability(effectiveConfig, imageModel, "image")) return message.warning("所选图片模型不可用，请在脚本节点重新选择图片模型");
        if (!eligibleRows.length) return message.info("所选分镜图已生成、正在生成或提交状态待确认");
        const targets = ensureScriptImageNodes(nodeId, eligibleRows.map((row) => row.id), regenerate);
        if (enqueueGenerationBatch(nodeId, "storyboard_image", targets.map((target) => ({ rowId: target.row.id, nodeId: target.node.id })))) message.success("分镜图已加入生成队列");
    }), [effectiveConfig, enqueueGenerationBatch, ensureScriptImageNodes, isAiConfigReady, message, nodesRef]);

    const createScriptVideoNodes = useCallback((nodeId: string, silent = false, rowIds?: string[], regenerate = false) => {
        const scriptNode = nodesRef.current.find((node) => node.id === nodeId && node.type === CanvasNodeType.Script);
        const allRows = scriptNode?.metadata?.storyboard?.rows || [];
        const rows = rowIds?.length ? allRows.filter((row) => rowIds.includes(row.id)) : allRows;
        if (!scriptNode || !rows.length) return;
        const videoSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Video];
        const startLeft = scriptNode.position.x + scriptNode.width + 120;
        const videoModel = storyboardMediaModel(effectiveConfig, scriptNode, "video");
        const nextNodes = [...nodesRef.current];
        let nextConnections = [...connectionsRef.current];
        const videoNodeByRowId = new Map<string, string>();
        let createdCount = 0;
        rows.forEach((row, index) => {
            const prompt = (row.videoMotionPrompt || row.plotDescription).trim();
            const existingIndex = row.videoNodeId ? nextNodes.findIndex((node) => node.id === row.videoNodeId && node.type === CanvasNodeType.Video) : -1;
            const existing = existingIndex >= 0 ? nextNodes[existingIndex] : undefined;
            const referenceIds = storyboardRowReferenceNodeIds(scriptNode, row, nextNodes, nextConnections, false, existing?.id);
            const composerContent = storyboardComposerContent(prompt, referenceIds, nextNodes);
            if (existingIndex >= 0) {
                const existing = nextNodes[existingIndex];
                const configured = applyNodeConfigPatch(existing, { model: videoModel, ...storyboardMediaParameters(effectiveConfig, scriptNode, "video", row.durationSeconds) });
                const existingMetadata = configured.metadata?.content ? configured.metadata : resetGenerationTaskMetadata(configured.metadata);
                let target: CanvasNodeData = { ...configured, metadata: { ...existingMetadata, prompt, composerContent, model: videoModel, ...storyboardPromptTemplateMetadata(row, "video"), shotIndex: row.shotNumber, workflowKind: "shot", workflowTitle: `镜头 ${row.shotNumber} 视频`, generationMode: "video", videoEditOperation: existing.metadata?.videoEditOperation || "text_to_video" } };
                if (regenerate && hasStoryboardMedia(existing)) {
                    target = createStoryboardRegenerationNode(target, nextNodes);
                    nextNodes.push(target);
                    createdCount++;
                } else nextNodes[existingIndex] = target;
                nextConnections = reconcileStoryboardTargetConnections(nextConnections, scriptNode, row, target.id, referenceIds);
                videoNodeByRowId.set(row.id, target.id);
                return;
            }
            const videoNode = createCanvasNode(CanvasNodeType.Video, { x: startLeft + videoSpec.width / 2, y: scriptNode.position.y + index * (videoSpec.height + 36) + videoSpec.height / 2 }, { prompt, composerContent, model: videoModel, ...storyboardPromptTemplateMetadata(row, "video"), workflowKind: "shot", workflowTitle: `镜头 ${row.shotNumber} 视频`, shotIndex: row.shotNumber, generationMode: "video", videoEditOperation: "text_to_video", status: NODE_STATUS_IDLE, ...storyboardMediaParameters(effectiveConfig, scriptNode, "video", row.durationSeconds) });
            videoNode.title = `镜头 ${row.shotNumber} · 视频`;
            nextNodes.push(videoNode);
            nextConnections = reconcileStoryboardTargetConnections(nextConnections, scriptNode, row, videoNode.id, referenceIds);
            videoNodeByRowId.set(row.id, videoNode.id);
            createdCount += 1;
        });
        const scriptIndex = nextNodes.findIndex((node) => node.id === scriptNode.id);
        nextNodes[scriptIndex] = {
            ...scriptNode,
            metadata: {
                ...scriptNode.metadata,
                storyboard: {
                    rows: allRows.map((row) => ({ ...row, videoNodeId: videoNodeByRowId.get(row.id) || row.videoNodeId })),
                    visibleColumns: scriptNode.metadata?.storyboard?.visibleColumns || ["shotNumber", "durationSeconds", "videoMotionPrompt", "dialogue", "assets"],
                    referenceNodeIds: scriptNode.metadata?.storyboard?.referenceNodeIds || [],
                },
            },
        };
        nodesRef.current = nextNodes;
        connectionsRef.current = nextConnections;
        setNodes(nextNodes);
        setConnections(nextConnections);
        if (!silent) message.success(createdCount ? `已创建 ${createdCount} 个视频节点` : "已同步现有视频节点的提示词");
    }, [connectionsRef, effectiveConfig, message, nodesRef, setConnections, setNodes]);

    const createAndGenerateScriptVideos = useCallback((nodeId: string, rowIds?: string[], regenerate = false) => runCanvasGenerationSubmissionOnce(mediaSubmissionLocks.current, storyboardSubmissionKey(nodeId, "video", rowIds), async () => {
        let scriptNode = nodesRef.current.find((node) => node.id === nodeId && node.type === CanvasNodeType.Script);
        if (!scriptNode) return;
        const videoModel = storyboardMediaModel(effectiveConfig, scriptNode, "video");
        if (!isAiConfigReady(effectiveConfig, videoModel)) {
            navigateToSettings({ continueCreation: true });
            return;
        }
        if (!configuredModelMatchesCapability(effectiveConfig, videoModel, "video")) return message.warning("所选视频模型不可用，请在脚本节点重新选择视频模型");
        const allRows = scriptNode?.metadata?.storyboard?.rows || [];
        const rows = rowIds?.length ? allRows.filter((row) => rowIds.includes(row.id)) : allRows;
        const describedRows = rows.filter((row) => Boolean((row.videoMotionPrompt || row.plotDescription).trim()));
        const eligibleRows = scriptNode ? storyboardGenerationRows(scriptNode, nodesRef.current, describedRows.map((row) => row.id), "video", regenerate) : [];
        if (!eligibleRows.length) {
            if (describedRows.some((row) => row.videoNodeId && nodesRef.current.some((node) => node.id === row.videoNodeId && Boolean(node.metadata?.content)))) message.info("镜头视频已存在");
            else message.warning("请先补充镜头画面描述");
            return;
        }
        createScriptVideoNodes(nodeId, true, eligibleRows.map((row) => row.id), regenerate);
        scriptNode = nodesRef.current.find((node) => node.id === nodeId && node.type === CanvasNodeType.Script);
        const targetRowIds = new Set(eligibleRows.map((row) => row.id));
        const targets = rows.flatMap((row) => {
            if (!targetRowIds.has(row.id)) return [];
            const currentRow = scriptNode?.metadata?.storyboard?.rows.find((item) => item.id === row.id) || row;
            const videoNode = currentRow.videoNodeId ? nodesRef.current.find((node) => node.id === currentRow.videoNodeId && node.type === CanvasNodeType.Video) : undefined;
            if (!videoNode || videoNode.metadata?.content) return [];
            const prompt = (currentRow.videoMotionPrompt || currentRow.plotDescription).trim();
            if (!prompt) return [];
            return [{ row: currentRow, videoNode, prompt }];
        });
        const targetById = new Map(targets.map((target) => [target.videoNode.id, target]));
        const nextNodes = nodesRef.current.map((node) => {
            const target = targetById.get(node.id);
            return target ? { ...node, metadata: { ...node.metadata, prompt: target.prompt, composerContent: target.videoNode.metadata?.composerContent || target.prompt, model: videoModel, ...storyboardPromptTemplateMetadata(target.row, "video"), generationMode: "video" as const, videoEditOperation: "text_to_video" as const, videoStartFrameNodeId: undefined } } : node;
        });
        const nextConnections = connectionsRef.current;
        nodesRef.current = nextNodes;
        connectionsRef.current = nextConnections;
        setNodes(nextNodes);
        setConnections(nextConnections);
        setSelectedNodeIds(new Set(targets.map((target) => target.videoNode.id)));
        if (enqueueGenerationBatch(nodeId, "storyboard_video", targets.map((target) => ({ rowId: target.row.id, nodeId: target.videoNode.id })))) message.success("镜头视频已加入生成队列");
    }), [connectionsRef, createScriptVideoNodes, effectiveConfig, enqueueGenerationBatch, isAiConfigReady, message, nodesRef, setConnections, setNodes, setSelectedNodeIds]);

    const createScriptActionBoards = useCallback((nodeId: string) => runCanvasGenerationSubmissionOnce(mediaSubmissionLocks.current, `${nodeId}:action-board`, async () => {
        const scriptNode = nodesRef.current.find((node) => node.id === nodeId && node.type === CanvasNodeType.Script);
        const rows = scriptNode?.metadata?.storyboard?.rows || [];
        if (!scriptNode || !rows.length) return;
        const imageModel = effectiveConfig.imageModel || effectiveConfig.model;
        if (!isAiConfigReady(effectiveConfig, imageModel)) {
            navigateToSettings({ continueCreation: true });
            return;
        }
        const actionBoardRows = rows.filter((row) => !nodesRef.current.some((node) => node.type === CanvasNodeType.Image && node.metadata?.workflowKind === "action_board" && node.metadata.shotIndex === row.shotNumber && Boolean(node.metadata.content)));
        if (!actionBoardRows.length) {
            message.info("动作拆分板已存在");
            return;
        }
        const imageSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Image];
        const startX = scriptNode.position.x + scriptNode.width + 120;
        const nextNodes = [...nodesRef.current];
        const nextConnections = [...connectionsRef.current];
        const targets: Array<{ row: StoryboardRow; node: CanvasNodeData; prompt: string }> = [];
        actionBoardRows.forEach((row, index) => {
            const prompt = [
                "生成一张电影动作拆分 12 宫格参考图，严格 3 列 4 行，12 个格子清晰分隔，保持同一角色、服装、场景和光线连续。",
                `镜头 ${row.shotNumber}：${row.plotDescription || row.videoMotionPrompt || "根据镜头剧情补全动作"}`,
                row.characters.length ? `角色：${row.characters.map((item) => item.characterName).join("、")}` : "",
                "按时间顺序展示动作起势、推进、转折、落点和结束姿态，不要添加文字、边框标题或额外画面。",
            ].filter(Boolean).join("\n");
            const existingIndex = nextNodes.findIndex((node) => node.type === CanvasNodeType.Image && node.metadata?.workflowKind === "action_board" && node.metadata.shotIndex === row.shotNumber);
            if (existingIndex >= 0 && nextNodes[existingIndex].metadata?.content) return;
            const imageNode = existingIndex >= 0
                ? { ...nextNodes[existingIndex], metadata: { ...resetGenerationTaskMetadata(nextNodes[existingIndex].metadata), prompt } }
                : createCanvasNode(CanvasNodeType.Image, { x: startX + imageSpec.width / 2, y: scriptNode.position.y + index * (imageSpec.height + 36) + imageSpec.height / 2 }, { prompt, workflowKind: "action_board", workflowTitle: `镜头 ${row.shotNumber} 动作板`, shotIndex: row.shotNumber, actionBoardRows: 4, actionBoardColumns: 3, status: NODE_STATUS_IDLE });
            imageNode.title = `镜头 ${row.shotNumber} · 动作板`;
            if (existingIndex >= 0) nextNodes[existingIndex] = imageNode;
            else {
                nextNodes.push(imageNode);
                nextConnections.push({ id: nanoid(), fromNodeId: scriptNode.id, toNodeId: imageNode.id, fromHandleId: `row:${row.id}` });
            }
            targets.push({ row, node: imageNode, prompt });
        });
        nodesRef.current = nextNodes;
        connectionsRef.current = nextConnections;
        setNodes(nextNodes);
        setConnections(nextConnections);
        if (enqueueGenerationBatch(nodeId, "action_board", targets.map((target) => ({ rowId: target.row.id, nodeId: target.node.id })))) message.success("动作拆分板已加入生成队列");
    }), [connectionsRef, effectiveConfig, enqueueGenerationBatch, isAiConfigReady, message, nodesRef, setConnections, setNodes]);

    const generateScriptVideos = useCallback((nodeId: string, rowIds: string[], regenerate = false) => runCanvasGenerationSubmissionOnce(mediaSubmissionLocks.current, storyboardSubmissionKey(nodeId, "video", rowIds), async () => {
        let scriptNode = nodesRef.current.find((node) => node.id === nodeId && node.type === CanvasNodeType.Script);
        const rows = (scriptNode?.metadata?.storyboard?.rows || []).filter((row) => rowIds.includes(row.id));
        if (!scriptNode || !rows.length) return;
        const readyRows = rows.filter((row) => row.imageNodeId && nodesRef.current.some((node) => node.id === row.imageNodeId && node.type === CanvasNodeType.Image && node.metadata?.content));
        if (!readyRows.length) return message.warning("请先生成并检查选中镜头的首帧");
        if (readyRows.length !== rows.length) return message.warning(`${rows.length - readyRows.length} 个选中镜头还没有可用首帧，请全部生成并检查后再确认`);
        const videoModel = storyboardMediaModel(effectiveConfig, scriptNode, "video");
        if (!isAiConfigReady(effectiveConfig, videoModel)) {
            navigateToSettings({ continueCreation: true });
            return;
        }
        const eligibleRows = storyboardGenerationRows(scriptNode, nodesRef.current, readyRows.map((row) => row.id), "video", regenerate);
        if (!configuredModelMatchesCapability(effectiveConfig, videoModel, "video")) return message.warning("所选视频模型不可用，请在脚本节点重新选择视频模型");
        if (!eligibleRows.length) return message.info("所选镜头视频已生成、正在生成或提交状态待确认");
        createScriptVideoNodes(nodeId, true, eligibleRows.map((row) => row.id), regenerate);
        scriptNode = nodesRef.current.find((node) => node.id === nodeId && node.type === CanvasNodeType.Script);
        if (!scriptNode) return;
        const currentScriptNode = scriptNode;
        const videoSpec = NODE_DEFAULT_SIZE[CanvasNodeType.Video];
        const currentRows = eligibleRows.map((row) => currentScriptNode.metadata?.storyboard?.rows.find((item) => item.id === row.id) || row);
        const startX = Math.max(...currentRows.map((row) => nodesRef.current.find((node) => node.id === row.imageNodeId)?.position.x || currentScriptNode.position.x + currentScriptNode.width)) + videoSpec.width + 120;
        const nextNodes = [...nodesRef.current];
        let nextConnections = [...connectionsRef.current];
        const targets: Array<{ row: StoryboardRow; node: CanvasNodeData; prompt: string }> = [];
        currentRows.forEach((row, index) => {
            const prompt = (row.videoMotionPrompt || row.plotDescription).trim();
            const existing = row.videoNodeId ? nextNodes.find((node) => node.id === row.videoNodeId && node.type === CanvasNodeType.Video) : undefined;
            const referenceIds = storyboardRowReferenceNodeIds(currentScriptNode, row, nextNodes, nextConnections, true, existing?.id);
            const composerContent = storyboardComposerContent(prompt, referenceIds, nextNodes);
            const existingMetadata = existing?.metadata?.content ? existing.metadata : resetGenerationTaskMetadata(existing?.metadata);
            const videoNode = existing
                ? { ...existing, metadata: { ...existingMetadata, prompt, composerContent, model: videoModel, ...storyboardPromptTemplateMetadata(row, "video"), workflowKind: "shot" as const, workflowTitle: `镜头 ${row.shotNumber} 视频`, shotIndex: row.shotNumber, generationMode: "video" as const, videoEditOperation: "image_to_video" as const, videoStartFrameNodeId: row.imageNodeId, ...storyboardMediaParameters(effectiveConfig, currentScriptNode, "video", row.durationSeconds) } }
                : createCanvasNode(CanvasNodeType.Video, { x: startX, y: currentScriptNode.position.y + index * (videoSpec.height + 36) + videoSpec.height / 2 }, { prompt, composerContent, model: videoModel, ...storyboardPromptTemplateMetadata(row, "video"), workflowKind: "shot", workflowTitle: `镜头 ${row.shotNumber} 视频`, shotIndex: row.shotNumber, generationMode: "video", videoEditOperation: "image_to_video", videoStartFrameNodeId: row.imageNodeId, status: NODE_STATUS_IDLE, ...storyboardMediaParameters(effectiveConfig, currentScriptNode, "video", row.durationSeconds) });
            if (!existing) {
                videoNode.title = `镜头 ${row.shotNumber} · 视频`;
                nextNodes.push(videoNode);
            } else {
                const existingIndex = nextNodes.findIndex((node) => node.id === existing.id);
                nextNodes[existingIndex] = videoNode;
            }
            nextConnections = reconcileStoryboardTargetConnections(nextConnections, currentScriptNode, row, videoNode.id, referenceIds);
            targets.push({ row, node: videoNode, prompt });
        });
        nodesRef.current = nextNodes;
        connectionsRef.current = nextConnections;
        setNodes(nextNodes);
        setConnections(nextConnections);
        if (enqueueGenerationBatch(nodeId, "storyboard_video", targets.map((target) => ({ rowId: target.row.id, nodeId: target.node.id })))) message.success("镜头视频已加入生成队列");
    }), [connectionsRef, createScriptVideoNodes, effectiveConfig, enqueueGenerationBatch, isAiConfigReady, message, nodesRef, setConnections, setNodes]);

    return {
        addScriptRow,
        createAndGenerateScriptVideos,
        createScriptActionBoards,
        createScriptImageNodes,
        createScriptVideoNodes,
        generateScriptImages,
        generateScriptRows,
        generateScriptVideos,
        removeScriptRow,
        replaceScriptRows,
        updateScriptRow,
        updateScriptRows,
    };
}

function invalidateEditedPromptVariables(previous: StoryboardRow | undefined, next: StoryboardRow) {
    if (!previous) return next;
    return {
        ...next,
        imagePromptTemplateVariables: next.imageGenerationPrompt === previous.imageGenerationPrompt ? next.imagePromptTemplateVariables : undefined,
        videoPromptTemplateVariables: next.videoMotionPrompt === previous.videoMotionPrompt ? next.videoPromptTemplateVariables : undefined,
    };
}
