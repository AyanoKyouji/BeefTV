import type { CanvasNodeData, CanvasNodeMetadata } from "@/types/canvas";
import type { GenerationTask } from "@/services/api/task-center";

export function resetGenerationTaskMetadata(metadata: CanvasNodeMetadata | undefined, status: CanvasNodeMetadata["status"] = "idle"): CanvasNodeMetadata {
    const next = { ...(metadata || {}), status, errorDetails: undefined, generationErrorCode: undefined, generationErrorSummary: undefined, resourceReloadAvailable: undefined, failedPromptFingerprint: undefined, failedInputFingerprint: undefined };
    for (const key of ["taskId", "taskType", "taskOutputIndex", "taskClientOperationId", "generationSubmissionState", "retryOf", "attemptGroupId", "taskStatus", "taskProgress", "taskStage", "taskProvider", "taskStartedAt", "taskCompletedAt", "taskDurationMs", "taskErrorCode", "taskFailureDiagnostics", "taskProviderRequestId", "taskOfficialStatus", "taskReceiptRecorded", "taskCreatedAt", "taskUpdatedAt"] as const) delete next[key];
    return next;
}

export function stoppedGenerationTask(node: CanvasNodeData | undefined, task: GenerationTask) {
    const meta = node?.metadata;
    if (task.clientOperationId && meta?.taskClientOperationId && task.clientOperationId !== meta.taskClientOperationId) return true;
    return meta?.stoppedGenerationSubmissions?.some((attempt) => attempt.operationId === task.clientOperationId || Boolean(attempt.taskId && attempt.taskId === task.id)) ?? false;
}
