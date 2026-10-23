import { isCanvasNodeGenerating } from "@/lib/canvas/canvas-node-task-state";
import type { CanvasGenerationBatchItem, CanvasNodeData } from "@/types/canvas";

export function storyboardSubmissionKey(nodeId: string, kind: "image" | "video", rowIds?: string[]) {
    return JSON.stringify([nodeId, kind, rowIds ? [...new Set(rowIds)].sort() : "all"]);
}

export function storyboardMediaBatchItem(script: CanvasNodeData, nodeId: string | undefined, kind: "image" | "video") {
    if (!nodeId) return undefined;
    const batches = script.metadata?.generationBatches || [];
    for (let index = batches.length - 1; index >= 0; index--) {
        if (batches[index].mode !== `storyboard_${kind}`) continue;
        const item = batches[index].items.find(item => item.nodeId === nodeId);
        if (item) return item;
    }
}

export function storyboardMediaBusy(node: CanvasNodeData | undefined, item?: CanvasGenerationBatchItem) {
    // A delivered result wins over a batch receipt that has not reconciled yet.
    if (node?.metadata?.status === "success" && (node.metadata.content || node.metadata.storageKey)) return false;
    return isCanvasNodeGenerating(node)
        || node?.metadata?.status === "loading"
        || ["submitting", "unknown"].includes(node?.metadata?.generationSubmissionState || "")
        || Boolean(item?.submissionUncertain)
        || ["waiting", "submitting", "queued", "running"].includes(item?.status || "");
}
