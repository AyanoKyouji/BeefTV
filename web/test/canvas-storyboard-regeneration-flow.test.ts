import { beforeEach, expect, mock, test } from "bun:test";
import * as react from "react";
import * as antd from "antd";
import * as config from "@/stores/use-config-store";
import { createStoryboardRow } from "@/lib/canvas/canvas-project-domain";
import { deriveStoryboardPipelineProgress } from "@/lib/canvas/canvas-storyboard-progress";
import { storyboardMediaParameters } from "@/lib/canvas/canvas-storyboard-models";
import { buildGenerationConfig } from "@/lib/canvas/canvas-generation-config";
import { CanvasNodeType, type CanvasNodeData, type CanvasConnection, type CanvasGenerationBatch } from "@/types/canvas";

let confirmations: any[] = [];
const effectiveConfig: config.AiConfig = { ...config.defaultConfig, model: "text", imageModel: "flux", videoModel: "minimax-h3",
    channels: [{ id: "test", name: "Test", baseUrl: "https://example.test", apiKey: "fixture", apiFormat: "openai", models: ["flux", "image-node-model", "minimax-h3", "video-node-model"],
        modelProfiles: [{ model: "flux", capability: "image" }, { model: "image-node-model", capability: "image" }, { model: "minimax-h3", capability: "video" }, { model: "video-node-model", capability: "video" }] }] };
mock.module("react", () => ({ ...react, useCallback: (callback: unknown) => callback, useEffect() {}, useRef: (value: unknown) => ({ current: value }) }));
mock.module("antd", () => ({ ...antd, App: { useApp: () => ({ message: { success() {}, info() {}, warning() {}, error() {} }, modal: { confirm: (options: unknown) => confirmations.push(options) } }) } }));
mock.module("@/stores/use-config-store", () => ({ ...config, useEffectiveConfig: () => effectiveConfig, useConfigStore: (select: any) => select({ isAiConfigReady: () => true }) }));
const { useCanvasStoryboard } = await import("@/pages/canvas/use-canvas-storyboard");
const { useCanvasBatchTable } = await import("@/pages/canvas/use-canvas-batch-table");
beforeEach(() => { confirmations = []; });

function mount(reserveBatches = false) {
    const row = createStoryboardRow(1, { id: "shot", plotDescription: "女孩微笑", imageNodeId: "image", videoNodeId: "video" });
    const rows = [row, createStoryboardRow(2, { id: "untouched", plotDescription: "其他镜头" })];
    const node = (id: string, type: CanvasNodeData["type"]): CanvasNodeData => ({ id, type, title: id, position: { x: 100, y: 100 }, width: 300, height: 200,
        metadata: { content: `old-${id}`, status: "success", taskId: `old-${id}-task`, taskStatus: "succeeded", model: id === "image" ? "flux" : "minimax-h3" } });
    const script = { ...node("script", CanvasNodeType.Script), metadata: { storyboard: { rows, visibleColumns: [] } } };
    const nodesRef = { current: [script, node("image", CanvasNodeType.Image), node("video", CanvasNodeType.Video)] };
    const connectionsRef = { current: [] as CanvasConnection[] };
    const queued: any[] = [];
    const api = useCanvasStoryboard({ projectId: "canvas", addedSkills: [], nodesRef, connectionsRef, setNodes: (next) => { nodesRef.current = typeof next === "function" ? next(nodesRef.current) : next; },
        setConnections: (next) => { connectionsRef.current = typeof next === "function" ? next(connectionsRef.current) : next; }, setSelectedNodeIds() {},
        enqueueGenerationBatch: (...args) => {
            queued.push(args);
            if (reserveBatches) nodesRef.current[0].metadata!.generationBatches = [...(nodesRef.current[0].metadata!.generationBatches || []), {
                id: `batch-${queued.length}`, sourceNodeId: args[0], projectId: "canvas", mode: args[1], status: "queued", createdAt: "", updatedAt: "",
                items: args[2].map((target, index) => ({ ...target, id: `item-${queued.length}-${index}`, status: "waiting", retryCount: 0 })),
            } as CanvasGenerationBatch];
            return "new-batch";
        } });
    return { api, nodesRef, connectionsRef, queued, row: () => nodesRef.current[0].metadata!.storyboard!.rows[0] };
}

