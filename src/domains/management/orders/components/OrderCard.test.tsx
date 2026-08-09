import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Order } from "../../../order/types";

// lottie-web obtains a real 2D canvas context at import time, which jsdom does not provide.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../../shared/api/public");

import * as publicApi from "../../../../shared/api/public";
import OrderCard from "./OrderCard";

// The shared public mock does not export these two (see HistoryComponent.test.tsx); OrderCard
// reaches for them at call time, so patching them onto the mocked module object is enough.
const mockDeleteOrder = jest.fn<Promise<void>, [string]>();
const mockUpdateOrderStatus = jest.fn<Promise<void>, [unknown]>();
(publicApi as unknown as { deleteOrder: unknown }).deleteOrder = mockDeleteOrder;
(publicApi as unknown as { updateOrderStatus: unknown }).updateOrderStatus = mockUpdateOrderStatus;

function makeOrder(overrides: Partial<Order> = {}): Order {
    return {
        id: "1",
        order_no: 4821,
        tel: "12345678",
        customer_name: "Test Customer",
        delivery_method: "Pick Up",
        payment_type: "Cash",
        address: "",
        notes: "",
        items: [],
        amount_paid: 10,
        order_type: "Pick Up",
        external_id: null,
        phone_number: "12345678",
        order_created: new Date().toISOString(),
        status: "Kitchen Phase",
        isPaid: false,
        branch_id: "branch-1",
        estimation: 15,
        ...overrides,
    };
}

function renderCard(order: Order): HTMLElement {
    const { container } = render(
        <MemoryRouter>
            <OrderCard order={order} onDeleteClick={jest.fn()} />
        </MemoryRouter>
    );
    // The MUI Card is the outermost element the background colour is applied to.
    return container.querySelector(".MuiCard-root") as HTMLElement;
}

// MUI applies the colour through an emotion class, not an inline style, so it has to be read
// from the computed style — which jsdom resolves to rgb() form.
function backgroundOf(card: HTMLElement): string {
    return window.getComputedStyle(card).backgroundColor;
}

describe("OrderCard — counter-payment orders", () => {
    it("renders an awaiting-counter-payment order on a gray card", () => {
        const card = renderCard(makeOrder({ status: "Awaiting Counter Payment" }));

        expect(backgroundOf(card)).toBe("rgb(224, 224, 224)");
    });

    it("labels the card so the gray is not the only signal", () => {
        renderCard(makeOrder({ status: "Awaiting Counter Payment" }));

        expect(screen.getByTestId("awaiting-counter-payment-chip").textContent).toBe("PAY AT COUNTER");
    });

    it("does not offer OVEN on an unpaid counter order", () => {
        // The kitchen flow starts only once the cashier has taken the money.
        renderCard(makeOrder({ status: "Awaiting Counter Payment" }));

        expect(screen.queryByText("OVEN")).toBeNull();
    });

    it("leaves PAY enabled so the cashier can take the money", () => {
        renderCard(makeOrder({ status: "Awaiting Counter Payment" }));

        expect((screen.getByText("PAY").closest("button") as HTMLButtonElement).disabled).toBe(false);
    });
});

describe("OrderCard — background colours are unchanged for every other order", () => {
    it("renders an ordinary kitchen order white", () => {
        const card = renderCard(makeOrder({ status: "Kitchen Phase" }));

        expect(backgroundOf(card)).toBe("rgb(255, 255, 255)");
        expect(screen.queryByTestId("awaiting-counter-payment-chip")).toBeNull();
    });

    it.each([
        ["Jahez", "rgb(255, 245, 245)"],
        ["Keeta", "rgb(205, 186, 46)"],
        ["Talabat", "rgb(251, 170, 102)"],
    ] as const)("keeps the %s colour", (orderType, expected) => {
        // Regression guard: the status check was added ahead of the order_type chain, so these
        // must still resolve exactly as before.
        const card = renderCard(makeOrder({ order_type: orderType }));

        expect(backgroundOf(card)).toBe(expected);
    });

    it("still shows OVEN on a paid kitchen order", () => {
        renderCard(makeOrder({ status: "Kitchen Phase" }));

        expect(screen.getByText("OVEN")).toBeTruthy();
    });
});
