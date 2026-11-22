import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// The editor and the menu popups resolve their copy through useTranslation.
import "../../../../../shared/i18n";

// PizzaLoader (shown while the pizza popup sets up) pulls in lottie-react, which needs a real
// <canvas> 2D context jsdom does not implement.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

// Factoryless: resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../../../shared/api/public");

import { editOrder, fetchBaseAppInfo } from "../../../../../shared/api/public";
import { clearMatchMedia, stubMatchMedia } from "../../../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../../couriers/components/emotionRules.testutil";
import { OrderEditDialog } from "./OrderEditDialog";
import { makeBaseAppInfo, makeEditableOrder } from "./orderEdit.testutil";
import type { EditOrderRequest, Order } from "../../../../order/types";

const mockFetchBaseAppInfo = jest.mocked(fetchBaseAppInfo);
const mockEditOrder = jest.mocked(editOrder);

// Return type inferred on purpose: there is no @types/jest, so `jest.Mock` cannot be named here.
function renderDialog(orderOverrides: Partial<Order> = {}) {
    const onClose = jest.fn<void, []>();
    render(<OrderEditDialog order={makeEditableOrder(orderOverrides)} onClose={onClose} />);
    return { onClose };
}

async function category(name: string): Promise<HTMLElement> {
    return screen.findByRole("button", { name: new RegExp(`^${name}`) });
}

async function expand(name: string): Promise<void> {
    fireEvent.click(await category(name));
}

function badgeCount(): string {
    const badge = screen.getByTestId("order-edit-cart-badge").querySelector(".MuiBadge-badge");
    return badge?.textContent ?? "";
}

function completeButton(): HTMLElement {
    return screen.getByRole("button", { name: /^(Complete|No changes yet|Order cannot be empty|Saving…)$/ });
}

function openList(): void {
    fireEvent.click(screen.getByRole("button", { name: "Order list" }));
}

function lineFor(text: RegExp): HTMLElement {
    const line = screen.getAllByTestId("order-edit-line").find(el => text.test(el.textContent ?? ""));
    if (!line) throw new Error(`no order line matching ${text}`);
    return line;
}

/** Sprite in, both Coca Colas out: one green row and one red row in the summary. */
async function makeTypicalEdit(): Promise<void> {
    await expand("Beverages");
    fireEvent.click(screen.getByRole("button", { name: "Add Sprite" }));
    openList();
    fireEvent.click(screen.getByRole("button", { name: "Remove Coca Cola" }));
}

beforeEach(() => {
    // The menu popups bootstrap the TikTok pixel when window.ttq is absent, by inserting a script
    // before the document's first <script> — jsdom has none. Pre-seeding it skips that branch, as
    // PizzaPopupContent.test.tsx does.
    window.ttq = { track: jest.fn() };
    mockFetchBaseAppInfo.mockReset();
    mockEditOrder.mockReset();
    mockFetchBaseAppInfo.mockResolvedValue(makeBaseAppInfo());
    localStorage.clear();
});

afterEach(() => {
    clearMatchMedia();
    jest.useRealTimers();
});

describe("OrderEditDialog — opening", () => {
    it("loads the menu of the order's own branch", async () => {
        renderDialog();
        await category("Pizzas");
        expect(mockFetchBaseAppInfo).toHaveBeenCalledWith(null, "branch-7");
    });

    it("shows the order number, customer, phone and order type in the header", async () => {
        renderDialog();
        expect(screen.getByText("Edit order #2041")).toBeTruthy();
        expect(screen.getByText("Sara · 97333334444 · Pick Up")).toBeTruthy();
        await category("Pizzas");
    });

    it("lists the categories collapsed and in menu order, with an in-order badge", async () => {
        renderDialog();
        await category("Pizzas");
        const headers = screen.getAllByRole("button").filter(b => b.hasAttribute("aria-expanded"));
        expect(headers.map(h => h.textContent)).toEqual(["Pizzas1 in order", "Sauces", "Beverages2 in order"]);
        headers.forEach(h => expect(h.getAttribute("aria-expanded")).toBe("false"));
        expect(screen.queryByRole("button", { name: "Add Sprite" })).toBeNull();
    });

    it("shows a category's items when it is expanded, and stopped items without a +", async () => {
        renderDialog();
        await expand("Beverages");
        expect((await category("Beverages")).getAttribute("aria-expanded")).toBe("true");
        expect(screen.getByRole("button", { name: "Add Sprite" })).toBeTruthy();
        const water = screen.getByTestId("menu-item-Water");
        expect(within(water).getByText("Unavailable")).toBeTruthy();
        expect(within(water).queryByRole("button")).toBeNull();
        expect(within(screen.getByTestId("menu-item-Coca Cola")).getByText("× 2")).toBeTruthy();
    });

    it("never loads an item photo", async () => {
        renderDialog();
        await expand("Pizzas");
        await expand("Beverages");
        expect(document.querySelectorAll("img")).toHaveLength(0);
    });

    it("explains why Complete is disabled before anything changes", async () => {
        renderDialog();
        await category("Pizzas");
        expect(completeButton().textContent).toBe("No changes yet");
        expect((completeButton() as HTMLButtonElement).disabled).toBe(true);
    });
});

