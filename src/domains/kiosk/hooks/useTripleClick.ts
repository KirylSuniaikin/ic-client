import { useRef } from "react";
import type { MouseEvent } from "react";

// Assumed: no click-speed value is specified anywhere in the plan or the RN reference (ic-pizza-
// kiosk has no equivalent gesture — re-pairing there goes through a PIN screen instead, see §22
// Open Question 3). 600ms is a generous-but-deliberate window for three consecutive taps on a
// walk-up touchscreen (fast enough that an ordinary customer tapping the hero video by accident
// won't trigger it, slow enough that a staff member doesn't have to rush).
const DEFAULT_WINDOW_MS = 600;

/**
 * Admin re-pair gesture: three clicks within `windowMs` of each other fire `onTrigger` once. No
 * PIN — the gesture itself (top of the hero video, invisible hotspot) is the only guard (§3 item
 * 3 / task-description.txt E3).
 *
 * Click timestamps are held in a ref array rather than state — this must not cause a re-render on
 * every tap, and the window check only needs to run synchronously inside the click handler.
 */
export function useTripleClick(onTrigger: () => void, windowMs: number = DEFAULT_WINDOW_MS): (event: MouseEvent) => void {
    const clicksRef = useRef<number[]>([]);

    return function handleClick(): void {
        const now = Date.now();
        // Drop clicks that fall outside the window before appending the new one, so a click
        // arriving well after a previous pair starts a fresh window rather than accumulating
        // stale timestamps forever.
        const recent = clicksRef.current.filter(ts => now - ts < windowMs);
        recent.push(now);

        if (recent.length >= 3) {
            clicksRef.current = [];
            onTrigger();
            return;
        }
        clicksRef.current = recent;
    };
}
