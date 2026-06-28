import React from "react";
import {Box, Button, Popover} from "@mui/material";
import {DateRange} from "react-date-range";
import {enUS} from "date-fns/locale";
import {format} from "date-fns";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import type {DateRangeState} from "../../types";

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

export function DateRangePickerPopover(props: Props): JSX.Element {
    const {id, open, anchorEl, onClose, onApply, applyLabel} = props;

    return (
        <Popover
            id={id}
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{vertical: "bottom", horizontal: "left"}}
        >
            <Box sx={{p: 2}}>
                {props.mode === "range" ? (
                    <DateRange
                        editableDateInputs
                        // react-date-range types selection loosely; it always carries our start/end/key shape
                        onChange={(item) => props.onRangeChange([item.selection as DateRangeState])}
                        moveRangeOnFirstSelection={false}
                        ranges={props.range}
                        locale={enUS}
                    />
                ) : (
                    <input
                        type="date"
                        value={format(props.date, "yyyy-MM-dd")}
                        onChange={(e) => props.onDateChange(new Date(e.target.value))}
                        style={{padding: "8px", fontSize: "16px", width: "100%"}}
                    />
                )}
                <Button variant="contained" fullWidth onClick={onApply} sx={{mt: 2}}>
                    {applyLabel}
                </Button>
            </Box>
        </Popover>
    );
}
