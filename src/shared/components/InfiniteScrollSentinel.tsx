import React from "react";
import { Box, CircularProgress } from "@mui/material";

type Props = {
    /** The `sentinelRef` returned by useIncrementalList. */
    sentinelRef: (node: HTMLElement | null) => void;
    testId?: string;
};

/**
 * End-of-list marker for useIncrementalList. Render it only while there is more to show — it
 * doubles as the "loading the next batch" affordance, so an empty end of list stays quiet.
 */
export function InfiniteScrollSentinel({ sentinelRef, testId = "infinite-scroll-sentinel" }: Props) {
    return (
        <Box
            ref={sentinelRef}
            data-testid={testId}
            sx={{ display: "grid", placeItems: "center", py: 2 }}
        >
            <CircularProgress size={24} />
        </Box>
    );
}
