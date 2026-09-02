import React from "react";
import {Box, Button, Popover, Stack, Typography} from "@mui/material";
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
 * Picks a range of MONTHS.
 *
 * <p>The chrome is a deliberate copy of {@code DateRangePickerPopover} — same anchor, radius, shadow
 * and full-width brand pill — so the two controls read as one family. The body is different because
 * the instrument is: this report has no day grain at all, and offering a day picker for it would
 * invite ranges the server cannot answer.
 *
 * <p>Uses {@code @mui/x-date-pickers}, already a dependency and already used this way in
 * {@code TaskCardDrawer} and {@code PurchaseInvoiceGroup}. There is no global
 * {@code LocalizationProvider}, so this wraps its own — the established local pattern.
 */
export default function MonthRangePickerPopover(
    {open, anchorEl, range, onRangeChange, onClose, onApply}: Props
): React.JSX.Element {
    const setMonth = (which: "from" | "to", value: Dayjs | null): void => {
        if (!value) return;
        const picked = value.startOf("month").toDate();
        onRangeChange(which === "from" ? {...range, from: picked} : {...range, to: picked});
    };

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{vertical: "bottom", horizontal: "left"}}
            slotProps={{paper: {sx: {borderRadius: 3, mt: 0.5, boxShadow: 6}}}}
        >
            <Box sx={{p: 2}}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Stack direction={{xs: 'column', sm: 'row'}} spacing={2}>
                        <Box>
                            <Typography variant="caption" fontWeight="bold" sx={{color: '#8a807a'}}>
                                From
                            </Typography>
                            <DateCalendar
                                views={['year', 'month']}
                                openTo="month"
                                value={dayjs(range.from)}
                                onChange={v => setMonth("from", v)}
                            />
                        </Box>
                        <Box>
                            <Typography variant="caption" fontWeight="bold" sx={{color: '#8a807a'}}>
                                To
                            </Typography>
                            <DateCalendar
                                views={['year', 'month']}
                                openTo="month"
                                value={dayjs(range.to)}
                                onChange={v => setMonth("to", v)}
                            />
                        </Box>
                    </Stack>
                </LocalizationProvider>

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
                        "&:hover": {backgroundColor: "#c73c3d"},
                    }}
                >
                    🔁 Apply
                </Button>
            </Box>
        </Popover>
    );
}
