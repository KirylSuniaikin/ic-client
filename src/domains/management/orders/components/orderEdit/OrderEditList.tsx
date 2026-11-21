import { useTranslation } from "react-i18next";
import { Box, Button, IconButton, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { BRAND_RED } from "../../../../../shared/utils/theme";
import type { OrderEditLine, OrderLineStatus } from "./useOrderEdit";
import { describeOrderLine, formatBd, lineTotal } from "./orderLineDisplay";
import { EDIT_COLORS } from "./orderEditColors";

interface OrderEditListProps {
    lines: OrderEditLine[];
    originalTotal: number;
    editedTotal: number;
    onIncrement: (key: string) => void;
    onDecrement: (key: string) => void;
    onRemove: (key: string) => void;
    /** Present for the lines whose popup can reopen them pre-filled; absent hides the action. */
    canChangeOptions: (line: OrderEditLine) => boolean;
    onChangeOptions: (line: OrderEditLine) => void;
    /** Back to the categories: the list's own visible way out on every screen size. */
    onHide: () => void;
}

const STEPPER_SX = {
    width: 44,
    height: 44,
    border: `1px solid ${EDIT_COLORS.hairline}`,
    color: EDIT_COLORS.text,
} as const;

function statusTone(status: OrderLineStatus): { color: string; bg: string } {
    if (status.kind === "removed") return { color: EDIT_COLORS.removedText, bg: EDIT_COLORS.removedBg };
    if (status.kind === "new" || status.kind === "added") return { color: EDIT_COLORS.addedText, bg: EDIT_COLORS.addedBg };
    return { color: "text.secondary", bg: "#fff" };
}

export function OrderEditList({
    lines, originalTotal, editedTotal, onIncrement, onDecrement, onRemove, canChangeOptions, onChangeOptions, onHide,
}: OrderEditListProps): JSX.Element {
    const { t } = useTranslation("orderEdit");

    function statusText(status: OrderLineStatus): string | null {
        if (status.kind === "new") return t("list.new");
        if (status.kind === "added") return t("list.added", { count: status.count });
        if (status.kind === "removed") return t("list.removed", { count: status.count });
        return null;
    }

    return (
        <Box data-testid="order-edit-list" sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, bgcolor: "#fff" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.5, borderBottom: `1px solid ${EDIT_COLORS.hairline}` }}>
                <IconButton aria-label={t("list.back")} onClick={onHide} sx={{ width: 44, height: 44, color: BRAND_RED }}>
                    {/* Points the reading direction's way back: right in Arabic. */}
                    <ArrowBackRoundedIcon sx={{ "[dir=rtl] &": { transform: "scaleX(-1)" } }} />
                </IconButton>
                <Typography sx={{ fontWeight: 700, color: EDIT_COLORS.text, flex: 1 }}>{t("list.title")}</Typography>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {lines.length === 0 && (
                    <Typography sx={{ p: 2, color: "text.secondary" }}>{t("list.empty")}</Typography>
                )}
                {lines.map(line => {
                    const { title, details } = describeOrderLine(line.item);
                    const tone = statusTone(line.status);
                    const change = statusText(line.status);
                    const price = t("list.price", { amount: formatBd(lineTotal(line.item)) });
                    return (
                        <Box
                            key={line.key}
                            data-testid="order-edit-line"
                            sx={{ px: 2, py: 1.25, bgcolor: tone.bg, borderBottom: `1px solid ${EDIT_COLORS.hairline}` }}
                        >
                            <Typography sx={{ fontWeight: 700, color: EDIT_COLORS.text }}>
                                {line.item.quantity} × {title}
                            </Typography>
                            {details.map((detail, i) => (
                                <Typography key={i} variant="body2" sx={{ color: "text.secondary" }}>{detail}</Typography>
                            ))}
                            <Typography variant="body2" data-testid="order-edit-line-note" sx={{ color: tone.color, fontWeight: change ? 700 : 400 }}>
                                {change ? `${change} · ${price}` : price}
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, flexWrap: "wrap" }}>
                                <IconButton aria-label={t("list.decrease", { name: line.item.name })} onClick={() => onDecrement(line.key)} sx={STEPPER_SX}>
                                    <RemoveRoundedIcon />
                                </IconButton>
                                <IconButton aria-label={t("list.increase", { name: line.item.name })} onClick={() => onIncrement(line.key)} sx={STEPPER_SX}>
                                    <AddRoundedIcon />
                                </IconButton>
                                <IconButton
                                    aria-label={t("list.removeLine", { name: line.item.name })}
                                    onClick={() => onRemove(line.key)}
                                    sx={{ ...STEPPER_SX, color: EDIT_COLORS.removedText }}
                                >
                                    <DeleteOutlineRoundedIcon />
                                </IconButton>
                                {canChangeOptions(line) && (
                                    <Button
                                        startIcon={<TuneRoundedIcon />}
                                        onClick={() => onChangeOptions(line)}
                                        sx={{ minHeight: 44, color: BRAND_RED, textTransform: "none", fontWeight: 700 }}
                                    >
                                        {t("list.changeOptions")}
                                    </Button>
                                )}
                            </Box>
                        </Box>
                    );
                })}
            </Box>

            <Box sx={{ px: 2, py: 1.5, borderTop: `1px solid ${EDIT_COLORS.hairline}`, display: "flex", justifyContent: "space-between", gap: 2 }}>
                <Typography sx={{ color: "text.secondary" }}>{t("list.was", { amount: formatBd(originalTotal) })}</Typography>
                <Typography sx={{ fontWeight: 700, color: EDIT_COLORS.text }}>{t("list.now", { amount: formatBd(editedTotal) })}</Typography>
            </Box>
        </Box>
    );
}
