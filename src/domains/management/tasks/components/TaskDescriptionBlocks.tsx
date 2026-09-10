import React from "react";
import { Box, Typography } from "@mui/material";
import { hasDescriptionContent, parseTaskDescription } from "../descriptionBlocks";

export interface TaskDescriptionBlocksProps {
    description: string | null;
    // "drawer" = body2 text / small bold caption header (matches this file's existing
    // Priority/Photo caption style in TaskCardDrawer.tsx); "card" = caption-sized header+body for
    // the dense board tile.
    size?: "drawer" | "card";
}

const HEADER_SX_BY_SIZE = {
    drawer: {
        display: "block" as const,
        mb: 0.5,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
        color: "text.secondary",
        fontSize: 11,
    },
    card: {
        display: "block" as const,
        mb: 0.25,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
        color: "text.secondary",
        fontSize: 10,
    },
};

const BODY_VARIANT_BY_SIZE = {
    drawer: "body2" as const,
    card: "caption" as const,
};

function Block({ header, body, size }: { header: string; body: string; size: "drawer" | "card" }): JSX.Element {
    return (
        <Box sx={{ mb: 1.25, "&:last-child": { mb: 0 } }}>
            <Typography variant="caption" sx={HEADER_SX_BY_SIZE[size]}>
                {header}
            </Typography>
            <Typography
                variant={BODY_VARIANT_BY_SIZE[size]}
                color="text.primary"
                sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
                {body}
            </Typography>
        </Box>
    );
}

export default function TaskDescriptionBlocks({ description, size = "drawer" }: TaskDescriptionBlocksProps): JSX.Element | null {
    if (!hasDescriptionContent(description)) return null;

    const parsed = parseTaskDescription(description);

    if (parsed.isLegacy) {
        return (
            <Box>
                <Block header="Description" body={parsed.goal} size={size} />
            </Box>
        );
    }

    return (
        <Box>
            {parsed.goal.trim().length > 0 && <Block header="Goal & Description" body={parsed.goal} size={size} />}
            {parsed.doneCriteria.trim().length > 0 && <Block header="Done Criteria" body={parsed.doneCriteria} size={size} />}
            {parsed.progressComments.trim().length > 0 && <Block header="Progress Comments" body={parsed.progressComments} size={size} />}
            {parsed.blocker.trim().length > 0 && <Block header="Blocker" body={parsed.blocker} size={size} />}
        </Box>
    );
}
