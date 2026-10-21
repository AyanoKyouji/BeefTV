import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GenerationFailureNotice } from "../src/components/generation/generation-failure-notice";
import { explainGenerationError } from "../src/lib/generation-error";

test("uncertain submission offers original task instead of resubmitting", () => {
    const html = renderToStaticMarkup(<GenerationFailureNotice explanation={explainGenerationError({ code: "video_submission_unknown" })} onRetry={() => {}} onOpenDetails={() => {}} />);
    expect(html).toContain("查看原任务");
    expect(html).not.toContain("重新生成");
});

test("invalid reference explains limits without repeating unchanged input", () => {
    const html = renderToStaticMarkup(<GenerationFailureNotice explanation={explainGenerationError("第 2 段参考音频时长为 0.90 秒，需要 2–30 秒；请裁剪或更换这段素材后再提交")} onRetry={() => {}} />);
    expect(html).toContain("第 2 段参考音频");
    expect(html).toContain("2–30 秒");
    expect(html).not.toContain("重新生成");
});

test("a measured 503 explains the outage while preserving uncertain-submission protection", () => {
    const html = renderToStaticMarkup(<GenerationFailureNotice explanation={explainGenerationError({ code: "submission_uncertain" })}
        context={{ failureDiagnostics: { source: "upstream_http", httpStatus: 503, summary: "private raw provider payload" } }}
        onRetry={() => {}} onOpenDetails={() => {}} />);
    expect(html).toContain("模型服务暂时不可用，提交结果尚未确认");
    expect(html).toContain("查看原任务");
    expect(html).not.toContain("重新生成");
    expect(html).not.toContain("private raw provider payload");
});

test("an unconfirmed request without upstream 503 evidence keeps its original cause", () => {
    const explanation = explainGenerationError({ code: "submission_uncertain" });
    const html = renderToStaticMarkup(<GenerationFailureNotice explanation={explanation} context={{ failureDiagnostics: { source: "local_result", httpStatus: 503 } }} />);
    expect(html).toContain(explanation.reason);
    expect(html).not.toContain("模型服务暂时不可用，提交结果尚未确认");
});
