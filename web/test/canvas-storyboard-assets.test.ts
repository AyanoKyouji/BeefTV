import { describe, expect, it } from "bun:test";

import { buildStoryboardAssetCatalog } from "@/lib/canvas/canvas-storyboard-assets";
import { reconcileStoryboardRowOutputs, reconcileStoryboardTargetConnections, storyboardComposerContent, storyboardRowReferenceNodeIds } from "@/lib/canvas/canvas-storyboard-materializer";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type StoryboardRow } from "@/types/canvas";

const node = (id: string, type: CanvasNodeType, metadata: CanvasNodeData["metadata"] = {}): CanvasNodeData => ({
    id,
    type,
    title: id,
    position: { x: 0, y: 0 },
    width: 320,
    height: 180,
    metadata,
});

const row: StoryboardRow = {
    id: "row-1",
    shotNumber: 1,
    durationSeconds: 6,
    plotDescription: "雨夜追逐",
    dialogue: "快走",
    characters: [{ characterName: "林岚", characterAssetId: "character-asset" }],
    narrativeIntent: "",
    viewerPOV: "",
    performanceBlocking: "",
    shotSize: "",
    emotion: "",
    lightingAndAtmosphere: "",
    audioEffects: "",
    camera: "",
    motion: "",
    timeBeats: "",
    imageGenerationPrompt: "",
    videoMotionPrompt: "快速跟拍",
    mustHave: [],
    optionalDetails: [],
    continuityOut: "",
    negativePrompt: "",
    assetBindings: [{ nodeId: "prop", role: "prop", priority: 80 }],
    imageNodeId: "first-frame",
    status: "idle",
};

describe("storyboard asset catalog", () => {
    it("sends reusable image, video, audio and character assets but excludes generated shots", () => {
        const assets = buildStoryboardAssetCatalog([
            node("image", CanvasNodeType.Image, { content: "data:image/png;base64,x", assetCategory: "environment" }),
            node("video", CanvasNodeType.Video, { storageKey: "resource:video" }),
            node("audio", CanvasNodeType.Audio, { content: "data:audio/wav;base64,x" }),
            node("character", CanvasNodeType.Image, { workflowKind: "character", characterAssetId: "character-asset", characterVersionId: "v1" }),
            node("shot", CanvasNodeType.Image, { content: "data:image/png;base64,x", workflowKind: "shot" }),
            node("text", CanvasNodeType.Text, { content: "story" }),
        ]);

        expect(assets.map((asset) => [asset.id, asset.type])).toEqual([
            ["image", "image"],
            ["video", "video"],
            ["audio", "audio"],
            ["character", "character"],
        ]);
    });
});

