import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
    Alert, Badge, Box, Button, CircularProgress, Dialog, Drawer, IconButton, Typography, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import ResponsiveSheet from "../../../_shared/components/ResponsiveSheet";
import { BRAND_RED } from "../../../../../shared/utils/theme";
import { NO_CUSTOMER_PHONE } from "../../../../order/types";
import type { Order } from "../../../../order/types";
import type { CartItem, Group } from "../../../../menu/types";
import { useOrderEdit } from "./useOrderEdit";
import type { OrderEditLine } from "./useOrderEdit";
import { useOrderEditMenu } from "./useOrderEditMenu";
import { buildEditCategories, cheapestAvailable, lineEditKind, menuItemToCartItem, popupKindFor } from "./orderEditMenu";
import { OrderEditCategories } from "./OrderEditCategories";
import { OrderEditList } from "./OrderEditList";
import { OrderEditSummary } from "./OrderEditSummary";
import { OrderEditItemPopups } from "./OrderEditItemPopups";
import type { ComboChoices, ItemPopupRequest } from "./OrderEditItemPopups";
import { EDIT_COLORS } from "./orderEditColors";

interface OrderEditDialogProps {
    order: Order;
    /** Closes the editor. Mount the dialog only while it is open, so every opening starts fresh. */
    onClose: () => void;
}

interface OpenPopup {
    request: ItemPopupRequest;
    /** The line the popup was opened for: Save replaces it. Null when the popup adds a new line. */
    lineKey: string | null;
}

function groupsOf(categories: ReturnType<typeof buildEditCategories>, name: string): Group[] {
    return categories.find(category => category.name === name)?.groups ?? [];
}

function customerLine(order: Order): string {
    const phone = order.phone_number && order.phone_number !== NO_CUSTOMER_PHONE ? order.phone_number : "";
    return [order.customer_name, phone, order.order_type].filter(Boolean).join(" · ");
}

/**
 * Edits an order in place over the order board: a centred dialog from `md` up, a 92% bottom
 * drawer on a phone, the same content in both. Spec: ORDER_EDIT_POPUP_SPEC.md.
 */
