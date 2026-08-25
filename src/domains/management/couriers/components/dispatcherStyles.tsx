import React from "react";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

/**
 * Shared chrome for the dispatcher panel.
 *
 * The panel was built from bare MUI tables and `Alert` slabs — the only management screen that
 * did not follow the storefront's cream-and-red language. These tokens mirror the delivery
 * bottom sheets (domains/delivery/components/sheetStyles.tsx) so the two halves of the same
 * feature read as one product.
 */

export const BRAND_RED = "#E44B4C";

/** A block of rows on its own surface, replacing the default table backdrop. */
export const PANEL_CARD_SX: SxProps<Theme> = {
    backgroundColor: "#fff",
    border: "1px solid #f1eae4",
    borderRadius: 4,
    overflow: "hidden",
};

export const SECTION_TITLE_SX: SxProps<Theme> = {
    fontWeight: 700,
    color: "#3b352c",
    mb: 1.5,
};

/** Rows read as list items, not spreadsheet cells: no dividers, generous vertical rhythm. */
export const ROW_SX: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 2,
    px: 2,
    py: 1.75,
    borderBottom: "1px solid #f6f1ec",
    "&:last-of-type": { borderBottom: "none" },
};

export const CLICKABLE_ROW_SX: SxProps<Theme> = {
    ...ROW_SX,
    cursor: "pointer",
    transition: "background-color 120ms ease",
    "&:hover": { backgroundColor: "#fffaf9" },
};

/**
 * Courier availability, coloured by what a dispatcher can do with it: green means "can take work
 * now", amber "occupied", grey "not on shift". A single neutral chip made the whole roster read
 * the same at a glance, which is the one thing this table exists to prevent.
 */
export function CourierStatusChip({ status }: { status: string }): JSX.Element {
    const palette = status === "FREE"
        ? { bg: "#e8f5ec", fg: "#2e7d32" }
        : status === "OFFLINE" || status === "BLACKLISTED"
            ? { bg: "#f1eae4", fg: "#8a807a" }
            : { bg: "#fff6e6", fg: "#8a5a00" };
    return (
        <Box sx={{ backgroundColor: palette.bg, borderRadius: 999, px: 1.25, py: 0.25, display: "inline-flex" }}>
            <Typography variant="caption" sx={{ color: palette.fg, fontWeight: 700 }}>
                {status}
            </Typography>
        </Box>
    );
}

/** In place of MUI's `Alert`: its icon-and-slab styling appears nowhere else in this product. */
export function PanelNotice({ tone, children }: {
    tone: "error" | "info";
    children: React.ReactNode;
}): JSX.Element {
    const palette = tone === "error" ? { bg: "#fdecec", fg: "#b3261e" } : { bg: "#f4f1ea", fg: "#6b635b" };
    return (
        <Box role="status" sx={{ backgroundColor: palette.bg, borderRadius: 3, px: 2, py: 1.25, mb: 2 }}>
            <Typography variant="body2" sx={{ color: palette.fg, fontWeight: 600 }}>
                {children}
            </Typography>
        </Box>
    );
}

/** What the roster says when there is genuinely nothing to do — the panel's normal state. */
export function EmptyState({ children }: { children: React.ReactNode }): JSX.Element {
    return (
        <Box sx={{ px: 2, py: 3, textAlign: "center" }}>
            <Typography variant="body2" sx={{ color: "#8a807a" }}>{children}</Typography>
        </Box>
    );
}
