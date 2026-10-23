import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { CanvasGenerationBatch, CanvasNodeData } from "@/types/canvas";

const effects: Array<() => void | (() => void)> = [];
const cleanups: Array<() => void> = [];
const events: string[] = [];
const timers: Array<() => void> = [];
let currentScope = true;
let activeTaskLimit = 1;
mock.module("react", () => ({
    useCallback: (callback: unknown) => callback,
    useRef: (value: unknown) => ({ current: value }),
    useEffect: (callback: () => void | (() => void)) => effects.push(callback),
}));
mock.module("antd", () => ({ App: { useApp: () => ({ message: { error: () => {}, warning: () => {}, info: () => {} }, modal: {} }) } }));
mock.module("@/stores/use-config-store", () => ({ useEffectiveConfig: () => ({}), useConfigStore: (select: (value: unknown) => unknown) => select({ isAiConfigReady: () => true }) }));
mock.module("@/stores/use-user-store", () => ({ useUserStore: (select: (value: unknown) => unknown) => select({ runtimeLimits: { activeTaskLimit } }) }));
mock.module("@/lib/user-scope-guard", () => ({ captureUserScope: () => ({ userScope: "local", epoch: 1 }), userScopeMatches: () => currentScope }));
mock.module("@/lib/generation-error", () => ({ shouldBlockManualRetry: () => false }));
mock.module("@/lib/canvas/canvas-project-generation", () => ({ buildGenerationConfig: () => ({ model: "mock-text" }), createGenerationRetryContext: async () => ({}), generationTaskMetadata: () => ({}), resetGenerationTaskMetadata: (value: unknown) => value }));
mock.module("@/services/api/task-center", () => ({ listGenerationTasks: async () => { events.push("list"); return []; } }));
const { useCanvasGenerationBatches } = await import("@/pages/canvas/use-canvas-generation-batches");

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
beforeEach(() => {
    effects.length = 0; events.length = 0; timers.length = 0; currentScope = true; activeTaskLimit = 1;
    (globalThis as any).window = { setInterval: (callback: () => void) => { timers.push(callback); return 1; }, clearInterval: () => {} };
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); delete (globalThis as any).window; });

function mount(flush: () => Promise<void>, options: { loaded?: boolean; mixed?: boolean; deferFunctions?: boolean } = {}) {
    const batch = { id: "batch", sourceNodeId: "script", projectId: "canvas", mode: "storyboard_image", status: "queued", createdAt: "", updatedAt: "", items: [1, 2, 3].map(i => ({ id: `item-${i}`, rowId: `row-${i}`, nodeId: `image-${i}`, status: "waiting", retryCount: 0 })) } as CanvasGenerationBatch;
    const nodesRef = { current: [{ id: "script", metadata: { generationBatches: [batch] } }, ...[1, 2, 3].map(i => ({ id: `image-${i}`, metadata: { prompt: "镜头画面", status: "idle" } }))] as CanvasNodeData[] };
    if (options.mixed) {
        batch.items = [batch.items[0]];
        nodesRef.current[0].metadata!.generationBatches!.push({ ...batch, id: "video-batch", mode: "storyboard_video", items: [{ ...batch.items[0], id: "video-item", nodeId: "video-1" }] });
        nodesRef.current.push({ id: "video-1", metadata: { prompt: "镜头视频", status: "idle" } } as CanvasNodeData);
    }
    const setNodes = (next: any) => { if (options.deferFunctions && typeof next === "function") return; nodesRef.current = typeof next === "function" ? next(nodesRef.current) : next; };
    const api = useCanvasGenerationBatches({ projectId: "canvas", projectLoaded: options.loaded ?? true, nodes: nodesRef.current, nodesRef, setNodes, flushCanvasProject: async () => { events.push("save"); await flush(); events.push("saved"); }, handleGenerateNode: async nodeId => {
        events.push(`submit:${nodeId}`);
        setNodes((nodes: CanvasNodeData[]) => nodes.map(node => node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: "loading", taskId: "mock-task", taskStatus: "queued" } } : node));
    } });
    effects.forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
    return Object.assign(nodesRef, { api });
}

test("local batches wait for the complete canvas save before dispatch and respect capacity", async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const nodes = mount(() => pending);
    expect(events).toEqual(["save"]);
    release(); await settle();
    expect(events).toEqual(["save", "saved", "list", "submit:image-1"]);
    expect(nodes.current[0].metadata?.generationBatches?.[0].items.map(item => item.status)).toEqual(["queued", "waiting", "waiting"]);
});