describe("storyboard image ownership after source edits", () => {
    const bound = { ...row, imageGenerationPrompt: "blue car", imageNodeId: "output" };
    const output: CanvasConnection = { id: "output-edge", fromNodeId: "script", toNodeId: "output", fromHandleId: "row:row-1", storyboardRowId: "row-1", relation: "storyboard-output" };
    const reference: CanvasConnection = { id: "reference", fromNodeId: "prop", toNodeId: "script", toHandleId: "row:row-1" };
    const otherBoard: CanvasConnection = { ...output, id: "other-board", fromNodeId: "other-script" };

    it("retains a stable row's output when its display number and order change", () => {
        const other = { ...row, id: "other-row", imageNodeId: undefined };
        const result = reconcileStoryboardRowOutputs("script", [other, bound], [{ ...bound, shotNumber: 1 }, { ...other, shotNumber: 2 }], [output]);
        expect(result.rows[0].imageNodeId).toBe("output");
        expect(result.connections).toEqual([output]);
        expect(result.detachedCount).toBe(0);
    });

    it("detaches only the old image output, preserving incoming references and other boards", () => {
        const result = reconcileStoryboardRowOutputs("script", [bound], [{ ...bound, imageGenerationPrompt: "red car" }], [output, reference, otherBoard]);
        expect(result.rows[0].imageNodeId).toBeUndefined();
        expect(result.rows[0].imageBindingStale).toBe(true);
        expect(result.rows[0].imageGenerationPrompt).toBe("red car");
        expect(result.rows[0].assetBindings).toEqual(bound.assetBindings);
        expect(result.connections).toEqual([reference, otherBoard]);
        expect(result.detachedCount).toBe(1);
    });

    it("keeps the image when editing dialogue or a plot hidden by an explicit image prompt", () => {
        const result = reconcileStoryboardRowOutputs("script", [bound], [{ ...bound, dialogue: "changed", plotDescription: "changed plot" }], [output]);
        expect(result.rows[0].imageNodeId).toBe("output");
        expect(result.detachedCount).toBe(0);
    });

    it("invalidates the image when its fallback plot input changes", () => {
        const fallback = { ...bound, imageGenerationPrompt: "", plotDescription: "old plot" };
        const result = reconcileStoryboardRowOutputs("script", [fallback], [{ ...fallback, plotDescription: "new plot" }], [output]);
        expect(result.rows[0].imageNodeId).toBeUndefined();
        expect(result.connections).toEqual([]);
    });

    it("does not discard an explicitly replaced image or a whitespace-only edit", () => {
        expect(reconcileStoryboardRowOutputs("script", [bound], [{ ...bound, imageGenerationPrompt: "red car", imageNodeId: "replacement" }], []).rows[0].imageNodeId).toBe("replacement");
        expect(reconcileStoryboardRowOutputs("script", [bound], [{ ...bound, imageGenerationPrompt: " blue car " }], [output]).rows[0].imageNodeId).toBe("output");
    });

    it("removes deleted row connections without affecting an identical row ID on another board", () => {
        const result = reconcileStoryboardRowOutputs("script", [bound], [], [output, reference, otherBoard]);
        expect(result.connections).toEqual([otherBoard]);
        expect(result.rows).toEqual([]);
    });
});

describe("storyboard target materializer", () => {
    const script = node("script", CanvasNodeType.Script, { storyboard: { rows: [row], visibleColumns: [], referenceNodeIds: ["project-style"] } });
    const nodes = [script, node("project-style", CanvasNodeType.Image, { content: "style" }), node("prop", CanvasNodeType.Image, { content: "prop" }), node("character", CanvasNodeType.Image, { workflowKind: "character", characterAssetId: "character-asset" }), node("manual", CanvasNodeType.Video, { content: "video" }), node("direct-manual", CanvasNodeType.Audio, { content: "audio" }), node("first-frame", CanvasNodeType.Image, { content: "frame", workflowKind: "shot" }), node("target", CanvasNodeType.Video)];
    const connections: CanvasConnection[] = [{ id: "manual-row-input", fromNodeId: "manual", toNodeId: "script", toHandleId: "row:row-1" }];

    it("combines stable bindings and produces position mention tokens", () => {
        const references = storyboardRowReferenceNodeIds(script, row, nodes, connections, true);
        expect(references).toEqual(["project-style", "prop", "character", "manual", "first-frame"]);
        expect(storyboardComposerContent("快速跟拍", references, nodes)).toBe("参考资产：@图片1 @图片2 @角色1 @视频1 @图片3\n快速跟拍");

        const withDirectManualInput = storyboardRowReferenceNodeIds(script, row, nodes, [...connections, { id: "direct", fromNodeId: "direct-manual", toNodeId: "target" }], false, "target");
        expect(withDirectManualInput).toContain("direct-manual");
    });

    it("reconciles managed edges without deleting manual connections", () => {
        const manualTargetEdge: CanvasConnection = { id: "manual-target", fromNodeId: "manual", toNodeId: "target" };
        const created = reconcileStoryboardTargetConnections([manualTargetEdge], script, row, "target", ["prop", "character"]);
        expect(created.filter((edge) => edge.relation === "storyboard-output")).toHaveLength(1);
        expect(created.filter((edge) => edge.relation === "storyboard-asset-reference").map((edge) => edge.fromNodeId).sort()).toEqual(["character", "prop"]);

        const reconciled = reconcileStoryboardTargetConnections(created, script, row, "target", ["character"]);
        expect(reconciled.some((edge) => edge.id === "manual-target")).toBe(true);
        expect(reconciled.some((edge) => edge.relation === "storyboard-asset-reference" && edge.fromNodeId === "prop")).toBe(false);
    });
});
