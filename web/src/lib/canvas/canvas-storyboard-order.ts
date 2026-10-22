import type { StoryboardRow } from "@/types/canvas";

export function reorderStoryboardRows(rows: StoryboardRow[], sourceId: string, targetId: string, placement: "before" | "after"): StoryboardRow[] {
    const source = rows.find((row) => row.id === sourceId);
    if (!source || sourceId === targetId || !rows.some((row) => row.id === targetId)) return rows;
    const next = rows.filter((row) => row.id !== sourceId);
    const index = next.findIndex((row) => row.id === targetId);
    next.splice(index + (placement === "after" ? 1 : 0), 0, source);
    if (next.every((row, rowIndex) => row.id === rows[rowIndex].id)) return rows;
    return next.map((row, rowIndex) => ({ ...row, shotNumber: rowIndex + 1 }));
}