describe("OrderEditDialog — adding", () => {
    it("adds a simple item with one tap on +", async () => {
        renderDialog();
        await expand("Beverages");
        expect(badgeCount()).toBe("3");
        fireEvent.click(screen.getByRole("button", { name: "Add Sprite" }));
        expect(badgeCount()).toBe("4");
        expect(within(screen.getByTestId("menu-item-Sprite")).getByText("× 1")).toBeTruthy();
        expect(completeButton().textContent).toBe("Complete");
    });

    it("opens the pizza popup, text-only, for + on a pizza", async () => {
        renderDialog();
        await expand("Pizzas");
        fireEvent.click(screen.getByRole("button", { name: "Add Pepperoni" }));
        expect(await screen.findByRole("button", { name: "Add · 3.50" })).toBeTruthy();
        expect(screen.getAllByText("Pepperoni").length).toBeGreaterThan(0);
        expect(screen.queryByText("A description staff never need to read")).toBeNull();
        expect(document.querySelectorAll('img[src="https://example.test/photo.webp"]')).toHaveLength(0);
    });

    it("puts the popup's pizza into the order and returns to the editor", async () => {
        renderDialog();
        await expand("Pizzas");
        fireEvent.click(screen.getByRole("button", { name: "Add Pepperoni" }));
        fireEvent.click(await screen.findByRole("button", { name: "Add · 3.50" }));
        await waitFor(() => expect(screen.queryByRole("button", { name: "Add · 3.50" })).toBeNull());
        expect(badgeCount()).toBe("4");
        openList();
        expect(within(lineFor(/Pepperoni \(M\)/)).getByTestId("order-edit-line-note").textContent).toBe("+1 added · 7.000 BD");
    });
});

