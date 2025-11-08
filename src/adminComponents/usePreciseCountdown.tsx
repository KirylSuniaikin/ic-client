import { useEffect, useRef, useState } from "react";

export function usePreciseCountdown(endTs, stepMs = 250) {
    const [now, setNow] = useState(() => Date.now());
    const tRef = useRef(null);

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
            if (tRef.current) clearTimeout(tRef.current);
        };
    }, [stepMs]);

    return endTs - now;
}
