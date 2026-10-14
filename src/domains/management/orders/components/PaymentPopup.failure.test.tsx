import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Order } from "../../../order/types";

type SentPayload = { idempotency_key?: string; amount: number; type: string };

// Factory mock, same pattern as PaymentPopup.idempotency.test.tsx.
const mockSendOrderPayment = jest.fn<Promise<unknown>, [SentPayload]>();
jest.mock("../../../../shared/api/public", () => ({
    sendOrderPayment: (payload: SentPayload) => mockSendOrderPayment(payload),
}));

import PaymentPopup from "./PaymentPopup";

// Only the fields PaymentPopup reads; the cast is confined to this fixture.
const order = { id: "o-1", amount_paid: 10, branch_id: "2" } as unknown as Order;

const onClose = jest.fn();
const onPaymentSuccess = jest.fn();

function ui(open: boolean): JSX.Element {
    return <PaymentPopup open={open} onClose={onClose} order={order} onPaymentSuccess={onPaymentSuccess} />;
}

function keys(): (string | undefined)[] {
    return mockSendOrderPayment.mock.calls.map(([p]) => p.idempotency_key);
}

function confirmButton(): HTMLButtonElement {
    const button = screen.getByText("Confirm Payment").closest("button");
    if (!button) throw new Error("Confirm button not found");
    return button;
}

async function clickConfirm(): Promise<void> {
    fireEvent.click(screen.getByText("Confirm Payment"));
}

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockSendOrderPayment.mockReset();
    onClose.mockReset();
    onPaymentSuccess.mockReset();
});

describe("PaymentPopup failure handling", () => {
    it("keeps the popup open and shows the error after a failed single payment", async () => {
        mockSendOrderPayment.mockRejectedValueOnce(new Error("boom"));
        render(ui(true));

        fireEvent.click(screen.getByText("Card"));
        await clickConfirm();

        const error = await screen.findByTestId("payment-popup-error");
        expect(error.textContent).toContain("Payment could not be recorded");
        expect(onClose).not.toHaveBeenCalled();
        expect(onPaymentSuccess).not.toHaveBeenCalled();
        await waitFor(() => expect(confirmButton().disabled).toBe(false));
    });

    it("reuses the key on re-submit and then succeeds", async () => {
        mockSendOrderPayment.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
        render(ui(true));

        fireEvent.click(screen.getByText("Card"));
        await clickConfirm();
        await screen.findByTestId("payment-popup-error");
        await waitFor(() => expect(confirmButton().disabled).toBe(false));
        await clickConfirm();

        await waitFor(() => expect(onPaymentSuccess).toHaveBeenCalledTimes(1));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(keys()[0]).toBeTruthy();
        expect(keys()[1]).toBe(keys()[0]);
    });

    it("mints a new key when the type changes before re-submit", async () => {
        mockSendOrderPayment.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
        render(ui(true));

        fireEvent.click(screen.getByText("Card"));
        await clickConfirm();
        await screen.findByTestId("payment-popup-error");
        await waitFor(() => expect(confirmButton().disabled).toBe(false));
        fireEvent.click(screen.getByText("Benefit"));
        await clickConfirm();

        await waitFor(() => expect(mockSendOrderPayment).toHaveBeenCalledTimes(2));
        expect(keys()[1]).not.toBe(keys()[0]);
    });

    it("mints fresh keys after the drawer is closed and reopened", async () => {
        mockSendOrderPayment.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
        const { rerender } = render(ui(true));

        fireEvent.click(screen.getByText("Card"));
        await clickConfirm();
        await screen.findByTestId("payment-popup-error");

        rerender(ui(false));
        rerender(ui(true));
        fireEvent.click(screen.getByText("Card"));
        await clickConfirm();

        await waitFor(() => expect(mockSendOrderPayment).toHaveBeenCalledTimes(2));
        expect(keys()[1]).not.toBe(keys()[0]);
    });
});
