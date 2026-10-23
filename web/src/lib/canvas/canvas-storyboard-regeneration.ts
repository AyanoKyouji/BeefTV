import { nanoid } from "nanoid";
import { findAvailableGenerationGroupPosition } from "@/lib/canvas/canvas-generation-layout";
import { isolateCopiedNodeMetadata } from "@/lib/canvas/canvas-node-copy";
import { mediaGeneratorMetadata } from "@/lib/canvas/canvas-node-semantics";
import { isCanvasNodeGenerating } from "@/lib/canvas/canvas-node-task-state";
import { clearInPlaceMediaOutputMetadata } from "@/lib/canvas/canvas-project-generation";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

export function storyboardGenerationRows(script: CanvasNodeData, nodes: CanvasNodeData[], rowIds: string[], kind: "image" | "video", regenerate = false) {
    const activeIds = new Set((script.metadata?.generationBatches || []).flatMap((batch) => batch.items
        .filter((item) => ["waiting", "submitting", "queued", "running"].includes(item.status)).map((item) => item.nodeId)));
    const type = kind === "image" ? CanvasNodeType.Image : CanvasNodeType.Video;
    return (script.metadata?.storyboard?.rows || []).filter((row) => {
        if (!rowIds.includes(row.id)) return false;
        const node = nodes.find((node) => node.id === (kind === "image" ? row.imageNodeId : row.videoNodeId) && node.type === type);
        if (!node) return true;
        if (activeIds.has(node.id) || node.metadata?.status === "loading" || isCanvasNodeGenerating(node) || ["submitting", "unknown"].includes(node.metadata?.generationSubmissionState || "")) return false;
        return regenerate || !hasStoryboardMedia(node);
    });
}

export function hasStoryboardMedia(node: CanvasNodeData) {
    return Boolean(node.metadata?.content || node.metadata?.storageKey);
}

// Each new attempt owns a blank target. Keep the old result and its task intact,
// so batch reconciliation cannot mistake the previous success for this attempt.
export function createStoryboardRegenerationNode(source: CanvasNodeData, nodes: CanvasNodeData[]): CanvasNodeData {
    const now = new Date().toISOString();
    const metadata = mediaGeneratorMetadata(clearInPlaceMediaOutputMetadata(isolateCopiedNodeMetadata(source, new Map()), "idle"));
    delete metadata.generatedFromNodeId;
    delete metadata.fileUpload;
    return {
        ...source, id: nanoid(), createdAt: now, updatedAt: now, metadata,
        position: findAvailableGenerationGroupPosition(nodes, { x: source.position.x + source.width + 96, y: source.position.y }, source),
    };
}
