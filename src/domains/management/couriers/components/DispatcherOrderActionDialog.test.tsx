import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DispatcherOrderActionDialog } from "./DispatcherOrderActionDialog";
import type { DispatcherOrderAction } from "./DispatcherOrderActionDialog";
import type { CourierOrderSummary } from "../types";

/**
 * The two destructive dispatcher actions (manual §02 "Release an order", DELIVERY_SPEC.md §4).
 *
 * Release is the answer to the phone call that replaced the decline button — there is no refusal
 * in the courier app, so a rider who genuinely cannot take a job calls the manager and the manager
 * takes it back off them. Cancel is the other one, and its copy carries the fact that decides
 * whether a manager should press it at all: **no money goes back automatically**.
 *
 * The dialog had no test of its own. `CourierDispatcherPanel.test.tsx` exercised the confirm
 * labels and the refund sentence through it, but never the release copy, the dismiss path, or the
 * titles.
 */

const ORDER: CourierOrderSummary = {
    orderId: 43, orderNo: 4821, status: "Out for delivery", deliveredAt: null,
    waitTimeMinutes: 5, travelTimeMinutes: 12,
    geofenceWarning: null, geofenceDistanceM: null, geofenceOverridden: null,
};

function renderDialog(
    action: DispatcherOrderAction | null,
    order: CourierOrderSummary | null = ORDER,
    courierName = "Ali"
) {
    const onConfirm = jest.fn<void, []>();
    const onClose = jest.fn<void, []>();
    render(
        <DispatcherOrderActionDialog
            action={action} order={order} courierName={courierName}
            onConfirm={onConfirm} onClose={onClose}
        />
    );
    return { onConfirm, onClose };
}

describe("DispatcherOrderActionDialog — release", () => {
    it("names the order and the rider it is coming off", () => {
        renderDialog("release");

        expect(screen.getByText("Release order #4821")).toBeTruthy();
        expect(screen.getByText(/takes order #4821 off Ali/)).toBeTruthy();
    });

    /**
     * The consequence a manager has to know before pressing: a released order does NOT go back
     * round the automatic loop, it lands on the waiting list for them to assign by hand. A manager
     * who expected the engine to pick it up would walk away from an order nobody is carrying.
     */
    it("says out loud that nothing picks the order up automatically", () => {
        renderDialog("release");

        expect(screen.getByText(/not offered to anyone automatically/)).toBeTruthy();
        expect(screen.getByText(/back to the waiting list/)).toBeTruthy();
    });

    it("does not carry the cancel action's refund warning", () => {
        renderDialog("release");

        expect(screen.queryByText(/No money is returned/)).toBeNull();
    });

    it("confirms the release", () => {
        const { onConfirm } = renderDialog("release");

        fireEvent.click(screen.getByRole("button", { name: "Release order" }));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});

describe("DispatcherOrderActionDialog — cancel", () => {
    it("names the order it is stopping", () => {
        renderDialog("cancel");

        expect(screen.getByText("Cancel order #4821")).toBeTruthy();
    });

    /**
     * There is no refund code anywhere in this system (`DispatcherService.cancel` says so in as
     * many words). A manager reading a bare "Cancel this order?" would reasonably assume the
     * customer is paid back — they are not, and somebody has to do it by hand in the EazyPay
     * console. This sentence is the only place that is ever said.
     */
    it("warns in plain words that the refund is a manual job, not an automatic one", () => {
        renderDialog("cancel");

        expect(screen.getByText(/No money is returned to the customer/)).toBeTruthy();
        expect(screen.getByText(/EazyPay console/)).toBeTruthy();
    });

    it("promises the order itself is kept, not deleted", () => {
        renderDialog("cancel");

        expect(screen.getByText(/nothing is deleted/i)).toBeTruthy();
    });

    it("confirms the cancel", () => {
        const { onConfirm } = renderDialog("cancel");

        fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});

describe("DispatcherOrderActionDialog — the way out", () => {
    /** "Keep it" rather than "Cancel", because "Cancel" is one of the two actions on offer here. */
    it("lets the manager back out without firing either action", () => {
        const { onConfirm, onClose } = renderDialog("cancel");

        fireEvent.click(screen.getByRole("button", { name: "Keep it" }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it("stays shut while no action has been chosen", () => {
        renderDialog(null);

        expect(screen.queryByRole("button", { name: "Keep it" })).toBeNull();
    });

    it("stays shut when there is no order to act on", () => {
        renderDialog("release", null);

        expect(screen.queryByRole("button", { name: "Release order" })).toBeNull();
    });

    it("falls back to the internal id when the order has no customer-facing number", () => {
        renderDialog("release", { ...ORDER, orderNo: null });

        expect(screen.getByText("Release order #43")).toBeTruthy();
    });
});
