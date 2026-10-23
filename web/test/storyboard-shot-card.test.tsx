import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StoryboardShotCard } from "@/components/canvas/storyboard-shot-card";
import { CanvasScriptNodeContent } from "@/components/canvas/canvas-script-node";
import { connectionHandleY } from "@/components/canvas/canvas-connections";
import { createStoryboardRow, getConnectionTargetAnchor, storyboardHandleAtY } from "@/lib/canvas/canvas-project-domain";
import { deriveStoryboardPipelineProgress } from "@/lib/canvas/canvas-storyboard-progress";
import { STORYBOARD_ROW_HEIGHT, storyboardNodeHeight } from "@/lib/canvas/canvas-storyboard-layout";
import { CanvasNodeType, type CanvasNodeData, type CanvasGenerationBatchItem } from "@/types/canvas";

const image = (id: string, status: "success" | "loading" | "error", content = ""): CanvasNodeData => ({ id, type: CanvasNodeType.Image, title: id, position: { x: 0, y: 0 }, width: 300, height: 200, metadata: { status, content } });
const row = { ...createStoryboardRow(1), id: "stable-shot", plotDescription: "女孩转身，男孩停在原地", imageNodeId: "image" };
const script: CanvasNodeData = { id: "board", type: CanvasNodeType.Script, title: "分镜板", position: { x: 20, y: 30 }, width: 1000, height: storyboardNodeHeight(3), metadata: { storyboard: { rows: [row, { ...row, id: "second", shotNumber: 2 }, { ...row, id: "third", shotNumber: 3 }] } } };
function renderCard(node: CanvasNodeData, batchItem?: CanvasGenerationBatchItem) {
    const item = { ...deriveStoryboardPipelineProgress(script, [script, node], []).rows[0], imageBatchItem: batchItem };
    return renderToStaticMarkup(<StoryboardShotCard item={item} nodes={[script, node]} disabled={false} onEdit={() => {}} onGenerateImages={() => {}} onGenerateVideos={() => {}} onCancel={() => {}} onLocate={() => {}} />);
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
        expect(markup).toContain("重新生成图片");
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
    test("completed videos retain regeneration without a redundant view button", () => {
        const video = { ...image("video", "success", "https://example.test/shot.mp4"), type: CanvasNodeType.Video };
        const board = { ...script, metadata: { storyboard: { rows: [{ ...row, videoNodeId: video.id }] } } };
        const nodes = [board, image("image", "success", "data:image/png;base64,eA=="), video];
        const item = deriveStoryboardPipelineProgress(board, nodes, []).rows[0];
        const props = { item, nodes, disabled: false, onEdit() {}, onGenerateImages() {}, onGenerateVideos() {}, onCancel() {}, onLocate() {} };
        const markup = renderToStaticMarkup(<StoryboardShotCard {...props} />);
        expect(markup).toContain("重新生成图片");
        expect(markup).toContain("重新生成视频");
        expect(markup).not.toContain("查看视频");
        const loading = renderToStaticMarkup(<StoryboardShotCard {...props} item={{ ...item, videoNode: { ...video, metadata: { status: "loading" } }, videoState: "loading" }} />);
        expect(loading).toContain("取消");
        expect(loading).toContain("重新生成图片");
        expect(loading).not.toContain("重新生成视频");
    });
});

