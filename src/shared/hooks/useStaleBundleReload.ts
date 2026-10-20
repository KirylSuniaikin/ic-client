import { useEffect, useRef } from "react";
import { fetchDeployedMain, runningMain } from "../utils/buildVersion";
import { logger } from "../utils/logger";
import { clearPageLeaving, isPageLeaving, markPageLeaving } from "../utils/pageLeaving";

export const CHECK_INTERVAL_MS = 10 * 60 * 1000;
export const MIN_CHECK_GAP_MS = 60 * 1000;

/**
 * How long the page must have been safe before a reload may fire.
 *
 * Three ways out of checkout empty the cart and close every sheet BEFORE the page navigates: the
 * pickup and delivery gateway redirects, and the BenefitPay confirm that then opens
 * /payment_result. They hold the reload off with markPageLeaving(); this delay is the backstop for
 * a way out that does not, since a reload fired before it leaves would cancel the navigation and
 * strand a paid or half-paid order.
 */
export const SETTLE_MS = 60 * 1000;

/** Per tab: the deployed bundle this tab has already reloaded for, so a mismatch cannot loop. */
export const RELOAD_TARGET_KEY = "staleBundleReloadTarget";

interface StaleBundleWatcher {
    setSafe: (safe: boolean) => void;
    dispose: () => void;
}

// Claims the one reload allowed per target. Without working storage the loop guard cannot hold,
// so no reload is the safe answer.
function claimReload(target: string): boolean {
    try {
        if (sessionStorage.getItem(RELOAD_TARGET_KEY) === target) {
            logger.info("Stale bundle: already reloaded once for", target, "- not again this session");
            return false;
        }
        sessionStorage.setItem(RELOAD_TARGET_KEY, target);
        return true;
    } catch (error) {
        logger.warn("Stale bundle: session storage unavailable, skipping the reload", error);
        return false;
    }
}

function isVisible(): boolean {
    return document.visibilityState === "visible";
}

function startWatcher(running: string, initiallySafe: boolean): StaleBundleWatcher {
    let safe = initiallySafe;
    // A fresh mount has nothing of its own in flight, so a page that starts safe counts as settled.
    let safeSince = Number.NEGATIVE_INFINITY;
    let staleTarget: string | null = null;
    let lastCheckAt = Number.NEGATIVE_INFINITY;
    let checking = false;
    let disposed = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    function disarm(): void {
        if (settleTimer !== null) {
            clearTimeout(settleTimer);
            settleTimer = null;
        }
    }

    function markLeaving(): void {
        markPageLeaving();
        disarm();
    }

    function reloadWhenSettled(): void {
        if (disposed || isPageLeaving() || !safe || staleTarget === null || settleTimer !== null) return;
        const remaining = safeSince + SETTLE_MS - Date.now();
        if (remaining > 0) {
            settleTimer = setTimeout(() => {
                settleTimer = null;
                reloadWhenSettled();
            }, remaining);
            return;
        }
        if (!claimReload(staleTarget)) return;
        logger.info("Stale bundle: reloading for", staleTarget);
        window.location.reload();
    }

    async function check(): Promise<void> {
        const startedAt = Date.now();
        if (disposed || checking || startedAt - lastCheckAt < MIN_CHECK_GAP_MS) return;
        lastCheckAt = startedAt;
        checking = true;
        try {
            const deployed = await fetchDeployedMain();
            if (disposed || deployed === null) return;
            staleTarget = deployed === running ? null : deployed;
            reloadWhenSettled();
        } catch (error) {
            logger.warn("Stale bundle check failed:", error);
        } finally {
            checking = false;
        }
    }

    const onVisibilityChange = (): void => {
        if (isVisible()) void check();
    };
    const onPageShow = (event: PageTransitionEvent): void => {
        // Only a back/forward-cache restore revives a page that had left; the first pageshow can
        // fire after a checkout has already started leaving, if the page was still loading.
        if (event.persisted) {
            clearPageLeaving();
            // The stale target is already known, and the throttled check below may skip it.
            reloadWhenSettled();
        }
        void check();
    };
    const onFocus = (): void => {
        void check();
    };
    const interval = setInterval(() => {
        if (isVisible()) void check();
    }, CHECK_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pagehide", markLeaving);
    void check();

    return {
        setSafe(next: boolean): void {
            if (next === safe) return;
            safe = next;
            if (!next) {
                disarm();
                return;
            }
            safeSince = Date.now();
            reloadWhenSettled();
        },
        dispose(): void {
            disposed = true;
            disarm();
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("pageshow", onPageShow);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("pagehide", markLeaving);
        },
    };
}

/**
 * Reloads the page once a newer build has been deployed, so a tab kept open across a deploy does
 * not keep offering an old checkout. The reload waits until `isSafe` has held for SETTLE_MS (a page
 * already safe when it mounts reloads straight away); the caller decides what "safe" means. Off
 * wherever the page was not served from a CRA build (dev server, tests).
 */
export function useStaleBundleReload(isSafe: boolean): void {
    const watcherRef = useRef<StaleBundleWatcher | null>(null);
    // Read by the mount effect, which must not re-run (and restart the watcher) on every change.
    const isSafeRef = useRef(isSafe);
    isSafeRef.current = isSafe;

    useEffect(() => {
        const running = runningMain();
        if (running === null) return;
        const watcher = startWatcher(running, isSafeRef.current);
        watcherRef.current = watcher;
        return () => {
            watcher.dispose();
            watcherRef.current = null;
        };
    }, []);

    useEffect(() => {
        watcherRef.current?.setSafe(isSafe);
    }, [isSafe]);
}
