import { useTranslation } from "react-i18next";
import { NO_CUSTOMER_PHONE } from "../../../../order/types";
import type { Order } from "../../../../order/types";
import { useOrderEdit } from "./useOrderEdit";
import { useOrderEditMenu } from "./useOrderEditMenu";
import { OrderEditSummary } from "./OrderEditSummary";
import { OrderWorkDialog } from "./OrderWorkDialog";

interface OrderEditDialogProps {
    order: Order;
    /** Closes the editor. Mount the dialog only while it is open, so every opening starts fresh. */
    onClose: () => void;
}

function customerLine(order: Order): string {
    const phone = order.phone_number && order.phone_number !== NO_CUSTOMER_PHONE ? order.phone_number : "";
    return [order.customer_name, phone, order.order_type].filter(Boolean).join(" · ");
}

/** Edits an order in place over the order board, then shows what changed for 10 seconds. */
export function OrderEditDialog({ order, onClose }: OrderEditDialogProps): JSX.Element {
    const { t } = useTranslation("orderEdit");
    const menu = useOrderEditMenu(order.branch_id);
    const edit = useOrderEdit(order);

    const saved = edit.phase === "saved" && edit.summary !== null;
    const footerLabel = edit.phase === "saving"
        ? t("footer.saving")
        : edit.completeBlocker === "emptyOrder"
            ? t("footer.emptyOrder")
            : edit.completeBlocker === "noChanges" ? t("footer.noChanges") : t("footer.complete");

    return (
        <OrderWorkDialog
            menu={menu}
            lines={edit}
            title={t(saved ? "header.savedTitle" : "header.title", { orderNo: order.order_no })}
            ariaLabel={t("header.title", { orderNo: order.order_no })}
            subtitle={customerLine(order)}
            footer={{
                label: footerLabel,
                disabled: edit.completeBlocker !== null || edit.phase === "saving",
                onClick: () => { void edit.complete(); },
            }}
            error={edit.saveError === null ? null : t("footer.saveError", { message: edit.saveError })}
            busy={edit.phase === "saving"}
            hasUnsavedWork={edit.phase === "editing" && edit.hasChanges}
            discardBody={t("discard.body")}
            compareWithOriginal
            takeover={saved && edit.summary ? <OrderEditSummary summary={edit.summary} onClose={onClose} onBack={edit.continueEditing} /> : undefined}
            onClose={onClose}
        />
    );
}

export default OrderEditDialog;
