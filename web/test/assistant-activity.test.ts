import { expect, test } from "bun:test";
import { assistantActivityState } from "../src/pages/canvas/canvas-assistant-copy";

const ready = { streaming: false, awaitingReceipt: false, available: true, historyLoaded: true, historyError: false, sessionBusy: false, failed: false, pendingProposal: false, cancelled: false };

test("a new active turn animates despite an older error or pending proposal", () => {
    expect(assistantActivityState({ ...ready, streaming: true, failed: true, pendingProposal: true })).toEqual({ phase: "processing", text: "处理中", animated: true });
});
test("waiting for a final receipt remains active until the result is known", () => {
    expect(assistantActivityState({ ...ready, awaitingReceipt: true }).animated).toBe(true);
    expect(assistantActivityState({ ...ready, awaitingReceipt: true }).phase).toBe("receiving");
});
test("an ended turn awaiting generation confirmation stays still", () => {
    expect(assistantActivityState({ ...ready, pendingProposal: true })).toEqual({ phase: "confirmation", text: "等待确认", animated: false });
});
test("an ended turn stays idle when its proposal has already been submitted", () => {
    expect(assistantActivityState(ready)).toEqual({ phase: "idle", text: "就绪", animated: false });
});
test("failure and cancellation stop the activity animation", () => {
    expect(assistantActivityState({ ...ready, failed: true, pendingProposal: true })).toEqual({ phase: "error", text: "本轮未完成", animated: false });
    expect(assistantActivityState({ ...ready, cancelled: true })).toEqual({ phase: "stopped", text: "已停止", animated: false });
});
test("unread history, failed history and unavailable host never claim ready", () => {
    expect(assistantActivityState({ ...ready, historyLoaded: false }).phase).toBe("loading");
    expect(assistantActivityState({ ...ready, historyError: true }).phase).toBe("unavailable");
    expect(assistantActivityState({ ...ready, available: false }).phase).toBe("unavailable");
    expect(assistantActivityState({ ...ready, sessionBusy: true }).animated).toBe(false);
});
