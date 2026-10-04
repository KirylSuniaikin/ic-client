import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { TextField } from "@mui/material";
import type { InputBaseComponentProps, SxProps, Theme } from "@mui/material";
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
    /** Select the whole draft on focus, so typing replaces the figure instead of appending to it. */
    selectOnFocus?: boolean;
    /** Escape discards the draft and leaves the cell without calling `onCommit`. */
    cancelOnEscape?: boolean;
    /** Leaving a cell nobody typed into does not call `onCommit` at all. */
    commitOnlyIfEdited?: boolean;
    /**
     * Passed to the `<input>` itself: an accessible name, data attributes for keyboard navigation.
     * The mouse and key handlers this component sets itself are excluded, as they would be overwritten.
     */
    inputProps?: Omit<InputBaseComponentProps, "onMouseDown" | "onMouseUp" | "onKeyDown">;
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
                                     selectOnFocus = false,
                                     cancelOnEscape = false,
                                     commitOnlyIfEdited = false,
                                     inputProps,
                                 }: DecimalCellInputProps) {
    const [draft, setDraft] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    // Escape blurs the input, and that blur must not commit the draft it just discarded.
    const cancellingRef = useRef<boolean>(false);
    const editedRef = useRef<boolean>(false);
    const selectPendingRef = useRef<boolean>(false);
    const focusedByPointerRef = useRef<boolean>(false);

    // Selecting inside onFocus is undone by the draft replacing the input's value on the next
    // render, so the selection is made after that render lands.
    useLayoutEffect(() => {
        if (!selectPendingRef.current) return;
        selectPendingRef.current = false;
        inputRef.current?.select();
    });

    return (
        <TextField
            type="text"
            inputMode="decimal"
            placeholder={placeholder}
            value={draft ?? value}
            inputRef={inputRef}
            onFocus={() => {
                editedRef.current = false;
                if (selectOnFocus) selectPendingRef.current = true;
                setDraft(clearZeroOnFocus && toDecimal(value).isZero() ? "" : value);
            }}
            onChange={(e) => {
                editedRef.current = true;
                setDraft(e.target.value);
            }}
            onBlur={(e) => {
                const cancelled = cancellingRef.current;
                cancellingRef.current = false;
                if (!cancelled && (editedRef.current || !commitOnlyIfEdited)) {
                    onCommit(draft ?? e.target.value);
                }
                setDraft(null);
            }}
            size="small"
            variant="standard"
            sx={{ width, ...sx }}
            slotProps={{
                htmlInput: {
                    ...inputProps,
                    onMouseDown: (e: ReactMouseEvent<HTMLInputElement>) => {
                        focusedByPointerRef.current = document.activeElement !== e.currentTarget;
                    },
                    // Chrome places the caret on the mouseup that follows a focusing click, which
                    // silently undoes the select-all made on focus.
                    onMouseUp: (e: ReactMouseEvent<HTMLInputElement>) => {
                        if (selectOnFocus && focusedByPointerRef.current) e.preventDefault();
                        focusedByPointerRef.current = false;
                    },
                    onKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => {
                        if (!cancelOnEscape || e.key !== "Escape") return;
                        e.preventDefault();
                        cancellingRef.current = true;
                        setDraft(null);
                        inputRef.current?.blur();
                    },
                },
            }}
        />
    );
}
