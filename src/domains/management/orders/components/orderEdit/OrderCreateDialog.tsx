import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useOrderCreate } from "./useOrderCreate";
import { useOrderEditMenu } from "./useOrderEditMenu";
import { OrderCreateDetailsStep } from "./OrderCreateDetailsStep";
import { OrderEditSummary } from "./OrderEditSummary";
import { OrderWorkDialog } from "./OrderWorkDialog";
import type { OrderWorkFooter } from "./OrderWorkDialog";

interface OrderCreateDialogProps {
    /** The branch the order is placed for: the board's selected branch. */
    branchId: string;
    /** Mount only while open, so every opening starts with an empty order. */
    onClose: () => void;
}

/**
 * A new staff order without leaving the board: pick the items in the quick popup, Continue to the
 * customer and payment step, Place order, then 10 seconds of what was ordered. Replaces the trip to
 * /menu?isAdmin=true for the topbar's New Order.
 */
export function OrderCreateDialog({ branchId, onClose }: OrderCreateDialogProps): JSX.Element {
    const { t } = useTranslation("orderEdit");
    const menu = useOrderEditMenu(branchId);
    const order = useOrderCreate(branchId);

    // Items the backend refused as no longer available: fetch the menu again so they show as stopped.
    const reloadMenu = useRef(menu.reload);
    reloadMenu.current = menu.reload;
    useEffect(() => {
        if (order.unavailableNotice > 0) reloadMenu.current();
    }, [order.unavailableNotice]);

    const showingSummary = order.step === "placed" && order.summary !== null;
    let takeover: ReactNode;
    if (showingSummary && order.summary) {
        takeover = <OrderEditSummary variant={order.summaryVariant} summary={order.summary} onClose={onClose} onBack={order.backToOrder} />;
    } else if (order.step === "details" || order.step === "saving") {
        takeover = (
            <OrderCreateDetailsStep
                items={order.items}
                saving={order.step === "saving"}
                error={order.placeError}
                onBack={order.backToItems}
                onPlace={details => { void order.place(details); }}
            />
        );
    }

    const isEmpty = order.items.length === 0;
    // Once placed, the lines edit that order: the footer saves a change, like the edit popup's Complete.
    let footer: OrderWorkFooter;
    if (order.isPlaced) {
        const saving = order.step === "saving";
        footer = {
            label: saving ? t("footer.saving") : isEmpty ? t("footer.emptyOrder") : order.hasChanges ? t("footer.complete") : t("footer.noChanges"),
            disabled: saving || isEmpty || !order.hasChanges,
            onClick: () => { void order.saveChanges(); },
        };
    } else {
        footer = {
            label: isEmpty ? t("create.emptyOrder") : t("create.continue"),
            disabled: isEmpty,
            onClick: order.toDetails,
        };
    }
    let title = t("create.title");
    if (showingSummary) title = t("create.placedTitle");
    else if (order.isPlaced) title = t("create.editTitle");
    const placeError = order.placeError === null ? null : order.isPlaced
        ? t("footer.saveError", { message: order.placeError })
        : t("create.placeError", { message: order.placeError });

    return (
        <OrderWorkDialog
            menu={menu}
            lines={order}
            title={title}
            ariaLabel={t("create.title")}
            footer={footer}
            error={order.step === "items" ? placeError : null}
            busy={order.step === "saving"}
            hasUnsavedWork={order.isPlaced ? !showingSummary && order.hasChanges : !isEmpty}
            discardBody={order.isPlaced ? t("discard.body") : t("create.discardBody")}
            compareWithOriginal={order.isPlaced}
            takeover={takeover}
            onClose={onClose}
        />
    );
}

export default OrderCreateDialog;
