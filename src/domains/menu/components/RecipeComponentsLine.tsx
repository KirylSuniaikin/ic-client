import React from "react";
import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import HighlightOffOutlinedIcon from "@mui/icons-material/HighlightOffOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import type { RecipeComponent } from "../types";

const brandRed = "#E44B4C";

interface RecipeComponentsLineProps {
    components: RecipeComponent[];
    removedIds: number[];
    onToggle: (component: RecipeComponent) => void;
}

/**
 * Comma-separated line of a pizza's recipe components (shown under the dough/quantity
 * selectors). Deletable components are underlined with a small ⊗ button; clicking strikes the
 * name through (black line) and swaps the icon to a restore arrow. Non-deletable components are
 * plain text. Renders nothing for items without a recipe, so non-pizza popups degrade gracefully.
 */
export const RecipeComponentsLine: React.FC<RecipeComponentsLineProps> = ({ components, removedIds, onToggle }) => {
    const { t, i18n } = useTranslation("menu");
    const isArabic = i18n.language.startsWith("ar");
    // Display-only swap (label/label_ar); `name` still drives onToggle/removal state and
    // order-removal tokens (see src/domains/menu/utils/customizations.ts).
    const displayLabel = (c: RecipeComponent): string =>
        isArabic ? (c.label_ar ?? c.label ?? c.name) : (c.label ?? c.name);

    if (components.length === 0) return null;

    const hasDeletableComponent = components.some((component) => component.deletable);

    return (
        <Box sx={{ mb: 2, px: 0.2 }}>
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 0.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                    {t("recipe.heading")}
                </Typography>
                {/* The ⓘ only appears when something is actually removable — on a recipe with no
                    deletable components nothing is underlined, so the hint would describe UI that
                    isn't on screen. enterTouchDelay/leaveTouchDelay are the house tap-to-open
                    idiom for touch devices (see management/statistics/.../GlobalStatsCard.tsx). */}
                {hasDeletableComponent && (
                    <Tooltip title={t("recipe.removeHint")} arrow enterTouchDelay={0} leaveTouchDelay={6000}>
                        <InfoOutlinedIcon fontSize="small" sx={{ color: "text.disabled", cursor: "pointer" }} />
                    </Tooltip>
                )}
            </Stack>
            <Typography variant="body2" sx={{ color: "#6b6b6b", lineHeight: 1.9 }}>
                {components.map((component, index) => {
                    const removed = removedIds.includes(component.id);
                    const separator = index < components.length - 1 ? ", " : "";

                    if (!component.deletable) {
                        return (
                            <React.Fragment key={component.id}>
                                {displayLabel(component)}
                                {separator}
                            </React.Fragment>
                        );
                    }

                    return (
                        <React.Fragment key={component.id}>
                            <Box
                                component="span"
                                onClick={() => onToggle(component)}
                                sx={{
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                    textDecoration: removed ? "line-through" : "underline",
                                    textDecorationColor: removed ? "#000" : undefined,
                                    color: removed ? "#000" : undefined,
                                }}
                            >
                                {displayLabel(component)}
                                {removed ? (
                                    <ReplayOutlinedIcon
                                        sx={{ fontSize: 14, verticalAlign: "middle", ml: 0.3, color: brandRed }}
                                    />
                                ) : (
                                    <HighlightOffOutlinedIcon
                                        sx={{ fontSize: 14, verticalAlign: "middle", ml: 0.3, color: brandRed }}
                                    />
                                )}
                            </Box>
                            {separator}
                        </React.Fragment>
                    );
                })}
            </Typography>
        </Box>
    );
};
