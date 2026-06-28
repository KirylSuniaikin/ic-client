import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import KeyboardDoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";

interface ScrollHintArrowProps {
    // The element to bring to the top of the viewport when tapped (the first menu row).
    targetRef: React.RefObject<HTMLElement>;
}

const brandRed = "#E44B4C";

// Kiosk-only affordance: a bouncing down-arrow pinned to the bottom of the screen that hints the
// page is scrollable (some walk-up customers don't realise it is). Tapping it smooth-scrolls the
// menu's first row to the top of the display. It hides itself once the target has scrolled into
// the upper half of the viewport so it never lingers over the menu or the cart bar.
export function ScrollHintArrow({ targetRef }: ScrollHintArrowProps): JSX.Element | null {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const update = (): void => {
            const el = targetRef.current;
            if (!el) return;
            // Visible while any of the hero video is still on screen (menu top below the viewport
            // top); hidden once the hero has scrolled away and only the menu fills the display.
            setVisible(el.getBoundingClientRect().top > 0);
        };
        update();
        // Capture phase: the page's global CSS makes <body> (not window) the vertical scroller, so
        // a normal bubble-phase window "scroll" listener never fires. Scroll events don't bubble
        // but they DO traverse the capture phase, so this catches the scroller whatever it is.
        window.addEventListener("scroll", update, { passive: true, capture: true });
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, { capture: true });
            window.removeEventListener("resize", update);
        };
    }, [targetRef]);

    if (!visible) return null;

    // smooth + block:"start" lands the first menu row at the top with no jump/teleport.
    const handleClick = (): void => {
        targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <Box
            role="button"
            aria-label="Scroll down to the menu"
            onClick={handleClick}
            sx={{
                position: "fixed",
                bottom: 24,
                left: "50%",
                zIndex: 9998,
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: brandRed,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                cursor: "pointer",
                // Gentle vertical "jump". translateX(-50%) is repeated in the keyframes because the
                // animation's transform fully replaces the static centering transform.
                animation: "scrollHintBounce 1.2s ease-in-out infinite",
                "@keyframes scrollHintBounce": {
                    "0%, 100%": { transform: "translateX(-50%) translateY(0)" },
                    "50%": { transform: "translateX(-50%) translateY(10px)" },
                },
                "@media (prefers-reduced-motion: reduce)": { animation: "none", transform: "translateX(-50%)" },
                "&:hover": { backgroundColor: "#d23f40" },
            }}
        >
            <KeyboardDoubleArrowDownIcon sx={{ fontSize: 36 }} />
        </Box>
    );
}

export default ScrollHintArrow;
