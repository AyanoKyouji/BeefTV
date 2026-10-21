import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { chromium, type Browser } from "playwright";

let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
const canvas = { id: "current-canvas", revision: 3, title: "Current canvas", createdAt: "2026-10-21", updatedAt: "2026-10-21", nodes: [], connections: [], chatSessions: [], activeChatId: null, viewport: { x: 0, y: 0, k: 1 }, directorScenes: [] };
beforeAll(async () => {
    const build = await Bun.build({
        entrypoints: [import.meta.dir + "/fixtures/workspace-scope-harness.ts"], target: "browser",
        define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true", "import.meta.env.MODE": '"production"', "import.meta.env.VITE_CANVAS_LOCAL_MODE": '"true"', "import.meta.env.VITE_CANVAS_BACKEND_URL": '"/api"', "process.env.NODE_ENV": '"production"' },
        plugins: [{ name: "workspace-entry", setup(builder) {
            builder.onResolve({ filter: /^@\// }, args => ({ path: Bun.resolveSync("../src/" + args.path.slice(2), import.meta.dir) }));
            builder.onLoad({ filter: /\/application\.tsx$/ }, () => ({ contents: 'import { applyUserSession } from "@/lib/user-session"; import { getWorkspaceBootstrap } from "@/services/api/workspace"; await applyUserSession(await getWorkspaceBootstrap());', loader: "ts" }));
            builder.onLoad({ filter: /\/appearance-bootstrap\.ts$/ }, () => ({ contents: 'export const bootstrapAppearance = async () => {};', loader: "ts" }));
        } }],
    });
    if (!build.success) throw new Error(build.logs.join("\n"));
    const js = await build.outputs[0]!.text();
    const ok = (data: unknown) => Response.json({ code: 0, data });
    server = Bun.serve({ port: 0, fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/harness.js") return new Response(js, { headers: { "Content-Type": "application/javascript" } });
        if (url.pathname === "/api/workspace/bootstrap") return ok({ contractVersion: 1, profile: "local", capabilities: {}, user: { id: "current-workspace" }, workspace: { id: "current-workspace" }, storageMode: "local", features: {} });
        if (url.pathname === "/api/canvas-projects") return ok({ projects: [{ id: canvas.id }] });
        if (url.pathname === "/api/canvas-projects/current-canvas") return ok({ project: canvas });
        if (url.pathname.startsWith("/api/")) return ok({});
        return new Response('<script type="module" src="/harness.js"></script>', { headers: { "Content-Type": "text/html" } });
    } });
    const executablePath = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((path): path is string => Boolean(path && existsSync(path)));
    browser = await chromium.launch({ executablePath, headless: true });
}, 60000);
afterAll(async () => { await browser?.close(); server?.stop(true); });

test("switching desktop data directories never projects backend canvases into the previous workspace cache", async () => {
    const page = await browser.newPage();
    try {
        await page.goto(server.url.toString());
        await page.waitForFunction(() => Boolean((window as any).__scopeResult));
        const result = await page.evaluate(() => (window as any).__scopeResult);
        expect(result.scope).toBe("current-workspace");
        expect(result.projects.map((project: any) => project.id)).toEqual(["current-canvas"]);
        expect(result.previousCache.state.projects.map((project: any) => project.title)).toEqual(["Previous canvas"]);
        expect(result.misplacedJournal).toBeNull();
    } finally { await page.close(); }
}, 15000);
