import * as React from "react";
import { Box, Popover, TextField } from "@mui/material";
import { FILTER_POPOVER_PAPER_SX } from "./MultiSelectFilterPopover";

interface Props {
    open: boolean;
    anchorEl: HTMLElement | null;
    onClose: () => void;
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
}

/** Controlled text box in a popover; debouncing is the owner's job, so typing stays instant. */
export function TextFilterPopover({ open, anchorEl, onClose, value, onChange, ariaLabel }: Props): React.JSX.Element {
    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            slotProps={{ paper: { sx: FILTER_POPOVER_PAPER_SX } }}
        >
            <Box sx={{ p: 2, minWidth: 240 }}>
                <TextField
                    autoFocus
                    size="small"
                    fullWidth
                    placeholder="Contains…"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    inputProps={{ "aria-label": ariaLabel }}
                />
            </Box>
        </Popover>
    );
}