test("a rejected save submits no task and leaves all waiting rows retryable", async () => {
    const nodes = mount(async () => { throw new Error("版本冲突"); });
    await settle();
    expect(events).toEqual(["save"]);
    expect(nodes.current[0].metadata?.generationBatches?.[0].items.every(item => item.status === "failed" && item.errorDetails?.includes("版本冲突"))).toBe(true);
});

test("a cancelled batch is re-read after saving rather than submitted from an old snapshot", async () => {
    let release!: () => void;
    const nodes = mount(() => new Promise<void>(resolve => { release = resolve; }));
    nodes.current[0].metadata!.generationBatches![0].items.forEach(item => { item.status = "cancelled"; });
    release(); await settle();
    expect(events).toEqual(["save", "saved", "list"]);
});

test("changing account while saving cannot dispatch the old canvas batch", async () => {
    let release!: () => void;
    mount(() => new Promise<void>(resolve => { release = resolve; }));
    currentScope = false;
    release(); await settle();
    expect(events).toEqual(["save", "saved"]);
});

test("separate image and video batches dispatch in the same capacity window", async () => {
    activeTaskLimit = 2;
    const nodes = mount(async () => {}, { mixed: true });
    await settle();
    expect(events).toEqual(["save", "saved", "list", "submit:image-1", "submit:video-1"]);
    expect(nodes.current[0].metadata!.generationBatches!.map(batch => batch.items[0].status)).toEqual(["queued", "queued"]);
});

test("enqueue reserves immediately even when React defers functional state updates", () => {
    const nodes = mount(async () => {}, { loaded: false, deferFunctions: true });
    nodes.current[0].metadata!.generationBatches = [];
    const imageBatch = nodes.api.enqueueGenerationBatch("script", "storyboard_image", [{ rowId: "one", nodeId: "image-1" }]);
    const duplicate = nodes.api.enqueueGenerationBatch("script", "storyboard_image", [{ rowId: "one", nodeId: "image-1" }]);
    const videoBatch = nodes.api.enqueueGenerationBatch("script", "storyboard_video", [{ rowId: "one", nodeId: "video-1" }]);
    expect(imageBatch).toBeTruthy(); expect(videoBatch).toBeTruthy(); expect(duplicate).toBeUndefined();
    expect(nodes.current[0].metadata!.generationBatches!.map(batch => batch.id)).toEqual([imageBatch!, videoBatch!]);
    expect(events).toEqual([]);
});

test("history trimming cannot discard waiting concurrent batches", () => {
    const nodes = mount(async () => {}, { loaded: false });
    nodes.current[0].metadata!.generationBatches = [];
    for (let i = 0; i < 25; i++) nodes.api.enqueueGenerationBatch("script", "storyboard_image", [{ rowId: `row-${i}`, nodeId: `target-${i}` }]);
    expect(nodes.current[0].metadata!.generationBatches).toHaveLength(25);
    expect(nodes.current[0].metadata!.generationBatches!.every(batch => batch.items[0].status === "waiting")).toBe(true);
});

test("a new click while saving waits for a save cycle that includes its targets", async () => {
    activeTaskLimit = 2;
    let release!: () => void;
    let saves = 0;
    const nodes = mount(() => ++saves === 1 ? new Promise<void>(resolve => { release = resolve; }) : Promise.resolve());
    nodes.current[0].metadata!.generationBatches![0].items = [nodes.current[0].metadata!.generationBatches![0].items[0]];
    nodes.current.push({ id: "video-new", metadata: { prompt: "新镜头视频", status: "idle" } } as CanvasNodeData);
    nodes.api.enqueueGenerationBatch("script", "storyboard_video", [{ rowId: "row-new", nodeId: "video-new" }]);
    release(); await settle();
    expect(events.filter(event => event.startsWith("submit:"))).toEqual(["submit:image-1"]);
    expect(nodes.current[0].metadata!.generationBatches![1].items[0].status).toBe("waiting");
    timers[0](); await settle();
    expect(saves).toBe(2);
    expect(events.filter(event => event.startsWith("submit:"))).toEqual(["submit:image-1", "submit:video-new"]);
});
