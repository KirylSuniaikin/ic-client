import {useEffect, useRef, useState} from "react";

/**
 * How long a confirmed payment stays on screen before the customer is taken back to the menu.
 *
 * <p>Ten seconds is long enough to read the order number and short enough that nobody feels held.
 * The same constant exists in `ic-pizza-mobile` — the two screens are siblings and must count the
 * same.
 */
export const RETURN_DELAY_SECONDS = 10;

/**
 * Counts down to an automatic hand-off, and reports the seconds left so the screen can show them.
 *
 * <p>Two timers on purpose. The hand-off is ONE `setTimeout` for the whole delay, so it fires at
 * the real deadline instead of accumulating the drift of ten chained ticks; the display is a plain
 * `setInterval` that only decrements a number. `usePreciseCountdown` was the other candidate and
 * was not reused: it aligns its ticks to the wall-clock second grid, which is what a resend
 * cooldown wants and what makes a fixed 10.0 s deadline arrive up to a second late here.
 *
 * <p>`onElapsed` is read through a ref because every caller passes an inline arrow: depending on
 * its identity would re-arm the timeout on each render and the hand-off would never arrive.
 */
export function useReturnCountdown(totalSeconds: number, onElapsed: () => void): number {
    const [remaining, setRemaining] = useState(totalSeconds);
    const onElapsedRef = useRef(onElapsed);
    onElapsedRef.current = onElapsed;

    useEffect(() => {
        const id = window.setTimeout(() => onElapsedRef.current(), totalSeconds * 1000);
        return () => clearTimeout(id);
    }, [totalSeconds]);

    useEffect(() => {
        const id = window.setInterval(() => setRemaining((s) => (s > 0 ? s - 1 : 0)), 1000);
        return () => clearInterval(id);
    }, []);

    return remaining;
}
