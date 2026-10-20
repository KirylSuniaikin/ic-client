/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";

// scripts/writeBuildInfo.mjs runs as plain Node after `react-scripts build`, so it is exercised the
// same way here: as a child process whose working directory holds a fake build/ folder.
const SCRIPT = path.resolve(__dirname, "../../../scripts/writeBuildInfo.mjs");
const MAIN = "/static/js/main.1a2b3c4d.js";

type BuildInfo = { main: string; commit: string | null; builtAt: string; version: string };

let projectDir = "";

function writeManifest(files: Record<string, string>): void {
    mkdirSync(path.join(projectDir, "build"), { recursive: true });
    writeFileSync(path.join(projectDir, "build", "asset-manifest.json"), JSON.stringify({ files, entrypoints: [] }));
}

function runScript(commit: string | undefined): { status: number | null; stderr: string } {
    const env = { ...process.env };
    delete env.VERCEL_GIT_COMMIT_SHA;
    if (commit !== undefined) env.VERCEL_GIT_COMMIT_SHA = commit;
    const result = spawnSync(process.execPath, [SCRIPT], { cwd: projectDir, env, encoding: "utf8" });
    return { status: result.status, stderr: result.stderr };
}

function readBuildInfo(): BuildInfo {
    // The shape is asserted field by field in the tests below.
    const info: BuildInfo = JSON.parse(readFileSync(path.join(projectDir, "build", "version.json"), "utf8"));
    return info;
}

// Bahrain is UTC+3 all year (no daylight saving), so the expected stamp is plain arithmetic.
function expectedBahrainCalVer(iso: string): string {
    const bahrain = new Date(Date.parse(iso) + 3 * 60 * 60 * 1000);
    const two = (n: number): string => String(n).padStart(2, "0");
    return `${bahrain.getUTCFullYear()}.${two(bahrain.getUTCMonth() + 1)}.${two(bahrain.getUTCDate())}.` +
        `${two(bahrain.getUTCHours())}${two(bahrain.getUTCMinutes())}`;
}

beforeEach(() => {
    projectDir = mkdtempSync(path.join(tmpdir(), "write-build-info-"));
});

afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
});

describe("scripts/writeBuildInfo.mjs", () => {
    it("writes the main bundle, commit, build time and a Bahrain CalVer to build/version.json", () => {
        writeManifest({ "main.js": MAIN, "main.css": "/static/css/main.abc.css", "index.html": "/index.html" });

        const { status, stderr } = runScript("0123456789abcdef");

        expect(stderr).toBe("");
        expect(status).toBe(0);
        const info = readBuildInfo();
        expect(info.main).toBe(MAIN);
        expect(info.commit).toBe("0123456789abcdef");
        expect(new Date(info.builtAt).toISOString()).toBe(info.builtAt);
        expect(info.version).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d{4}$/);
        expect(info.version).toBe(expectedBahrainCalVer(info.builtAt));
    });

    it("records a null commit outside Vercel", () => {
        writeManifest({ "main.js": MAIN });

        expect(runScript(undefined).status).toBe(0);
        expect(readBuildInfo().commit).toBeNull();
    });

    it("fails the build with a clear message when the manifest has no main.js", () => {
        writeManifest({ "main.css": "/static/css/main.abc.css" });

        const { status, stderr } = runScript("0123456789abcdef");

        expect(status).toBe(1);
        expect(stderr).toContain('files["main.js"]');
        expect(existsSync(path.join(projectDir, "build", "version.json"))).toBe(false);
    });
});
