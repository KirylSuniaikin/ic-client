import React, {useEffect, useState} from "react";
import {Box, Button, Chip, IconButton, Popover, Stack, Typography} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {BRAND_RED} from "../../../../../shared/utils/theme";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month index since year 0, so two months compare and subtract as plain numbers. */
function ordinal(d: Date): number {
    return d.getFullYear() * 12 + d.getMonth();
}

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

/**
 * Picks a range of MONTHS from a grid of twelve.
 *
 * <p>One grid, clicked twice — first click sets the start and arms the end, second click closes the
 * range. Two side-by-side calendars was the obvious way to build it and the wrong way to use it: the
 * day-range picker next to it on the same filter row is a single calendar, so two was inconsistent
 * as well as twice the width on a POS tablet.
 *
 * <p>A hand-rolled grid rather than {@code DateCalendar}, for two reasons the picker cannot give us:
 * <ul>
 *   <li><strong>It fits.</strong> DateCalendar reserves a fixed ~336px for a day grid it never shows
 *       in month view, so the popover ran off the bottom of a tablet and clipped its own Apply
 *       button. Twelve buttons are about half that and the popover is capped to the viewport as
 *       well, so it can no longer be cut off however low the trigger sits.</li>
 *   <li><strong>It can show the range.</strong> Highlighting a span of months needs per-month
 *       rendering; the free DateCalendar has no slot for it (that is DateRangeCalendar, which is
 *       Pro). Selecting Mar and Sep with nothing in between looking selected is the single most
 *       confusing thing about the old picker.</li>
 * </ul>
 *
 * <p>Most of the time nobody wants a custom range at all, so the presets sit above and end the job
 * in one click.
 */
export default function MonthRangePickerPopover(
    {open, anchorEl, range, onRangeChange, onClose, onApply}: Props
): React.JSX.Element {
    // Null = the next click starts a new range. Set = we are waiting for the closing click.
    const [pendingFrom, setPendingFrom] = useState<Date | null>(null);
    const [year, setYear] = useState<number>(() => range.to.getFullYear());

    // Reopening after picking a different range should land on that range's year, not on whatever
    // year was last paged to.
    useEffect(() => {
        if (open) setYear(range.to.getFullYear());
    }, [open, range.to]);

    const pick = (monthIndex: number): void => {
        const picked = new Date(year, monthIndex, 1);

        if (pendingFrom === null) {
            setPendingFrom(picked);
            return;
        }

        setPendingFrom(null);
        onRangeChange(closeRange(pendingFrom, picked));
    };

    const applyPreset = (months: number): void => {
        setPendingFrom(null);
        onRangeChange(presetRange(months));
    };

    const label = (d: Date): string =>
        d.toLocaleDateString("en-US", {month: "short", year: "numeric"});

    // While a range is half-picked, the armed month is the only thing highlighted -- showing the
    // old range underneath it would make the click that is about to happen look like it has already
    // happened.
    const lo = pendingFrom ? ordinal(pendingFrom) : ordinal(range.from);
    const hi = pendingFrom ? ordinal(pendingFrom) : ordinal(range.to);

    const monthState = (monthIndex: number): "start" | "end" | "inside" | "none" => {
        const o = year * 12 + monthIndex;
        if (o < lo || o > hi) return "none";
        if (o === lo) return "start";
        if (o === hi) return "end";
        return "inside";
    };

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={() => {
                setPendingFrom(null);
                onClose();
            }}
            anchorOrigin={{vertical: "bottom", horizontal: "left"}}
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: 3,
                        mt: 0.5,
                        boxShadow: 6,
                        // Belt and braces with the shorter body above: however low on the screen the
                        // trigger sits, the popover scrolls rather than losing its Apply button.
                        maxHeight: "calc(100vh - 24px)",
                        overflowY: "auto",
                    },
                },
            }}
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
                        ? `${label(pendingFrom)} — pick the end month`
                        : `${label(range.from)} — ${label(range.to)}`}
                </Typography>
                <Typography variant="caption" sx={{display: 'block', color: '#8a807a', mb: 1}}>
                    {pendingFrom ? "Click a second month to close the range."
                                 : "Click a month to start a new range."}
                </Typography>

                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{mb: 0.5}}>
                    <IconButton size="small" aria-label="Previous year" onClick={() => setYear(y => y - 1)}>
                        <ChevronLeftIcon fontSize="small"/>
                    </IconButton>
                    <Typography variant="body2" fontWeight="bold">{year}</Typography>
                    <IconButton size="small" aria-label="Next year" onClick={() => setYear(y => y + 1)}>
                        <ChevronRightIcon fontSize="small"/>
                    </IconButton>
                </Stack>

                <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5}}>
                    {MONTHS.map((name, i) => {
                        const state = monthState(i);
                        const isEnd = state === "start" || state === "end";
                        return (
                            <Box
                                key={name}
                                component="button"
                                type="button"
                                aria-label={`${name} ${year}`}
                                aria-pressed={state !== "none"}
                                onClick={() => pick(i)}
                                sx={{
                                    py: 1,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    fontWeight: isEnd ? 700 : 500,
                                    fontFamily: 'inherit',
                                    // The ends are solid brand red, the months between are a tint of
                                    // it -- so a six-month range reads as one bar, not two dots.
                                    borderRadius: state === "start" ? '999px 0 0 999px'
                                                : state === "end" ? '0 999px 999px 0'
                                                : state === "inside" ? 0 : '999px',
                                    backgroundColor: isEnd ? BRAND_RED
                                                   : state === "inside" ? 'rgba(228, 75, 76, 0.14)'
                                                   : 'transparent',
                                    color: isEnd ? '#fff' : '#3b352c',
                                    '&:hover': {
                                        backgroundColor: isEnd ? '#c73c3d'
                                                       : state === "inside" ? 'rgba(228, 75, 76, 0.22)'
                                                       : '#f3efe9',
                                    },
                                }}
                            >
                                {name}
                            </Box>
                        );
                    })}
                </Box>

                <Button
                    variant="contained"
                    fullWidth
                    disableElevation
                    onClick={() => {
                        setPendingFrom(null);
                        onApply();
                    }}
                    sx={{
                        mt: 2,
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
