import { Button, Input, InputNumber, Select } from "antd";
import { Image as ImageIcon, Film, Pencil, LocateFixed, Square } from "lucide-react";

import { StoryboardAssetsCell, StoryboardMediaPreview } from "@/components/canvas/storyboard-assets-cell";
import type { StoryboardPipelineRow, StoryboardPipelineItemState } from "@/lib/canvas/canvas-storyboard-progress";
import { generationErrorMessage } from "@/lib/generation-error";
import { storyboardMediaBusy } from "@/lib/canvas/canvas-storyboard-generation-state";
import type { CanvasGenerationBatchItem, CanvasNodeData, StoryboardRow } from "@/types/canvas";

function mediaStatus(state: StoryboardPipelineItemState, node?: CanvasNodeData, item?: CanvasGenerationBatchItem) {
    if (state === "success") return "已完成";
    if (item?.submissionUncertain || node?.metadata?.generationSubmissionState === "unknown") return "状态待确认";
    if (item?.status === "waiting") return "等待执行";
    if (item?.status === "submitting") return "提交中";
    if (item?.status === "queued") return "排队中";
    if (item?.status === "running") return "生成中";
    if (node?.metadata?.taskStatus === "cancelled" || item?.status === "cancelled") return "已停止";
    return { missing: "未生成", idle: "待生成", loading: "生成中", success: "已完成", error: "失败" }[state];
}

export function StoryboardShotCard({ item, nodes, videoInputMode, disabled, selected, reorderable, onEdit, onGenerateImages, onGenerateVideos, onCancel, onLocate }: {
    item: StoryboardPipelineRow;
    nodes: CanvasNodeData[];
    videoInputMode?: "direct" | "keyframe";
    disabled: boolean;
    selected?: boolean;
    reorderable?: boolean;
    onEdit: () => void;
    onGenerateImages: () => void;
    onGenerateVideos: () => void;
    onCancel: (node: CanvasNodeData) => void;
    onLocate: (node: CanvasNodeData) => void;
}) {
    const { row, imageNode, videoNode, imageState, videoState } = item;
    const { imageBatchItem, videoBatchItem } = item;
    const imageBusy = imageState === "loading" || storyboardMediaBusy(imageNode, imageBatchItem);
    const videoBusy = videoState === "loading" || storyboardMediaBusy(videoNode, videoBatchItem);
    const needsFirstFrame = videoInputMode === "keyframe" && !imageNode?.metadata?.content;
    const mediaAction = (kind: "image" | "video") => {
        const node = kind === "image" ? imageNode : videoNode;
        const state = kind === "image" ? imageState : videoState;
        const busy = kind === "image" ? imageBusy : videoBusy;
        const batchItem = kind === "image" ? imageBatchItem : videoBatchItem;
        const label = kind === "image" ? "图片" : "视频";
        const canCancel = busy && node && (node.metadata?.status === "loading" || Boolean(node.metadata?.taskId || node.metadata?.taskClientOperationId));
        if (canCancel) return <Button size="small" icon={<Square className="size-3" />} onClick={() => onCancel(node)}>取消{label}</Button>;
        return <Button size="small" icon={kind === "image" ? <ImageIcon className="size-3" /> : <Film className="size-3" />} disabled={disabled || busy || (kind === "video" && needsFirstFrame)}
            title={kind === "video" && needsFirstFrame ? "先做首帧模式需要该镜头已有分镜图" : undefined}
            onClick={kind === "image" ? onGenerateImages : onGenerateVideos}>
            {busy ? `${label}${mediaStatus(state, node, batchItem)}` : `${state === "success" ? "重新生成" : state === "error" ? "重试" : "生成"}${label}`}
        </Button>;
    };
    const failedNode = imageState === "error" ? imageNode : videoState === "error" ? videoNode : undefined;
    const error = failedNode?.metadata?.errorDetails;
    const description = row.plotDescription || row.imageGenerationPrompt || row.videoMotionPrompt || "还没有画面描述，点击编辑镜头。";
    return (
        <article aria-label={`镜头 ${row.shotNumber}`} aria-current={selected ? "true" : undefined}
            className={`flex h-full min-w-0 gap-3 rounded-lg border p-3 text-foreground ${reorderable ? "cursor-grab select-none active:cursor-grabbing" : "cursor-pointer"}`}
            style={{ borderColor: selected ? "var(--color-primary)" : "var(--border)", background: "var(--background)" }}
            onClick={(event) => {
                event.stopPropagation();
                const target = event.target;
                if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
                if (target.closest("button, a, input, textarea, select, label, summary, [role='button']")) return;
                onEdit();
            }}
            onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
            <div className="w-32 shrink-0 self-stretch">
                <StoryboardMediaPreview node={imageNode} label={`镜头 ${row.shotNumber} 分镜图`} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                    <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]" onClick={onEdit} aria-label={`编辑镜头 ${row.shotNumber}`}>
                        镜头 {String(row.shotNumber).padStart(2, "0")}<Pencil className="size-3" />
                    </button>
                    <span className="text-xs text-foreground/55">{row.shotSize || "景别未设"} · {row.durationSeconds} 秒</span>
                    <span className="min-w-0 flex-1" />
                    {imageNode || videoNode ? <button type="button" title="在画布中定位产物" aria-label={`定位镜头 ${row.shotNumber} 产物`} className="rounded p-1 text-foreground/50 hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]" onClick={() => onLocate(videoNode || imageNode!)}><LocateFixed className="size-3.5" /></button> : null}
                </div>
                <p className={`${error ? "line-clamp-1 min-h-4" : "line-clamp-2 min-h-8"} text-xs leading-4`} title={description}>{description}</p>
                <div className="flex min-h-5 items-center gap-2 text-xs text-foreground/55">
                    <span className="shrink-0">参考素材</span>
                    {row.assetBindings?.length ? <StoryboardAssetsCell bindings={row.assetBindings} nodes={nodes} limit={2} /> : <span>未设置（可选）</span>}
                    {row.imageBindingStale && !row.imageNodeId ? <span className="truncate text-destructive">内容已修改，需更新图片</span> : null}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
                    <span className={imageState === "error" ? "text-destructive" : "text-foreground/55"}>图片：{mediaStatus(imageState, imageNode, imageBatchItem)}</span>
                    <span className={videoState === "error" ? "text-destructive" : "text-foreground/55"}>视频：{mediaStatus(videoState, videoNode, videoBatchItem)}</span>
                    <span className="min-w-0 flex-1" />
                    {mediaAction("image")}
                    {mediaAction("video")}
                </div>
                {error ? <p className="truncate text-xs text-destructive" title={generationErrorMessage(error)}>{generationErrorMessage(error)}</p> : null}
            </div>
        </article>
    );
}

