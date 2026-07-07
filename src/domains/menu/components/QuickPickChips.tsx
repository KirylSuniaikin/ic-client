import React from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useQuickPicks } from "../hooks/useQuickPicks";
import type { QuickPickDto } from "../types";

const brandRed = "#E44B4C";

interface QuickPickChipsProps {
    menuItemId: number | null | undefined;
    selectedIds: number[];
    onChange: (selectedIds: number[], joinedLabel: string) => void;
}

function resolveLabel(pick: QuickPickDto, isArabic: boolean): string {
    const base = isArabic && pick.labelAr ? pick.labelAr : pick.label;
    return pick.isPopular ? `⭐ ${base}` : base;
}

function resolveRawLabel(pick: QuickPickDto, isArabic: boolean): string {
    return isArabic && pick.labelAr ? pick.labelAr : pick.label;
}

export const QuickPickChips: React.FC<QuickPickChipsProps> = ({ menuItemId, selectedIds, onChange }) => {
    const { t, i18n } = useTranslation("menu");
    const isArabic = i18n.language.startsWith("ar");
    const picks = useQuickPicks(menuItemId);

    if (picks.length === 0) return null;

    function handleToggle(pick: QuickPickDto): void {
        const next = selectedIds.includes(pick.id)
            ? selectedIds.filter((id) => id !== pick.id)
            : [...selectedIds, pick.id];

        const joined = picks
            .filter((p) => next.includes(p.id))
            .map((p) => resolveRawLabel(p, isArabic))
            .join(", ");

        onChange(next, joined);
    }

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1, px: 0.2 }}>
                {t("quickPicks.header")}
            </Typography>
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                }}
            >
                {picks.map((pick) => {
                    const active = selectedIds.includes(pick.id);
                    return (
                        <Box
                            key={pick.id}
                            onClick={() => handleToggle(pick)}
                            sx={{
                                px: 2,
                                py: 1,
                                borderRadius: "999px",
                                cursor: "pointer",
                                border: active ? `2px solid ${brandRed}` : "2px solid transparent",
                                backgroundColor: "#fff",
                                boxShadow: active ? "none" : "0 1px 3px rgba(0,0,0,0.25)",
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: active ? "bold" : "normal",
                                    color: active ? brandRed : "#000",
                                }}
                            >
                                {resolveLabel(pick, isArabic)}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};
