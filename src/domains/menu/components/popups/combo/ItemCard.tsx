import {Box, Button, TextField, ToggleButton, ToggleButtonGroup, Typography} from "@mui/material";
import React from "react";
import {useTranslation} from "react-i18next";
import {useLocalizedItem} from "../../../../../shared/hooks/useLocalizedItem";
import {useOptionLabel} from "../../../../../shared/hooks/useOptionLabel";
import type { MenuItem, RecipeComponent } from '../../../types';
import {RecipeComponentsLine} from "../../RecipeComponentsLine";

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

interface ItemCardProps {
    item: MenuItem | null | undefined;
    onChange?: () => void;
    fixed?: boolean;
    dough?: string;
    crust?: string;
    onDoughChange?: (val: string) => void;
    onCrustChange?: (val: string) => void;
    description?: string;
    setDescription?: (val: string) => void;
    showDoughSelector?: boolean;
    // Recipe-component removal (pizza/brick slots): parent owns the state, card renders the line.
    components?: RecipeComponent[];
    removedIds?: number[];
    onToggleComponent?: (component: RecipeComponent) => void;
    // Rendered right under the recipe-components line (e.g. the extra-ingredients scroll).
    extrasSlot?: React.ReactNode;
}

export function ItemCard ({ item,
                              onChange,
                              fixed,
                              dough,
                              crust,
                              onDoughChange,
                              onCrustChange,
                              description,
                              setDescription,
                              showDoughSelector,
                              components = [],
                              removedIds = [],
                              onToggleComponent,
                              extrasSlot,
                            }: ItemCardProps): JSX.Element {
    const {t} = useTranslation("menu");
    const {name: localizeName, description: localizeDescription} = useLocalizedItem();
    const optionLabel = useOptionLabel();

    if (!item) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 2.5,
                    mb: 2,
                    bgcolor: "#fff",
                    borderRadius: 5,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                    minHeight: 120,
                }}
            >
                <Typography color="text.secondary">{t("itemCard.noItemAvailable")}</Typography>
            </Box>
        );
    }
    return(
        <Box
            sx={{
                p: 2.5,
                mb: 2,
                bgcolor: "#fff",
                borderRadius: 5,
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "flex-start" }}>
                <img
                    src={item.photo}
                    alt={localizeName(item)}
                    style={{
                        width: 120,
                        height: 120,
                        objectFit: "cover",
                        borderRadius: 12,
                    }}
                />

                <Box
                    sx={{
                        ml: 2,
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        minHeight: 120,
                    }}
                >
                    <Box>
                        <Typography fontWeight="500" sx={{ mb: 0.5 }}>
                            {localizeName(item)}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {localizeDescription(item) || " "}
                        </Typography>
                    </Box>

                    {!fixed && (
                        <Button
                            variant="outlined"
                            size="small"
                            sx={{
                                color: brandRed,
                                backgroundColor: "#ffe5e6",
                                borderColor: "white",
                                textTransform: "none",
                                fontSize: "15px",
                                borderRadius: 8,
                                "&:hover": { backgroundColor: "#d23f40" },
                                alignSelf: "flex-start",
                                mt: 1,
                            }}
                            onClick={onChange}
                        >
                            {t("itemCard.change")}
                        </Button>
                    )}
                </Box>
            </Box>

            {item.category === "Pizzas" && (
                <Box sx={{ mt: 2 }}>
                    {showDoughSelector && (
                        <>
                            <ToggleButtonGroup
                                exclusive
                                value={dough}
                                onChange={(e, val) => val && onDoughChange?.(val)}
                                sx={{ backgroundColor: brandGray, borderRadius: "9999px", p: "4px", mb: 1, "& .MuiToggleButtonGroup-grouped": { border: 0, flex: 1, borderRadius: "9999px", mr: "4px", "&:not(:last-of-type)": { borderRight: "none" }, }, }}
                                fullWidth
                            >
                                {["Traditional Dough", "Thin Dough"].map((d) => (
                                    <ToggleButton key={d} value={d} sx={{ textTransform: "none", fontSize: "13px", justifyContent: "center", color: "#666", borderRadius: "9999px", height: 30, "&:hover": { backgroundColor: "transparent" }, "&.Mui-selected": { backgroundColor: "#fff", color: brandRed, boxShadow: "0 2px 4px rgba(0,0,0,0.25)", "&:hover": { backgroundColor: "#fff" }, }, }}>
                                        {optionLabel(d)}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </>
                    )}

                    <ToggleButtonGroup
                        exclusive
                        value={crust}
                        onChange={(e, val) => val && onCrustChange?.(val)}
                        sx={{ backgroundColor: brandGray, borderRadius: "9999px", p: "4px", mb: 1, "& .MuiToggleButtonGroup-grouped": { border: 0, flex: 1, borderRadius: "9999px", mr: "4px", "&:not(:last-of-type)": { borderRight: "none" }, }, }}
                        fullWidth
                    >
                        {["Classic Crust", "Garlic Crust"].map((c) => (
                            <ToggleButton key={c} value={c} sx={{ textTransform: "none", fontSize: "13px", justifyContent: "center", color: "#666", borderRadius: "9999px", height: 30, "&:hover": { backgroundColor: "transparent" }, "&.Mui-selected": { backgroundColor: "#fff", color: brandRed, boxShadow: "0 2px 4px rgba(0,0,0,0.25)", "&:hover": { backgroundColor: "#fff" }, }, }}>
                                {optionLabel(c)}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>

                    {onToggleComponent && (
                        <Box sx={{ mt: 1 }}>
                            <RecipeComponentsLine
                                components={components}
                                removedIds={removedIds}
                                onToggle={onToggleComponent}
                            />
                        </Box>
                    )}

                    {extrasSlot}

                    <TextField
                        label={t("itemCard.addNote")}
                        fullWidth
                        multiline
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription?.(e.target.value)}
                        sx={{mb: 3, mt:2}}
                        InputProps={{sx: {borderRadius: 4}}}
                    />
                </Box>
            )}

            {/* Brick pizzas have no dough/crust box; give them just the components line. */}
            {item.category === "Brick Pizzas" && onToggleComponent && (
                <Box sx={{ mt: 2 }}>
                    <RecipeComponentsLine
                        components={components}
                        removedIds={removedIds}
                        onToggle={onToggleComponent}
                    />
                </Box>
            )}
        </Box>
    );
}