test("regeneration starts directly without a confirmation dialog", async () => {
    const h = mount();
    await h.api.generateScriptImages("script", ["shot"], true);
    expect(confirmations).toEqual([]);
    expect(h.queued).toHaveLength(1);
    expect(h.nodesRef.current.find(node => node.id === "image")?.metadata?.content).toBe("old-image");
});

for (const mode of ["image", "direct-video", "keyframe-video"] as const) {
    test(`${mode} regeneration queues a fresh bound target and retains the old result`, async () => {
        const h = mount(); const oldNodes = structuredClone(h.nodesRef.current.slice(1));
        const pending = mode === "image" ? h.api.generateScriptImages("script", ["shot"], true)
            : mode === "direct-video" ? h.api.createAndGenerateScriptVideos("script", ["shot"], true) : h.api.generateScriptVideos("script", ["shot"], true);
        await pending;
        expect(confirmations).toEqual([]);
        expect(h.queued).toHaveLength(1);
        expect(h.queued[0][2]).toHaveLength(1);
        const targetId = h.queued[0][2][0].nodeId;
        const target = h.nodesRef.current.find(node => node.id === targetId)!;
        expect(target.metadata?.taskId).toBeUndefined();
        expect(target.metadata?.content).toBeUndefined();
        expect(target.metadata?.status).toBe("idle");
        expect(mode === "image" ? h.row().imageNodeId : h.row().videoNodeId).toBe(targetId);
        expect(mode === "image" ? h.row().videoNodeId : h.row().imageNodeId).toBe(mode === "image" ? "video" : "image");
        expect(h.nodesRef.current.filter(node => oldNodes.some(old => old.id === node.id))).toEqual(oldNodes);
        expect(h.nodesRef.current[0].metadata!.storyboard!.rows[1].imageNodeId).toBeUndefined();
        if (mode === "keyframe-video") {
            expect(target.metadata?.videoStartFrameNodeId).toBe("image");
            expect(target.metadata?.videoEditOperation).toBe("image_to_video");
        }
        // Deliver the new attempt: only the bound target counts toward current progress.
        target.metadata = { ...target.metadata, content: "new-result", status: "success" };
        const progress = deriveStoryboardPipelineProgress(h.nodesRef.current[0], h.nodesRef.current, h.connectionsRef.current);
        expect(mode === "image" ? progress.rows[0].imageNode?.metadata?.content : progress.rows[0].videoNode?.metadata?.content).toBe("new-result");
        if (mode !== "image") expect(progress.successfulVideoNodeIds).toEqual([targetId]);
    });
}

test("fill-missing does not resubmit completed images or either video path", async () => {
    const h = mount();
    await h.api.generateScriptImages("script", ["shot"]);
    await h.api.createAndGenerateScriptVideos("script", ["shot"]);
    await h.api.generateScriptVideos("script", ["shot"]);
    expect(confirmations).toEqual([]); expect(h.queued).toEqual([]);
});
test("concurrent duplicate clicks only enqueue one task without a dialog", async () => {
    const h = mount();
    const first = h.api.generateScriptImages("script", ["shot"], true);
    const second = h.api.generateScriptImages("script", ["shot"], true);
    await Promise.all([first, second]);
    expect(confirmations).toEqual([]);
    expect(h.queued).toHaveLength(1);
});
test("the storyboard selection overrides a previous output's model", async () => {
    const h = mount();
    h.nodesRef.current.find(node => node.id === "image")!.metadata!.model = "image-node-model";
    const pending = h.api.generateScriptImages("script", ["shot"], true);
    await pending;
    expect(confirmations).toEqual([]);
    const target = h.nodesRef.current.find(node => node.id === h.row().imageNodeId)!;
    expect(target.metadata?.model).toBe("flux");
});
test("moving nodes before direct submission retains the latest position and shot input", async () => {
    const h = mount();
    const first = h.api.generateScriptImages("script", ["shot"], true);
    h.nodesRef.current[0].position = { x: 900, y: 900 };
    await first;
    expect(h.queued).toHaveLength(1);
    const pending = h.api.generateScriptImages("script", ["shot"], true);
    h.row().plotDescription = "修改后的动作";
    await pending;
    expect(h.queued).toHaveLength(2);
    const target = h.nodesRef.current.find(node => node.id === h.row().imageNodeId)!;
    expect(target.metadata?.prompt).toBe("修改后的动作");
    expect(h.nodesRef.current[0].position).toEqual({ x: 900, y: 900 });
});

