import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary = mkdtempSync(join(tmpdir(), "beeftv-dev-proxy-"));
const tokenFile = join(temporary, "owner-token");
const syntheticToken = "synthetic-local-owner-credential";
writeFileSync(tokenFile, syntheticToken + "\n", { mode: 0o600 });
afterAll(() => rmSync(temporary, { recursive: true, force: true }));

function configResult(file = "") {
    return Bun.spawnSync({
        cmd: [process.execPath, "--eval", `
            import config from "./vite.config.ts";
            import { loadEnv } from "vite";
            console.log(JSON.stringify({ proxy: config.server.proxy, publicEnv: loadEnv("development", process.cwd()) }));
        `],
        cwd: new URL("..", import.meta.url).pathname,
        env: { ...process.env, BEEFTV_DEV_OWNER_TOKEN_FILE: file, VITE_DESKTOP_LAUNCH_TOKEN: "" },
    });
}

describe("local development proxy identity", () => {
    test("authenticates operation and UI entries without marking model configuration as external discovery", () => {
        const result = configResult(tokenFile);
        expect(result.exitCode).toBe(0);
        const { proxy, publicEnv } = JSON.parse(result.stdout.toString());
        for (const route of ["/api/ops", "/api/assistant/ui-session", "/api/agent-clients"]) {
            expect(proxy[route].headers["X-Beeftv-Owner"]).toBe(syntheticToken);
        }
        expect(proxy["/api"].headers["X-Beeftv-Owner"]).toBeUndefined();
        expect(JSON.stringify(publicEnv)).not.toContain(syntheticToken);
        expect(JSON.stringify(publicEnv)).not.toContain(tokenFile);
    });

    test("normal Vite usage does not add a development owner identity", () => {
        const result = configResult();
        expect(result.exitCode).toBe(0);
        const { proxy } = JSON.parse(result.stdout.toString());
        expect(Object.keys(proxy)).toEqual(["/api"]);
        expect(proxy["/api"].headers["X-Beeftv-Owner"]).toBeUndefined();
    });

    test("an empty credential file stops configuration instead of silently starting an unusable proxy", () => {
        const emptyFile = join(temporary, "empty-token");
        writeFileSync(emptyFile, "\n");
        const result = configResult(emptyFile);
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr.toString()).toContain("Local development owner credential is empty");
    });
});
