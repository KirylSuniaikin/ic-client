import React from "react";
import { Box, Typography } from "@mui/material";
import { ZONE_STYLE } from "../zone";
import type { DisciplineZone, MyWorkSummaryTO } from "../types";
import { formatDate, formatHours } from "../format";

export type ProfileStatsProps = {
    score: number | null;
    zone: DisciplineZone | null;
    activeCount: number | null;
    summary: MyWorkSummaryTO | null;
};

const Stat: React.FC<{ value: string; label: string; testId: string; color?: string }> = ({ value, label, testId, color }) => (
    <Box sx={{ flex: 1, textAlign: "center", px: 0.5 }}>
        <Typography data-testid={testId} sx={{ fontWeight: 800, fontSize: 28, lineHeight: 1.1, color }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Box>
);

// Pay figures are null unless the viewer is an OWNER; this renders what the response carries.
const ProfileStats: React.FC<ProfileStatsProps> = ({ score, zone, activeCount, summary }) => (
    <Box data-testid="profile-stats" sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "stretch", "& > * + *": { borderLeft: "1px solid", borderColor: "grey.200" } }}>
            <Stat
                value={score === null ? "–" : String(score)}
                label="Score"
                testId="my-profile-score"
                color={zone === null ? undefined : ZONE_STYLE[zone].bg}
            />
            <Stat value={summary === null ? "–" : formatHours(summary.totalHours)} label="Hours last cycle" testId="profile-hours" />
            <Stat value={activeCount === null ? "–" : String(activeCount)} label="Violations" testId="profile-active-count" />
        </Box>
        {summary !== null && (
            <Box data-testid="last-month-work-card" sx={{ mt: 1.5, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                    {`${formatDate(summary.periodStart)} – ${formatDate(summary.periodEnd)}`}
                </Typography>
                {summary.totalSalary !== null && (
                    <Typography variant="body2">{`Total salary: BD ${summary.totalSalary.toFixed(3)}`}</Typography>
                )}
                {summary.totalCost !== null && (
                    <Typography variant="body2">{`Total cost: BD ${summary.totalCost.toFixed(3)}`}</Typography>
                )}
            </Box>
        )}
    </Box>
);

export default ProfileStats;
