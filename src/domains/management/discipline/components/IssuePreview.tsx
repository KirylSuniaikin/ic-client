import React from "react";
import { Box, Typography } from "@mui/material";
import { formatDate } from "../format";
import { ACTION_LEVEL_LABEL } from "../labels";
import type { IssuePreviewTO } from "../types";
import ZoneChip from "./ZoneChip";

const PENDING_NOTE =
    "The employee has 48 hours to give a written explanation. The General Manager then confirms or cancels the violation. The formal action is issued on confirmation.";
const PILOT_NOTE =
    "Shadow pilot is on: this violation is recorded and counts toward the score, but no penalty hours or documents are applied.";
const CLASS_D_NOTE = "Class D: recorded for the General Manager (art.107). No points, no explanation window.";

// The acceptance criteria require "9 h", so formatHours' fixed 2 decimals ("9.00") is not used here.
const roundHours = (n: number): number => Number(n.toFixed(2));

const IssuePreview: React.FC<{ preview: IssuePreviewTO }> = ({ preview }) => {
    const isClassD = preview.violationClass === "D";
    const showHours = !preview.shadowPilot && preview.penaltyHours > 0;
    return (
        <Box
            data-testid="issue-preview"
            sx={{ border: "1px solid", borderColor: "grey.200", borderRadius: 3, p: 1.5, mb: 2 }}
        >
            {!isClassD && (
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                    <Typography data-testid="issue-preview-score" sx={{ fontWeight: 700, fontSize: 14 }}>
                        {`Score ${preview.scoreBefore} → ${preview.scoreAfter}`}
                    </Typography>
                    <ZoneChip zone={preview.zoneBefore} />
                    <ZoneChip zone={preview.zoneAfter} />
                </Box>
            )}
            {preview.formalAction !== null && (
                <Typography data-testid="issue-preview-action" sx={{ fontSize: 14, mb: 0.5 }}>
                    {`Formal action: ${ACTION_LEVEL_LABEL[preview.formalAction]}`}
                </Typography>
            )}
            {isClassD ? (
                <Typography data-testid="issue-preview-class-d" sx={{ fontSize: 13, color: "text.secondary", mb: 0.5 }}>
                    {CLASS_D_NOTE}
                </Typography>
            ) : (
                <Typography data-testid="issue-preview-outcome" sx={{ fontSize: 13, color: "text.secondary", mb: 0.5 }}>
                    {preview.outcomeStatus === "PENDING_EXPLANATION" ? PENDING_NOTE : "Applies immediately."}
                </Typography>
            )}
            {preview.shadowPilot && (
                <Typography data-testid="issue-preview-pilot" sx={{ fontSize: 13, color: "text.secondary" }}>
                    {PILOT_NOTE}
                </Typography>
            )}
            {showHours && (
                <Box data-testid="issue-preview-hours">
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                        {`Penalty hours: ${preview.penaltyHours} h`}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                        {`This pay cycle (${formatDate(preview.payCycle.start)} – ${formatDate(preview.payCycle.end)}): ${preview.penaltyHoursInCycle} h already`}
                    </Typography>
                </Box>
            )}
            {showHours && preview.capHours !== null && preview.maxDeductibleHours !== null && (
                <Typography data-testid="issue-preview-cap" sx={{ fontSize: 13, color: "text.secondary" }}>
                    {`Penalty hours this cycle: ${roundHours(preview.penaltyHoursInCycle + preview.penaltyHours)} h, cap ${roundHours(preview.capHours)} h, ${roundHours(preview.maxDeductibleHours)} h will be deducted at most`}
                </Typography>
            )}
        </Box>
    );
};

export default IssuePreview;
