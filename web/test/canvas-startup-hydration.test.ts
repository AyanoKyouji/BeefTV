import { expect, mock, test } from "bun:test";

const calls: string[] = [];
let applicationReady!: () => void;
const ready = new Promise<void>((resolve) => { applicationReady = resolve; });

mock.module("@fontsource-variable/inter", () => ({}));
mock.module("@fontsource-variable/jetbrains-mono", () => ({}));
mock.module("@/services/diagnostics/browser-environment", () => ({ browserCapabilities: () => ({ secureRandom: true, structuredClone: true, indexedDB: true }) }));
mock.module("@/services/desktop-runtime", () => ({ bootstrapDesktopRuntime: async () => { calls.push("runtime"); } }));
mock.module("@/stores/canvas/use-canvas-store", () => ({
    useCanvasStore: { persist: { rehydrate: async () => { calls.push("cache-before-workspace"); } } },
}));
mock.module("@/services/local-workspace-repository", () => ({ hydrateLocalCanvasProjectsFromBackend: async () => { calls.push("backend"); } }));
mock.module("@/services/appearance-bootstrap", () => ({ bootstrapAppearance: async () => { calls.push("appearance"); } }));
mock.module("../src/application", () => { calls.push("application"); applicationReady(); return {}; });

test("startup leaves scoped canvas hydration to the workspace initializer", async () => {
    await import("../src/main");
    await ready;
    expect(calls).toEqual(["runtime", "appearance", "application"]);
});