for (const mode of ["image", "direct-video", "keyframe-video"] as const) for (const regenerate of [false, true]) {
    test(`${mode} ${regenerate ? "regeneration" : "first generation"} directly queues the storyboard's selected model`, async () => {
        const h = mount();
        const beforeConfig = structuredClone(effectiveConfig);
        const metadata = h.nodesRef.current[0].metadata!;
        metadata.storyboardImageModel = "test::image-node-model";
        metadata.storyboardVideoModel = "test::video-node-model";
        const old = h.nodesRef.current.find(node => node.id === (mode === "image" ? "image" : "video"))!;
        old.metadata!.size = "old-model-size";
        old.metadata!.quality = "old-model-quality";
        if (!regenerate) {
            delete old.metadata!.content; delete old.metadata!.storageKey;
            delete old.metadata!.taskId; delete old.metadata!.taskStatus;
            old.metadata!.status = "idle";
        }
        const selected = mode === "image" ? metadata.storyboardImageModel : metadata.storyboardVideoModel;
        const pending = mode === "image" ? h.api.generateScriptImages("script", ["shot"], regenerate)
            : mode === "direct-video" ? h.api.createAndGenerateScriptVideos("script", ["shot"], regenerate) : h.api.generateScriptVideos("script", ["shot"], regenerate);
        await pending;
        expect(confirmations).toEqual([]);
        expect(h.queued).toHaveLength(1);
        const target = h.nodesRef.current.find(node => node.id === h.queued[0][2][0].nodeId)!;
        expect(target.metadata?.model).toBe(selected);
        expect(target.metadata?.size).not.toBe("old-model-size");
        expect(target.metadata?.quality).not.toBe("old-model-quality");
        expect(effectiveConfig).toEqual(beforeConfig);
        expect(JSON.parse(JSON.stringify(h.nodesRef.current[0])).metadata.storyboardImageModel).toBe(metadata.storyboardImageModel);
        expect(JSON.parse(JSON.stringify(h.nodesRef.current[0])).metadata.storyboardVideoModel).toBe(metadata.storyboardVideoModel);
    });
}
test("direct submission reads the latest selected model", async () => {
    const h = mount();
    const pending = h.api.generateScriptImages("script", ["shot"], true);
    h.nodesRef.current[0].metadata!.storyboardImageModel = "test::image-node-model";
    await pending;
    expect(h.queued).toHaveLength(1);
    expect(h.nodesRef.current.find(node => node.id === h.row().imageNodeId)?.metadata?.model).toBe("test::image-node-model");
    expect(confirmations).toEqual([]);
});
test("unavailable selections do not silently fall back to another model", async () => {
    for (const kind of ["image", "video"] as const) {
        const h = mount();
        h.nodesRef.current[0].metadata![kind === "image" ? "storyboardImageModel" : "storyboardVideoModel"] = "removed-model";
        if (kind === "image") await h.api.generateScriptImages("script", ["shot"], true);
        else { await h.api.createAndGenerateScriptVideos("script", ["shot"], true); await h.api.generateScriptVideos("script", ["shot"], true); }
        expect(h.queued).toEqual([]);
        expect(confirmations).toEqual([]);
    }
});
test("batch fill-missing uses the chosen model and leaves finished shots untouched", async () => {
    const h = mount();
    h.nodesRef.current[0].metadata!.storyboardImageModel = "test::image-node-model";
    const before = structuredClone(h.nodesRef.current.find(node => node.id === "image"));
    const pending = h.api.generateScriptImages("script", ["shot", "untouched"]);
    await pending;
    expect(h.queued[0][2]).toHaveLength(1);
    expect(h.queued[0][2][0].rowId).toBe("untouched");
    expect(h.nodesRef.current.find(node => node.id === h.queued[0][2][0].nodeId)?.metadata?.model).toBe("test::image-node-model");
    expect(h.nodesRef.current.find(node => node.id === "image")).toEqual(before);
    expect(h.row().imageNodeId).toBe("image");
});

