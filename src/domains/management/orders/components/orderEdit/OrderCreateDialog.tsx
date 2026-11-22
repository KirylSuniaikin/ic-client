import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useOrderCreate } from "./useOrderCreate";
import { useOrderEditMenu } from "./useOrderEditMenu";
import { OrderCreateDetailsStep } from "./OrderCreateDetailsStep";
import { OrderEditSummary } from "./OrderEditSummary";
import { OrderWorkDialog } from "./OrderWorkDialog";

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

    const placed = order.step === "placed" && order.summary !== null;
    let takeover: ReactNode;
    if (placed && order.summary) {
        takeover = <OrderEditSummary variant="create" summary={order.summary} onClose={onClose} />;
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

    return (
        <OrderWorkDialog
            menu={menu}
            lines={order}
            title={t(placed ? "create.placedTitle" : "create.title")}
            ariaLabel={t("create.title")}
            footer={{
                label: isEmpty ? t("create.emptyOrder") : t("create.continue"),
                disabled: isEmpty,
                onClick: order.toDetails,
            }}
            error={order.step === "items" && order.placeError !== null ? t("create.placeError", { message: order.placeError }) : null}
            busy={order.step === "saving"}
            hasUnsavedWork={!placed && !isEmpty}
            discardBody={t("create.discardBody")}
            compareWithOriginal={false}
            takeover={takeover}
            onClose={onClose}
        />
    );
}

export default OrderCreateDialog;
