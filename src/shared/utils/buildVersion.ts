import { logger } from "./logger";

// CRA names the entry chunk /static/js/main.<contenthash>.js, and scripts/writeBuildInfo.mjs
// publishes the same path from asset-manifest.json, so the two are directly comparable. The dev
// server serves /static/js/bundle.js instead, which is what keeps the reload feature off there.
const MAIN_SCRIPT_SELECTOR = 'script[src*="/static/js/main."]';
const VERSION_URL = "/version.json";

// Compared as paths so an absolute src and the manifest's root-relative entry still match.
function toPathname(src: string): string | null {
    try {
        return new URL(src, document.baseURI).pathname;
    } catch (error) {
        logger.warn("Build version: unreadable bundle path", src, error);
        return null;
    }
}

/** The entry bundle this tab is running, or null when it was not served from a CRA build. */
export function runningMain(): string | null {
    const src = document.querySelector<HTMLScriptElement>(MAIN_SCRIPT_SELECTOR)?.getAttribute("src");
    return src ? toPathname(src) : null;
}

function readMain(body: unknown): string | null {
    if (typeof body !== "object" || body === null || !("main" in body)) return null;
    const main = body.main;
    return typeof main === "string" && main.length > 0 ? toPathname(main) : null;
}

/**
 * The entry bundle of the build currently deployed, or null when that cannot be told. Never
 * throws: a failed check must only ever mean "no reload", never a broken page.
 */
export async function fetchDeployedMain(): Promise<string | null> {
    try {
        const response = await fetch(VERSION_URL, { cache: "no-store" });
        if (!response.ok) {
            logger.warn(`Build version check: HTTP ${response.status}`);
            return null;
        }
        const main = readMain(await response.json());
        if (main === null) logger.warn("Build version check: version.json names no main bundle");
        return main;
    } catch (error) {
        logger.warn("Build version check failed:", error);
        return null;
    }
}
