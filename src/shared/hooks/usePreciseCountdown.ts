import { useEffect, useRef, useState } from "react";

export function usePreciseCountdown(endTs: number, stepMs: number = 1000): number {
    const [now, setNow] = useState<number>(() => Date.now());
    const tRef = useRef<number | null>(null);

    useEffect(() => {
        let stopped = false;

        const tick = () => {
            if (stopped) return;
            const t = Date.now();
            setNow(t);

            const next = Math.max(0, stepMs - (t % stepMs));
            tRef.current = window.setTimeout(tick, next || stepMs);
        };

        tick();
        return () => {
            stopped = true;
            if (tRef.current !== null) clearTimeout(tRef.current);
        };
    }, [stepMs]);

    return endTs - now;
}
