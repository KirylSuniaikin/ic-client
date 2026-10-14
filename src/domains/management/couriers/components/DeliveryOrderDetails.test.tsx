import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { DeliveryOrderDetails } from "./DeliveryOrderDetails";
import type { DeliveryCard } from "../types";

/**
 * The order details block a dispatcher reads when they open a card (DELIVERY_SPEC.md §4). Had no
 * test of its own before courier-capacity Phase 5 — `AssignCourierDialog.test.tsx` and
 * `DeliveryBoardPanel.test.tsx` only ever exercised it indirectly, by opening a popup that embeds
 * it.
 */

const CARD: DeliveryCard = {
    orderId: 101,
    orderNo: 11,
    status: "Out for delivery",
    branchId: "b1",
    branchName: "Manama",
    addressLine: "Block 338, Road 3801",
    customerName: "Ali",
    customerPhone: "33110022",
    courierPhone: "39887766",
    readyAt: "2026-08-08T10:00:00",
    estimatedHandoverAt: "2026-08-08T10:05:00",
    estimatedDeliveredAt: "2026-08-08T10:48:00",
    riskMinutes: 48,
    promisedAt: "2026-08-08T10:40:00",
    promisedTotalMinutes: 30,
    freshnessBudgetMinutes: 20,
    items: [{ name: "Pepperoni", quantity: 2 }],
};

describe("DeliveryOrderDetails", () => {
    it("shows the single Courier phone block for a plain, non-split order", () => {
        render(<DeliveryOrderDetails card={CARD} freshnessBudgetMinutes={20} />);

        expect(screen.getByText("Courier")).toBeTruthy();
        expect(screen.getByText("39887766")).toBeTruthy();
        expect(screen.queryByText("Couriers")).toBeNull();
    });

    it("names the customer and address", () => {
        render(<DeliveryOrderDetails card={CARD} freshnessBudgetMinutes={20} />);

        expect(screen.getByText("Ali")).toBeTruthy();
        expect(screen.getByText("Block 338, Road 3801")).toBeTruthy();
    });
});

/**
 * Courier-capacity Phase 5 (task-spec.md §11 P5): a genuinely split order shows one courier line
 * per part instead of the single "Courier" block above.
 */
describe("DeliveryOrderDetails — a genuinely split order", () => {
    const SPLIT_CARD: DeliveryCard = {
        ...CARD,
        courierPhone: "39887766",
        partsTotal: 2,
        parts: [
            { partId: 501, partIndex: 1, courierPhone: "39887766", assigned: true },
            { partId: 502, partIndex: 2, courierPhone: null, assigned: false },
        ],
    };

    it("renders the per-part courier list when partsTotal > 1", () => {
        render(<DeliveryOrderDetails card={SPLIT_CARD} freshnessBudgetMinutes={20} />);

        expect(screen.getByText("Couriers")).toBeTruthy();
        expect(screen.getByText("Part 1/2")).toBeTruthy();
        expect(screen.getByText("Part 2/2")).toBeTruthy();
        expect(screen.getByText("39887766")).toBeTruthy();
        expect(screen.getByText("not assigned")).toBeTruthy();
    });

    it("renders no singular Courier block when the order is genuinely split", () => {
        render(<DeliveryOrderDetails card={SPLIT_CARD} freshnessBudgetMinutes={20} />);

        expect(screen.queryByText("Courier")).toBeNull();
    });

    it("falls back to the unchanged single Courier block when parts is absent even with partsTotal set", () => {
        const cardWithNoPartsList: DeliveryCard = { ...CARD, partsTotal: 2, parts: undefined };
        render(<DeliveryOrderDetails card={cardWithNoPartsList} freshnessBudgetMinutes={20} />);

        expect(screen.getByText("Courier")).toBeTruthy();
        expect(screen.queryByText("Couriers")).toBeNull();
    });
});
