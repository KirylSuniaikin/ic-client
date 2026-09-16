import React from "react";
import { Box, Chip, Typography } from "@mui/material";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import { hasDescriptionContent, parseTaskDescription } from "../descriptionBlocks";
import { extractUrls } from "../../../../shared/utils/linkify";

export interface TaskDescriptionBlocksProps {
    description: string | null;
    // "drawer" = body2 text / small bold caption header (matches this file's existing
    // Priority/Photo caption style in TaskCardDrawer.tsx); "card" = caption-sized header+body for
    // the dense board tile.
    size?: "drawer" | "card";
}

// Drawer headers read as a real subtitle (subtitle1-equivalent, no caps/tracking); card headers
// stay a small uppercase label but a visible step up from the old 10px caption, and remain
// subordinate to both the drawer header and the h6/body2 titles in TaskCardDrawer/TaskCardItem.
const HEADER_VARIANT_BY_SIZE = {
    drawer: "subtitle1" as const,
    card: "caption" as const,
};

const HEADER_SX_BY_SIZE = {
    drawer: {
        display: "block" as const,
        mb: 0.5,
        fontWeight: 700,
        color: "text.primary",
    },
    card: {
        display: "block" as const,
        mb: 0.25,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
        color: "text.primary",
        fontSize: 12,
    },
};

const BODY_VARIANT_BY_SIZE = {
    drawer: "body2" as const,
    card: "caption" as const,
};

function formatUrlLabel(url: string): string {
    // Keep the chip a small affordance, not a headline: show just the hostname rather than the
    // full (often long) URL.
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

const LINK_CHIP_SX_BY_SIZE = {
    drawer: { height: 24, fontSize: 11, maxWidth: 220 },
    card: { height: 20, fontSize: 10, maxWidth: 140 },
};

// A row of small, secondary "open link" chips. Rendered above the description blocks; on the card
// tile (size="card") this sits inside a Card whose own onClick opens the drawer, so the click must
// stop propagation or the tile would also try to open on every link click.
function LinkRow({ urls, size }: { urls: string[]; size: "drawer" | "card" }): JSX.Element {
    return (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.25 }}>
            {urls.map(url => (
                <Chip
                    key={url}
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    variant="outlined"
                    size="small"
                    icon={<LinkRoundedIcon sx={{ fontSize: size === "card" ? 12 : 14 }} />}
                    label={formatUrlLabel(url)}
                    onClick={(event): void => event.stopPropagation()}
                    sx={{
                        color: "text.secondary",
                        borderColor: "divider",
                        ...LINK_CHIP_SX_BY_SIZE[size],
                        "& .MuiChip-label": {
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        },
                    }}
                />
            ))}
        </Box>
    );
}

function Block({ header, body, size }: { header: string; body: string; size: "drawer" | "card" }): JSX.Element {
    return (
        <Box sx={{ mb: 1.25, "&:last-child": { mb: 0 } }}>
            <Typography variant={HEADER_VARIANT_BY_SIZE[size]} sx={HEADER_SX_BY_SIZE[size]}>
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
    // Union across all four raw block fields (for legacy descriptions only `goal` is populated
    // with the full raw string), first-seen order, deduped — the link row is scanned from the raw
    // text, not the rendered blocks.
    const urls = extractUrls([parsed.goal, parsed.doneCriteria, parsed.progressComments, parsed.blocker].join("\n"));

    if (parsed.isLegacy) {
        return (
            <Box>
                {urls.length > 0 && <LinkRow urls={urls} size={size} />}
                <Block header="Description" body={parsed.goal} size={size} />
            </Box>
        );
    }

    return (
        <Box>
            {urls.length > 0 && <LinkRow urls={urls} size={size} />}
            {parsed.goal.trim().length > 0 && <Block header="Goal & Description" body={parsed.goal} size={size} />}
            {parsed.doneCriteria.trim().length > 0 && <Block header="Done Criteria" body={parsed.doneCriteria} size={size} />}
            {parsed.progressComments.trim().length > 0 && <Block header="Progress Comments" body={parsed.progressComments} size={size} />}
            {parsed.blocker.trim().length > 0 && <Block header="Blocker" body={parsed.blocker} size={size} />}
        </Box>
    );
}
