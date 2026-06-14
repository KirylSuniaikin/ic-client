import { useEffect } from 'react';

export function useWakeLock(): void {
    useEffect(() => {
        let lock: WakeLockSentinel | undefined;
        async function reqWakeLock(): Promise<void> {
            try {
                lock = await navigator.wakeLock?.request("screen");
                document.addEventListener("visibilitychange", () => {
                    if (document.visibilityState === "visible") void reqWakeLock();
                }, { once: true });
            } catch {}
        }
        void reqWakeLock();
        return () => { try { lock?.release?.(); } catch {} };
    }, []);
}
