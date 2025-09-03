import { useEffect } from "react";

export default function useOscillatingAutoScroll(
    ref,
    {
        enabled = true,
        initialDelay = 800,
        pxPerSecond = 240,
        cycles = 1,
        pauseOnHover = true,
        cancelOnInteract = true,
        bestsellers
    } = {}
) {
    useEffect(() => {
        console.log("im triggered")
        const el = ref.current;
        if (!el || !enabled) return;

        // respect user accessibility setting
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
            disableSnap();
            running = true;
            last = performance.now();
            rafId = requestAnimationFrame(tick);
        };

        const stop = () => {
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
            // ВОССТАНАВЛИВАЕМ snap
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
    }, [ref, enabled, initialDelay, pxPerSecond, cycles, pauseOnHover, cancelOnInteract, bestsellers]);
}
