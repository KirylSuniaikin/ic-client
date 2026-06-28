import {useTheme} from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

export type StatsLayout = "mobile" | "tablet";

// Phones (< sm / 600px) get the stacked single-column layout; everything sm+ (the
// POS tablets) keeps the rich multi-column layout. Used only for the few spots the
// MUI Grid breakpoint props can't express (dividers, full-width controls).
export function useStatsLayout(): StatsLayout {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    return isMobile ? "mobile" : "tablet";
}
