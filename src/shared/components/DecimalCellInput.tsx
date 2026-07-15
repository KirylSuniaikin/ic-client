import { useState } from "react";
import { TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { toDecimal } from "../utils/decimalUtils";

type DecimalCellInputProps = {
    /** Committed value, already display-formatted by the caller (e.g. `fmt3(row.quantity)`). */
    value: string;
    /** Called on blur with the raw typed string (possibly empty); the caller normalizes and commits it. */
    onCommit: (raw: string) => void;
    /** Start the edit blank when the committed value is zero, so the user types over it instead of deleting it first. */
    clearZeroOnFocus?: boolean;
    placeholder?: string;
    width?: number;
    sx?: SxProps<Theme>;
};

/**
 * Numeric table cell whose in-progress keystrokes live in THIS leaf's state, never in the
 * table's. A table-level draft value makes every character re-render every row — with a
 * DatePicker and two Autocompletes per purchase row that costs seconds of input latency.
 * The table is only told about the value once, on blur.
 */
export function DecimalCellInput({
                                     value,
                                     onCommit,
                                     clearZeroOnFocus = false,
                                     placeholder = "0.000",
                                     width,
                                     sx,
                                 }: DecimalCellInputProps) {
    const [draft, setDraft] = useState<string | null>(null);

    return (
        <TextField
            type="text"
            inputMode="decimal"
            placeholder={placeholder}
            value={draft ?? value}
            onFocus={() => setDraft(clearZeroOnFocus && toDecimal(value).isZero() ? "" : value)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => {
                onCommit(draft ?? e.target.value);
                setDraft(null);
            }}
            size="small"
            variant="standard"
            sx={{ width, ...sx }}
        />
    );
}
