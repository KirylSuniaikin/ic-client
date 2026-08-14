import { useEffect, useState } from "react";

// Long enough for the first menu row to arrive on a normal connection, short enough that a customer
// on bad mobile data is not left staring at the loader.
const DEFAULT_TIMEOUT_MS = 2500;

// Fetches and decodes the given images off-screen, reporting true once they are all settled.
// Callers use it to hold a loading animation until the images behind it are in the browser cache,
// so the menu does not paint a grid of empty boxes the moment the loader disappears.
//
// It always resolves: a failed image counts as settled, and a hard timeout releases the caller even
// if nothing ever loads. A preloader that can block forever is worse than no preloader at all.
export function useImagePreloader(urls: string[], timeoutMs: number = DEFAULT_TIMEOUT_MS): boolean {
    const [ready, setReady] = useState(urls.length === 0);
    // Depend on the list by value, not identity: callers rebuild the array on every render, and an
    // identity dep would restart the preload — and flip `ready` back to false — on each one.
    const key = urls.join("|");

    useEffect(() => {
        if (urls.length === 0) {
            setReady(true);
            return;
        }
        setReady(false);

        let cancelled = false;
        let pending = urls.length;

        const release = (): void => {
            if (!cancelled) setReady(true);
        };
        const settleOne = (): void => {
            if (cancelled) return;
            pending -= 1;
            if (pending === 0) release();
        };

        const images = urls.map(url => {
            const img = new Image();
            img.onload = (): void => {
                // Decoding here keeps the first paint of the real <img> off the main thread. Some
                // browsers reject decode() for an already-decoded image — that is still a success,
                // so both branches settle.
                if (typeof img.decode === "function") img.decode().then(settleOne, settleOne);
                else settleOne();
            };
            // A 404 or a broken file must not hold the loader hostage.
            img.onerror = settleOne;
            img.src = url;
            return img;
        });

        const timer = setTimeout(release, timeoutMs);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            // Detach handlers so in-flight requests can't call setState after unmount.
            images.forEach(img => {
                img.onload = null;
                img.onerror = null;
            });
        };
    }, [key, timeoutMs]); // eslint-disable-line react-hooks/exhaustive-deps

    return ready;
}
