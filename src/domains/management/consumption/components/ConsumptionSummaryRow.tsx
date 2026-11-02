import React from "react";
import {Box, ButtonBase, Chip, Typography} from "@mui/material";
import {alpha} from "@mui/material/styles";
import {RowSummary} from "../consumptionRows";

type Props = {
    vendorLabel: string;
    // Set only while a vendor is filtered, so the chip can clear that filter.
    onClearVendor?: () => void;
    summary: RowSummary;
    onOpenHistory: () => void;
};

export function ConsumptionSummaryRow({vendorLabel, onClearVendor, summary, onOpenHistory}: Props) {
    return (
        <Box
            data-testid="consumption-summary-row"
            sx={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1.5,
                px: 2,
                py: 1.25,
                borderRadius: 2,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
            }}
        >
            <Box sx={{flex: 1, minWidth: 160}}>
                <Typography variant="caption" color="text.secondary" sx={{display: "block", lineHeight: 1.2}}>
                    Total amount
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {summary.count} {summary.count === 1 ? "item" : "items"}
                </Typography>
            </Box>
            <Chip
                label={vendorLabel}
                size="small"
                color={onClearVendor ? "primary" : "default"}
                onDelete={onClearVendor}
            />
            <ButtonBase
                onClick={onOpenHistory}
                aria-label="Show 6 month purchase history"
                sx={{borderRadius: 1.5, px: 1, py: 0.25, minWidth: 120, justifyContent: "flex-end", "&:hover": {bgcolor: "action.hover"}}}
            >
                <Typography sx={{fontWeight: 700, fontSize: 22, fontVariantNumeric: "tabular-nums", textDecoration: "underline dotted", textUnderlineOffset: 4}}>
                    {summary.total.toFixed(3)} <Typography component="span" variant="body2" color="text.secondary">BD</Typography>
                </Typography>
            </ButtonBase>
        </Box>
    );
}
