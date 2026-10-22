import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { chromium, type Browser } from "playwright";
import { startCustomerScenarioServer } from "./fixtures/customer-generation-server";

let browser: Browser;
let runtime: Awaited<ReturnType<typeof startCustomerScenarioServer>>;
beforeAll(async () => {
    runtime = await startCustomerScenarioServer();
    const executablePath = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p): p is string => Boolean(p && existsSync(p)));
    browser = await chromium.launch({executablePath, headless: true});
}, 60000);
afterAll(async () => {await browser?.close(); runtime?.stop();});

async function open(options: {character?: boolean; dark?: boolean; narrow?: boolean} = {}) {
    const scenario = options.character ? "character" : "five-images";
    const entry = runtime.create(scenario);
    const context = await browser.newContext({colorScheme: options.dark ? "dark" : "light", viewport: {width: options.narrow ? 390 : 1280, height: 900}});
    await context.addCookies([{name: "scenario", value: entry.id, url: runtime.server.url.toString()}]);
    // These tests must never use a real upstream or credentials.
    await context.route("**/*", route => new URL(route.request().url()).origin === runtime.server.url.origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(entry.url + "&cancel-controls");
    try { await page.getByRole("button", {name: "生成", exact: true}).waitFor({timeout: 5000}); }
    catch (error) { const body = await page.locator("body").innerText(); await context.close(); throw new Error(JSON.stringify({errors, body}), {cause: error}); }
    return {...entry, context, page, errors, close: async () => {entry.state.release(); await context.close();}};
}

async function until(predicate: () => boolean) {
    const deadline = Date.now() + 5000;
    while (!predicate() && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
    expect(predicate()).toBe(true);
}

for (const dark of [false, true]) for (const narrow of [false, true]) test(`real composer cancels a late receipt once (${dark ? "dark" : "light"}, ${narrow ? "390px" : "desktop"})`, async () => {
    const {page, state, errors, close} = await open({dark, narrow});
    let release!: () => void;
    const gate = new Promise<void>(resolve => {release = resolve;});
    let held = false;
    await page.route("**/api/tasks", async route => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await route.fetch(); held = true; await gate; await route.fulfill({response});
    });
    try {
        await page.getByRole("button", {name: "生成", exact: true}).click();
        await until(() => held);
        await page.getByRole("textbox", {name: "视频提示词", exact: true}).fill("");
        const cancel = page.getByRole("button", {name: "取消生成", exact: true});
        expect(await cancel.isEnabled()).toBe(true);
        await cancel.click();
        expect(await page.getByRole("button", {name: "正在取消生成", exact: true}).isDisabled()).toBe(true);
        expect(state.cancels).toHaveLength(0);
        release();
        await until(() => state.cancels.length === 1);
        await page.waitForFunction(() => (window as any).__customer.settled);
        const metadata = await page.evaluate(() => (window as any).__customer.nodes.find((n: any) => n.id === "target").metadata);
        expect(metadata.taskId).toBe("original-customer-task");
        expect(metadata.taskStatus).toBe("cancelled");
        expect(metadata.composerContent.trim()).toBe("");
        expect(state.posts).toHaveLength(1);
        expect(state.cancels).toEqual(["original-customer-task"]);
        expect(errors).toEqual([]);
    } finally {release(); await close();}
}, 20000);

test("composer cancellation during preparation preserves edited prompt and previous output without admitting a task", async () => {
    const {page, state, errors, close} = await open({character: true});
    let release!: () => void; const gate = new Promise<void>(r => {release = r;}); let held = false;
    await page.route("**/api/projects/synthetic-domain/characters/character-asset", async route => {held = true; await gate; await route.continue();});
    try {
        await page.getByRole("button", {name: "生成", exact: true}).click(); await until(() => held);
        await page.getByRole("textbox", {name: "视频提示词", exact: true}).fill("修改后的提示词");
        await page.getByRole("button", {name: "取消生成", exact: true}).click();
        await page.waitForFunction(() => (window as any).__customer.settled);
        release();
        const m = await page.evaluate(() => (window as any).__customer.nodes.find((n: any) => n.id === "target").metadata);
        expect(m.composerContent).toBe("修改后的提示词"); expect(m.storageKey).toBe("resource:previous-result");
        expect(state.posts).toHaveLength(0); expect(state.cancels).toHaveLength(0); expect(errors).toEqual([]);
        expect(await page.getByRole("button", {name: "生成", exact: true}).isEnabled()).toBe(true);
    } finally {release(); await close();}
}, 15000);

test("an accepted task can be cancelled from its composer", async () => {
    const {page, state, close} = await open();
    try {
        await page.getByRole("button", {name: "生成", exact: true}).click();
        await page.waitForFunction(() => (window as any).__customer.nodes.find((n: any) => n.id === "target").metadata.taskId);
        await page.getByRole("button", {name: "取消生成", exact: true}).click();
        await until(() => state.cancels.length === 1);
        await page.waitForFunction(() => (window as any).__customer.settled);
        expect(state.task.status).toBe("cancelled"); expect(state.posts).toHaveLength(1);
    } finally {await close();}
}, 15000);

test("cancel API failure preserves the original running task and reports uncertainty", async () => {
    const {page, state, close} = await open(); let cancels = 0;
    await page.route("**/api/tasks/original-customer-task/cancel", async route => {cancels++; await route.fulfill({status: 503, json: {code: 503, msg: "cancel unavailable"}});});
    try {
        await page.getByRole("button", {name: "生成", exact: true}).click();
        await page.waitForFunction(() => (window as any).__customer.nodes.find((n: any) => n.id === "target").metadata.taskId);
        await page.getByRole("button", {name: "取消生成", exact: true}).click();
        await page.waitForFunction(() => (window as any).__customer.settled);
        const m = await page.evaluate(() => (window as any).__customer.nodes.find((n: any) => n.id === "target").metadata);
        expect(cancels).toBe(1); expect(m.taskId).toBe("original-customer-task"); expect(m.taskStatus).toBe("running");
        expect(m.errorDetails).toContain("取消尚未确认"); expect(state.posts).toHaveLength(1);
    } finally {await close();}
}, 15000);

test("closing the page does not cancel a durable generation", async () => {
    const {page, state, close} = await open();
    try {
        await page.getByRole("button", {name: "生成", exact: true}).click(); await until(() => state.posts.length === 1);
        await page.close(); expect(state.cancels).toHaveLength(0); expect(state.task.status).toBe("running");
    } finally {await close();}
}, 15000);

test("lost receipt plus unavailable lookup retains uncertainty without resubmission", async () => {
    const {page, state, close} = await open();
    let release!: () => void; const gate = new Promise<void>(r => {release = r;}); let held = false;
    await page.route("**/api/tasks", async route => {
        if (route.request().method() !== "POST") return route.continue();
        await route.fetch(); held = true; await gate; await route.abort("connectionreset");
    });
    await page.route("**/api/tasks/by-operation/**", route => route.fulfill({status: 503, json: {code: 503, msg: "lookup unavailable"}}));
    try {
        await page.getByRole("button", {name: "生成", exact: true}).click(); await until(() => held);
        await page.getByRole("button", {name: "取消生成", exact: true}).click(); release();
        await page.waitForFunction(() => (window as any).__customer.settled);
        const m = await page.evaluate(() => (window as any).__customer.nodes.find((n: any) => n.id === "target").metadata);
        expect(m.generationSubmissionState).toBe("unknown"); expect(m.taskClientOperationId).toBe(state.task.clientOperationId);
        expect(state.posts).toHaveLength(1); expect(state.cancels).toHaveLength(0); expect(state.task.status).toBe("running");
    } finally {release(); await close();}
}, 15000);
