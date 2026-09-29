import * as React from "react";
import {useEffect, useRef, useState} from "react";
import {Stack, TextField} from "@mui/material";
import {ROUNDED_FIELD_SX} from "../../_shared/components/roundedSelect";
import type {ShiftDateRange} from "../types";

export interface ShiftDateRangeFieldsProps {
    /** The window currently in force. Null while it is unknown, e.g. before the first load. */
    value: ShiftDateRange | null;
    /** Fired only with a complete, ordered range that differs from `value`. */
    onChange: (range: ShiftDateRange) => void;
    disabled?: boolean;
}

const fieldSx = {flex: "1 1 0", minWidth: 150, ...ROUNDED_FIELD_SX};

export default function ShiftDateRangeFields({
    value,
    onChange,
    disabled = false,
}: ShiftDateRangeFieldsProps): React.JSX.Element {
    const valueFrom = value?.from ?? "";
    const valueTo = value?.to ?? "";
    const [from, setFrom] = useState(valueFrom);
    const [to, setTo] = useState(valueTo);
    // Chrome fires a change for every keystroke in a date segment -- typing a year passes through
    // 0002, 0020 and 0202 -- and every commit reloads, which disables or unmounts these fields
    // mid-typing. So a typed edit waits for blur or Enter; a picker selection sends no keydown and
    // commits at once.
    const typingRef = useRef(false);

    // Keyed on the strings, not the object: callers build `value` inline on every render, and
    // re-seeding on identity would wipe a half-entered range whenever the parent re-renders.
    useEffect(() => {
        setFrom(valueFrom);
        setTo(valueTo);
    }, [valueFrom, valueTo]);

    const reversed = from !== "" && to !== "" && from > to;

    function commit(nextFrom: string, nextTo: string): void {
        // ISO dates compare correctly as strings.
        if (nextFrom === "" || nextTo === "" || nextFrom > nextTo) return;
        if (nextFrom === valueFrom && nextTo === valueTo) return;
        onChange({from: nextFrom, to: nextTo});
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
        if (e.key === "Enter") {
            typingRef.current = false;
            commit(from, to);
        } else {
            typingRef.current = true;
        }
    }

    function handleBlur(): void {
        if (!typingRef.current) return;
        typingRef.current = false;
        commit(from, to);
    }

    return (
        <Stack direction="row" gap={1}>
            <TextField
                label="From"
                type="date"
                size="small"
                value={from}
                disabled={disabled}
                onChange={e => {
                    setFrom(e.target.value);
                    if (!typingRef.current) commit(e.target.value, to);
                }}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                error={reversed}
                helperText={reversed ? "From must be on or before To" : undefined}
                InputLabelProps={{shrink: true}}
                sx={fieldSx}
                data-testid="shift-range-from"
            />
            <TextField
                label="To"
                type="date"
                size="small"
                value={to}
                disabled={disabled}
                onChange={e => {
                    setTo(e.target.value);
                    if (!typingRef.current) commit(from, e.target.value);
                }}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                error={reversed}
                InputLabelProps={{shrink: true}}
                sx={fieldSx}
                data-testid="shift-range-to"
            />
        </Stack>
    );
}