describe("OrderEditDialog — order list", () => {
    it("marks a removed unit on the line and shows Was / Now totals", async () => {
        renderDialog();
        await category("Pizzas");
        openList();
        fireEvent.click(screen.getByRole("button", { name: "One less Coca Cola" }));
        expect(within(lineFor(/Coca Cola/)).getByTestId("order-edit-line-note").textContent).toBe("1 removed · 0.500 BD");
        expect(screen.getByText("Was 4.500 BD")).toBeTruthy();
        expect(screen.getByText("Now 4.000 BD")).toBeTruthy();
        expect(badgeCount()).toBe("2");
    });

    it("blocks Complete with 'Order cannot be empty' when every line is binned", async () => {
        renderDialog();
        await category("Pizzas");
        openList();
        fireEvent.click(screen.getByRole("button", { name: "Remove Coca Cola" }));
        fireEvent.click(screen.getByRole("button", { name: "Remove Pepperoni" }));
        expect(completeButton().textContent).toBe("Order cannot be empty");
        expect((completeButton() as HTMLButtonElement).disabled).toBe(true);
    });

    it("reopens a pizza line pre-filled, and Save replaces the line", async () => {
        renderDialog();
        await category("Pizzas");
        openList();
        expect(within(lineFor(/Coca Cola/)).queryByRole("button", { name: "Change size / toppings" })).toBeNull();
        fireEvent.click(within(lineFor(/Pepperoni/)).getByRole("button", { name: "Change size / toppings" }));

        const medium = await screen.findByRole("button", { name: "M" });
        expect(medium.getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(screen.getByRole("button", { name: "L" }));
        fireEvent.click(screen.getByRole("button", { name: "Add · 4.50" }));

        await waitFor(() => expect(screen.queryByRole("button", { name: "Add · 4.50" })).toBeNull());
        const lines = screen.getAllByTestId("order-edit-line").map(l => l.firstChild?.textContent);
        expect(lines).toEqual(["1 × Pepperoni (L)", "2 × Coca Cola"]);
        expect(within(lineFor(/Pepperoni \(L\)/)).getByTestId("order-edit-line-note").textContent).toBe("New · 4.500 BD");
    });

    it("opens as a side panel next to the categories on a tablet", async () => {
        stubMatchMedia(true);
        renderDialog();
        await category("Pizzas");
        expect(screen.getByRole("dialog")).toBeTruthy();
        openList();
        expect(screen.getByTestId("order-edit-list")).toBeTruthy();
        // The categories stay usable beside it.
        expect(await category("Pizzas")).toBeTruthy();
    });

    it("has a back button on a tablet too, which closes the side panel", async () => {
        stubMatchMedia(true);
        renderDialog();
        await category("Pizzas");
        openList();
        fireEvent.click(screen.getByRole("button", { name: "Back to the menu" }));
        expect(screen.queryByTestId("order-edit-list")).toBeNull();
    });

    it("covers the drawer on a phone, with a back button to the menu", async () => {
        renderDialog();
        await category("Pizzas");
        openList();
        fireEvent.click(screen.getByRole("button", { name: "Back to the menu" }));
        expect(screen.queryByTestId("order-edit-list")).toBeNull();
    });
});

describe("OrderEditDialog — closing without saving", () => {
    it("closes straight away when nothing changed", async () => {
        const { onClose } = renderDialog();
        await category("Pizzas");
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("asks 'Discard changes?' first when something changed", async () => {
        const { onClose } = renderDialog();
        await expand("Beverages");
        fireEvent.click(screen.getByRole("button", { name: "Add Sprite" }));
        fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
        expect(await screen.findByText("Discard changes?")).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
        expect(onClose).not.toHaveBeenCalled();
        expect(badgeCount()).toBe("4");

        fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
        fireEvent.click(await screen.findByRole("button", { name: "Discard" }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(mockEditOrder).not.toHaveBeenCalled();
    });
});

describe("OrderEditDialog — Complete and the summary", () => {
    it("calls editOrder once with the edited lines and the order's own details", async () => {
        mockEditOrder.mockResolvedValue(makeEditableOrder());
        renderDialog();
        await makeTypicalEdit();
        fireEvent.click(completeButton());
        fireEvent.click(completeButton());

        await screen.findByTestId("order-edit-summary");
        expect(mockEditOrder).toHaveBeenCalledTimes(1);
        const [request, orderId] = mockEditOrder.mock.calls[0] as [EditOrderRequest, string];
        expect(orderId).toBe("77");
        expect(request).toEqual(expect.objectContaining({
            id: "77", order_no: 2041, tel: "97333334444", customer_name: "Sara",
            delivery_method: "Pick Up", payment_type: "Cash", notes: "ring the bell", amount_paid: 4,
        }));
        expect(request.items.map(i => [i.name, i.quantity, i.amount])).toEqual([["Pepperoni", 1, 3.5], ["Sprite", 1, 0.5]]);
    });

    // The backend answers 500 ("Order has no customer") to any tel on a customer-less order.
    it.each([
        ["the WebSocket placeholder", "rabotyaga"],
        ["the order-history placeholder", "Failed to fetch number"],
        ["an empty phone", ""],
        ["no phone at all", null],
    ])("sends no tel for a customer-less order with %s", async (_label, phone) => {
        mockEditOrder.mockResolvedValue(makeEditableOrder());
        renderDialog({ phone_number: phone as string });
        await makeTypicalEdit();
        fireEvent.click(completeButton());

        await screen.findByTestId("order-edit-summary");
        const [request] = mockEditOrder.mock.calls[0] as [EditOrderRequest, string];
        expect(request.tel).toBeNull();
    });

    it("lists what was added in green and what was removed in red, struck through", async () => {
        mockEditOrder.mockResolvedValue(makeEditableOrder());
        renderDialog();
        await makeTypicalEdit();
        fireEvent.click(completeButton());

        expect(await screen.findByText("Order #2041 updated")).toBeTruthy();
        const added = within(screen.getByTestId("summary-added"));
        const removed = within(screen.getByTestId("summary-removed"));
        expect(added.getByText("ADDED")).toBeTruthy();
        expect(removed.getByText("REMOVED")).toBeTruthy();

        const addedRow = added.getByTestId("summary-added-row");
        const removedRow = removed.getByTestId("summary-removed-row");
        expect(addedRow.textContent).toBe("1 × Sprite");
        expect(removedRow.textContent).toBe("2 × Coca Cola");
        expect(addedRow.querySelector("svg")).not.toBeNull();
        expect(removedRow.querySelector("svg")).not.toBeNull();

        const addedText = within(addedRow).getByText("1 × Sprite");
        const removedText = within(removedRow).getByText("2 × Coca Cola");
        expect(emotionRulesFor(addedText)).toMatch(/color:(#145c31|rgb\(20, 92, 49\))/i);
        expect(emotionRulesFor(removedText)).toMatch(/color:(#8f2627|rgb\(143, 38, 39\))/i);
        expect(emotionRulesFor(removedText)).toContain("text-decoration:line-through");
        expect(screen.getByTestId("summary-total").textContent).toBe("4.500 BD → 4.000 BD");
    });

    it("closes itself after 10 seconds", async () => {
        jest.useFakeTimers();
        mockEditOrder.mockResolvedValue(makeEditableOrder());
        const { onClose } = renderDialog();
        await makeTypicalEdit();
        fireEvent.click(completeButton());
        await screen.findByTestId("order-edit-summary");
        expect(screen.getByText("Closes in 10 s")).toBeTruthy();

        // One second per act(): each tick schedules the next only once React has re-rendered.
        const tick = (): void => act(() => { jest.advanceTimersByTime(1000); });
        tick();
        expect(screen.getByText("Closes in 9 s")).toBeTruthy();
        for (let i = 0; i < 8; i++) tick();
        expect(screen.getByText("Closes in 1 s")).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
        tick();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("drains the countdown bar as one smooth 10-second linear animation, not a jump per second", async () => {
        mockEditOrder.mockResolvedValue(makeEditableOrder());
        renderDialog();
        await makeTypicalEdit();
        fireEvent.click(completeButton());
        const summary = await screen.findByTestId("order-edit-summary");

        // The sx rule lives on the progress root and targets its bar.
        const progress = summary.querySelector(".MuiLinearProgress-root");
        expect(progress).not.toBeNull();
        expect(emotionRulesFor(progress as Element)).toMatch(/\.MuiLinearProgress-bar \{[^}]*\banimation:\S+ 10s linear forwards/);
    });

    it("closes at once on Close now", async () => {
        mockEditOrder.mockResolvedValue(makeEditableOrder());
        const { onClose } = renderDialog();
        await makeTypicalEdit();
        fireEvent.click(completeButton());
        fireEvent.click(await screen.findByRole("button", { name: "Close now" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps the edits and shows the error when the save fails", async () => {
        mockEditOrder.mockRejectedValue(new Error("Error editing order: 500"));
        const { onClose } = renderDialog();
        await makeTypicalEdit();
        fireEvent.click(completeButton());

        expect(await screen.findByText(/The order was not saved: Error editing order: 500/)).toBeTruthy();
        expect(screen.queryByTestId("order-edit-summary")).toBeNull();
        expect(screen.getAllByTestId("order-edit-line").map(l => l.firstChild?.textContent))
            .toEqual(["1 × Pepperoni (M)", "1 × Sprite"]);
        expect(completeButton().textContent).toBe("Complete");
        expect((completeButton() as HTMLButtonElement).disabled).toBe(false);
        expect(onClose).not.toHaveBeenCalled();
    });
});
