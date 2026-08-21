import React from "react";
import { Box, CircularProgress } from "@mui/material";

type Props = {
    /**
     * Reserves vertical space while the content is in flight, so the surrounding layout does not
     * collapse and then jump when it lands. Pass "100%" to fill a flex/grid parent.
     */
    minHeight?: number | string;
    size?: number;
    testId?: string;
};

/**
 * The admin surface's one loading affordance: a centred spinner that occupies the space its
 * content will occupy.
 *
 * It exists to be rendered *inside* the surface that is loading — under a page's top bar, inside
 * the dialog or panel whose data is pending — rather than in place of it. Swapping a whole screen
 * for a loader takes the title, the back button and the branch selector away at the exact moment
 * the user is asking themselves what the app is doing.
 */
export function LoadingIndicator({ minHeight = 240, size, testId = "loading-indicator" }: Props): JSX.Element {
    return (
        <Box data-testid={testId} sx={{ display: "grid", placeItems: "center", width: "100%", minHeight }}>
            <CircularProgress size={size} />
        </Box>
    );
}
