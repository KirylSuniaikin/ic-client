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
 * customer and payment step, then a 10-second review that places the order when approved (or left
 * alone) and goes back to the details when not. Replaces the trip to /menu?isAdmin=true for the
 * topbar's New Order.
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

    const reviewing = (order.step === "review" || order.step === "saving") && order.summary !== null;
    let takeover: ReactNode;
    if (reviewing && order.summary) {
        takeover = (
            <OrderEditSummary
                variant="create"
                summary={order.summary}
                approving={order.step === "saving"}
                onApprove={() => { void order.approve().then(placed => { if (placed) onClose(); }); }}
                onBack={order.backToDetails}
            />
        );
    } else if (order.step === "details") {
        takeover = (
            <OrderCreateDetailsStep
                items={order.items}
                initialDetails={order.details}
                error={order.placeError}
                onBack={order.backToItems}
                onReview={order.review}
            />
        );
    }

    const isEmpty = order.items.length === 0;
    const footer: OrderWorkFooter = {
        label: isEmpty ? t("create.emptyOrder") : t("create.continue"),
        disabled: isEmpty,
        onClick: order.toDetails,
    };
    const placeError = order.placeError === null ? null : t("create.placeError", { message: order.placeError });

    return (
        <OrderWorkDialog
            menu={menu}
            lines={order}
            title={reviewing ? t("create.reviewTitle") : t("create.title")}
            ariaLabel={t("create.title")}
            footer={footer}
            error={order.step === "items" ? placeError : null}
            busy={order.step === "saving"}
            hasUnsavedWork={!isEmpty}
            discardBody={t("create.discardBody")}
            compareWithOriginal={false}
            takeover={takeover}
            onClose={onClose}
        />
    );
}

export default OrderCreateDialog;
