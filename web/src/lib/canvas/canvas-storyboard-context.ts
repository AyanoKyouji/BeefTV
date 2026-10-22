import type { CanvasNodeData } from "@/types/canvas";
import { storyboardRowsOutputContract } from "./canvas-project-domain";

export type StoryboardGenerationContext = {
    projectStyle?: {
        presetId: string;
        title: string;
        prompt: string;
        profileJson?: string;
    };
    characters: Array<{
        assetId: string;
        versionId: string;
        name: string;
        definition: Record<string, unknown>;
    }>;
};

// 自由画布可以只用剧情拆镜；已有画风与项目角色卡仍须完整，不能静默丢弃。
export function resolveStoryboardGenerationContext(nodes: CanvasNodeData[]): StoryboardGenerationContext {
    const styleNode = nodes.find((node) => node.metadata?.workflowKind === "styleboard");
    const stylePrompt = String(styleNode?.metadata?.content || styleNode?.metadata?.prompt || "").trim();
    const stylePresetId = String(styleNode?.metadata?.stylePresetId || "").trim();
    if (styleNode && (!stylePrompt || !stylePresetId)) throw new Error("项目画风配置不完整，请重新设置画风后再生成分镜");

    // `workflowKind=character` is also used by standalone character-design
    // image workflows. Only nodes linked to a project character asset are
    // storyboard character cards and therefore participate in this check.
    const characterNodes = nodes.filter((node) => node.metadata?.workflowKind === "character" && node.metadata?.characterAssetId?.trim());
    const invalidCharacter = characterNodes.find((node) => !node.metadata?.characterAssetId?.trim() || !node.metadata?.characterVersionId?.trim() || !(node.metadata?.characterName || node.title).trim());
    if (invalidCharacter) throw new Error(`角色卡“${invalidCharacter.metadata?.characterName || invalidCharacter.title || "未命名角色"}”版本未同步，请刷新角色资产后再生成分镜`);

    return {
        projectStyle: styleNode ? {
            presetId: stylePresetId,
            title: styleNode.title.replace(/^(?:项目)?画风\s*[·：:]?\s*/, "").trim() || styleNode.title,
            prompt: stylePrompt,
            profileJson: styleNode.metadata?.styleProfileJson,
        } : undefined,
        characters: characterNodes.map((node) => ({
            assetId: node.metadata!.characterAssetId!.trim(),
            versionId: node.metadata!.characterVersionId!.trim(),
            name: (node.metadata?.characterName || node.title).trim(),
            definition: node.metadata?.characterDefinition || { prompt: node.metadata?.characterPrompt || "" },
        })),
    };
}

export function buildStoryboardGenerationPrompt(prompt: string, context: StoryboardGenerationContext, options: { shotCount: number; shotDurationSeconds: number }) {
    return [
        prompt.trim(),
        context.projectStyle ? `【项目画风】\n${context.projectStyle.prompt}` : "",
        context.characters.length ? `【当前角色版本】\n${JSON.stringify(context.characters)}` : "",
        storyboardRowsOutputContract([
            options.shotCount > 0 ? `必须输出 ${options.shotCount} 个镜头。` : "按剧情需要拆分镜头。",
            options.shotDurationSeconds > 0 ? `每个镜头的 durationSeconds 必须为 ${options.shotDurationSeconds}。` : "按剧情及用户要求安排镜头时长。",
        ].join("")),
    ].filter(Boolean).join("\n\n");
}

// Expose the same generation prerequisites to the Agent before it starts a workflow.
export function inspectStoryboardReadiness(nodes: CanvasNodeData[]) {
    let generationContext: StoryboardGenerationContext | undefined;
    let blockingReason: string | undefined;
    try { generationContext = resolveStoryboardGenerationContext(nodes); }
    catch (error) { blockingReason = error instanceof Error ? error.message : "分镜上下文未就绪"; }
    const styleNode = nodes.find((node) => node.metadata?.workflowKind === "styleboard");
    const styleReady = Boolean(styleNode?.metadata?.stylePresetId?.trim() && String(styleNode.metadata.content || styleNode.metadata.prompt || "").trim());
    const storyboards = nodes.filter((node) => node.type === "script").map((node) => {
        const rows = node.metadata?.storyboard?.rows || [];
        const incompleteRowIds = rows.filter((row) => !Number.isFinite(row.durationSeconds) || row.durationSeconds <= 0 || !row.videoMotionPrompt?.trim()).map((row) => row.id);
        return { nodeId: node.id, title: node.title, rowCount: rows.length, populated: rows.length > 0 && incompleteRowIds.length === 0, incompleteRowIds, totalDurationSeconds: rows.reduce((total, row) => total + (Number.isFinite(row.durationSeconds) && row.durationSeconds > 0 ? row.durationSeconds : 0), 0) };
    });
    return {
        canGenerateStoryboard: Boolean(generationContext), blockingReason,
        style: { ready: styleReady, nodeId: styleNode?.id, presetId: styleNode?.metadata?.stylePresetId, title: styleNode?.title },
        storyboards,
        nextActions: [
            ...(!styleReady ? [styleNode ? "项目画风配置不完整，请重新设置画风后再生成分镜。" : "可以直接按剧情生成分镜；如需统一项目画风，可选用 canvas_list_styles 和 canvas_apply_style 设置。"] : []),
            ...(storyboards.some((item) => !item.populated) ? ["先 canvas_read_storyboard 读取真实行 ID，再 canvas_edit_storyboard 更新空行并按需新增镜头；正文或标题不代表已填充分镜表。"] : []),
        ],
    };
}