describe("independent storyboard media actions", () => {
    function renderMedia(imageStatus: "loading" | "error", videoStatus?: "loading", keyframe = false) {
        const img = image("image", imageStatus);
        const vid = videoStatus ? { ...image("video", videoStatus), type: CanvasNodeType.Video } : undefined;
        const item = { row, imageNode: img, imageState: imageStatus, videoNode: vid, videoState: videoStatus || "missing" } as const;
        return renderToStaticMarkup(<StoryboardShotCard item={item} nodes={[img, ...(vid ? [vid] : [])]} videoInputMode={keyframe ? "keyframe" : "direct"} disabled={false} onEdit={() => {}} onGenerateImages={() => {}} onGenerateVideos={() => {}} onCancel={() => {}} onLocate={() => {}} />);
    }
    test("an image job keeps direct video generation available on the same shot", () => {
        const html = renderMedia("loading");
        expect(html).toContain("取消图片");
        const button = html.match(/<button\b[\s\S]*?<\/button>/g)!.find(button => button.includes("生成视频"))!;
        expect(button).not.toMatch(/\sdisabled(?:=""|(?=[\s>]))/);
    });
    test("both running media types expose their own cancellation", () => {
        const html = renderMedia("loading", "loading");
        expect(html).toContain("取消图片"); expect(html).toContain("取消视频");
    });
    test("a first-frame dependency only disables that shot's video action", () => {
        const html = renderMedia("error", undefined, true);
        const buttons = html.match(/<button\b[\s\S]*?<\/button>/g)!;
        expect(buttons.find(button => button.includes("重试图片"))).not.toContain("disabled");
        expect(buttons.find(button => button.includes("生成视频"))).toContain("disabled");
    });
    test("queued image and video states are derived across batches rather than the last batch alone", () => {
        const img = image("image", "error");
        img.metadata = { status: "idle" };
        const vid = { ...img, id: "video", type: CanvasNodeType.Video };
        const board = { ...script, metadata: { storyboard: { rows: [{ ...row, videoNodeId: vid.id }] }, generationBatches: [
            { id: "image-batch", mode: "storyboard_image", items: [{ id: "i", nodeId: img.id, rowId: row.id, status: "waiting" }] },
            { id: "video-batch", mode: "storyboard_video", items: [{ id: "v", nodeId: vid.id, rowId: row.id, status: "queued" }] },
        ] } } as CanvasNodeData;
        const nodes = [board, img, vid];
        const item = deriveStoryboardPipelineProgress(board, nodes, []).rows[0];
        const html = renderToStaticMarkup(<StoryboardShotCard item={item} nodes={nodes} disabled={false} onEdit={() => {}} onGenerateImages={() => {}} onGenerateVideos={() => {}} onCancel={() => {}} onLocate={() => {}} />);
        expect(html).toContain("图片：等待执行"); expect(html).toContain("视频：排队中");
        expect(item.imageState).toBe("loading"); expect(item.videoState).toBe("loading");
        const buttons = html.match(/<button\b[\s\S]*?<\/button>/g)!;
        expect(buttons.find(button => button.includes("图片等待执行"))).toMatch(/\sdisabled(?:=""|(?=[\s>]))/);
        expect(buttons.find(button => button.includes("视频排队中"))).toMatch(/\sdisabled(?:=""|(?=[\s>]))/);
    });
});

test("script toolbar and other shot actions remain enabled during an image batch", () => {
    const img = image("image", "loading");
    const board = { ...script, metadata: { storyboard: { rows: [row, { ...row, id: "other", shotNumber: 2, imageNodeId: undefined }] }, generationBatches: [{ id: "active", mode: "storyboard_image", status: "running", items: [{ id: "i", rowId: row.id, nodeId: img.id, status: "running" }] }] } } as CanvasNodeData;
    const nodes = [board, img];
    const pipeline = deriveStoryboardPipelineProgress(board, nodes, []);
    const noop = () => {};
    const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><CanvasScriptNodeContent node={board} nodes={nodes} batch={board.metadata!.generationBatches![0]} pipeline={pipeline} scale={1} mentionReferences={[]}
        onOpen={noop} onCancelGeneration={noop} onLocate={noop} onCreateImageNodes={noop} onCreateVideoNodes={noop} onGenerateImages={noop} onGenerateVideos={noop}
        onVideoInputModeChange={noop} onMediaModelChange={noop} onMediaSettingsChange={noop} onMergeVideos={noop} onCreateActionBoards={noop} onRetryBatch={noop} onRetryBatchItem={noop}
        onStopBatch={noop} onAddRow={noop} onPromptChange={noop} onGenerateScript={noop} onModelChange={noop} onShotDurationChange={noop} onShotCountChange={noop}
        onComposerHeightChange={noop} onConnectStart={noop} onScrollTopChange={noop} /></QueryClientProvider>);
    const buttons = html.match(/<button\b[\s\S]*?<\/button>/g)!;
    for (const label of ["补齐分镜图", "生成镜头视频", "生成图片", "生成视频"]) {
        const button = buttons.find(button => button.includes(`>${label}</span>`))!;
        expect(button).toBeTruthy();
        expect(button).not.toMatch(/\sdisabled(?:=""|(?=[\s>]))/);
    }
    expect(html).toContain("取消图片");
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
