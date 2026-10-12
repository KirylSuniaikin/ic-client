import React from "react";
import { Box } from "@mui/material";
import { ZONE_STYLE } from "../zone";
import type { DisciplineZone } from "../types";

export type ScoreBadgeProps = {
    score: number;
    zone: DisciplineZone;
    size?: "sm" | "md" | "lg";
    testId?: string;
};

const DIAMETER: Record<"sm" | "md" | "lg", number> = { sm: 22, md: 30, lg: 56 };
const FONT_PX: Record<"sm" | "md" | "lg", { normal: number; long: number }> = {
    sm: { normal: 11, long: 9 },
    md: { normal: 14, long: 11 },
    lg: { normal: 22, long: 17 },
};

// Placement is the caller's job.
const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, zone, size = "sm", testId }) => {
    const { bg, fg, label } = ZONE_STYLE[zone];
    // Three characters ("100", "-12") would overflow the circle at the normal size.
    const long = String(score).length >= 3;
    return (
        <Box
            component="span"
            data-testid={testId}
            data-zone={zone}
            aria-label={`Score ${score}, ${label}`}
            sx={{
                width: DIAMETER[size],
                height: DIAMETER[size],
                borderRadius: "50%",
                bgcolor: bg,
                color: fg,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontWeight: 700,
                fontSize: long ? FONT_PX[size].long : FONT_PX[size].normal,
                lineHeight: 1,
                overflow: "hidden",
            }}
        >
            {score}
        </Box>
    );
};

export default ScoreBadge;
