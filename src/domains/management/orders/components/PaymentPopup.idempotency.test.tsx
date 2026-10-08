import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Order } from "../../../order/types";

// Factory mock: the shared manual mock of public.ts does not export sendOrderPayment.
// The mock- prefix lets the hoisted factory reference it lazily.
const mockSendOrderPayment = jest.fn<Promise<unknown>, [SentPayload]>();
jest.mock("../../../../shared/api/public", () => ({
    sendOrderPayment: (payload: SentPayload) => mockSendOrderPayment(payload),
}));

import PaymentPopup from "./PaymentPopup";

// Only the fields PaymentPopup reads; the cast is confined to this fixture.
const order = { id: "o-1", amount_paid: 10, branch_id: "2" } as unknown as Order;

function renderPopup(): void {
    render(<PaymentPopup open onClose={jest.fn()} order={order} onPaymentSuccess={jest.fn()} />);
}

type SentPayload = { idempotency_key?: string; amount: number };

function sentPayloads(): SentPayload[] {
    return mockSendOrderPayment.mock.calls.map(([payload]) => payload);
}

beforeEach(() => {
    mockSendOrderPayment.mockReset();
    mockSendOrderPayment.mockResolvedValue(undefined);
});

describe("PaymentPopup idempotency keys", () => {
    it("sends one non-empty key for a single payment", async () => {
        renderPopup();

        fireEvent.click(screen.getByText("Card"));
        fireEvent.click(screen.getByText("Confirm Payment"));

        await waitFor(() => expect(mockSendOrderPayment).toHaveBeenCalledTimes(1));
        expect(sentPayloads()[0].idempotency_key).toBeTruthy();
    });

    it("sends a different key for each leg of a split payment", async () => {
        renderPopup();

        fireEvent.click(screen.getByText("Split"));
        fireEvent.click(screen.getByText("+ Add Payer"));
        const inputs = screen.getAllByPlaceholderText("0.00");
        fireEvent.change(inputs[0], { target: { value: "4" } });
        fireEvent.change(inputs[1], { target: { value: "6" } });
        fireEvent.click(screen.getByText("Confirm Payment"));

        await waitFor(() => expect(mockSendOrderPayment).toHaveBeenCalledTimes(2));
        const [first, second] = sentPayloads();
        expect(first.idempotency_key).toBeTruthy();
        expect(second.idempotency_key).toBeTruthy();
        expect(first.idempotency_key).not.toBe(second.idempotency_key);
    });
});
