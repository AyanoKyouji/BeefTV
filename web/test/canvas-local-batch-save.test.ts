import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import type { CanvasGenerationBatch, CanvasNodeData } from "@/types/canvas";

const effects: Array<() => void | (() => void)> = [];
const cleanups: Array<() => void> = [];
const events: string[] = [];
let currentScope = true;
mock.module("react", () => ({
    useCallback: (callback: unknown) => callback,
    useRef: (value: unknown) => ({ current: value }),
    useEffect: (callback: () => void | (() => void)) => effects.push(callback),
}));
mock.module("antd", () => ({ App: { useApp: () => ({ message: { error: () => {}, warning: () => {}, info: () => {} }, modal: {} }) } }));
mock.module("@/stores/use-config-store", () => ({ useEffectiveConfig: () => ({}), useConfigStore: (select: (value: unknown) => unknown) => select({ isAiConfigReady: () => true }) }));
mock.module("@/stores/use-user-store", () => ({ useUserStore: (select: (value: unknown) => unknown) => select({ runtimeLimits: { activeTaskLimit: 1 } }) }));
mock.module("@/lib/user-scope-guard", () => ({ captureUserScope: () => ({ userScope: "local", epoch: 1 }), userScopeMatches: () => currentScope }));
mock.module("@/lib/generation-error", () => ({ shouldBlockManualRetry: () => false }));
mock.module("@/lib/canvas/canvas-project-generation", () => ({ buildGenerationConfig: () => ({ model: "mock-text" }), createGenerationRetryContext: async () => ({}), generationTaskMetadata: () => ({}), resetGenerationTaskMetadata: (value: unknown) => value }));
mock.module("@/services/api/task-center", () => ({ listGenerationTasks: async () => { events.push("list"); return []; } }));
const { useCanvasGenerationBatches } = await import("@/pages/canvas/use-canvas-generation-batches");

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
beforeEach(() => {
    effects.length = 0; events.length = 0; currentScope = true;
    (globalThis as any).window = { setInterval: () => 1, clearInterval: () => {} };
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); delete (globalThis as any).window; });

function mount(flush: () => Promise<void>) {
    const batch = { id: "batch", sourceNodeId: "script", projectId: "canvas", mode: "storyboard_image", status: "queued", createdAt: "", updatedAt: "", items: [1, 2, 3].map(i => ({ id: `item-${i}`, rowId: `row-${i}`, nodeId: `image-${i}`, status: "waiting", retryCount: 0 })) } as CanvasGenerationBatch;
    const nodesRef = { current: [{ id: "script", metadata: { generationBatches: [batch] } }, ...[1, 2, 3].map(i => ({ id: `image-${i}`, metadata: { prompt: "镜头画面", status: "idle" } }))] as CanvasNodeData[] };
    const setNodes = (next: any) => { nodesRef.current = typeof next === "function" ? next(nodesRef.current) : next; };
    useCanvasGenerationBatches({ projectId: "canvas", projectLoaded: true, nodes: nodesRef.current, nodesRef, setNodes, flushCanvasProject: async () => { events.push("save"); await flush(); events.push("saved"); }, handleGenerateNode: async nodeId => {
        events.push(`submit:${nodeId}`);
        setNodes((nodes: CanvasNodeData[]) => nodes.map(node => node.id === nodeId ? { ...node, metadata: { ...node.metadata, status: "loading", taskId: "mock-task", taskStatus: "queued" } } : node));
    } });
    effects.forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
    return nodesRef;
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
