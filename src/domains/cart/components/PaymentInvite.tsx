import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { BRAND_RED } from "../../../shared/utils/theme";

// The owner's sketch (option A, 18 Oct 2026): a speech bubble announcing the new payment methods
// in the free space above the cart's choices, and a dashed arrow curving down the margin to the
// payment row. The cart shows both only until a method is picked.

const BUBBLE_SX = {
    position: "relative",
    width: "fit-content",
    maxWidth: 270,
    // Inset from the section's edge, so the tail sits beside where the arrow sets off.
    ml: 2.5,
    // Room under the bubble for its tail and the arrow's start, clear of "Delivery type".
    mb: "30px",
    px: 2,
    py: 1.5,
    borderRadius: "18px",
    backgroundColor: BRAND_RED,
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.35,
    boxShadow: `0 6px 18px ${alpha(BRAND_RED, 0.35)}`,
    // The tail: a square turned 45° under the bubble's starting corner.
    "&::after": {
        content: '""',
        position: "absolute",
        left: 22,
        bottom: -7,
        width: 14,
        height: 14,
        borderRadius: "2px",
        backgroundColor: BRAND_RED,
        transform: "rotate(45deg)",
    },
} satisfies SxProps<Theme>;

export function PaymentInviteBubble(): JSX.Element {
    const { t } = useTranslation("paymentChoice");
    return (
        <Typography data-testid="payment-invite-bubble" sx={BUBBLE_SX}>
            <Box component="span" aria-hidden sx={{ fontSize: "16px", mr: 0.5 }}>✨</Box>
            {t("newMethodsInvite")}
        </Typography>
    );
}

const ARROW_WIDTH = 64;
// The x, in the arrow's box, of the lane it runs down: in the section's margin, left of the content.
const LANE_X = 10;

// Placed in a box wrapping the section's controls, whose last child is the payment row (at least
// 48px tall): from just under the bubble's tail down to that row's middle, reaching 22px out into
// the section's 24px margin.
const ARROW_SX = {
    position: "absolute",
    left: -22,
    top: -14,
    bottom: 24,
    width: ARROW_WIDTH,
    color: BRAND_RED,
    pointerEvents: "none",
} satisfies SxProps<Theme>;

/**
 * The dashed curve for an arrow box `height` px tall: out from under the bubble, down the margin
 * and into the payment row. Drawn at its real size rather than stretched, so the two bends keep
 * their shape and the dashes stay even however much sits between the bubble and the row (the
 * branch card comes and goes).
 */
export function arrowPath(height: number): string {
    const turnIn = Math.max(40, height - 26);
    return `M 60 0 C 30 2, ${LANE_X} 10, ${LANE_X} 40 L ${LANE_X} ${turnIn} C ${LANE_X} ${height - 8}, 16 ${height}, 24 ${height}`;
}

function arrowHeadPath(height: number): string {
    return `M 23 ${height - 5} L 32 ${height} L 23 ${height + 5} Z`;
}

/** The node's height, kept current as the layout around it changes. */
function useHeight(node: HTMLElement | null): number {
    const [height, setHeight] = useState(0);
    useLayoutEffect(() => {
        if (node === null) return undefined;
        const measure = (): void => setHeight(node.clientHeight);
        measure();
        if (typeof ResizeObserver === "undefined") return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, [node]);
    return height;
}

export function PaymentInviteArrow(): JSX.Element {
    // The RTL emotion cache moves the box to the other margin but cannot mirror a drawing, so the
    // curve is flipped here, as the cart picks its chevrons by direction.
    const isRtl = useTheme().direction === "rtl";
    const [box, setBox] = useState<HTMLDivElement | null>(null);
    const height = useHeight(box);

    return (
        <Box ref={setBox} aria-hidden data-testid="payment-invite-arrow" sx={ARROW_SX}>
            {height > 0 && (
                <svg width={ARROW_WIDTH} height={height} overflow="visible">
                    <g
                        data-testid="payment-invite-arrow-drawing"
                        transform={isRtl ? `translate(${ARROW_WIDTH} 0) scale(-1 1)` : undefined}
                    >
                        <path
                            d={arrowPath(height)}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.2}
                            strokeDasharray="6 5"
                            strokeLinecap="round"
                        />
                        <path d={arrowHeadPath(height)} fill="currentColor" />
                    </g>
                </svg>
            )}
        </Box>
    );
}
