import { useEffect, useState } from "react";
import type { RefObject } from "react";

// Returns true once the referenced element's bottom edge has scrolled above the top of the
// viewport (i.e. the element is fully off-screen upwards). Used to hide fixed/absolute overlays
// once the hero above them has scrolled away, so they don't cover the menu.
//
// Uses a capture-phase scroll listener because the app's global CSS makes <body> (not window) the
// vertical scroller: scroll events don't bubble but do traverse the capture phase, so this catches
// the real scroller whatever it is (same approach as ScrollHintArrow).
export function useScrolledAboveViewport<T extends HTMLElement>(ref: RefObject<T>): boolean {
    const [scrolledAway, setScrolledAway] = useState(false);

    useEffect(() => {
        const update = (): void => {
            const el = ref.current;
            if (!el) return;
            setScrolledAway(el.getBoundingClientRect().bottom < 0);
        };
        update();
        window.addEventListener("scroll", update, { passive: true, capture: true });
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, { capture: true });
            window.removeEventListener("resize", update);
        };
    }, [ref]);

    return scrolledAway;
}
