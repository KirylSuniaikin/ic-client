import React from "react";
import {Box, Typography} from "@mui/material";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

type Props = {
    current: number;
    previous: number;
};

// ▲/▼ delta vs the previous comparable period. Green up / red down; "new" when there
// was no baseline (previous === 0). Renders nothing when both periods are empty.
export function TrendChip({current, previous}: Props): JSX.Element | null {
    if (previous === 0 && current === 0) return null;

    const noBaseline = previous === 0;
    const deltaPct = noBaseline ? 0 : ((current - previous) / Math.abs(previous)) * 100;
    const up = current >= previous;
    const color = current === previous ? "text.disabled" : up ? "success.main" : "error.main";
    const label = noBaseline ? "new" : `${Math.abs(Math.round(deltaPct))}%`;

    return (
        <Box component="span" sx={{display: "inline-flex", alignItems: "center", color, lineHeight: 1}}>
            {up ? <ArrowDropUpIcon sx={{fontSize: 18}}/> : <ArrowDropDownIcon sx={{fontSize: 18}}/>}
            <Typography component="span" variant="caption" sx={{fontWeight: 700, color: "inherit"}}>
                {label}
            </Typography>
        </Box>
    );
}
