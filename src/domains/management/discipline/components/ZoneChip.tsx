import React from "react";
import { Chip } from "@mui/material";
import { ZONE_STYLE } from "../zone";
import type { DisciplineZone } from "../types";

const ZoneChip: React.FC<{ zone: DisciplineZone }> = ({ zone }) => {
    const { bg, fg, label } = ZONE_STYLE[zone];
    return (
        <Chip
            size="small"
            label={label}
            data-zone={zone}
            sx={{ bgcolor: bg, color: fg, fontWeight: 600 }}
        />
    );
};

export default ZoneChip;
