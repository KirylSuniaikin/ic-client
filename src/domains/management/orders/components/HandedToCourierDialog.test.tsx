import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandedToCourierDialog } from "./HandedToCourierDialog";
import type { Order } from "../../../order/types";

/**
 * The kitchen's hand-over confirm (manual §02 "Handed to courier").
 *
 * This is the tap the whole change was made to protect. It is one-way from the kitchen board: the
 * card leaves the screen, the order moves to Out for delivery, and the customer is told their food
 * is on the way. The defect being fixed was an accidental tap doing exactly that from the courier
 * app — so moving the button to the kitchen tablet without a confirm would only have reproduced
 * the accident on a new screen.
 *
 * The dialog had no test. `OrderCard.test.tsx` clicked through it by text to reach the API call,
 * which meant its copy, its order number and its Cancel path were asserted nowhere.
 */

// Only `order_no` is read here; the rest of Order is irrelevant to this dialog.
const ORDER = { order_no: 4821 } as unknown as Order;

function renderDialog(open = true, order: Order = ORDER) {
    const onConfirm = jest.fn<void, []>();
    const onCancel = jest.fn<void, []>();
    render(<HandedToCourierDialog open={open} order={order} onConfirm={onConfirm} onCancel={onCancel} />);
    return { onConfirm, onCancel };
}

describe("HandedToCourierDialog", () => {
    /**
     * The number is what makes the confirm meaningful. A kitchen has several delivery cards up at
     * once, and "are you sure?" against no particular order is a prompt staff learn to dismiss.
     */
    it("names the order being handed over", () => {
        renderDialog();

        expect(screen.getByText(/order #4821/)).toBeTruthy();
    });

    /**
     * Both consequences are stated because both are irreversible from this screen: the card goes,
     * and the customer is told. Staff who only knew about the first would treat a misfire as a
     * screen glitch rather than as a message already sent.
     */
    it("spells out that the card leaves and the customer is told", () => {
        renderDialog();

        expect(screen.getByText(/leaves this\s+board/)).toBeTruthy();
        expect(screen.getByText(/customer is told it is on the way/)).toBeTruthy();
    });

    it("hands over only once the kitchen confirms", () => {
        const { onConfirm, onCancel } = renderDialog();

        fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onCancel).not.toHaveBeenCalled();
    });

    /** The accidental-tap escape. Without it the confirm would be a speed bump, not a guard. */
    it("lets a mistaken tap back out without handing anything over", () => {
        const { onConfirm, onCancel } = renderDialog();

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it("renders nothing while it is closed", () => {
        renderDialog(false);

        expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
    });
});
