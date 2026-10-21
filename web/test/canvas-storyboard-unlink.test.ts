import { expect, test } from "bun:test";
import { createCanvasNode, createStoryboardRow, detachNodeFromStoryboardRow } from "../src/lib/canvas/canvas-project-domain";
import { CanvasNodeType, type CanvasConnection } from "../src/types/canvas";

const image = createCanvasNode(CanvasNodeType.Image, { x: 500, y: 0 }, { assetId: "existing", storageKey: "resource:existing", taskId: "original-task" });
const row = { ...createStoryboardRow(1), imageNodeId: image.id, videoNodeId: "video", assetBindings: [{ nodeId: image.id, role: "prop" as const }] };
const other = { ...createStoryboardRow(2), imageNodeId: image.id };
const script = createCanvasNode(CanvasNodeType.Script, { x: 0, y: 0 }, { storyboard: { rows: [row, other], visibleColumns: [], referenceNodeIds: [image.id] } });
const nodes = [script, image];
const output: CanvasConnection = { id: "output", fromNodeId: script.id, toNodeId: image.id, fromHandleId: `row:${row.id}`, relation: "storyboard-output", storyboardRowId: row.id };
const rows = (result: typeof nodes) => result[0].metadata!.storyboard!.rows;

test("unlinking a shot output clears only that ownership and retains media and incoming references", () => {
    const result = detachNodeFromStoryboardRow(nodes, output, []);
    expect(rows(result)[0].imageNodeId).toBeUndefined();
    expect(rows(result)[0].videoNodeId).toBe("video");
    expect(rows(result)[0].assetBindings).toEqual(row.assetBindings);
    expect(rows(result)[1]).toBe(other);
    expect(result[1]).toBe(image);
    expect(row.imageNodeId).toBe(image.id);
});
test("manual row wires without a managed relation also clear their ownership", () => {
    expect(rows(detachNodeFromStoryboardRow(nodes, { ...output, relation: undefined, storyboardRowId: undefined }, []))[0].imageNodeId).toBeUndefined();
});
test("an equivalent remaining connection keeps the association", () => {
    expect(detachNodeFromStoryboardRow(nodes, output, [{ ...output, id: "duplicate" }])).toBe(nodes);
});
test("removing an older output wire cannot clear a newly chosen target", () => {
    expect(rows(detachNodeFromStoryboardRow(nodes, { ...output, toNodeId: "old-image" }, []))[0]).toBe(row);
});
test("unlinking an incoming row reference removes that binding but keeps outputs and other rows", () => {
    const edge: CanvasConnection = { id: "reference", fromNodeId: image.id, toNodeId: script.id, toHandleId: `row:${row.id}` };
    const result = detachNodeFromStoryboardRow(nodes, edge, []);
    expect(rows(result)[0].assetBindings).toEqual([]);
    expect(rows(result)[0].imageNodeId).toBe(image.id);
    expect(rows(result)[1]).toBe(other);
});
test("unlinking a script context removes only the context reference", () => {
    const edge: CanvasConnection = { id: "context", fromNodeId: image.id, toNodeId: script.id, toHandleId: "storyboard:context" };
    const result = detachNodeFromStoryboardRow(nodes, edge, []);
    expect(result[0].metadata!.storyboard!.referenceNodeIds).toEqual([]);
    expect(rows(result)[0]).toBe(row);
});
test("video output unlink leaves the image and its resource intact", () => {
    const result = detachNodeFromStoryboardRow(nodes, { ...output, toNodeId: "video" }, []);
    expect(rows(result)[0].videoNodeId).toBeUndefined();
    expect(rows(result)[0].imageNodeId).toBe(image.id);
    expect(result[1]).toBe(image);
});
