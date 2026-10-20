import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ImageSettingsPanel } from "../src/components/image-settings-panel";
import { ModelCapabilityEditor } from "../src/components/model-capability-editor";
import { canvasThemes } from "../src/lib/canvas-theme";
import { defaultImageCapabilityConfig, modelCapabilityConfigFor, normalizeModelCapabilityConfig, type ModelCapabilityConfig } from "../src/lib/model-capabilities";
import { createModelChannel, defaultConfig } from "../src/stores/use-config-store";

// Reproduce the incomplete JSON used during DEV-007, rather than completing it
// in the fixture and hiding the persisted configuration boundary.
const partial = JSON.parse(JSON.stringify({
    image: {
        references: { promptMaxChars: 8000, maxImages: 0, maskSupported: false },
        size: { parameter: "size", values: ["768x768"], default: "768x768", allowCustom: false },
        quality: { supported: false, default: "auto" },
        transparentBackground: { supported: false },
        maxOutputs: 1,
    },
})) as ModelCapabilityConfig;

function configFor(capabilityConfig: ModelCapabilityConfig, protocol: "openai-image" | "gemini-image" = "openai-image") {
    const model = "partial-image";
    return {
        ...defaultConfig,
        model: `custom::${model}`,
        imageModel: `custom::${model}`,
        channels: [createModelChannel({ id: "custom", models: [model], modelProfiles: [{ model, capability: "image", protocol, capabilityConfig }] })],
    };
}

describe("incomplete persisted image capabilities", () => {
    test("the DEV-007 fixture renders settings and retains explicit restrictions without changing stored JSON", () => {
        const before = JSON.stringify(partial);
        const config = configFor(partial);
        const image = modelCapabilityConfigFor(config, config.model).image!;
        expect(image.references.maxImages).toBe(0);
        expect(image.references.maskSupported).toBe(false);
        expect(image.maxOutputs).toBe(1);
        expect(image.quality.supported).toBe(false);
        expect(image.size.values).toEqual(["768x768"]);
        expect(image.size.allowCustom).toBe(false);
        expect(renderToStaticMarkup(<ImageSettingsPanel config={config} theme={canvasThemes.dark} onConfigChange={() => {}} />)).toContain("768");
        expect(JSON.stringify(partial)).toBe(before);
    });

    test("capability editing also renders the same incomplete profile", () => {
        expect(() => renderToStaticMarkup(<ModelCapabilityEditor capability="image" protocol="openai-image" model="partial-image" value={partial} onChange={() => {}} />)).not.toThrow();
    });

    test("missing sections use the selected protocol defaults", () => {
        const image = modelCapabilityConfigFor(configFor({ image: {} } as ModelCapabilityConfig, "gemini-image"), "custom::partial-image").image!;
        expect(image).toEqual(defaultImageCapabilityConfig("gemini-image", "partial-image"));
    });

    test("null or non-array option lists cannot crash rendering", () => {
        for (const image of [{ size: null, quality: null }, { size: { values: null }, quality: { values: "auto" } }]) {
            const config = configFor({ image } as unknown as ModelCapabilityConfig);
            expect(() => renderToStaticMarkup(<ImageSettingsPanel config={config} theme={canvasThemes.light} onConfigChange={() => {}} />)).not.toThrow();
        }
    });

    test("explicit empty quality options remain empty and a complete profile is unchanged", () => {
        const image = defaultImageCapabilityConfig("gemini-image", "partial-image");
        image.quality = { supported: false, values: [], default: "auto" };
        expect(normalizeModelCapabilityConfig({ version: 1, image }).image).toEqual(image);
    });
});