export function OrderEditDialog({ order, onClose }: OrderEditDialogProps): JSX.Element {
    const { t } = useTranslation("orderEdit");
    const theme = useTheme();
    const isWide = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });
    const menu = useOrderEditMenu(order.branch_id);
    const edit = useOrderEdit(order);
    const [listOpen, setListOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [popup, setPopup] = useState<OpenPopup | null>(null);
    const [popupSeq, setPopupSeq] = useState(0);

    const categories = useMemo(() => buildEditCategories(menu.menu), [menu.menu]);
    const choices = useMemo<ComboChoices>(() => ({
        pizzas: groupsOf(categories, "Pizzas"),
        bricks: groupsOf(categories, "Brick Pizzas"),
        drinks: groupsOf(categories, "Beverages"),
        sauces: groupsOf(categories, "Sauces"),
    }), [categories]);
    // The combo popups pick their defaults from these lists and cannot open without them.
    const pizzaComboReady = choices.pizzas.length > 0 && choices.drinks.length > 0 && choices.sauces.length > 0;
    const detroitComboReady = choices.bricks.length > 0 && choices.drinks.length > 0 && choices.sauces.length > 0;

    function openPopup(request: ItemPopupRequest, lineKey: string | null): void {
        // A fresh key per opening: the combo popups seed their state once, on mount.
        setPopupSeq(n => n + 1);
        setPopup({ request, lineKey });
    }

    function addWithOneTap(group: Group): void {
        const item = cheapestAvailable(group);
        if (item) edit.addItems([menuItemToCartItem(item)]);
    }

    function handleAdd(group: Group): void {
        const kind = popupKindFor(group);
        if (kind === "pizza") openPopup({ kind, group, editItem: null }, null);
        else if (kind === "baguette") openPopup({ kind, menuItem: cheapestAvailable(group) ?? group.items[0] }, null);
        else if (kind === "generic") openPopup({ kind, group }, null);
        else if (kind === "pizzaCombo" && pizzaComboReady) openPopup({ kind, comboGroup: group.items, editItem: null }, null);
        else if (kind === "detroitCombo" && detroitComboReady) openPopup({ kind, combo: group.items, editItem: null }, null);
        else addWithOneTap(group);
    }

    function changeOptionsRequest(item: CartItem): ItemPopupRequest | null {
        const kind = lineEditKind(item);
        if (kind === "pizza") {
            const group = choices.pizzas.find(g => g.name === item.name);
            return group ? { kind, group, editItem: item } : null;
        }
        const comboItems = menu.menu.filter(m => m.name === item.name && m.category === "Combo Deals");
        if (comboItems.length === 0) return null;
        if (kind === "pizzaCombo" && pizzaComboReady) return { kind, comboGroup: comboItems, editItem: item };
        if (kind === "detroitCombo" && detroitComboReady) return { kind, combo: comboItems, editItem: item };
        return null;
    }

    function handlePopupAdd(items: CartItem[]): void {
        if (popup?.lineKey) edit.replaceLine(popup.lineKey, items);
        else edit.addItems(items);
    }

    function requestClose(): void {
        if (edit.phase === "saving") return;
        if (edit.phase === "editing" && edit.hasChanges) {
            setConfirmOpen(true);
            return;
        }
        onClose();
    }

    const saved = edit.phase === "saved" && edit.summary !== null;

    const header = (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: 2, pt: 2, pb: 1.5, borderBottom: `1px solid ${EDIT_COLORS.hairline}` }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography component="h2" sx={{ fontSize: "1.2rem", fontWeight: 800, color: EDIT_COLORS.text }}>
                    {t(saved ? "header.savedTitle" : "header.title", { orderNo: order.order_no })}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>{customerLine(order)}</Typography>
            </Box>
            <IconButton aria-label={t("header.close")} onClick={requestClose} sx={{ width: 44, height: 44, color: BRAND_RED }}>
                <CloseRoundedIcon />
            </IconButton>
        </Box>
    );

    const listProps = {
        lines: edit.lines,
        originalTotal: edit.originalTotal,
        editedTotal: edit.editedTotal,
        onIncrement: edit.increment,
        onDecrement: edit.decrement,
        onRemove: edit.removeLine,
        canChangeOptions: (line: OrderEditLine): boolean => changeOptionsRequest(line.item) !== null,
        onChangeOptions: (line: OrderEditLine): void => {
            const request = changeOptionsRequest(line.item);
            if (request) openPopup(request, line.key);
        },
    };

    let categoriesBody: ReactNode;
    if (menu.loading) {
        categoriesBody = (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2, color: "text.secondary" }}>
                <CircularProgress size={20} sx={{ color: BRAND_RED }} />
                <Typography>{t("menu.loading")}</Typography>
            </Box>
        );
    } else if (menu.error !== null) {
        categoriesBody = (
            <Alert
                severity="error"
                action={<Button color="inherit" onClick={menu.reload}>{t("menu.retry")}</Button>}
            >
                {t("menu.loadError", { message: menu.error })}
            </Alert>
        );
    } else {
        categoriesBody = <OrderEditCategories categories={categories} lines={edit.lines} onAdd={handleAdd} />;
    }

    const completeLabel = edit.phase === "saving"
        ? t("footer.saving")
        : edit.completeBlocker === "emptyOrder"
            ? t("footer.emptyOrder")
            : edit.completeBlocker === "noChanges" ? t("footer.noChanges") : t("footer.complete");

    const editingBody = (
        <>
            <Box sx={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
                <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto", p: 2, bgcolor: "#fffcf8" }}>{categoriesBody}</Box>
                {listOpen && isWide && (
                    <Box sx={{ width: 340, flexShrink: 0, borderInlineStart: `1px solid ${EDIT_COLORS.hairline}` }}>
                        <OrderEditList {...listProps} onHide={() => setListOpen(false)} />
                    </Box>
                )}
                {listOpen && !isWide && (
                    <Box sx={{ position: "absolute", inset: 0, zIndex: 2 }}>
                        <OrderEditList {...listProps} onHide={() => setListOpen(false)} />
                    </Box>
                )}
            </Box>
            {edit.saveError !== null && (
                <Alert severity="error" sx={{ mx: 2, mt: 1.5 }}>{t("footer.saveError", { message: edit.saveError })}</Alert>
            )}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2, borderTop: `1px solid ${EDIT_COLORS.hairline}` }}>
                <Button
                    variant="contained"
                    disableElevation
                    disabled={edit.completeBlocker !== null || edit.phase === "saving"}
                    onClick={() => { void edit.complete(); }}
                    sx={{
                        flex: 1,
                        minHeight: 52,
                        borderRadius: 999,
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: 17,
                        bgcolor: BRAND_RED,
                        "&:hover": { bgcolor: BRAND_RED, filter: "brightness(0.94)" },
                        "&.Mui-disabled": { bgcolor: EDIT_COLORS.disabledCta, color: "text.secondary" },
                    }}
                >
                    {completeLabel}
                </Button>
                <IconButton
                    aria-label={t("footer.orderList")}
                    aria-pressed={listOpen}
                    onClick={() => setListOpen(open => !open)}
                    sx={{
                        width: 52,
                        height: 52,
                        border: `1px solid ${EDIT_COLORS.hairline}`,
                        bgcolor: listOpen ? EDIT_COLORS.openHeader : "#fff",
                        color: BRAND_RED,
                    }}
                >
                    <Badge badgeContent={edit.totalQuantity} color="primary" max={999} data-testid="order-edit-cart-badge">
                        <ShoppingCartRoundedIcon />
                    </Badge>
                </IconButton>
            </Box>
        </>
    );

    const content = (
        <Box data-testid="order-edit-dialog" sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            {header}
            {saved && edit.summary
                ? <OrderEditSummary summary={edit.summary} onClose={onClose} />
                : editingBody}
        </Box>
    );

    return (
        <>
            {isWide ? (
                <Dialog
                    open
                    onClose={requestClose}
                    maxWidth={false}
                    aria-label={t("header.title", { orderNo: order.order_no })}
                    slotProps={{
                        paper: {
                            elevation: 0,
                            sx: {
                                width: 820,
                                maxWidth: "calc(100% - 32px)",
                                height: 700,
                                maxHeight: "calc(100% - 32px)",
                                borderRadius: "20px",
                                overflow: "hidden",
                                boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
                            },
                        },
                    }}
                >
                    {content}
                </Dialog>
            ) : (
                <Drawer
                    anchor="bottom"
                    open
                    onClose={requestClose}
                    PaperProps={{
                        sx: {
                            height: "92%",
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            overflow: "hidden",
                            backgroundImage: "none",
                        },
                    }}
                >
                    <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mt: 1 }} />
                    {content}
                </Drawer>
            )}

            {popup && (
                <OrderEditItemPopups
                    key={popupSeq}
                    request={popup.request}
                    choices={choices}
                    extraIngredients={menu.extraIngredients}
                    toppings={menu.toppings}
                    isSDoughAvailable={menu.isSDoughAvailable}
                    onAdd={handlePopupAdd}
                    onClose={() => setPopup(null)}
                />
            )}

            <ResponsiveSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t("discard.title")} testId="order-edit-discard">
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 2.5 }}>{t("discard.body")}</Typography>
                <Box sx={{ display: "flex", gap: 1.5 }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => setConfirmOpen(false)}
                        sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700, color: BRAND_RED, borderColor: BRAND_RED, minHeight: 44 }}
                    >
                        {t("discard.keep")}
                    </Button>
                    <Button
                        fullWidth
                        variant="contained"
                        disableElevation
                        onClick={onClose}
                        sx={{ borderRadius: 999, textTransform: "none", fontWeight: 700, bgcolor: BRAND_RED, minHeight: 44, "&:hover": { bgcolor: BRAND_RED } }}
                    >
                        {t("discard.confirm")}
                    </Button>
                </Box>
            </ResponsiveSheet>
        </>
    );
}

export default OrderEditDialog;
