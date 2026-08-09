import React from "react";
import { Box, Stack, Tooltip } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const BRAND = "#E44B4C";

/** Number of real product columns (Product, Amount, Total Price, Unit Price, Target Price, blank). */
export const PRODUCT_COLUMN_COUNT = 6;

/**
 * Shared chrome for the purchase table's cells.
 *
 * The table previously gave five different answers to "can I type here?": numeric cells were
 * grey pills, text and date cells were naked underline-stripped inputs, and the two COMPUTED
 * columns looked exactly like the editable numeric ones. Everything below exists so there are
 * only two answers — a box means you can edit it, plain text means the table worked it out.
 */

/**
 * Every editable control sits in this box: date, vendor, product, amount, total price.
 *
 * The fixed height matters as much as the colour. A DatePicker, an Autocomplete and a bare
 * numeric input all have different intrinsic heights, so without it each field found its own
 * vertical position and a row of them looked like it was staggered.
 */
export const editableFieldSx = {
    px: 1,
    minHeight: 34,
    display: "flex",
    alignItems: "center",
    borderRadius: 2,
    border: "1px solid",
    borderColor: "transparent",
    bgcolor: "rgba(0,0,0,0.035)",
    transition: "border-color 120ms ease, background-color 120ms ease",
    "&:hover": { borderColor: "rgba(0,0,0,0.18)" },
    "&:focus-within": { borderColor: BRAND, bgcolor: "#fff" },
} as const;

/** MUI's standard-variant underline, removed — the box above is the only chrome a field gets. */
const noUnderlineSx = {
    "& .MuiInput-underline:before": { borderBottom: "none" },
    "& .MuiInput-underline:after": { borderBottom: "none" },
    "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottom: "none" },
} as const;

export const fieldInputSx = {
    ...noUnderlineSx,
    "& input": { fontSize: "0.875rem", fontWeight: 600, py: 0.25 },
} as const;

/** Money and quantity: right-aligned with tabular figures, so decimal points line up down a column. */
export const numericInputSx = {
    ...noUnderlineSx,
    "& input": {
        fontSize: "0.875rem",
        fontWeight: 600,
        py: 0.25,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
    },
} as const;

/** One look for every delete bin in the table — invoice-level and line-level alike. */
export const binSx = { color: "text.disabled", "&:hover": { color: "error.main" } } as const;

/**
 * Moved in verbatim from `PurchaseTablePopup.tsx` (Phase 1). Shared by the invoice strip and the
 * inline per-group product header — this file is now the single home for header chrome.
 */
export const headerCellSx = {
    fontWeight: 700,
    color: "text.secondary",
    whiteSpace: "nowrap",
    fontSize: "0.75rem",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    bgcolor: "#f7f6f2",
} as const;

/**
 * The inline product header rendered under each expanded invoice's strip. Same type treatment as
 * `headerCellSx`, but it doesn't need a sticky/table-wide background (each group paints its own)
 * and sits closer to the strip above it, so it gets less vertical padding.
 */
export const inlineHeaderCellSx = {
    ...headerCellSx,
    bgcolor: "transparent",
    py: 0.5,
} as const;

/**
 * The invoice strip row's shaded background + 2px top rule — the strip's single full-width cell
 * is now the only place a group-opening rule needs to be drawn.
 */
export const groupStripSx = {
    bgcolor: "rgba(0,0,0,0.02)",
    "& > td": { borderTop: "2px solid rgba(0,0,0,0.14)" },
} as const;

/**
 * Column header with a tap-to-open ⓘ. Purchases are entered on tablets, where hover never
 * fires — enterTouchDelay/leaveTouchDelay are the house idiom for that.
 *
 * `align` follows its column: the numeric headers sit over right-aligned figures.
 *
 * Moved in verbatim from `PurchaseTablePopup.tsx` (Phase 1).
 */
export function HeaderWithInfo({ label, info, align = "left" }: { label: string; info: string; align?: "left" | "right" }) {
    return (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent={align === "right" ? "flex-end" : "flex-start"}
            gap={0.5}
            sx={{ whiteSpace: "nowrap" }}
        >
            <span>{label}</span>
            <Tooltip title={info} arrow enterTouchDelay={0} leaveTouchDelay={6000}>
                <InfoOutlinedIcon fontSize="small" sx={{ color: "text.disabled", cursor: "pointer" }} />
            </Tooltip>
        </Stack>
    );
}

type Tone = "neutral" | "error";

/**
 * Wrapper for an editable numeric cell. Carries `data-tone` alongside the read-only cells so a
 * test can assert that exactly one number in a row is red.
 */
export function EditableNumber({ children }: { children: React.ReactNode }) {
    return (
        <Box data-tone="neutral" sx={{ ...editableFieldSx, display: "inline-flex" }}>
            {children}
        </Box>
    );
}

/**
 * A number the table derived rather than one that was typed — deliberately unboxed, so it reads
 * as output. Red is reserved for a unit price over its target.
 */
export function ComputedNumber({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
    return (
        <Box
            component="span"
            data-tone={tone}
            sx={{
                fontSize: "0.875rem",
                fontVariantNumeric: "tabular-nums",
                fontWeight: tone === "error" ? 800 : 600,
                color: tone === "error" ? "error.main" : "text.secondary",
            }}
        >
            {children}
        </Box>
    );
}
