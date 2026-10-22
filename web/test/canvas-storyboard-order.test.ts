import { describe, expect, test } from "bun:test";
import { reorderStoryboardRows } from "@/lib/canvas/canvas-storyboard-order";
import { createStoryboardRow } from "@/lib/canvas/canvas-project-domain";

const rows = ["a", "b", "c", "d"].map((id, index) => createStoryboardRow(index + 1, {
    id, imageNodeId: `image-${id}`, videoNodeId: `video-${id}`, plotDescription: `画面 ${id}`,
    assetBindings: [{ nodeId: `reference-${id}`, role: "character", priority: 1 }],
}));
const ids = (items: typeof rows) => items.map((row) => row.id);

describe("storyboard reordering", () => {
    test("can move a shot multiple places before or after a target", () => {
        expect(ids(reorderStoryboardRows(rows, "a", "c", "after"))).toEqual(["b", "c", "a", "d"]);
        expect(ids(reorderStoryboardRows(rows, "d", "b", "before"))).toEqual(["a", "d", "b", "c"]);
    });
    test("keeps assets, content and stable identity while renumbering", () => {
        const next = reorderStoryboardRows(rows, "d", "a", "before");
        expect(next.map((row) => row.shotNumber)).toEqual([1, 2, 3, 4]);
        for (const row of next) {
            const original = rows.find((item) => item.id === row.id)!;
            expect(row.imageNodeId).toBe(original.imageNodeId);
            expect(row.videoNodeId).toBe(original.videoNodeId);
            expect(row.assetBindings).toBe(original.assetBindings);
            expect(row.plotDescription).toBe(original.plotDescription);
        }
        expect(ids(rows)).toEqual(["a", "b", "c", "d"]);
    });
    test("up/down operations can be reversed without changing bindings", () => {
        const up = reorderStoryboardRows(rows, "c", "b", "before");
        const restored = reorderStoryboardRows(up, "c", "b", "after");
        expect(restored).toEqual(rows);
    });
    test("dropping on the same shot or its current boundary does not write a new order", () => {
        expect(reorderStoryboardRows(rows, "b", "b", "before")).toBe(rows);
        expect(reorderStoryboardRows(rows, "b", "a", "after")).toBe(rows);
        expect(reorderStoryboardRows(rows, "b", "c", "before")).toBe(rows);
    });
    test("a source or destination removed during dragging cannot reorder remaining shots", () => {
        const withoutB = rows.filter((row) => row.id !== "b");
        expect(reorderStoryboardRows(withoutB, "b", "a", "before")).toBe(withoutB);
        expect(reorderStoryboardRows(withoutB, "c", "b", "after")).toBe(withoutB);
    });
    test("placing relative to a filtered visible target preserves all other shots", () => {
        expect(ids(reorderStoryboardRows(rows, "d", "a", "after"))).toEqual(["a", "d", "b", "c"]);
    });
});
