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

/** Muted body text, and the greyer tone reserved for "this value is not usable". */
export const MUTED = "#8a807a";
export const FADED = "#b0a79f";

/**
 * Semantic tones for a figure measured against a target — never the brand accent, which says
 * "this is IC Pizza", not "this one is late". Green is {@link CourierStatusChip}'s own "can take
 * work now" and red is {@link PanelNotice}'s error tone, so the surface keeps one vocabulary for
 * "inside the budget" and "outside it".
 */
export const TONE_OK = "#2e7d32";
export const TONE_BAD = "#b3261e";

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

/**
 * Rows read as list items, not spreadsheet cells: no dividers, generous vertical rhythm.
 *
 * Below `sm` the row becomes a stacked card, which is the layout {@link DeliveryBoardPanel}
 * already gives its own cards at every width. It was a fixed single-line flex, so on a phone the
 * name column was the only thing that could give: it truncated while a nowrap stats string held
 * its full width. Stacking lets the row grow downwards instead, which is the direction there is
 * room in — and the extra `py` at `xs` is deliberate, because these are touch targets on a
 * handset, not table rows under a mouse.
 *
 * `sm` and up is byte-for-byte the single line it always was.
 */
export const ROW_SX: SxProps<Theme> = {
    display: "flex",
    flexDirection: { xs: "column", sm: "row" },
    alignItems: { xs: "stretch", sm: "center" },
    gap: { xs: 1, sm: 2 },
    px: 2,
    py: { xs: 2.25, sm: 1.75 },
    borderBottom: "1px solid #f6f1ec",
    "&:last-of-type": { borderBottom: "none" },
};

/**
 * What a pill or a chip needs so `alignItems: stretch` does not pull it edge to edge on a phone.
 * A status chip stretched across a whole card stops reading as a chip at all.
 */
export const CHIP_SELF_SX: SxProps<Theme> = {
    alignSelf: { xs: "flex-start", sm: "auto" },
};

/**
 * A stats string that may wrap on a phone and never on a desktop row. Unconditional nowrap is
 * what forced the name column to truncate at `xs`; at `sm` it is still what keeps the figures on
 * one line beside the name.
 */
export const STATS_WRAP_SX: SxProps<Theme> = {
    whiteSpace: { xs: "normal", sm: "nowrap" },
};

/**
 * A floor for a panel body, so an empty list does not collapse to nothing beside a full one.
 * Roughly one row plus its empty state — enough to keep two stretched columns reading as a pair.
 */
export const PANEL_MIN_HEIGHT = 160;

export const CLICKABLE_ROW_SX: SxProps<Theme> = {
    ...ROW_SX,
    cursor: "pointer",
    transition: "background-color 120ms ease",
    "&:hover": { backgroundColor: "#fffaf9" },
};

/**
 * A labelled figure. The value is its own text node, and always the label's IMMEDIATE next
 * sibling, so a test can assert the pairing rather than "some node in this row says 2" — two
 * figures swapped between their labels would otherwise pass. It is also what keeps "\u2014" legible
 * on its own when a value could not be derived.
 */
export function Metric({ label, value }: { label: string; value: string }): JSX.Element {
    return (
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
            <Typography variant="caption" sx={{ color: MUTED }}>{label}</Typography>
            <Typography variant="caption" sx={{ color: "#3b352c", fontWeight: 700 }}>{value}</Typography>
        </Box>
    );
}

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
