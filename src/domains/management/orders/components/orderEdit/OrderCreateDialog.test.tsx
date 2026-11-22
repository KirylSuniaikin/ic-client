import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import "../../../../../shared/i18n";

// PizzaLoader pulls in lottie-react, which needs a <canvas> 2D context jsdom does not implement.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

// Factoryless: resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../../../shared/api/public");

import { createOrder, fetchBaseAppInfo } from "../../../../../shared/api/public";
import { clearMatchMedia } from "../../../../../shared/hooks/stubMatchMedia.testutil";
import { ItemsUnavailableError } from "../../../../order/types";
import type { CreateOrderRequest, Order } from "../../../../order/types";
import { OrderCreateDialog } from "./OrderCreateDialog";
import { makeBaseAppInfo } from "./orderEdit.testutil";

const mockFetchBaseAppInfo = jest.mocked(fetchBaseAppInfo);
const mockCreateOrder = jest.mocked(createOrder);

function renderDialog() {
    const onClose = jest.fn<void, []>();
    render(<OrderCreateDialog branchId="branch-7" onClose={onClose} />);
    return { onClose };
}

async function expand(name: string): Promise<void> {
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${name}`) }));
}

function footerButton(): HTMLButtonElement {
    return screen.getByRole("button", { name: /^(Continue|Add items to start)$/ }) as HTMLButtonElement;
}

function badgeCount(): string {
    return screen.getByTestId("order-edit-cart-badge").querySelector(".MuiBadge-badge")?.textContent ?? "";
}

/** Two Sprites and a Coca Cola: 1.500 BD. */
async function pickDrinks(): Promise<void> {
    await expand("Beverages");
    fireEvent.click(screen.getByRole("button", { name: "Add Sprite" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Sprite" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Coca Cola" }));
}

function chooseDiscount(percent: number): void {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Order discount" }));
    fireEvent.click(screen.getByRole("option", { name: `${percent}%` }));
}

function placeButton(): HTMLElement {
    return screen.getByRole("button", { name: /^Place order · / });
}

function sentRequest(call = 0): CreateOrderRequest {
    return mockCreateOrder.mock.calls[call][0];
}

beforeEach(() => {
    window.ttq = { track: jest.fn() };
    mockFetchBaseAppInfo.mockReset();
    mockCreateOrder.mockReset();
    mockFetchBaseAppInfo.mockResolvedValue(makeBaseAppInfo());
    mockCreateOrder.mockResolvedValue({ id: 555 } as unknown as Order);
    localStorage.clear();
});

afterEach(() => {
    clearMatchMedia();
});

describe("OrderCreateDialog — picking items", () => {
    it("loads the board branch's menu and starts as an empty new order", async () => {
        renderDialog();
        await screen.findByRole("button", { name: /^Pizzas/ });

        expect(mockFetchBaseAppInfo).toHaveBeenCalledWith(null, "branch-7");
        expect(screen.getByText("New order")).toBeTruthy();
        expect(footerButton().textContent).toBe("Add items to start");
        expect(footerButton().disabled).toBe(true);
    });

    it("adds items with + and counts them on the cart icon", async () => {
        renderDialog();
        await pickDrinks();

        expect(badgeCount()).toBe("3");
        expect(footerButton().textContent).toBe("Continue");
        expect(footerButton().disabled).toBe(false);
    });

    it("lists the picked items without edit tags and with a single total", async () => {
        renderDialog();
        await pickDrinks();
        fireEvent.click(screen.getByRole("button", { name: "Order list" }));

        const notes = screen.getAllByTestId("order-edit-line-note").map(n => n.textContent);
        expect(notes).toEqual(["1.000 BD", "0.500 BD"]);
        expect(screen.getByTestId("order-list-total").textContent).toBe("1.500 BD");
        expect(screen.queryByText(/^Was /)).toBeNull();
    });
});

describe("OrderCreateDialog — details and placing", () => {
    it("places the order with the customer, payment and discount, as the admin menu does", async () => {
        renderDialog();
        await pickDrinks();
        fireEvent.click(footerButton());

        expect(screen.getByTestId("order-create-details")).toBeTruthy();
        fireEvent.change(screen.getByLabelText("Phone (optional)"), { target: { value: "33334444" } });
        fireEvent.change(screen.getByLabelText("Customer name (optional)"), { target: { value: " Ali " } });
        fireEvent.click(screen.getByRole("button", { name: "Cash" }));
        chooseDiscount(10);
        expect(placeButton().textContent).toBe("Place order · 1.350 BD");
        fireEvent.click(placeButton());

        await screen.findByTestId("order-edit-summary");
        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
        const request = sentRequest();
        expect(request).toEqual(expect.objectContaining({
            tel: "97333334444", customer_name: "Ali", type: "Pick Up", payment_type: "Cash",
            branchId: "branch-7", notes: "", amount_paid: 1.35,
        }));
        expect(request.items.map(i => [i.name, i.quantity, i.discountAmount])).toEqual([["Sprite", 2, 10], ["Coca Cola", 1, 10]]);
        expect(typeof request.idempotency_key).toBe("string");
        // The staff member's own board does not ring for an order they placed.
        expect(JSON.parse(localStorage.getItem("suppressSoundIds") ?? "[]")).toEqual(["555"]);
    });

    it("shows the order beside the form, with the discount taken off the total", async () => {
        renderDialog();
        await pickDrinks();
        fireEvent.click(footerButton());

        const recap = within(screen.getByTestId("order-create-recap"));
        expect(recap.getByText("2 × Sprite")).toBeTruthy();
        expect(recap.getByText("1 × Coca Cola")).toBeTruthy();
        expect(recap.getByTestId("order-create-recap-total").textContent).toBe("1.500 BD");
        expect(recap.queryByText("Discount 10%")).toBeNull();

        chooseDiscount(10);
        expect(recap.getByText("Discount 10%")).toBeTruthy();
        expect(recap.getByText("−0.150")).toBeTruthy();
        expect(recap.getByTestId("order-create-recap-total").textContent).toBe("1.350 BD");
    });

    it("sends no phone when it is left empty, and the card machine by default", async () => {
        renderDialog();
        await pickDrinks();
        fireEvent.click(footerButton());
        fireEvent.click(placeButton());

        await screen.findByTestId("order-edit-summary");
        expect(sentRequest()).toEqual(expect.objectContaining({
            tel: null, customer_name: "", payment_type: "Card (Through card machine)", amount_paid: 1.5,
        }));
    });

    it("refuses a phone of the wrong length for the country", async () => {
        renderDialog();
        await pickDrinks();
        fireEvent.click(footerButton());
        fireEvent.change(screen.getByLabelText("Phone (optional)"), { target: { value: "3333" } });
        fireEvent.click(placeButton());

        expect(screen.getByText("The phone number must be exactly 8 digits")).toBeTruthy();
        expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("goes back to the items with everything still picked", async () => {
        renderDialog();
        await pickDrinks();
        fireEvent.click(footerButton());
        fireEvent.click(screen.getByRole("button", { name: "Back to the items" }));

        expect(screen.queryByTestId("order-create-details")).toBeNull();
        expect(badgeCount()).toBe("3");
    });

    it("shows what was ordered for 10 seconds: ADDED only, and the total", async () => {
        renderDialog();
        await pickDrinks();
        fireEvent.click(footerButton());
        fireEvent.click(placeButton());

        expect(await screen.findByText("Order placed")).toBeTruthy();
        const added = within(screen.getByTestId("summary-added"));
        expect(added.getAllByTestId("summary-added-row").map(r => r.textContent)).toEqual(["2 × Sprite", "1 × Coca Cola"]);
        expect(screen.queryByTestId("summary-removed")).toBeNull();
        expect(screen.getByTestId("summary-total").textContent).toBe("1.500 BD");
        expect(screen.getByText("Closes in 10 s")).toBeTruthy();
    });

    it("keeps the details and retries with the same key when placing fails", async () => {
        mockCreateOrder.mockRejectedValueOnce(new Error("Network down"));
        renderDialog();
        await pickDrinks();
        fireEvent.click(footerButton());
        fireEvent.click(screen.getByRole("button", { name: "Cash" }));
        fireEvent.click(placeButton());

        expect(await screen.findByText("The order was not placed: Network down")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Cash" }).getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(placeButton());
        await screen.findByTestId("order-edit-summary");
        expect(sentRequest(1).idempotency_key).toBe(sentRequest(0).idempotency_key);
    });

    it("drops items the branch no longer has, reloads the menu and returns to the items", async () => {
        mockCreateOrder.mockRejectedValueOnce(new ItemsUnavailableError("Sprite is out of stock", [32]));
        renderDialog();
        await pickDrinks();
        fireEvent.click(footerButton());
        fireEvent.click(placeButton());

        expect(await screen.findByText("The order was not placed: Sprite is out of stock")).toBeTruthy();
        expect(screen.queryByTestId("order-create-details")).toBeNull();
        expect(badgeCount()).toBe("1");
        await waitFor(() => expect(mockFetchBaseAppInfo).toHaveBeenCalledTimes(2));
    });
});

describe("OrderCreateDialog — closing", () => {
    it("closes at once while nothing is picked", async () => {
        const { onClose } = renderDialog();
        await screen.findByRole("button", { name: /^Pizzas/ });
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("asks before discarding picked items", async () => {
        const { onClose } = renderDialog();
        await pickDrinks();
        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(screen.getByText("The items you picked will be lost.")).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Discard" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