test("batch creation starts directly and collapses simultaneous clicks", async () => {
    const h = mount();
    h.nodesRef.current.push({ id: "batch", type: CanvasNodeType.BatchTable, title: "批量创作", position: { x: 0, y: 0 }, width: 600, height: 400,
        metadata: { batchTable: { operation: "creative", concurrency: 2, rows: [{ id: "row", enabled: true, inputNodeIds: ["image"], prompt: "生成场景" }] } } });
    const batch = useCanvasBatchTable({ nodesRef: h.nodesRef, connectionsRef: h.connectionsRef,
        setNodes: next => { h.nodesRef.current = typeof next === "function" ? next(h.nodesRef.current) : next; },
        setConnections: next => { h.connectionsRef.current = typeof next === "function" ? next(h.connectionsRef.current) : next; },
        setSelectedNodeIds() {}, enqueueGenerationBatch: (...args) => { h.queued.push(args); return "batch-id"; } });
    await Promise.all([batch.generateRows("batch"), batch.generateRows("batch")]);
    expect(confirmations).toEqual([]);
    expect(h.queued).toHaveLength(1);
    expect(h.queued[0][1]).toBe("batch_image");
    expect(h.queued[0][2]).toHaveLength(1);
});

for (const mode of ["image", "direct-video", "keyframe-video"] as const) for (const regenerate of [false, true]) {
    test(`${mode} ${regenerate ? "regeneration" : "first generation"} applies script parameters through request configuration`, async () => {
        const h = mount();
        const beforeConfig = structuredClone(effectiveConfig);
        const script = h.nodesRef.current[0];
        script.metadata!.storyboardImageSettings = { size: "16:9", quality: "high", transparentBackground: "false" };
        script.metadata!.storyboardVideoSettings = { size: "9:16", seconds: "5", vquality: "1080", generateAudio: "false", watermark: "false", videoH3Options: { seed: 42, prompt_expansion_mode: "disabled" } };
        const kind = mode === "image" ? "image" : "video";
        const old = h.nodesRef.current.find(node => node.id === kind)!;
        const original = structuredClone(old);
        if (!regenerate) { old.metadata = { model: old.metadata!.model, status: "idle", size: "stale-size", vquality: "480", seconds: "10" }; }
        if (kind === "image") await h.api.generateScriptImages("script", ["shot"], regenerate);
        else if (mode === "direct-video") await h.api.createAndGenerateScriptVideos("script", ["shot"], regenerate);
        else await h.api.generateScriptVideos("script", ["shot"], regenerate);
        expect(h.queued).toHaveLength(1);
        const target = h.nodesRef.current.find(node => node.id === h.queued[0][2][0].nodeId)!;
        expect(target.metadata).toMatchObject(storyboardMediaParameters(effectiveConfig, script, kind, h.row().durationSeconds));
        const request = buildGenerationConfig(effectiveConfig, target, kind);
        if (kind === "image") {
            expect(request.size).toBe("16:9");
            expect(request.quality).toBe("high");
            expect(request.count).toBe("1");
        } else {
            expect(request.size).toBe("9:16"); expect(request.videoSeconds).toBe("5"); expect(request.vquality).toBe("1080");
            expect(target.metadata?.videoH3Options?.seed).toBe(42);
            expect(h.row().durationSeconds).not.toBe(5);
        }
        if (regenerate) expect(h.nodesRef.current.find(node => node.id === kind)).toEqual(original);
        expect(effectiveConfig).toEqual(beforeConfig);
        expect(confirmations).toEqual([]);
    });
}

test("new batch targets receive selected parameters without changing completed outputs", async () => {
    const h = mount();
    h.nodesRef.current[0].metadata!.storyboardImageSettings = { size: "9:16", quality: "high" };
    const before = structuredClone(h.nodesRef.current.find(node => node.id === "image"));
    await h.api.generateScriptImages("script", ["shot", "untouched"]);
    expect(h.queued[0][2]).toHaveLength(1);
    const target = h.nodesRef.current.find(node => node.id === h.queued[0][2][0].nodeId)!;
    expect(target.metadata).toMatchObject({ size: "9:16", quality: "high", count: 1 });
    expect(h.nodesRef.current.find(node => node.id === "image")).toEqual(before);
});

