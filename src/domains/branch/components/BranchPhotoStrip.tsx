import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

type StripPhoto = { src: string; alt: string | null };

export interface BranchPhotoStripProps {
    photos: readonly StripPhoto[];
    branchName: string;
    /** "sheet": the phone Drawer, touch-scrolled. "pane": the PC picker column, mouse-scrolled. */
    size: "sheet" | "pane";
    /** Shown instead of the strip once every photo has failed to load. */
    fallback?: ReactNode;
}

const CARD_SX: SxProps<Theme> = {
    borderRadius: "20px",
    overflow: "hidden",
    bgcolor: "#f4ede8",
};

const IMAGE_SX: SxProps<Theme> = { width: "100%", height: "100%", objectFit: "cover", display: "block" };

/**
 * The branch's photos as a row of tall cards bleeding to the sheet's edges, so the next card
 * peeks in and says "this scrolls". One photo is a single wide card instead: a lone 4:5 card would
 * leave most of the row empty.
 *
 * Deliberately not interactive: there is no viewer to open, and a card that looks tappable but
 * does nothing is worse than a plain picture.
 *
 * A photo that fails to load is dropped rather than left as an empty card. If every one fails this
 * renders `fallback` (the caller's roundel) instead. The caller keys it by branch, so the failed
 * set starts empty for each branch.
 */
export function BranchPhotoStrip({ photos, branchName, size, fallback = null }: BranchPhotoStripProps): JSX.Element {
    const { t } = useTranslation("branch");
    const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());

    // Numbered by position in the config, so a photo keeps its name when another one fails.
    const visible = photos
        .map((photo, index) => ({ photo, index }))
        .filter(({ photo }) => !failed.has(photo.src));
    if (visible.length === 0) return <>{fallback}</>;

    const label = t("details.photosLabel", { branchName });

    const renderImage = ({ photo, index }: { photo: StripPhoto; index: number }): JSX.Element => (
        <Box
            component="img"
            src={photo.src}
            alt={photo.alt ?? t("details.photoAlt", { branchName, n: index + 1 })}
            loading={index < 2 ? "eager" : "lazy"}
            decoding="async"
            onError={() => setFailed((prev) => new Set(prev).add(photo.src))}
            sx={IMAGE_SX}
        />
    );

    if (visible.length === 1) {
        return (
            <Box role="region" aria-label={label} sx={{ mb: 2 }}>
                <Box sx={{ ...CARD_SX, width: "100%", aspectRatio: "16 / 9" }}>
                    {renderImage(visible[0])}
                </Box>
            </Box>
        );
    }

    return (
        <Box
            role="region"
            aria-label={label}
            // Focusable so keyboard users can scroll the row with the arrow keys.
            tabIndex={0}
            sx={{
                display: "flex",
                gap: 1,
                overflowX: "auto",
                scrollSnapType: "x mandatory",
                scrollPaddingInline: "24px",
                px: 3,
                mx: -3,
                pb: 0.5,
                mb: 2, // the gap above the branch name; the roundel fallback carries its own
                WebkitOverflowScrolling: "touch",
                // A hidden scrollbar is fine under a thumb, but a mouse wheel cannot move a strip
                // with no scrollbar, so the PC pane keeps a thin one.
                ...(size === "sheet"
                    ? { scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }
                    : { scrollbarWidth: "thin" }),
            }}
        >
            {visible.map((entry) => (
                <Box
                    key={entry.photo.src}
                    sx={{
                        ...CARD_SX,
                        flex: "0 0 auto",
                        width: size === "sheet" ? 160 : 150,
                        aspectRatio: "4 / 5",
                        scrollSnapAlign: "start",
                    }}
                >
                    {renderImage(entry)}
                </Box>
            ))}
        </Box>
    );
}
