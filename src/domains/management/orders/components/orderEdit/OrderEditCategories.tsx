import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, ButtonBase, Collapse, IconButton, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import type { Group } from "../../../../menu/types";
import { BRAND_RED } from "../../../../../shared/utils/theme";
import type { EditCategory } from "./orderEditMenu";
import { cheapestAvailable, isGroupAvailable } from "./orderEditMenu";
import type { OrderEditLine } from "./useOrderEdit";
import { formatBd } from "./orderLineDisplay";
import { EDIT_COLORS } from "./orderEditColors";

interface OrderEditCategoriesProps {
    categories: EditCategory[];
    lines: OrderEditLine[];
    onAdd: (group: Group) => void;
}

function quantityIn(lines: OrderEditLine[], matches: (line: OrderEditLine) => boolean): number {
    return lines.filter(matches).reduce((sum, line) => sum + line.item.quantity, 0);
}

/** Several sizes quote "from" their cheapest available one. */
function priceOf(group: Group): { amount: string; fromPrice: boolean } {
    const cheapest = cheapestAvailable(group) ?? group.items[0];
    return { amount: formatBd(cheapest.price), fromPrice: new Set(group.items.map(item => item.size)).size > 1 };
}

/**
 * Every menu category, collapsed. Item rows never load a photo: the editor is text-only so staff
 * never wait for an image.
 */
export function OrderEditCategories({ categories, lines, onAdd }: OrderEditCategoriesProps): JSX.Element {
    const { t } = useTranslation("orderEdit");
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

    function toggle(name: string): void {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {categories.map(category => {
                const open = expanded.has(category.name);
                const inOrder = quantityIn(lines, line => line.item.category === category.name);
                const panelId = `order-edit-category-${category.name.replace(/\s+/g, "-")}`;
                return (
                    <Box
                        key={category.name}
                        sx={{ border: `1px solid ${EDIT_COLORS.hairline}`, borderRadius: 3, overflow: "hidden", bgcolor: "#fff" }}
                    >
                        <ButtonBase
                            onClick={() => toggle(category.name)}
                            aria-expanded={open}
                            aria-controls={panelId}
                            sx={{
                                width: "100%",
                                minHeight: 56,
                                px: 2,
                                gap: 1.5,
                                justifyContent: "flex-start",
                                bgcolor: open ? EDIT_COLORS.openHeader : "#fff",
                            }}
                        >
                            <Typography sx={{ fontWeight: 700, color: EDIT_COLORS.text, flex: 1, textAlign: "start" }}>
                                {category.name}
                            </Typography>
                            {inOrder > 0 && (
                                <Box
                                    component="span"
                                    data-testid="category-in-order"
                                    sx={{
                                        px: 1.25,
                                        py: 0.25,
                                        borderRadius: 999,
                                        bgcolor: EDIT_COLORS.badgeBg,
                                        color: EDIT_COLORS.badgeText,
                                        fontSize: 13,
                                        fontWeight: 700,
                                    }}
                                >
                                    {t("menu.inOrder", { count: inOrder })}
                                </Box>
                            )}
                            <ExpandMoreRoundedIcon
                                sx={{ color: "text.secondary", transition: "transform 150ms", transform: open ? "rotate(180deg)" : "none" }}
                            />
                        </ButtonBase>
                        <Collapse in={open} unmountOnExit>
                            <Box id={panelId} role="list" sx={{ borderTop: `1px solid ${EDIT_COLORS.hairline}` }}>
                                {category.groups.map(group => {
                                    const available = isGroupAvailable(group);
                                    const price = priceOf(group);
                                    const quantity = quantityIn(lines, line =>
                                        line.item.category === category.name && line.item.name === group.name);
                                    return (
                                        <Box
                                            key={group.name}
                                            role="listitem"
                                            data-testid={`menu-item-${group.name}`}
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1.5,
                                                px: 2,
                                                py: 0.75,
                                                minHeight: 56,
                                                opacity: available ? 1 : 0.5,
                                                "& + &": { borderTop: `1px solid ${EDIT_COLORS.hairline}` },
                                            }}
                                        >
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography sx={{ fontWeight: 600, color: EDIT_COLORS.text }}>{group.name}</Typography>
                                                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                                    {available ? t(price.fromPrice ? "menu.fromPrice" : "menu.price", { amount: price.amount }) : t("menu.unavailable")}
                                                </Typography>
                                            </Box>
                                            {quantity > 0 && (
                                                <Typography sx={{ fontWeight: 700, color: EDIT_COLORS.text }}>
                                                    {t("menu.inOrderQuantity", { count: quantity })}
                                                </Typography>
                                            )}
                                            {available && (
                                                <IconButton
                                                    aria-label={t("menu.add", { name: group.name })}
                                                    onClick={() => onAdd(group)}
                                                    sx={{
                                                        width: 44,
                                                        height: 44,
                                                        bgcolor: BRAND_RED,
                                                        color: "#fff",
                                                        "&:hover": { bgcolor: BRAND_RED, filter: "brightness(0.94)" },
                                                    }}
                                                >
                                                    <AddRoundedIcon />
                                                </IconButton>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Collapse>
                    </Box>
                );
            })}
        </Box>
    );
}
