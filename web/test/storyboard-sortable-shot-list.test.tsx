import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { createStoryboardRow } from "@/lib/canvas/canvas-project-domain";
import type { StoryboardRow } from "@/types/canvas";

let slots: any[] = [];
let cursor = 0;
mock.module("react", () => ({
    useEffect: () => {},
    useRef: (value: unknown) => { const index = cursor++; return slots[index] ??= { current: value }; },
    useState: (value: unknown) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = value;
        return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
}));
const { StoryboardSortableShotList } = await import("@/components/canvas/storyboard-sortable-shot-list");
const originalElement = globalThis.Element;
class Target {
    constructor(readonly interactive = false) {}
    contains() { return true; }
    closest() { return this.interactive ? this : null; }
    getBoundingClientRect() { return { top: 0, height: 176 }; }
}
beforeEach(() => { slots = []; cursor = 0; (globalThis as any).Element = Target; });
afterEach(() => { if (originalElement) globalThis.Element = originalElement; else delete (globalThis as any).Element; });

function mount() {
    let rows = ["a", "b", "c"].map((id, index) => createStoryboardRow(index + 1, { id, imageNodeId: `image-${id}` }));
    let selectedRowId = "b";
    let writes = 0;
    const render = () => {
        cursor = 0;
        const element = StoryboardSortableShotList({ rows, visibleRows: rows, selectedRowId, onSelect: (id) => { selectedRowId = id; }, onUpdateRows: (next) => { rows = next; writes++; }, renderRow: () => null }) as any;
        element.props.ref.current = { focus: () => {} };
        return { root: element.props, row: (id: string) => element.props.children[2].find((child: any) => child.key === id).props };
    };
    return { render, rows: () => rows, writes: () => writes, edit: (updater: (rows: StoryboardRow[]) => StoryboardRow[]) => { rows = updater(rows); } };
}
function dragEvent(interactive = false) {
    return { button: 0, target: new Target(interactive), currentTarget: new Target(), clientY: 10,
        prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {},
        dataTransfer: { effectAllowed: "", dropEffect: "", setData() {} },
    };
}
function start(board: ReturnType<typeof mount>, id = "b", interactive = false) {
    const row = board.render().row(id);
    const event = dragEvent(interactive);
    row.onPointerDownCapture(event);
    row.onDragStart(event);
    return event;
}

test("dragging does not persist until drop, then preserves the selected shot's latest media", () => {
    const board = mount();
    start(board);
    board.render().row("a").onDragOver(dragEvent());
    expect(board.writes()).toBe(0);
    board.edit((rows) => rows.map((row) => row.id === "b" ? { ...row, imageNodeId: "latest-image-b" } : row));
    board.render().row("a").onDrop(dragEvent());
    expect(board.rows().map((row) => row.id)).toEqual(["b", "a", "c"]);
    expect(board.rows()[0].imageNodeId).toBe("latest-image-b");
    expect(board.writes()).toBe(1);
});
test("ending a drag outside the list does not reorder", () => {
    const board = mount();
    start(board);
    board.render().row("b").onDragEnd(dragEvent());
    expect(board.writes()).toBe(0);
    expect(board.rows().map((row) => row.id)).toEqual(["a", "b", "c"]);
});
test("buttons and unselected shots cannot start a reorder drag", () => {
    const board = mount();
    expect(start(board, "b", true).prevented).toBe(true);
    expect(start(board, "a").prevented).toBe(true);
    expect(board.writes()).toBe(0);
});
test("Escape clears a pending drag so a later drop cannot commit it", () => {
    const board = mount();
    start(board);
    let consumed = 0;
    board.render().root.onKeyDown({ key: "Escape", preventDefault() { consumed++; }, stopPropagation() { consumed++; } });
    board.render().row("a").onDrop(dragEvent());
    expect(board.writes()).toBe(0);
    expect(consumed).toBe(2);
});
test("arrows reorder only when the list owns keyboard input", () => {
    const board = mount();
    const keyEvent = (interactive: boolean) => ({ key: "ArrowUp", target: new Target(interactive), currentTarget: new Target(), nativeEvent: {}, preventDefault() {}, stopPropagation() {} });
    board.render().root.onKeyDown(keyEvent(true));
    expect(board.writes()).toBe(0);
    board.render().root.onKeyDown(keyEvent(false));
    expect(board.rows().map((row) => row.id)).toEqual(["b", "a", "c"]);
    board.render().root.onKeyDown(keyEvent(false));
    expect(board.writes()).toBe(1);
});
