import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StoryboardShotCard } from "@/components/canvas/storyboard-shot-card";
import { connectionHandleY } from "@/components/canvas/canvas-connections";
import { createStoryboardRow, getConnectionTargetAnchor, storyboardHandleAtY } from "@/lib/canvas/canvas-project-domain";
import { deriveStoryboardPipelineProgress } from "@/lib/canvas/canvas-storyboard-progress";
import { STORYBOARD_ROW_HEIGHT, storyboardNodeHeight } from "@/lib/canvas/canvas-storyboard-layout";
import { CanvasNodeType, type CanvasNodeData, type CanvasGenerationBatchItem } from "@/types/canvas";

const image = (id: string, status: "success" | "loading" | "error", content = ""): CanvasNodeData => ({ id, type: CanvasNodeType.Image, title: id, position: { x: 0, y: 0 }, width: 300, height: 200, metadata: { status, content } });
const row = { ...createStoryboardRow(1), id: "stable-shot", plotDescription: "女孩转身，男孩停在原地", imageNodeId: "image" };
const script: CanvasNodeData = { id: "board", type: CanvasNodeType.Script, title: "分镜板", position: { x: 20, y: 30 }, width: 1000, height: storyboardNodeHeight(3), metadata: { storyboard: { rows: [row, { ...row, id: "second", shotNumber: 2 }, { ...row, id: "third", shotNumber: 3 }] } } };
function renderCard(node: CanvasNodeData, batchItem?: CanvasGenerationBatchItem) {
    const item = deriveStoryboardPipelineProgress(script, [script, node], []).rows[0];
    return renderToStaticMarkup(<StoryboardShotCard item={item} nodes={[script, node]} batchMode="storyboard_image" batchItem={batchItem} disabled={false} onEdit={() => {}} onGenerateImages={() => {}} onGenerateVideos={() => {}} onCancel={() => {}} onLocate={() => {}} />);
}

describe("storyboard shot cards", () => {
    test("keeps input references separate from successful outputs", () => {
        const markup = renderCard(image("image", "success", "data:image/png;base64,eA=="));
        expect(markup).toContain("女孩转身，男孩停在原地");
        expect(markup).toContain("参考素材");
        expect(markup).toContain("未设置（可选）");
        expect(markup).toContain("图片：已完成");
        expect(markup).toContain("视频：未生成");
        expect(markup).not.toContain(">生成图片<");
        expect(markup).not.toContain("<video");
    });
    test("offers cancellation while running and retry after failure", () => {
        expect(renderCard(image("image", "loading"))).toContain("取消");
        const failed = image("image", "error");
        failed.metadata!.errorDetails = "模型暂不可用";
        const markup = renderCard(failed);
        expect(markup).toContain("重试图片");
        expect(markup).toContain("模型暂不可用");
    });
    test("does not report user cancellation as an ordinary failure", () => {
        const cancelled = image("image", "error");
        cancelled.metadata!.taskStatus = "cancelled";
        expect(renderCard(cancelled)).toContain("图片：已停止");
    });
    test("successful delivery takes precedence over a lagging batch status", () => {
        const waiting = { id: "item", rowId: row.id, nodeId: "image", status: "waiting", retryCount: 0 } as CanvasGenerationBatchItem;
        expect(renderCard(image("image", "success", "data:image/png;base64,eA=="), waiting)).toContain("图片：已完成");
    });
});

describe("shot card connection geometry", () => {
    test("hit testing, snapping and drawn connections agree after scrolling and reordering", () => {
        for (const rows of [script.metadata!.storyboard!.rows, [...script.metadata!.storyboard!.rows].reverse()]) {
            const board = { ...script, metadata: { ...script.metadata, storyboard: { rows } } };
            for (const scrollTop of [0, STORYBOARD_ROW_HEIGHT]) {
                const index = scrollTop ? 1 : 0;
                const handle = `row:${rows[index].id}`;
                const y = connectionHandleY(board, handle, scrollTop);
                expect(storyboardHandleAtY(board, y, scrollTop)).toBe(handle);
                expect(getConnectionTargetAnchor(board, { nodeId: "source", handleType: "source", x: 0, y: 0 }, handle, scrollTop).y).toBe(y);
            }
        }
    });
});