export function StoryboardShotDetails({ item, nodes, onUpdate }: { item: StoryboardPipelineRow; nodes: CanvasNodeData[]; onUpdate: (patch: Partial<StoryboardRow>) => void }) {
    const { row } = item;
    const textField = (key: keyof StoryboardRow, label: string, placeholder?: string) => (
        <label className="flex min-w-0 flex-col gap-1.5 text-xs text-foreground/65" key={key}>
            {label}<Input.TextArea aria-label={`${label}（镜头 ${row.shotNumber}）`} value={String(row[key] || "")} autoSize={{ minRows: 2, maxRows: 6 }} placeholder={placeholder || `填写${label}`} onChange={(event) => onUpdate({ [key]: event.target.value })} />
        </label>
    );
    return (
        <section className="space-y-4 rounded-xl border border-foreground/10 p-4" aria-label={`镜头 ${row.shotNumber} 详情`}>
            <h3 className="text-sm font-semibold">镜头 {row.shotNumber} · 编辑与预览</h3>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><p className="text-xs text-foreground/55">当前分镜图（点击放大）</p><StoryboardMediaPreview node={item.imageNode} label="分镜图" className="aspect-video w-full" /></div>
                <div className="space-y-2"><p className="text-xs text-foreground/55">当前视频（点击播放）</p><StoryboardMediaPreview node={item.videoNode} label="视频" kind="video" className="aspect-video w-full" /></div>
                {textField("plotDescription", "画面与动作", "描述这一镜发生什么、人物如何动作。")}
                {textField("dialogue", "台词 / 旁白")}
                <label className="flex flex-col gap-1.5 text-xs text-foreground/65">计划镜头时长（秒）<InputNumber aria-label="计划镜头时长（秒）" min={1} max={60} value={row.durationSeconds} onChange={(value) => onUpdate({ durationSeconds: Number(value) || 1 })} /></label>
                <label className="flex flex-col gap-1.5 text-xs text-foreground/65">景别<Select aria-label="景别" value={row.shotSize || undefined} allowClear placeholder="选择景别" options={["特写", "近景", "中景", "全景", "远景"].map((value) => ({ value, label: value }))} onChange={(value) => onUpdate({ shotSize: value || "" })} /></label>
            </div>
            <div className="flex items-center gap-3 text-xs text-foreground/65">输入参考素材{row.assetBindings?.length ? <StoryboardAssetsCell bindings={row.assetBindings} nodes={nodes} /> : <span>未设置（可选）</span>}</div>
            <details className="rounded-lg border border-foreground/10 p-3">
                <summary className="cursor-pointer text-sm font-medium">生成提示词与高级镜头设置</summary>
                <p className="my-3 text-xs text-foreground/55">图片提示词描述静态画面，视频提示词描述动作与运镜。模型生成时长仍受渠道能力限制。</p>
                <div className="grid gap-4 md:grid-cols-2">
                    {textField("imageGenerationPrompt", "图片提示词")}{textField("videoMotionPrompt", "视频提示词")}
                    {textField("camera", "镜头设计")}{textField("motion", "运镜")}
                    {textField("narrativeIntent", "镜头意图")}{textField("viewerPOV", "观众视点")}
                    {textField("performanceBlocking", "表演调度")}{textField("emotion", "情绪")}
                    {textField("lightingAndAtmosphere", "光影氛围")}{textField("audioEffects", "音效")}
                    {textField("timeBeats", "时间节拍")}{textField("continuityOut", "连续性出口")}{textField("negativePrompt", "负面要求")}
                </div>
            </details>
        </section>
    );
}
