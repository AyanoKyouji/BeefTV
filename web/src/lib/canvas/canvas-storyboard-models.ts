import type { AiConfig } from "@/stores/use-config-store";
import { mergedImageCapabilityConfig, resolveModelGenerationDefaults } from "@/lib/model-selection";
import { normalizeImageValue } from "@/lib/model-capabilities";
import type { CanvasNodeData, CanvasNodeMetadata } from "@/types/canvas";

export type StoryboardMediaKind = "image" | "video";
export type StoryboardMediaSettings = NonNullable<CanvasNodeMetadata["storyboardImageSettings"]> & NonNullable<CanvasNodeMetadata["storyboardVideoSettings"]>;

export function storyboardMediaModel(config: AiConfig, script: CanvasNodeData | null | undefined, kind: "image" | "video") {
    return kind === "image"
        ? script?.metadata?.storyboardImageModel || config.imageModel || ""
        : script?.metadata?.storyboardVideoModel || config.videoModel || "";
}

export function storyboardMediaModelPatch(kind: StoryboardMediaKind, model: string): Partial<CanvasNodeMetadata> {
    return kind === "image" ? { storyboardImageModel: model, storyboardImageSettings: undefined } : { storyboardVideoModel: model, storyboardVideoSettings: undefined };
}

export function storyboardMediaSettingsPatch(script: CanvasNodeData, kind: StoryboardMediaKind, patch: StoryboardMediaSettings): Partial<CanvasNodeMetadata> {
    const key = kind === "image" ? "storyboardImageSettings" : "storyboardVideoSettings";
    return { [key]: { ...script.metadata?.[key], ...patch } };
}

export function storyboardSettingsValuePatch(key: keyof AiConfig, value: string): StoryboardMediaSettings {
    const field = ({ videoSeconds: "seconds", videoGenerateAudio: "generateAudio", videoWatermark: "watermark", videoArkPrivateAssetUpload: "arkPrivateAssetUpload" } as Record<string, string>)[key] || key;
    return ["size", "quality", "transparentBackground", "seconds", "vquality", "generateAudio", "watermark", "arkPrivateAssetUpload"].includes(field) ? { [field]: value } : {};
}

export function storyboardMediaConfig(config: AiConfig, script: CanvasNodeData | null | undefined, kind: StoryboardMediaKind, durationSeconds?: number): AiConfig {
    const model = storyboardMediaModel(config, script, kind);
    const settings = kind === "image" ? script?.metadata?.storyboardImageSettings : script?.metadata?.storyboardVideoSettings;
    const defaults = resolveModelGenerationDefaults(config, model, kind, {
        ...settings,
        count: "1",
        videoSeconds: script?.metadata?.storyboardVideoSettings?.seconds ?? String(durationSeconds ?? script?.metadata?.storyboard?.rows[0]?.durationSeconds ?? config.videoSeconds),
        videoGenerateAudio: script?.metadata?.storyboardVideoSettings?.generateAudio,
        videoWatermark: script?.metadata?.storyboardVideoSettings?.watermark,
    }, config);
    const imageSettings = kind === "image" ? normalizeImageValue(mergedImageCapabilityConfig(config, model), { ...defaults, ...settings, count: "1" }) : {};
    return { ...config, ...defaults, ...imageSettings, model, count: "1", videoArkPrivateAssetUpload: script?.metadata?.storyboardVideoSettings?.arkPrivateAssetUpload ?? config.videoArkPrivateAssetUpload };
}

// Use the same resolved values for the settings summary and the queued targets.
export function storyboardMediaParameters(config: AiConfig, script: CanvasNodeData, kind: StoryboardMediaKind, durationSeconds?: number): Partial<CanvasNodeMetadata> {
    const resolved = storyboardMediaConfig(config, script, kind, durationSeconds);
    return kind === "image"
        ? { size: resolved.size, quality: resolved.quality, transparentBackground: resolved.transparentBackground, count: 1 }
        : { size: resolved.size, seconds: resolved.videoSeconds, vquality: resolved.vquality, generateAudio: resolved.videoGenerateAudio, watermark: resolved.videoWatermark, arkPrivateAssetUpload: resolved.videoArkPrivateAssetUpload, videoH3Options: script.metadata?.storyboardVideoSettings?.videoH3Options };
}
