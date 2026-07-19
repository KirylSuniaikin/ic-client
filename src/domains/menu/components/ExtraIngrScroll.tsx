import React from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useLocalizedItem } from "../../../shared/hooks/useLocalizedItem";
import type { ExtraIngr } from "../types";

const brandRed = "#E44B4C";

interface ExtraIngrScrollProps {
    ingredients: ExtraIngr[];
    selected: string[];
    onToggle: (name: string) => void;
}

/**
 * Horizontal scroll of extra-ingredient cards — same card design as PizzaPopupContent's
 * "Customize" block, extracted for reuse in the combo popups (no garlic-crust/cherry
 * pseudo-cards here; combos already have a crust toggle). Renders nothing when the
 * catalog has no extras for the current size.
 */
export const ExtraIngrScroll: React.FC<ExtraIngrScrollProps> = ({ ingredients, selected, onToggle }) => {
    const { t } = useTranslation("menu");
    const { name: localizeName } = useLocalizedItem();

    if (ingredients.length === 0) return null;

    return (
        <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1, px: 0.2 }}>
                {t("pizzaPopup.customize")}
            </Typography>
            <Box
                sx={{
                    display: "flex",
                    overflowX: "auto",
                    gap: 1,
                    mb: 2,
                    py: 1,
                    px: 0.2,
                    scrollSnapType: "x mandatory",
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": {
                        display: "none"
                    }
                }}
            >
                {ingredients.map((ing) => {
                    const active = selected.includes(ing.name);
                    const ingWithPhoto = ing as unknown as Record<string, unknown>;
                    return (
                        <Box
                            key={ing.name}
                            onClick={() => onToggle(ing.name)}
                            sx={{
                                width: 140,
                                flexShrink: 0,
                                textAlign: "center",
                                p: 2,
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: "13px",
                                color: "#000",
                                boxShadow: active
                                    ? `0 0 0 2px ${brandRed}`
                                    : "0 1px 3px rgba(0,0,0,0.25)",
                                border: "none",
                                "&:hover": {
                                    boxShadow: active
                                        ? `0 0 0 2px ${brandRed}`
                                        : "0 2px 5px rgba(0,0,0,0.2)"
                                }
                            }}
                        >
                            {ingWithPhoto.photo ? (
                                <img
                                    src={ingWithPhoto.photo as string}
                                    alt={localizeName(ing)}
                                    style={{
                                        maxWidth: "100%",
                                        height: 120,
                                        objectFit: "contain"
                                    }}
                                />
                            ) : (
                                <Box
                                    sx={{
                                        width: "100%",
                                        height: 120,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: "#f9f9f9"
                                    }}
                                />
                            )}
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: "bold",
                                    mt: 1,
                                    overflowWrap: "break-word",
                                    wordWrap: "break-word",
                                    whiteSpace: "normal",
                                    lineHeight: 1.2
                                }}
                            >
                                {localizeName(ing)}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                +{ingWithPhoto.price as number}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};
