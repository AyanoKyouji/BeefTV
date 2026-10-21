import { nanoid } from "nanoid";

import { storyboardAssetRoleForNode } from "@/lib/canvas/canvas-storyboard-assets";
import { buildOrderedCanvasResourceReferences, canvasResourceMentionToken } from "@/lib/canvas/canvas-resource-references";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type StoryboardAssetBinding, type StoryboardRow } from "@/types/canvas";

export function reconcileStoryboardRowOutputs(scriptId: string, previous: StoryboardRow[], rows: StoryboardRow[], connections: CanvasConnection[]) {
    const before = new Map(previous.map((row) => [row.id, row]));
    const remaining = new Set(rows.map((row) => row.id));
    const removed = new Set(previous.filter((row) => !remaining.has(row.id)).map((row) => row.id));
    const detached = new Map<string, string>();
    const imagePrompt = (row: StoryboardRow) => (row.imageGenerationPrompt || row.plotDescription).trim();
    const nextRows = rows.map((row) => {
        const old = before.get(row.id);
        if (!old?.imageNodeId || row.imageNodeId !== old.imageNodeId || imagePrompt(old) === imagePrompt(row)) return row;
        detached.set(row.id, old.imageNodeId);
        // Keep the task and media node. An old input's output must no longer
        // count as the edited row's current image, even if it completes later.
        return { ...row, imageNodeId: undefined, imageBindingStale: true };
    });
    const nextConnections = connections.filter((edge) => {
        const from = edge.fromNodeId === scriptId, to = edge.toNodeId === scriptId;
        if ((from || to) && edge.storyboardRowId && removed.has(edge.storyboardRowId)) return false;
        if (from && edge.fromHandleId?.startsWith("row:") && removed.has(edge.fromHandleId.slice(4))) return false;
        if (to && edge.toHandleId?.startsWith("row:") && removed.has(edge.toHandleId.slice(4))) return false;
        if (!from) return true;
        const rowId = edge.fromHandleId?.startsWith("row:") ? edge.fromHandleId.slice(4) : edge.storyboardRowId;
        return !rowId || detached.get(rowId) !== edge.toNodeId;
    });
    return { rows: nextRows, connections: nextConnections, detachedCount: detached.size };
}

export function storyboardRowReferenceNodeIds(
    scriptNode: CanvasNodeData,
    row: StoryboardRow,
    nodes: CanvasNodeData[],
    connections: CanvasConnection[],
    includeFirstFrame: boolean,
    targetNodeId?: string,
) {
    const characterAssetIds = new Set((row.characters || []).map((character) => character.characterAssetId).filter((assetId): assetId is string => Boolean(assetId)));
    const characterNodeIds = nodes
        .filter((node) => node.metadata?.workflowKind === "character" && Boolean(node.metadata.characterAssetId) && characterAssetIds.has(node.metadata.characterAssetId!))
        .map((node) => node.id);
    const referenceIds = new Set([
        ...(scriptNode.metadata?.storyboard?.referenceNodeIds || []),
        ...(row.assetBindings || []).map((binding) => binding.nodeId),
        ...characterNodeIds,
        ...connections.filter((connection) => connection.toNodeId === scriptNode.id && connection.toHandleId === `row:${row.id}`).map((connection) => connection.fromNodeId),
        ...(targetNodeId ? connections.filter((connection) => !connection.relation && connection.toNodeId === targetNodeId).map((connection) => connection.fromNodeId) : []),
        ...(includeFirstFrame && row.imageNodeId ? [row.imageNodeId] : []),
    ]);
    if (!includeFirstFrame && row.imageNodeId) referenceIds.delete(row.imageNodeId);
    referenceIds.delete(scriptNode.id);
    return Array.from(referenceIds).filter((nodeId) => nodes.some((node) => node.id === nodeId));
}

export function storyboardComposerContent(prompt: string, referenceNodeIds: string[], nodes: CanvasNodeData[]) {
    const referenceIds = Array.from(new Set(referenceNodeIds));
    const referenceNodes = referenceIds.flatMap((nodeId) => {
        const node = nodes.find((candidate) => candidate.id === nodeId);
        return node ? [node] : [];
    });
    const mentions = buildOrderedCanvasResourceReferences(referenceNodes).map(canvasResourceMentionToken);
    return mentions.length ? [`参考资产：${mentions.join(" ")}`, prompt.trim()].filter(Boolean).join("\n") : prompt.trim();
}

export function reconcileStoryboardTargetConnections(
    connections: CanvasConnection[],
    scriptNode: CanvasNodeData,
    row: StoryboardRow,
    targetNodeId: string,
    referenceNodeIds: string[],
) {
    const desired = new Set(referenceNodeIds.filter((nodeId) => nodeId !== targetNodeId && nodeId !== scriptNode.id));
    const next = connections.filter((connection) => {
        if (connection.storyboardRowId !== row.id || connection.toNodeId !== targetNodeId) return true;
        if (connection.relation === "storyboard-output") return connection.fromNodeId === scriptNode.id;
        if (connection.relation === "storyboard-asset-reference") return desired.has(connection.fromNodeId);
        return true;
    });
    if (!next.some((connection) => connection.fromNodeId === scriptNode.id && connection.toNodeId === targetNodeId && connection.fromHandleId === `row:${row.id}`)) {
        next.push({ id: nanoid(), fromNodeId: scriptNode.id, toNodeId: targetNodeId, fromHandleId: `row:${row.id}`, relation: "storyboard-output", storyboardRowId: row.id });
    }
    desired.forEach((fromNodeId) => {
        if (!next.some((connection) => connection.fromNodeId === fromNodeId && connection.toNodeId === targetNodeId)) {
            next.push({ id: nanoid(), fromNodeId, toNodeId: targetNodeId, relation: "storyboard-asset-reference", storyboardRowId: row.id });
        }
    });
    return next;
}

export function bindingForConnectedNode(node: CanvasNodeData): StoryboardAssetBinding | null {
    const role = storyboardAssetRoleForNode(node);
    return role ? { nodeId: node.id, role, priority: defaultRolePriority(role) } : null;
}

export function isStoryboardPreviewAsset(node: CanvasNodeData) {
    return node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Drawing || node.type === CanvasNodeType.Video || node.type === CanvasNodeType.Audio || node.metadata?.workflowKind === "character";
}

function defaultRolePriority(role: StoryboardAssetBinding["role"]) {
    if (role === "character") return 100;
    if (role === "environment") return 90;
    if (role === "prop" || role === "weapon" || role === "wardrobe") return 80;
    if (role === "motion" || role === "audio") return 70;
    return 60;
}
