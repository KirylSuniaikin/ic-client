import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { act, renderHook } from "@testing-library/react";

// Factoryless: resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../../../shared/api/public");

import { editOrder } from "../../../../../shared/api/public";
import type { CartItem } from "../../../../menu/types";
import { EDITED_ORDER_ID_KEY } from "../../hooks/useAdminOrders";
import { useOrderEdit } from "./useOrderEdit";
import { makeEditableOrder } from "./orderEdit.testutil";

const mockEditOrder = jest.mocked(editOrder);

function sprite(): CartItem {
    return {
        id: 32, name: "Sprite", size: "", category: "Beverages", photo: "", amount: 0.5, quantity: 1,
        isThinDough: false, isGarlicCrust: false, extraIngredients: [], toppings: [],
        note: "", description: "", discountAmount: 0, comboItems: null,
    };
}

function lineKeyOf(result: { current: ReturnType<typeof useOrderEdit> }, name: string): string {
    const found = result.current.lines.find(l => l.item.name === name);
    if (!found) throw new Error(`no line for ${name}`);
    return found.key;
}

beforeEach(() => {
    mockEditOrder.mockReset();
    localStorage.clear();
});

describe("useOrderEdit", () => {
    it("starts from the order's lines with Complete blocked by 'no changes'", () => {
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        expect(result.current.lines.map(l => [l.item.name, l.item.quantity, l.status.kind]))
            .toEqual([["Pepperoni", 1, "unchanged"], ["Coca Cola", 2, "unchanged"]]);
        expect(result.current.completeBlocker).toBe("noChanges");
        expect(result.current.totalQuantity).toBe(3);
        expect(result.current.originalTotal).toBeCloseTo(4.5);
    });

    it("adds a new line, marked new, and unblocks Complete", () => {
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        act(() => result.current.addItems([sprite()]));
        const added = result.current.lines.find(l => l.item.name === "Sprite");
        expect(added?.status).toEqual({ kind: "new" });
        expect(result.current.completeBlocker).toBeNull();
        expect(result.current.diff.added.map(c => [c.item.name, c.quantity])).toEqual([["Sprite", 1]]);
        expect(result.current.editedTotal).toBeCloseTo(5);
    });

    it("adds onto the existing line when the item is already in the order", () => {
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        act(() => result.current.addItems([{ ...sprite(), id: 31, name: "Coca Cola" }]));
        expect(result.current.lines).toHaveLength(2);
        expect(result.current.lines[1].item.quantity).toBe(3);
        expect(result.current.lines[1].status).toEqual({ kind: "added", count: 1 });
    });

    it("increments a line", () => {
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        act(() => result.current.increment(lineKeyOf(result, "Pepperoni")));
        expect(result.current.lines[0].item.quantity).toBe(2);
        expect(result.current.lines[0].status).toEqual({ kind: "added", count: 1 });
    });

    it("decrements a line and marks what was removed", () => {
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        act(() => result.current.decrement(lineKeyOf(result, "Coca Cola")));
        expect(result.current.lines[1].status).toEqual({ kind: "removed", count: 1 });
        expect(result.current.diff.removed.map(c => [c.item.name, c.quantity])).toEqual([["Coca Cola", 1]]);
    });

    it("removes the line when it is decremented to zero", () => {
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        act(() => result.current.decrement(lineKeyOf(result, "Pepperoni")));
        expect(result.current.lines.map(l => l.item.name)).toEqual(["Coca Cola"]);
    });

    it("removes the whole line with the bin", () => {
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        act(() => result.current.removeLine(lineKeyOf(result, "Coca Cola")));
        expect(result.current.lines.map(l => l.item.name)).toEqual(["Pepperoni"]);
        expect(result.current.diff.removed.map(c => c.quantity)).toEqual([2]);
    });

    it("blocks Complete with 'empty order' once every line is gone", () => {
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        act(() => result.current.removeLine(lineKeyOf(result, "Coca Cola")));
        act(() => result.current.removeLine(lineKeyOf(result, "Pepperoni")));
        expect(result.current.completeBlocker).toBe("emptyOrder");
    });

    it("replaces a line in place with what its popup produced", () => {
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        const large = { ...result.current.lines[0].item, size: "L", amount: 4.5 };
        act(() => result.current.replaceLine(lineKeyOf(result, "Pepperoni"), [large]));
        expect(result.current.lines.map(l => [l.item.name, l.item.size])).toEqual([["Pepperoni", "L"], ["Coca Cola", ""]]);
        expect(result.current.diff.removed.map(c => c.item.size)).toEqual(["M"]);
        expect(result.current.diff.added.map(c => c.item.size)).toEqual(["L"]);
    });

    it("does not count a line saved back unchanged as a change", () => {
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        const same = { ...result.current.lines[0].item };
        act(() => result.current.replaceLine(lineKeyOf(result, "Pepperoni"), [same]));
        expect(result.current.completeBlocker).toBe("noChanges");
    });

    it("does not save while Complete is blocked", async () => {
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        await act(async () => { await result.current.complete(); });
        expect(mockEditOrder).not.toHaveBeenCalled();
    });

    it("saves the edited lines with the order's own customer, payment and notes", async () => {
        mockEditOrder.mockResolvedValue(makeEditableOrder());
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        act(() => result.current.addItems([sprite()]));
        await act(async () => { await result.current.complete(); });

        expect(mockEditOrder).toHaveBeenCalledTimes(1);
        expect(mockEditOrder).toHaveBeenCalledWith(expect.objectContaining({
            id: "77",
            order_no: 2041,
            tel: "97333334444",
            customer_name: "Sara",
            payment_type: "Cash",
            notes: "ring the bell",
            amount_paid: 5,
            items: [
                expect.objectContaining({ name: "Pepperoni", quantity: 1 }),
                expect.objectContaining({ name: "Coca Cola", quantity: 2 }),
                expect.objectContaining({ name: "Sprite", quantity: 1, amount: 0.5 }),
            ],
        }), "77");
        expect(result.current.phase).toBe("saved");
        expect(result.current.summary?.added.map(c => c.item.name)).toEqual(["Sprite"]);
        expect(result.current.summary?.originalTotal).toBeCloseTo(4.5);
        expect(result.current.summary?.editedTotal).toBeCloseTo(5);
        // The board must not alert this tablet about its own edit.
        expect(JSON.parse(localStorage.getItem(EDITED_ORDER_ID_KEY) ?? "[]")).toEqual(["77"]);
    });

    it("sends no phone for an order without a customer", async () => {
        mockEditOrder.mockResolvedValue(makeEditableOrder());
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder({ phone_number: "Failed to fetch number" })));
        act(() => result.current.addItems([sprite()]));
        await act(async () => { await result.current.complete(); });
        expect(mockEditOrder).toHaveBeenCalledWith(expect.objectContaining({ tel: null }), "77");
    });

    it("keeps the edits and reports the error when the save fails", async () => {
        mockEditOrder.mockRejectedValue(new Error("Error editing order: 500"));
        const { result } = renderHook(() => useOrderEdit(makeEditableOrder()));
        act(() => result.current.addItems([sprite()]));
        await act(async () => { await result.current.complete(); });

        expect(result.current.phase).toBe("editing");
        expect(result.current.saveError).toBe("Error editing order: 500");
        expect(result.current.lines.map(l => l.item.name)).toEqual(["Pepperoni", "Coca Cola", "Sprite"]);
        expect(result.current.summary).toBeNull();
        expect(JSON.parse(localStorage.getItem(EDITED_ORDER_ID_KEY) ?? "[]")).toEqual([]);
    });
});
