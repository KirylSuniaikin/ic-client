import { amber, green, orange } from "@mui/material/colors";
import { BRAND_RED } from "../../../shared/utils/theme";
import type { DisciplineZone } from "./types";

// D-FE4: no invented hex. Yellow has no brand token, so it is MUI amber.
export const ZONE_STYLE: Record<DisciplineZone, { bg: string; fg: string; label: string }> = {
    GREEN: { bg: green[500], fg: "#FFFFFF", label: "Green zone" },
    YELLOW: { bg: amber[600], fg: "#FFFFFF", label: "Yellow zone" },
    ORANGE: { bg: orange[800], fg: "#FFFFFF", label: "Orange zone" },
    RED: { bg: BRAND_RED, fg: "#FFFFFF", label: "Red zone" },
};