for (const keyframe of [false, true]) test(`${keyframe ? "keyframe" : "direct"} video batch creates new targets with live script parameters`, async () => {
    const h = mount();
    delete h.row().videoNodeId;
    const pending = keyframe ? h.api.generateScriptVideos("script", ["shot"]) : h.api.createAndGenerateScriptVideos("script", ["shot"]);
    h.nodesRef.current[0].metadata!.storyboardVideoSettings = { vquality: "1080", size: "9:16", seconds: "5" };
    await pending;
    expect(h.queued).toHaveLength(1);
    const target = h.nodesRef.current.find(node => node.id === h.queued[0][2][0].nodeId)!;
    expect(target.metadata).toMatchObject({ vquality: "1080", size: "9:16", seconds: "5" });
    expect(h.nodesRef.current.find(node => node.id === "video")?.metadata?.content).toBe("old-video");
});

for (const kind of ["image", "video"] as const) test(`simultaneous ${kind} clicks on different shots each enqueue and preserve all batches`, async () => {
    const h = mount(true);
    const generate = kind === "image" ? h.api.generateScriptImages : h.api.createAndGenerateScriptVideos;
    await Promise.all([generate("script", ["shot"], true), generate("script", ["untouched"], true)]);
    expect(h.queued).toHaveLength(2);
    expect(h.queued.map(args => args[2][0].rowId)).toEqual(["shot", "untouched"]);
    expect(h.nodesRef.current[0].metadata?.generationBatches).toHaveLength(2);
    expect(new Set(h.queued.map(args => args[2][0].nodeId)).size).toBe(2);
});

test("image and direct video on the same shot enqueue independently", async () => {
    const h = mount(true);
    await Promise.all([h.api.generateScriptImages("script", ["shot"], true), h.api.createAndGenerateScriptVideos("script", ["shot"], true)]);
    expect(h.queued.map(args => args[1])).toEqual(["storyboard_image", "storyboard_video"]);
    expect(h.nodesRef.current[0].metadata?.generationBatches).toHaveLength(2);
    expect(h.queued[0][2][0].nodeId).toBe(h.row().imageNodeId);
    expect(h.queued[1][2][0].nodeId).toBe(h.row().videoNodeId);
});

test("an image job on another shot does not block a ready first-frame video", async () => {
    const h = mount(true);
    await Promise.all([h.api.generateScriptImages("script", ["untouched"]), h.api.generateScriptVideos("script", ["shot"], true)]);
    expect(h.queued.map(args => args[1])).toEqual(["storyboard_image", "storyboard_video"]);
    const target = h.nodesRef.current.find(node => node.id === h.row().videoNodeId)!;
    expect(target.metadata?.videoStartFrameNodeId).toBe("image");
});

test("overlapping batch selections skip already-reserved targets without dropping other shots", async () => {
    const h = mount(true);
    await Promise.all([h.api.generateScriptImages("script", ["shot"], true), h.api.generateScriptImages("script", ["untouched", "shot"], true)]);
    expect(h.queued).toHaveLength(2);
    expect(h.queued.flatMap(args => args[2].map((target: any) => target.rowId))).toEqual(["shot", "untouched"]);
    await h.api.generateScriptImages("script", ["shot"], true);
    expect(h.queued).toHaveLength(2);
});

test("ready first-frame videos on different shots can be clicked together", async () => {
    const h = mount(true);
    const secondImage = { ...h.nodesRef.current.find(node => node.id === "image")!, id: "second-image" };
    h.nodesRef.current.push(secondImage);
    h.nodesRef.current[0].metadata!.storyboard!.rows[1].imageNodeId = secondImage.id;
    await Promise.all([h.api.generateScriptVideos("script", ["shot"], true), h.api.generateScriptVideos("script", ["untouched"])]);
    expect(h.queued).toHaveLength(2);
    const targets = h.queued.map(args => h.nodesRef.current.find(node => node.id === args[2][0].nodeId)!);
    expect(targets.map(node => node.metadata?.videoStartFrameNodeId)).toEqual(["image", "second-image"]);
});

test("switching video modes cannot double-submit the same shot", async () => {
    const h = mount(true);
    await Promise.all([h.api.createAndGenerateScriptVideos("script", ["shot"], true), h.api.generateScriptVideos("script", ["shot"], true)]);
    expect(h.queued).toHaveLength(1);
    expect(h.queued[0][1]).toBe("storyboard_video");
});
