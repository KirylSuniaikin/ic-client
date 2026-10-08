import { jest, describe, it, expect, beforeEach, beforeAll, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { Order } from "../../../order/types";

// Split-mode failure cases live apart from PaymentPopup.failure.test.tsx: jsdom/nwsapi crashes
// in MUI's Modal manager after several drawer mounts in one file.
type SentPayload = { idempotency_key?: string; amount: number; type: string };

const mockSendOrderPayment = jest.fn<Promise<unknown>, [SentPayload]>();
jest.mock("../../../../shared/api/public", () => ({
    sendOrderPayment: (payload: SentPayload) => mockSendOrderPayment(payload),
}));

import PaymentPopup from "./PaymentPopup";

// Only the fields PaymentPopup reads; the cast is confined to this fixture.
const order = { id: "o-1", amount_paid: 10, branch_id: "2" } as unknown as Order;

const onClose = jest.fn();
const onPaymentSuccess = jest.fn();

function keys(): (string | undefined)[] {
    return mockSendOrderPayment.mock.calls.map(([p]) => p.idempotency_key);
}

function amounts(): number[] {
    return mockSendOrderPayment.mock.calls.map(([p]) => p.amount);
}

function confirmButton(): HTMLButtonElement {
    const button = screen.getByText("Confirm Payment").closest("button");
    if (!button) throw new Error("Confirm button not found");
    return button;
}

function clickConfirm(): void {
    fireEvent.click(screen.getByText("Confirm Payment"));
}

function setupSplit(): void {
    fireEvent.click(screen.getByText("Split"));
    fireEvent.click(screen.getByText("+ Add Payer"));
    const inputs = screen.getAllByPlaceholderText("0.00");
    fireEvent.change(inputs[0], { target: { value: "4" } });
    fireEvent.change(inputs[1], { target: { value: "6" } });
}

function renderPopup(): void {
    render(<PaymentPopup open onClose={onClose} order={order} onPaymentSuccess={onPaymentSuccess} />);
}

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

const realGetComputedStyle = window.getComputedStyle;

afterEach(() => {
    cleanup();
    window.getComputedStyle = realGetComputedStyle;
});

beforeEach(() => {
    // Known jsdom/nwsapi bug: getComputedStyle (called by MUI's Modal manager) throws once the
    // split rows' styles are injected, crashing the next drawer mount. Layout is irrelevant here.
    window.getComputedStyle = (): CSSStyleDeclaration => document.createElement("div").style;
    mockSendOrderPayment.mockReset();
    onClose.mockReset();
    onPaymentSuccess.mockReset();
});

describe("PaymentPopup split failure handling", () => {
    it("shows the partial message and locks the saved leg when leg 2 fails", async () => {
        mockSendOrderPayment.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("boom"));
        renderPopup();

        setupSplit();
        clickConfirm();

        const error = await screen.findByTestId("payment-popup-error");
        expect(error.textContent).toContain("1 of 2 payments saved");
        const inputs = screen.getAllByPlaceholderText("0.00");
        expect(inputs[0].hasAttribute("disabled")).toBe(true);
        expect(inputs[1].hasAttribute("disabled")).toBe(false);
        const deleteButtons = screen.getAllByTestId("DeleteIcon").map(icon => icon.closest("button"));
        expect(deleteButtons[0]?.disabled).toBe(true);
        expect(deleteButtons[1]?.disabled).toBe(false);
        const typeSelects = screen.getAllByRole("combobox");
        expect(typeSelects[0].getAttribute("aria-disabled")).toBe("true");
        expect(typeSelects[1].getAttribute("aria-disabled")).not.toBe("true");
        expect(onPaymentSuccess).not.toHaveBeenCalled();
    });

    it("re-sends only the failed leg with the same key", async () => {
        mockSendOrderPayment
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValue(undefined);
        renderPopup();

        setupSplit();
        clickConfirm();
        await screen.findByTestId("payment-popup-error");
        await waitFor(() => expect(confirmButton().disabled).toBe(false));
        clickConfirm();

        await waitFor(() => expect(onPaymentSuccess).toHaveBeenCalledTimes(1));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(amounts()).toEqual([4, 6, 6]);
        expect(keys()[2]).toBe(keys()[1]);
        expect(keys()[1]).not.toBe(keys()[0]);
    });

    it("mints a new key for an edited failed leg only", async () => {
        mockSendOrderPayment
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValue(undefined);
        renderPopup();

        setupSplit();
        clickConfirm();
        await screen.findByTestId("payment-popup-error");
        await waitFor(() => expect(confirmButton().disabled).toBe(false));

        fireEvent.click(screen.getByText("+ Add Payer"));
        const inputs = screen.getAllByPlaceholderText("0.00");
        fireEvent.change(inputs[1], { target: { value: "5" } });
        fireEvent.change(inputs[2], { target: { value: "1" } });
        clickConfirm();

        await waitFor(() => expect(onPaymentSuccess).toHaveBeenCalledTimes(1));
        expect(amounts()).toEqual([4, 6, 5, 1]);
        expect(keys()[2]).not.toBe(keys()[1]);
        expect(keys()[3]).toBeTruthy();
    });
});
