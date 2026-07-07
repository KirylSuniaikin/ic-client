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
    // Optional note integration. When both are provided, toggling a chip is also reflected in the
    // free-text note box: selecting a pick appends its label, deselecting removes it — so the
    // customer sees quick picks in the notes/description box, not only in the cart.
    note?: string;
    onNoteChange?: (nextNote: string) => void;
}

function resolveLabel(pick: QuickPickDto, isArabic: boolean): string {
    const base = isArabic && pick.labelAr ? pick.labelAr : pick.label;
    return pick.isPopular ? `⭐ ${base}` : base;
}

function resolveRawLabel(pick: QuickPickDto, isArabic: boolean): string {
    return isArabic && pick.labelAr ? pick.labelAr : pick.label;
}

// Adds or removes a single quick-pick label within a comma-separated note, leaving the customer's
// own text intact. Idempotent: a label never appears twice, so re-selecting can't duplicate it.
export function applyQuickPickLabelToNote(note: string, label: string, selected: boolean): string {
    const tokens = note.split(",").map((token) => token.trim()).filter(Boolean);
    const withoutLabel = tokens.filter((token) => token !== label);
    const nextTokens = selected ? [...withoutLabel, label] : withoutLabel;
    return nextTokens.join(", ");
}

export const QuickPickChips: React.FC<QuickPickChipsProps> = ({ menuItemId, selectedIds, onChange, note, onNoteChange }) => {
    const { t, i18n } = useTranslation("menu");
    const isArabic = i18n.language.startsWith("ar");
    const picks = useQuickPicks(menuItemId);

    if (picks.length === 0) return null;

    function handleToggle(pick: QuickPickDto): void {
        const isSelected = selectedIds.includes(pick.id);
        const next = isSelected
            ? selectedIds.filter((id) => id !== pick.id)
            : [...selectedIds, pick.id];

        const joined = picks
            .filter((p) => next.includes(p.id))
            .map((p) => resolveRawLabel(p, isArabic))
            .join(", ");

        onChange(next, joined);

        if (onNoteChange) {
            const label = resolveRawLabel(pick, isArabic);
            onNoteChange(applyQuickPickLabelToNote(note ?? "", label, !isSelected));
        }
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
