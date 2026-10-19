import React from "react";
import {Box, Button, Chip, Popover, Stack} from "@mui/material";
import {DateRange} from "react-date-range";
import {enUS} from "date-fns/locale";
import {endOfDay, format, startOfDay, subMonths, subYears} from "date-fns";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import type {DateRangeState} from "../../types";

const BRAND = "#E44B4C";

// The long look-backs the owner asks for most, each ending today. They only move the selection;
// Apply still confirms it, exactly as a range picked by hand.
const FAST_PICKS: ReadonlyArray<{label: string; startFrom: (today: Date) => Date}> = [
    {label: "Last 3 months", startFrom: (today) => subMonths(today, 3)},
    {label: "Last 6 months", startFrom: (today) => subMonths(today, 6)},
    {label: "Last year", startFrom: (today) => subYears(today, 1)},
];

type CommonProps = {
    id?: string;
    open: boolean;
    anchorEl: HTMLElement | null;
    onClose: () => void;
    onApply: () => void;
    applyLabel: string;
};

type RangeProps = CommonProps & {
    mode: "range";
    range: DateRangeState[];
    onRangeChange: (range: DateRangeState[]) => void;
};

type SingleProps = CommonProps & {
    mode: "single";
    date: Date;
    onDateChange: (date: Date) => void;
};

type Props = RangeProps | SingleProps;

type RangeFastPicksProps = {
    rangeKey: string;
    onRangeChange: (range: DateRangeState[]) => void;
};

// Pill chips in a wrapping row, as MonthRangePickerPopover lays out its presets, so the two pickers
// still read as one family.
function RangeFastPicks({rangeKey, onRangeChange}: RangeFastPicksProps): JSX.Element {
    const pick = (startFrom: (today: Date) => Date): void => {
        const today = new Date();
        onRangeChange([{startDate: startOfDay(startFrom(today)), endDate: endOfDay(today), key: rangeKey}]);
    };

    return (
        <Stack direction="row" useFlexGap sx={{mb: 1.5, gap: 1, flexWrap: "wrap"}}>
            {FAST_PICKS.map((fastPick) => (
                <Chip
                    key={fastPick.label}
                    label={fastPick.label}
                    size="small"
                    variant="outlined"
                    onClick={() => pick(fastPick.startFrom)}
                    sx={{borderRadius: 999, fontWeight: 600, color: BRAND, borderColor: BRAND}}
                />
            ))}
        </Stack>
    );
}

export function DateRangePickerPopover(props: Props): JSX.Element {
    const {id, open, anchorEl, onClose, onApply, applyLabel} = props;

    return (
        <Popover
            id={id}
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{vertical: "bottom", horizontal: "left"}}
            slotProps={{paper: {sx: {borderRadius: 3, mt: 0.5, boxShadow: 6}}}}
        >
            <Box sx={{p: 2}}>
                {props.mode === "range" ? (
                    <>
                        <RangeFastPicks
                            rangeKey={props.range[0]?.key ?? "selection"}
                            onRangeChange={props.onRangeChange}
                        />
                        <DateRange
                            editableDateInputs
                            // react-date-range types selection loosely; it always carries our start/end/key shape
                            onChange={(item) => props.onRangeChange([item.selection as DateRangeState])}
                            moveRangeOnFirstSelection={false}
                            ranges={props.range}
                            locale={enUS}
                            // The library ships a blue selection; brand red keeps the calendar in the
                            // same visual system as the rest of the management surface.
                            rangeColors={[BRAND]}
                        />
                    </>
                ) : (
                    <input
                        type="date"
                        value={format(props.date, "yyyy-MM-dd")}
                        onChange={(e) => props.onDateChange(new Date(e.target.value))}
                        style={{padding: "8px", fontSize: "16px", width: "100%"}}
                    />
                )}
                <Button
                    variant="contained"
                    fullWidth
                    disableElevation
                    onClick={onApply}
                    sx={{
                        mt: 2,
                        borderRadius: "9999px",
                        textTransform: "none",
                        fontWeight: 700,
                        py: 1.1,
                        backgroundColor: BRAND,
                        "&:hover": {backgroundColor: "#c73c3d"},
                    }}
                >
                    {applyLabel}
                </Button>
            </Box>
        </Popover>
    );
}
