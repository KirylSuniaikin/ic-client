import React from "react";
import {Box, Button, Chip, Popover} from "@mui/material";
import type {SxProps, Theme} from "@mui/material";
import {DateRange} from "react-date-range";
import {enUS} from "date-fns/locale";
import {endOfDay, format, isSameDay, startOfDay, subMonths, subYears} from "date-fns";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import {BRAND_RED} from "../../../../../shared/utils/theme";
import type {DateRangeState} from "../../types";

// DESIGN.md's pressed end of the brand CTA.
const BRAND_PRESSED = "#D0393A";

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

// Range mode's body. The calendar (.rdrCalendarWrapper) and MUI's Button are both inline-flex, so in
// a plain block the popover sized itself as if the 332px calendar and the Apply button sat side by
// side on one line, then wrapped the full-width button under it: the paper came out wider than the
// calendar by the button's label (73px for "Apply", 106px for "🔁 Refresh"), a blank strip on the
// right. A column flex box takes its width from its widest child -- the calendar -- and stretches
// the chips and Apply to exactly that width.
const RANGE_BODY_SX = {
    p: 2,
    display: "flex",
    flexDirection: "column",
    // The library's grey-blue (#eff2f7) date strip, toned to the management palette: the warm page
    // ground with a hairline, and both inputs drawn alike so only the active one stands out, in red.
    "& .rdrDateDisplayWrapper": {
        backgroundColor: "#fbfaf6",
        border: "1px solid #f1eae4",
        borderRadius: "12px",
    },
    "& .rdrDateDisplayItem": {
        borderRadius: "999px",
        borderColor: "#f1eae4",
        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    },
    "& .rdrDateDisplayItemActive": {borderColor: BRAND_RED},
    "& .rdrDateDisplayItem input": {color: "#3b352c", fontFamily: "inherit"},
    // The month arrows wear the same #eff2f7 swatch as the strip, and today's underline is the
    // library's blue whenever today is not selected.
    "& .rdrNextPrevButton": {backgroundColor: "#f1eae4", borderRadius: "50%"},
    "& .rdrNextPrevButton:hover": {backgroundColor: "#FCE9E9"},
    "& .rdrPprevButton i": {borderColor: "transparent #3b352c transparent transparent"},
    "& .rdrNextButton i": {borderColor: "transparent transparent transparent #3b352c"},
    "& .rdrDayToday .rdrDayNumber span:after": {backgroundColor: BRAND_RED},
} satisfies SxProps<Theme>;

type RangeFastPicksProps = {
    range: DateRangeState | undefined;
    rangeKey: string;
    onRangeChange: (range: DateRangeState[]) => void;
};

function coversFastPick(range: DateRangeState | undefined, startFrom: (today: Date) => Date, today: Date): boolean {
    return range !== undefined && isSameDay(range.startDate, startFrom(today)) && isSameDay(range.endDate, today);
}

// Three equal chips spanning the calendar's width. The one the current range matches is filled, so
// a range picked by a fast pick -- or by hand to the same days -- says which it is.
function RangeFastPicks({range, rangeKey, onRangeChange}: RangeFastPicksProps): JSX.Element {
    const today = new Date();
    // The day is read at the click, not at render: a popover left open past midnight still picks
    // a range ending on the new day.
    const pick = (startFrom: (today: Date) => Date): void => {
        const now = new Date();
        onRangeChange([{startDate: startOfDay(startFrom(now)), endDate: endOfDay(now), key: rangeKey}]);
    };

    return (
        <Box
            data-testid="date-range-fast-picks"
            sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1,
                mb: 1.5,
                // Width 0 growing to 100% keeps the chips out of the popover's own sizing: three
                // columns as wide as the widest label ("Last 6 months") would otherwise ask for a
                // couple of pixels more than the calendar and bring the blank strip back.
                width: 0,
                minWidth: "100%",
            }}
        >
            {FAST_PICKS.map((fastPick) => {
                const selected = coversFastPick(range, fastPick.startFrom, today);
                return (
                    <Chip
                        key={fastPick.label}
                        label={fastPick.label}
                        size="small"
                        variant={selected ? "filled" : "outlined"}
                        aria-pressed={selected}
                        onClick={() => pick(fastPick.startFrom)}
                        sx={{
                            borderRadius: 999,
                            fontWeight: 600,
                            color: selected ? "#fff" : BRAND_RED,
                            borderColor: BRAND_RED,
                            backgroundColor: selected ? BRAND_RED : "transparent",
                            fontSize: 12,
                            "& .MuiChip-label": {px: 0.75},
                            ...(selected && {"&:hover, &.Mui-focusVisible": {backgroundColor: BRAND_PRESSED}}),
                        }}
                    />
                );
            })}
        </Box>
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
            <Box data-testid="date-range-picker-body" sx={props.mode === "range" ? RANGE_BODY_SX : {p: 2}}>
                {props.mode === "range" ? (
                    <>
                        <RangeFastPicks
                            range={props.range[0]}
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
                            rangeColors={[BRAND_RED]}
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
                        backgroundColor: BRAND_RED,
                        "&:hover": {backgroundColor: BRAND_PRESSED},
                    }}
                >
                    {applyLabel}
                </Button>
            </Box>
        </Popover>
    );
}
