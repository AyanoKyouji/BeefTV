import { expect, test } from "bun:test";
import { USER_GENERATION_CANCEL, waitWithGenerationCancellation } from "@/services/api/generation-cancellation";
import type { GenerationTask } from "@/services/api/task-center";

const task = (status: GenerationTask["status"]) => ({id: "original", status} as GenerationTask);
const abortWait = (signal: AbortSignal) => new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {once: true}));

test("explicit cancellation stops the original durable task once", async () => {
    const controller = new AbortController(); let cancels = 0; const states: string[] = [];
    const pending = waitWithGenerationCancellation({signal: controller.signal, cancel: async () => {cancels++; return task("cancelled");}, query: async () => task("running"), publish: t => states.push(t.status), wait: () => abortWait(controller.signal)});
    controller.abort(USER_GENERATION_CANCEL); controller.abort(USER_GENERATION_CANCEL);
    await expect(pending).rejects.toMatchObject({name: "AbortError"});
    expect(cancels).toBe(1); expect(states).toEqual(["cancelled"]);
});

test("a late admission receipt is cancelled even when the signal is already aborted", async () => {
    const controller = new AbortController(); controller.abort(USER_GENERATION_CANCEL);
    let cancels = 0, waits = 0;
    await expect(waitWithGenerationCancellation({signal: controller.signal, cancel: async () => {cancels++; return task("cancelled");}, query: async () => task("running"), publish() {}, wait: async () => {waits++;}})).rejects.toMatchObject({name: "AbortError"});
    expect([cancels, waits]).toEqual([1, 0]);
});

test("page and scope aborts only detach the observer", async () => {
    const controller = new AbortController(); let cancels = 0;
    const pending = waitWithGenerationCancellation({signal: controller.signal, cancel: async () => {cancels++; return task("cancelled");}, query: async () => task("running"), publish() {}, wait: () => abortWait(controller.signal)});
    controller.abort(); await expect(pending).rejects.toMatchObject({name: "AbortError"}); expect(cancels).toBe(0);
});

test("cancel failure retains the running task and never reports cancellation", async () => {
    const controller = new AbortController(); const states: string[] = [];
    const pending = waitWithGenerationCancellation({signal: controller.signal, cancel: async () => {throw new Error("offline");}, query: async () => task("running"), publish: t => states.push(t.status), wait: () => abortWait(controller.signal)});
    controller.abort(USER_GENERATION_CANCEL);
    await expect(pending).rejects.toThrow("取消尚未确认"); expect(states).toEqual(["running"]);
});

test("completion winning the cancel race keeps the successful receipt", async () => {
    const controller = new AbortController(); const states: string[] = [];
    const pending = waitWithGenerationCancellation({signal: controller.signal, cancel: async () => {throw new Error("already completed");}, query: async () => task("succeeded"), publish: t => states.push(t.status), wait: () => abortWait(controller.signal)});
    controller.abort(USER_GENERATION_CANCEL);
    await expect(pending).rejects.toMatchObject({name: "AbortError"}); expect(states).toEqual(["succeeded"]);
});

test("normal completion removes its cancellation listener", async () => {
    const controller = new AbortController(); let cancels = 0;
    expect(await waitWithGenerationCancellation({signal: controller.signal, cancel: async () => {cancels++; return task("cancelled");}, query: async () => task("succeeded"), publish() {}, wait: async () => "result"})).toBe("result");
    controller.abort(USER_GENERATION_CANCEL); expect(cancels).toBe(0);
});
