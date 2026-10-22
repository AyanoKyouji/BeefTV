import { describe, expect, it } from "bun:test";

import { buildStoryboardGenerationPrompt, inspectStoryboardReadiness, resolveStoryboardGenerationContext } from "@/lib/canvas/canvas-storyboard-context";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

const node = (id: string, type: CanvasNodeType, metadata: CanvasNodeData["metadata"] = {}): CanvasNodeData => ({
    id,
    type,
    title: id,
    position: { x: 0, y: 0 },
    width: 320,
    height: 180,
    metadata,
});

const styleNode = node("style", CanvasNodeType.Text, {
    workflowKind: "styleboard",
    stylePresetId: "style-v1",
    content: "统一的项目画风",
});

describe("storyboard generation context", () => {
    it("allows a standalone script to generate from a prompt without a style node", () => {
        const nodes = [node("script", CanvasNodeType.Script, { composerContent: "女孩转身远离男孩。" })];
        const context = resolveStoryboardGenerationContext(nodes);
        expect(context.projectStyle).toBeUndefined();
        expect(context.characters).toEqual([]);
        expect(inspectStoryboardReadiness(nodes).canGenerateStoryboard).toBe(true);
        expect(inspectStoryboardReadiness(nodes).blockingReason).toBeUndefined();
    });

    it("does not silently discard an incomplete explicit style", () => {
        expect(() => resolveStoryboardGenerationContext([node("style", CanvasNodeType.Text, { workflowKind: "styleboard", content: "漫画" })])).toThrow("项目画风配置不完整");
    });

    it("ignores standalone character-design workflows without a linked asset", () => {
        const context = resolveStoryboardGenerationContext([
            styleNode,
            node("character-turnaround", CanvasNodeType.Image, {
                workflowKind: "character",
                composerContent: "生成角色三视图",
            }),
        ]);

        expect(context.characters).toEqual([]);
    });

    it("keeps the version check for linked character cards", () => {
        expect(() => resolveStoryboardGenerationContext([
            styleNode,
            node("character-card", CanvasNodeType.Text, {
                workflowKind: "character",
                characterAssetId: "asset-1",
                characterName: "李当歌",
            }),
        ])).toThrow("角色卡“李当歌”版本未同步");
    });

    it("passes linked character cards with a current version", () => {
        const context = resolveStoryboardGenerationContext([
            styleNode,
            node("character-card", CanvasNodeType.Text, {
                workflowKind: "character",
                characterAssetId: "asset-1",
                characterVersionId: "version-1",
                characterName: "李当歌",
                characterDefinition: { role: "镇国公世子" },
            }),
        ]);

        expect(context.characters).toEqual([{
            assetId: "asset-1",
            versionId: "version-1",
            name: "李当歌",
            definition: { role: "镇国公世子" },
        }]);
    });
});

describe("storyboard model prompt", () => {
    it("includes a parseable row contract and the selected count and duration", () => {
        const prompt = buildStoryboardGenerationPrompt("女孩转身远离男孩。", resolveStoryboardGenerationContext([]), { shotCount: 3, shotDurationSeconds: 5 });
        expect(prompt).toContain("女孩转身远离男孩。");
        expect(prompt).toContain('"title": string, "rows": object[]');
        expect(prompt).toContain("不要 Markdown");
        expect(prompt).toContain("必须输出 3 个镜头");
        expect(prompt).toContain("durationSeconds 必须为 5");
        expect(prompt).not.toContain("undefined");
    });

    it("retains the selected style and current character version in the model input", () => {
        const context = resolveStoryboardGenerationContext([styleNode, node("character", CanvasNodeType.Text, {
            workflowKind: "character", characterAssetId: "asset-1", characterVersionId: "version-2", characterName: "女孩", characterDefinition: { costume: "蓝色外套" },
        })]);
        const prompt = buildStoryboardGenerationPrompt("女孩转身", context, { shotCount: 0, shotDurationSeconds: 0 });
        expect(prompt).toContain("统一的项目画风");
        expect(prompt).toContain("version-2");
        expect(prompt).toContain("蓝色外套");
        expect(prompt).toContain("按剧情及用户要求安排镜头时长");
    });
});
