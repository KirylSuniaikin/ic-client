import React from "react";
import { Box } from "@mui/material";

const BRAND = "#E44B4C";

/**
 * Shared chrome for the purchase table's cells.
 *
 * The table previously gave five different answers to "can I type here?": numeric cells were
 * grey pills, text and date cells were naked underline-stripped inputs, and the two COMPUTED
 * columns looked exactly like the editable numeric ones. Everything below exists so there are
 * only two answers — a box means you can edit it, plain text means the table worked it out.
 */

/** Every editable control sits in this box: date, vendor, product, amount, total price. */
export const editableFieldSx = {
    px: 1,
    py: 0.25,
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

/** A 2px rule opening each invoice's block, applied to the whole <tr>. */
export const groupStartSx = { "& > td": { borderTop: "2px solid rgba(0,0,0,0.14)" } } as const;

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
