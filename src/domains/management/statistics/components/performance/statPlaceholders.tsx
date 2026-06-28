import React from "react";
import {Box, Skeleton, Typography} from "@mui/material";

// Shown while the first fetch is in flight (stats still null) — keeps the card's
// shape instead of an empty white box.
export function StatSkeleton({lines = 3}: {lines?: number}): JSX.Element {
    return (
        <Box>
            {Array.from({length: lines}).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={28} sx={{my: 1}}/>
            ))}
        </Box>
    );
}

// Shown once data has loaded but the selected range produced nothing — distinguishes
// "no orders" from "still loading" (both previously rendered as bare zeros).
export function StatEmptyState({message}: {message: string}): JSX.Element {
    return (
        <Box sx={{py: 4, textAlign: "center", color: "text.secondary"}}>
            <Typography variant="body2">{message}</Typography>
        </Box>
    );
}
