import React from "react";
import { Box, Typography } from "@mui/material";
import type { MyWorkSummaryTO } from "../types";
import { formatDate, formatHours } from "../format";

// Pay figures are null unless the viewer is an OWNER; this renders what the response carries.
const LastMonthWorkCard: React.FC<{ summary: MyWorkSummaryTO }> = ({ summary }) => (
    <Box
        data-testid="last-month-work-card"
        sx={{ border: "1px solid", borderColor: "grey.200", borderRadius: 3, p: 1.5, mb: 2 }}
    >
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Last full pay cycle</Typography>
        <Typography variant="body2" color="text.secondary">
            {`${formatDate(summary.periodStart)} – ${formatDate(summary.periodEnd)}`}
        </Typography>
        <Typography variant="body2">{`Hours worked: ${formatHours(summary.totalHours)}`}</Typography>
        {summary.totalSalary !== null && (
            <Typography variant="body2">{`Total salary: BD ${summary.totalSalary.toFixed(3)}`}</Typography>
        )}
        {summary.totalCost !== null && (
            <Typography variant="body2">{`Total cost: BD ${summary.totalCost.toFixed(3)}`}</Typography>
        )}
    </Box>
);

export default LastMonthWorkCard;
