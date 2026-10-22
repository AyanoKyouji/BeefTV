import { describe, expect, test } from "bun:test";

import { canvasGenerationPromptMetadata, canvasGenerationRequestFingerprint, runCanvasGenerationSubmissionOnce, stopUnconfirmedCanvasGeneration } from "@/lib/canvas/canvas-generation-submission";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

test("stopping an unknown local wait preserves its operation and current draft without claiming cancellation", () => {
    const node: CanvasNodeData = {id: "target", type: CanvasNodeType.Video, title: "draft", position: {x: 0, y: 0}, width: 320, height: 180, metadata: {status: "loading", composerContent: "edited", taskClientOperationId: "original-operation", generationSubmissionState: "unknown"}};
    const [stopped] = stopUnconfirmedCanvasGeneration([node], "target", "original-operation");
    expect(stopped!.metadata).toMatchObject({status: "error", composerContent: "edited", taskClientOperationId: "original-operation", generationSubmissionState: "unknown"});
    expect(stopped!.metadata?.taskStatus).toBeUndefined();
    expect(stopped!.metadata?.errorDetails).toContain("已停止本地等待");
    const submitting = {...node, metadata: {...node.metadata, generationSubmissionState: "submitting" as const}};
    expect(stopUnconfirmedCanvasGeneration([submitting], "target", "original-operation")[0]!.metadata).toMatchObject({status: "error", generationSubmissionState: "unknown", taskClientOperationId: "original-operation"});
    const rebound = {...node, metadata: {...node.metadata, taskId: "accepted-task"}};
    expect(stopUnconfirmedCanvasGeneration([rebound], "target", "original-operation")[0]).toBe(rebound);
    expect(stopUnconfirmedCanvasGeneration([node], "target", "obsolete-operation")[0]).toBe(node);
});

function fingerprint(overrides: Partial<Parameters<typeof canvasGenerationRequestFingerprint>[0]> = {}) {
    return canvasGenerationRequestFingerprint({
        nodeId: "node-1",
        mode: "video",
        prompt: "夜晚的城市",
        model: "video-model",
        options: { size: "16:9", videoSeconds: 10, vquality: "768p" },
        context: {
            referenceImages: [{ id: "image-1", name: "reference.png", type: "image/png", dataUrl: "", storageKey: "resource:image-1" }],
            referenceVideos: [],
            referenceAudios: [],
            characterReferences: [],
            resolvedCharacterVersions: [],
            resolvedCharacterVoices: [],
        },
        ...overrides,
    });
}

describe("canvas generation submission", () => {
    test("持久化时分离编辑器槽位提示词和模型提示词", () => {
        expect(canvasGenerationPromptMetadata("自我介绍 @图片1", "电影感：自我介绍 @图片1")).toEqual({
            composerContent: "自我介绍 @图片1",
            prompt: "电影感：自我介绍 @图片1",
        });
    });

    test("同一节点的并发提交只执行一次", async () => {
        const locks = new Map<string, Promise<unknown>>();
        let executions = 0;
        let duplicates = 0;
        let release!: () => void;
        const pending = new Promise<void>((resolve) => {
            release = resolve;
        });
        const run = () =>
            runCanvasGenerationSubmissionOnce(
                locks,
                "node-1",
                async () => {
                    executions += 1;
                    await pending;
                    return "done";
                },
                () => {
                    duplicates += 1;
                },
            );

        const submissions = [run(), run(), run()];
        await Promise.resolve();
        expect(executions).toBe(1);
        expect(duplicates).toBe(2);
        release();
        expect(await Promise.all(submissions)).toEqual(["done", "done", "done"]);

        await run();
        expect(executions).toBe(2);
    });

    test("相同输入生成稳定指纹，关键内容变化会改变指纹", () => {
        expect(fingerprint({ options: { vquality: "768p", videoSeconds: 10, size: "16:9" } })).toBe(fingerprint());
        expect(fingerprint({ prompt: "白天的城市" })).not.toBe(fingerprint());
        expect(fingerprint({ model: "another-model" })).not.toBe(fingerprint());
        expect(fingerprint({ options: { size: "9:16", videoSeconds: 10, vquality: "768p" } })).not.toBe(fingerprint());
        expect(
            fingerprint({
                context: {
                    referenceImages: [{ id: "image-2", name: "other.png", type: "image/png", dataUrl: "", storageKey: "resource:image-2" }],
                    referenceVideos: [],
                    referenceAudios: [],
                    characterReferences: [],
                    resolvedCharacterVersions: [],
                    resolvedCharacterVoices: [],
                },
            }),
        ).not.toBe(fingerprint());
    });
});
