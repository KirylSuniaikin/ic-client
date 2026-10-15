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

describe("OrderCard — background colours", () => {
    it("renders an ordinary kitchen order white", () => {
        const card = renderCard(makeOrder({ status: "Kitchen Phase" }));

        expect(backgroundOf(card)).toBe("rgb(255, 255, 255)");
    });

    it.each([
        ["Jahez", "rgb(255, 245, 245)"],
        ["Keeta", "rgb(205, 186, 46)"],
        ["Talabat", "rgb(251, 170, 102)"],
    ] as const)("keeps the %s colour", (orderType, expected) => {
        // Regression guard for cardBackgroundColor(), which replaced an inline four-deep ternary.
        const card = renderCard(makeOrder({ order_type: orderType }));

        expect(backgroundOf(card)).toBe(expected);
    });

    it("still shows OVEN on a paid kitchen order", () => {
        renderCard(makeOrder({ status: "Kitchen Phase" }));

        expect(screen.getByText("OVEN")).toBeTruthy();
    });
});
