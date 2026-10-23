import { expect, test } from "bun:test";
import { submitStoryboardTask } from "../src/services/storyboard-submission";
import { creationRuns, type CreationSubmission } from "../src/services/api/creation-runs";
import type { CreateTaskInput } from "../src/services/api/task-center";

const request = { type: "canvas_text", operation: "storyboard", projectId: "canvas", prompt: "剧本" } as CreateTaskInput;
function harness() {
    const calls: string[] = [];
    const run = { id: "run", executionEpoch: 1, executionOwner: "owner" };
    const submission = { id: "submission", execution: { model: "text-test", configHash: "stable", options: {} } } as CreationSubmission;
    const api = {
        ...creationRuns,
        create: async () => ({ run, submissions: [] }), claim: async () => run,
        prepare: async () => { calls.push("prepare"); return submission; },
        approve: async () => { calls.push("approve"); return { submissions: [{ ...submission, approvedAt: "now" }] }; },
        execute: async () => { calls.push("execute"); return { id: "task" }; },
        release: async () => { calls.push("release"); return { released: true }; },
    } as typeof creationRuns;
    return { api, calls };
}
test("已取消的专业拆镜不会批准或提交任务", async () => {
    const h = harness();
    const controller = new AbortController();
    controller.abort();
    await expect(submitStoryboardTask(request, { signal: controller.signal, assertCurrent() {} }, h.api)).rejects.toMatchObject({ name: "AbortError" });
    expect(h.calls).toEqual(["prepare", "release"]);
});
test("点击生成直接提交原配置对应的专业任务", async () => {
    const h = harness();
    expect((await submitStoryboardTask(request, { signal: new AbortController().signal, assertCurrent() {} }, h.api))?.id).toBe("task");
    expect(h.calls).toEqual(["prepare", "approve", "execute", "release"]);
});
test("提交前分镜校验失败会阻止执行", async () => {
	const h = harness();
	await expect(submitStoryboardTask(request, { signal: new AbortController().signal, assertCurrent() { throw new Error("分镜已编辑"); } }, h.api)).rejects.toThrow();
	expect(h.calls).toEqual(["prepare", "release"]);
});
