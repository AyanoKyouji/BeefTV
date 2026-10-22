import { expect, test } from "bun:test";
import { resetGenerationTaskMetadata, stoppedGenerationTask } from "../src/lib/canvas/canvas-generation-attempts";
import { stopUnconfirmedCanvasGeneration } from "../src/lib/canvas/canvas-generation-submission";
import { canvasGenerationTaskNodes } from "../src/pages/canvas/canvas-generation-failure";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";
import type { GenerationTask } from "../src/services/api/task-center";

const node: CanvasNodeData = { id: "target", type: CanvasNodeType.Video, title: "draft", position: {x: 1, y: 2}, width: 320, height: 180, metadata: {composerContent: "edited prompt", references: ["https://example.test/ref.png"], taskClientOperationId: "old-operation", generationSubmissionState: "unknown", status: "error", errorDetails: "unknown"} };
const task: GenerationTask = {id: "old-task", type: "canvas_video", status: "running", clientOperationId: "old-operation", prompt: "old prompt", attempts: 1, createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z"};

test("archived callbacks cannot bind or change a released node before or after a new attempt", () => {
    const stopped = stopUnconfirmedCanvasGeneration([node], node.id, "old-operation")[0]!;
    const fresh = {...stopped, metadata: {...stopped.metadata, taskClientOperationId: "new-operation", status: "loading" as const}};
    for (const current of [stopped, fresh]) for (const status of ["running", "failed", "cancelled", "succeeded"] as const) {
        const late = {...task, status};
        expect(stoppedGenerationTask(current, late)).toBe(true);
        expect(canvasGenerationTaskNodes([current], current.id, late)[0]).toBe(current);
    }
    const currentTask = {...task, id: "new-task", clientOperationId: "new-operation"};
    expect(canvasGenerationTaskNodes([fresh], fresh.id, currentTask)[0]!.metadata?.taskId).toBe("new-task");
});

test("confirmed cancellation releases empty nodes and retains existing output and edited inputs", () => {
    for (const content of [undefined, "resource:previous"]) {
        const current = {...node, metadata: {...node.metadata, generationSubmissionState: "accepted" as const, content, lastGenerationRequestFingerprint: "same"}};
        const cancelled = canvasGenerationTaskNodes([current], current.id, {...task, status: "cancelled"})[0]!;
        expect(cancelled.metadata?.status).toBe(content ? "success" : "idle");
        expect(cancelled.metadata?.composerContent).toBe("edited prompt");
        expect(cancelled.metadata?.references).toEqual(node.metadata?.references);
        expect(cancelled.metadata?.lastGenerationRequestFingerprint).toBeUndefined();
        expect(cancelled.metadata?.errorDetails).toBeUndefined();
    }
});

test("new attempt reset preserves the archived receipt, prior output and editable input", () => {
    const stopped = stopUnconfirmedCanvasGeneration([node], node.id, "old-operation")[0]!;
    const reset = resetGenerationTaskMetadata({...stopped.metadata, content: "resource:previous", taskId: "cancelled-task", taskStatus: "cancelled", generationSubmissionState: "accepted"});
    expect(reset.stoppedGenerationSubmissions).toEqual(stopped.metadata?.stoppedGenerationSubmissions);
    expect(reset.content).toBe("resource:previous");
    expect(reset.composerContent).toBe("edited prompt");
    expect(reset.taskId).toBeUndefined();
    expect(reset.generationSubmissionState).toBeUndefined();
});
