import React, {useState} from "react";
import {Box, Button, Chip, Popover, Stack, Typography} from "@mui/material";
import {DateCalendar, LocalizationProvider} from "@mui/x-date-pickers";
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, {Dayjs} from "dayjs";
import {BRAND_RED} from "../../../../../shared/utils/theme";

export type MonthRange = { from: Date; to: Date };

type Props = {
    open: boolean;
    anchorEl: HTMLElement | null;
    range: MonthRange;
    onRangeChange: (range: MonthRange) => void;
    onClose: () => void;
    onApply: () => void;
};

/**
 * Closes a range from two clicks on one calendar.
 *
 * <p>Exported and pure so the rule can be tested without the popover: clicking an earlier month
 * second is a normal way to use a single calendar and must mean the same range, not an inverted one.
 */
export function closeRange(first: Date, second: Date): MonthRange {
    return second < first ? {from: second, to: first} : {from: first, to: second};
}

/** The range a preset covers, counting back from the current month inclusive. */
export function presetRange(months: number, today: Date = new Date()): MonthRange {
    const to = new Date(today.getFullYear(), today.getMonth(), 1);
    return {from: new Date(to.getFullYear(), to.getMonth() - (months - 1), 1), to};
}

const PRESETS: { label: string; months: number }[] = [
    {label: "3 months", months: 3},
    {label: "6 months", months: 6},
    {label: "12 months", months: 12},
];

function startOfThisMonth(): Dayjs {
    return dayjs().startOf("month");
}

/**
 * Picks a range of MONTHS from a single calendar.
 *
 * <p>One calendar, clicked twice — first click sets the start and arms the end, second click closes
 * the range. Two side-by-side calendars was the obvious way to build it and the wrong way to use it:
 * the day-range picker next to it on the same filter row is a single calendar, so two was
 * inconsistent as well as twice the width on a POS tablet.
 *
 * <p>Most of the time nobody wants a custom range at all, so the presets sit above and end the job
 * in one click.
 */
export default function MonthRangePickerPopover(
    {open, anchorEl, range, onRangeChange, onClose, onApply}: Props
): React.JSX.Element {
    // Null = the next click starts a new range. Set = we are waiting for the closing click.
    const [pendingFrom, setPendingFrom] = useState<Dayjs | null>(null);

    const pick = (value: Dayjs | null): void => {
        if (!value) return;
        const picked = value.startOf("month");

        if (pendingFrom === null) {
            setPendingFrom(picked);
            return;
        }

        setPendingFrom(null);
        onRangeChange(closeRange(pendingFrom.toDate(), picked.toDate()));
    };

    const applyPreset = (months: number): void => {
        setPendingFrom(null);
        onRangeChange(presetRange(months));
    };

    const label = (d: Date): string =>
        d.toLocaleDateString("en-US", {month: "short", year: "numeric"});

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={() => {
                setPendingFrom(null);
                onClose();
            }}
            anchorOrigin={{vertical: "bottom", horizontal: "left"}}
            slotProps={{paper: {sx: {borderRadius: 3, mt: 0.5, boxShadow: 6}}}}
        >
            <Box sx={{p: 2, width: 320}}>
                <Stack direction="row" spacing={1} sx={{mb: 1.5}}>
                    {PRESETS.map(p => (
                        <Chip
                            key={p.label}
                            label={`Last ${p.label}`}
                            size="small"
                            onClick={() => applyPreset(p.months)}
                            sx={{borderRadius: 999}}
                        />
                    ))}
                </Stack>

                <Typography variant="body2" fontWeight="bold" sx={{color: '#3b352c'}}>
                    {pendingFrom
                        ? `${pendingFrom.format("MMM YYYY")} — pick the end month`
                        : `${label(range.from)} — ${label(range.to)}`}
                </Typography>
                <Typography variant="caption" sx={{display: 'block', color: '#8a807a', mb: 1}}>
                    {pendingFrom ? "Click a second month to close the range."
                                 : "Click a month to start a new range."}
                </Typography>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DateCalendar
                        views={['year', 'month']}
                        openTo="month"
                        value={pendingFrom ?? dayjs(range.to)}
                        onChange={pick}
                        sx={{width: '100%', m: 0}}
                    />
                </LocalizationProvider>

                <Button
                    variant="contained"
                    fullWidth
                    disableElevation
                    onClick={() => {
                        setPendingFrom(null);
                        onApply();
                    }}
                    sx={{
                        mt: 1,
                        borderRadius: "9999px",
                        textTransform: "none",
                        fontWeight: 700,
                        py: 1.1,
                        backgroundColor: BRAND_RED,
                        "&:hover": {backgroundColor: "#c73c3d"},
                    }}
                >
                    🔁 Apply
                </Button>
            </Box>
        </Popover>
    );
}
