import type { GenerationTask } from "./task-center";

// Page/scope aborts only detach observers. This distinct user intent also
// cancels the durable task, including an admission receipt arriving later.
export const USER_GENERATION_CANCEL = "user-cancel-generation";

export function userCancelledGeneration(signal?: AbortSignal) {
    return signal?.aborted === true && signal.reason === USER_GENERATION_CANCEL;
}

export async function waitWithGenerationCancellation<T>(options: {
    signal?: AbortSignal;
    cancel: () => Promise<GenerationTask>;
    query: () => Promise<GenerationTask>;
    publish: (task: GenerationTask) => void;
    wait: () => Promise<T>;
}) {
    let cancellation: Promise<{ error?: unknown }> | undefined;
    const onAbort = () => {
        if (!userCancelledGeneration(options.signal) || cancellation) return;
        cancellation = (async () => {
            try {
                options.publish(await options.cancel());
                return {};
            } catch (error) {
                // Completion may win the cancel race. Keep its terminal receipt;
                // never manufacture cancellation or submit another generation.
                try {
                    const latest = await options.query();
                    options.publish(latest);
                    if (["succeeded", "failed", "cancelled"].includes(latest.status)) return {};
                } catch { /* Preserve the cancellation failure and task identity. */ }
                return { error };
            }
        })();
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });
    onAbort();
    try {
        if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        return await options.wait();
    } finally {
        options.signal?.removeEventListener("abort", onAbort);
        const outcome = await cancellation;
        if (outcome?.error) throw new Error("取消尚未确认，原任务已保留，请在任务详情中再次取消或查询", { cause: outcome.error });
    }
}
