import { useEffect } from "react";

const __PLAYED = new WeakSet();

export default function useOscillatingAutoScroll(
    ref,
    {
        enabled = true,
        initialDelay = 800,
        pxPerSecond = 120,
        cycles = 1,
        pauseOnHover = true,
        cancelOnInteract = true,
        bestsellers,
        runOnce = true,
        onceKey = null,
        onceTtlMs = null
    } = {}
) {
    useEffect(() => {
        console.log("im triggered")
        const el = ref.current;
        if (!el || !enabled) return;

        if (runOnce) {
            if (__PLAYED.has(el)) return;

            if (onceKey) {
                try {
                    const raw = sessionStorage.getItem(onceKey);
                    if (raw) {
                        if (!onceTtlMs) return;
                        const { t } = JSON.parse(raw);
                        if (typeof t === "number" && Date.now() - t < onceTtlMs) return;
                    }
                } catch {}
            }
        }

        const mql =
            typeof window !== "undefined"
                ? window.matchMedia("(prefers-reduced-motion: reduce)")
                : null;
        if (mql?.matches) return;

        let rafId = 0;
        let readyTimer = 0;
        let startTimer = 0;
        let running = false;
        let dir = 1; // 1 -> right, -1 -> left
        let hits = 0;
        let last = 0;

        const originalSnap = el.style.scrollSnapType || "";
        const disableSnap = () => { el.style.scrollSnapType = "none"; };
        const restoreSnap = () => { el.style.scrollSnapType = originalSnap; };

        const tick = (now) => {
            if (!running) return;
            const dt = (now - last) / 1200;
            last = now;

            const max = el.scrollWidth - el.clientWidth;
            if (max <= 0) { stop(); return; }

            const delta = dir * pxPerSecond * dt;
            let next = el.scrollLeft + delta;

            if (next <= 0) { next = 0; dir = 0.75; hits++; }
            else if (next >= max) { next = max; dir = -0.75; hits++; }

            el.scrollTo({ left: next, top: 0, behavior: "auto" });

            if (hits >= cycles) { stop(); return; }
            rafId = requestAnimationFrame(tick);
        };

        const start = () => {
            if (running) return;

            if (runOnce) {
                __PLAYED.add(el);
                if (onceKey) {
                    try {
                        sessionStorage.setItem(
                            onceKey,
                            onceTtlMs ? JSON.stringify({ t: Date.now() }) : "1"
                        );
                    } catch {}
                }
            }
            disableSnap();
            running = true;
            last = performance.now();
            rafId = requestAnimationFrame(tick);
        };

        const stop = () => {
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
            restoreSnap();
        };

        const onEnter = () => {
            if (pauseOnHover) {
                stop();
            }
        };
        const onLeave = () => {
            if (pauseOnHover) {
                if (el.scrollWidth > el.clientWidth) {
                    start();
                }
            }
        };

        const cancel = () => {
            if (cancelOnInteract) stop();
        };

        if (pauseOnHover) {
            el.addEventListener("mouseenter", onEnter);
            el.addEventListener("mouseleave", onLeave);
        }
        if (cancelOnInteract) {
            el.addEventListener("pointerdown", cancel, { passive: true });
            el.addEventListener("wheel", cancel, { passive: true });
            el.addEventListener("touchstart", cancel, { passive: true });
        }

        const ensureScrollableAndStart = () => {
            if (el.scrollWidth > el.clientWidth) {
                startTimer = window.setTimeout(start, initialDelay);
                return;
            }
            readyTimer = window.setTimeout(ensureScrollableAndStart, 200);
        };

        const ro =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(() => {
                    if (!running && el.scrollWidth > el.clientWidth) {
                        if (startTimer) clearTimeout(startTimer);
                        startTimer = window.setTimeout(start, 100);
                    }
                })
                : null;
        ro?.observe(el);

        ensureScrollableAndStart();

        return () => {
            stop();
            if (readyTimer) clearTimeout(readyTimer);
            if (startTimer) clearTimeout(startTimer);
            ro?.disconnect();
            if (pauseOnHover) {
                el.removeEventListener("mouseenter", onEnter);
                el.removeEventListener("mouseleave", onLeave);
            }
            if (cancelOnInteract) {
                el.removeEventListener("pointerdown", cancel);
                el.removeEventListener("wheel", cancel);
                el.removeEventListener("touchstart", cancel);
            }
        };
    }, [ref, enabled, initialDelay, pxPerSecond, cycles, pauseOnHover, cancelOnInteract, bestsellers, runOnce, onceKey, onceTtlMs]);
}
