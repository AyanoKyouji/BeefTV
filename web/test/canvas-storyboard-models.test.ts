import { expect, test } from "bun:test";
import { storyboardMediaConfig, storyboardMediaModelPatch, storyboardMediaParameters, storyboardMediaSettingsPatch, storyboardSettingsValuePatch } from "@/lib/canvas/canvas-storyboard-models";
import { defaultModelCapabilityConfig } from "@/lib/model-capabilities";
import { defaultConfig, type AiConfig } from "@/stores/use-config-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

function fixture() {
    const capabilityConfig = defaultModelCapabilityConfig();
    Object.assign(capabilityConfig.video!, { ratios: ["16:9", "9:16"], defaultRatio: "16:9", resolutions: ["720p", "1080p"], defaultResolution: "720p", duration: { selection: "enum", values: [5, 10], default: 5 } });
    const config: AiConfig = { ...defaultConfig, imageModel: "test::image", videoModel: "test::video", vquality: "2160", videoSeconds: "15", channels: [{ id: "test", name: "Test", apiFormat: "openai", baseUrl: "https://example.test", apiKey: "fixture", models: ["image", "video"], modelProfiles: [{ model: "image", capability: "image", capabilityConfig }, { model: "video", capability: "video", capabilityConfig }] }] };
    const script: CanvasNodeData = { id: "script", type: CanvasNodeType.Script, title: "script", position: { x: 0, y: 0 }, width: 600, height: 400, metadata: { model: "text" } };
    return { config, script };
}

test("model switches reset only that media kind's parameters", () => {
    const { script } = fixture();
    script.metadata = { ...script.metadata, storyboardImageSettings: { size: "9:16" }, storyboardVideoSettings: { seconds: "10" } };
    script.metadata = { ...script.metadata, ...storyboardMediaModelPatch("image", "test::other") };
    expect(script.metadata.storyboardImageSettings).toBeUndefined();
    expect(script.metadata.storyboardVideoSettings).toEqual({ seconds: "10" });
    expect(script.metadata.model).toBe("text");
});

test("settings merge, persist and restore per-shot duration without changing the other kind", () => {
    const { script } = fixture();
    script.metadata = { ...script.metadata, ...storyboardMediaSettingsPatch(script, "image", { quality: "high" }) };
    script.metadata = { ...script.metadata, ...storyboardMediaSettingsPatch(script, "image", { size: "16:9" }) };
    script.metadata = { ...script.metadata, ...storyboardMediaSettingsPatch(script, "video", { seconds: "10", vquality: "1080" }) };
    script.metadata = { ...script.metadata, ...storyboardMediaSettingsPatch(script, "video", { seconds: undefined }) };
    const restored = JSON.parse(JSON.stringify(script));
    expect(restored.metadata.storyboardImageSettings).toEqual({ quality: "high", size: "16:9" });
    expect(restored.metadata.storyboardVideoSettings).toEqual({ vquality: "1080" });
});

test("model capabilities constrain parameters and ignore unrelated global defaults", () => {
    const { config, script } = fixture();
    script.metadata!.storyboardVideoSettings = { size: "21:9", vquality: "2160", seconds: "99" };
    const result = storyboardMediaConfig(config, script, "video", 3);
    expect(result.size).toBe("16:9"); expect(result.vquality).toBe("720");
    expect(["5", "10"]).toContain(result.videoSeconds);
    expect(config.vquality).toBe("2160");
});

test("duration uses each shot unless overridden and preview matches target values", () => {
    const { config, script } = fixture();
    expect(storyboardMediaParameters(config, script, "video", 10).seconds).toBe("10");
    script.metadata!.storyboardVideoSettings = { seconds: "5", vquality: "1080", size: "9:16" };
    const preview = storyboardMediaConfig(config, script, "video", 10);
    const target = storyboardMediaParameters(config, script, "video", 10);
    expect(target).toMatchObject({ seconds: preview.videoSeconds, vquality: preview.vquality, size: preview.size });
    expect(target.seconds).toBe("5");
});

test("settings field mapping excludes unrelated config and credentials", () => {
    expect(storyboardSettingsValuePatch("videoSeconds", "10")).toEqual({ seconds: "10" });
    expect(storyboardSettingsValuePatch("videoGenerateAudio", "false")).toEqual({ generateAudio: "false" });
    expect(storyboardSettingsValuePatch("apiKey", "secret")).toEqual({});
});
