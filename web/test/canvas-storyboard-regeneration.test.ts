import { expect, test } from "bun:test";
import { createStoryboardRow } from "@/lib/canvas/canvas-project-domain";
import { createStoryboardRegenerationNode, storyboardGenerationRows } from "@/lib/canvas/canvas-storyboard-regeneration";
import { CanvasNodeType, type CanvasGenerationBatch, type CanvasNodeData } from "@/types/canvas";

const media: CanvasNodeData = { id: "image", type: CanvasNodeType.Image, title: "分镜图", position: { x: 0, y: 0 }, width: 300, height: 200,
    metadata: { content: "old-image", storageKey: "old-storage", assetId: "old-asset", previewContent: "old-preview", status: "success", taskId: "old-task", taskStatus: "succeeded", model: "flux", size: "16:9", generationEffectKeys: ["old-effect"], isBatchRoot: true, batchChildIds: ["old-child"], naturalWidth: 1360 } };
const rows = [createStoryboardRow(1, { id: "one", imageNodeId: media.id }), createStoryboardRow(2, { id: "two" })];
const script: CanvasNodeData = { ...media, id: "script", type: CanvasNodeType.Script, metadata: { storyboard: { rows, visibleColumns: [] } } };

test("completion only blocks fill-missing, explicit regeneration selects the requested shot", () => {
    expect(storyboardGenerationRows(script, [script, media], ["one", "two"], "image").map(row => row.id)).toEqual(["two"]);
    expect(storyboardGenerationRows(script, [script, media], ["one"], "image", true).map(row => row.id)).toEqual(["one"]);
    expect(storyboardGenerationRows(script, [{ ...media, metadata: { storageKey: "local-image" } }], ["one"], "image")).toEqual([]);
});
test("active nodes and uncertain submissions cannot be regenerated", () => {
    for (const metadata of [{ status: "loading" }, { taskId: "live", taskStatus: "queued" }, { generationSubmissionState: "unknown" }, { generationSubmissionState: "submitting" }]) {
        const node = { ...media, metadata: { ...media.metadata, ...metadata } } as CanvasNodeData;
        expect(storyboardGenerationRows(script, [node], ["one"], "image", true)).toEqual([]);
    }
    const board = { ...script, metadata: { ...script.metadata, generationBatches: [{ items: [{ nodeId: media.id, status: "waiting" }] } as CanvasGenerationBatch] } };
    expect(storyboardGenerationRows(board, [media], ["one"], "image", true)).toEqual([]);
});
test("new targets preserve parameters but cannot inherit old success, receipts or batch ownership", () => {
    const before = structuredClone(media);
    const next = createStoryboardRegenerationNode(media, [media]);
    expect(media).toEqual(before);
    expect(next.id).not.toBe(media.id);
    expect(next.metadata).toMatchObject({ model: "flux", size: "16:9", status: "idle", nodeRole: "generator", generationResultPlacement: "replace-node" });
    for (const field of ["content", "storageKey", "assetId", "previewContent", "taskId", "taskStatus", "generationEffectKeys", "isBatchRoot", "batchChildIds", "naturalWidth"] as const) expect(next.metadata?.[field]).toBeUndefined();
    expect(next.position.x >= media.position.x + media.width || next.position.y >= media.position.y + media.height).toBe(true);
});
