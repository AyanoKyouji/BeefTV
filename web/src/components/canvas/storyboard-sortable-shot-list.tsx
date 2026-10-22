import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { reorderStoryboardRows } from "@/lib/canvas/canvas-storyboard-order";
import type { StoryboardRow } from "@/types/canvas";

type DropTarget = { id: string; placement: "before" | "after" };
const INTERACTIVE_TARGET = "button, a, input, textarea, select, label, summary, [contenteditable='true'], [role='button'], [role='combobox']";

export function StoryboardSortableShotList({ rows, visibleRows, selectedRowId, onSelect, onUpdateRows, renderRow }: {
    rows: StoryboardRow[];
    visibleRows: StoryboardRow[];
    selectedRowId?: string;
    onSelect: (id: string) => void;
    onUpdateRows: (rows: StoryboardRow[]) => void;
    renderRow: (row: StoryboardRow, select: () => void) => ReactNode;
}) {
    const listRef = useRef<HTMLDivElement>(null);
    const draggedId = useRef<string | null>(null);
    const dragCandidateId = useRef<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
    const [announcement, setAnnouncement] = useState("");
    useEffect(() => { listRef.current?.focus({ preventScroll: true }); }, []);
    const clearDrag = () => { draggedId.current = null; dragCandidateId.current = null; setDraggingId(null); setDropTarget(null); };
    const move = (sourceId: string, target: DropTarget) => {
        const next = reorderStoryboardRows(rows, sourceId, target.id, target.placement);
        if (next !== rows) {
            onUpdateRows(next);
            onSelect(sourceId);
            setAnnouncement(`镜头已移动到第 ${next.findIndex((row) => row.id === sourceId) + 1} 位`);
        }
    };
    const targetAt = (event: DragEvent<HTMLDivElement>, id: string): DropTarget => {
        const bounds = event.currentTarget.getBoundingClientRect();
        return { id, placement: event.clientY < bounds.top + bounds.height / 2 ? "before" : "after" };
    };
    return (
        <div ref={listRef} tabIndex={0} aria-label="可排序分镜列表" aria-describedby="storyboard-sort-help"
            className="space-y-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            onClickCapture={(event) => {
                if (event.target instanceof Element && event.currentTarget.contains(event.target) && !event.target.closest(INTERACTIVE_TARGET)) listRef.current?.focus({ preventScroll: true });
            }}
            onKeyDown={(event) => {
                if (event.key === "Escape" && draggingId) { event.preventDefault(); event.stopPropagation(); clearDrag(); return; }
                if (!selectedRowId || draggingId || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                if (event.target instanceof Element && event.target !== event.currentTarget && event.target.closest(INTERACTIVE_TARGET)) return;
                event.preventDefault();
                event.stopPropagation();
                const index = rows.findIndex((row) => row.id === selectedRowId);
                const target = rows[index + (event.key === "ArrowUp" ? -1 : 1)];
                if (index >= 0 && target) move(selectedRowId, { id: target.id, placement: event.key === "ArrowUp" ? "before" : "after" });
            }}>
            <p id="storyboard-sort-help" className="text-xs text-foreground/55">选中镜头后，按住左键拖动排序，或按 ↑ / ↓ 移动一位。松开鼠标放置，Esc 取消拖动。</p>
            <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
            {visibleRows.map((row) => (
                <div key={row.id} className={`relative h-44 ${draggingId === row.id ? "opacity-50" : ""}`}
                    draggable={row.id === selectedRowId}
                    onPointerDownCapture={(event) => {
                        dragCandidateId.current = event.button === 0 && row.id === selectedRowId && event.target instanceof Element && event.currentTarget.contains(event.target) && !event.target.closest(INTERACTIVE_TARGET) ? row.id : null;
                    }}
                    onDragStart={(event) => {
                        event.stopPropagation();
                        if (row.id !== selectedRowId || dragCandidateId.current !== row.id) { event.preventDefault(); return; }
                        draggedId.current = row.id;
                        setDraggingId(row.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("application/x-yuntv-storyboard-row", row.id);
                        listRef.current?.focus({ preventScroll: true });
                    }}
                    onDragOver={(event) => {
                        if (!draggedId.current) return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "move";
                        const next = targetAt(event, row.id);
                        setDropTarget((current) => current?.id === next.id && current.placement === next.placement ? current : next);
                    }}
                    onDragLeave={(event) => {
                        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
                        setDropTarget((current) => current?.id === row.id ? null : current);
                    }}
                    onDrop={(event) => {
                        if (!draggedId.current) return;
                        event.preventDefault();
                        event.stopPropagation();
                        move(draggedId.current, targetAt(event, row.id));
                        clearDrag();
                        listRef.current?.focus({ preventScroll: true });
                    }}
                    onDragEnd={(event) => { event.stopPropagation(); clearDrag(); listRef.current?.focus({ preventScroll: true }); }}>
                    {dropTarget?.id === row.id && draggingId !== row.id ? <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-primary ${dropTarget.placement === "before" ? "-top-1.5" : "-bottom-1.5"}`} /> : null}
                    {renderRow(row, () => { onSelect(row.id); listRef.current?.focus({ preventScroll: true }); })}
                </div>
            ))}
            {!visibleRows.length ? <p className="py-8 text-center text-sm text-foreground/50">没有匹配的镜头，请更换筛选条件。</p> : null}
        </div>
    );
}
