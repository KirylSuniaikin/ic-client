import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PricingCostCardsSection from "./PricingCostCardsSection";
import type { ComponentCost } from "../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts.
jest.mock("../../../../shared/api/management");

import { getComponentCosts, getMenuCostCards, updateComponentCost } from "../../../../shared/api/management";

const mockCostCards = jest.mocked(getMenuCostCards);
const mockComponents = jest.mocked(getComponentCosts);
const mockUpdateComponentCost = jest.mocked(updateComponentCost);

// Cards are collapsed by default, and CollapsibleCard unmounts hidden content, so a test that
// asserts on a card's contents has to open it first.
async function openCard(title: string): Promise<void> {
    await userEvent.click(await screen.findByRole("button", { name: `Expand ${title}` }));
}

function costInput(name: string): HTMLInputElement {
    const input = screen.getByLabelText(`Cost for ${name}`);
    if (!(input instanceof HTMLInputElement)) throw new Error(`Cost for ${name} is not an input`);
    return input;
}

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T>(): Deferred<T> {
    let resolve: (value: T) => void = () => undefined;
    const promise = new Promise<T>(res => {
        resolve = res;
    });
    return { promise, resolve };
}

describe("PricingCostCardsSection", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCostCards.mockResolvedValue({
            cards: [], menuItemsWithoutRecipe: [],
            costing: { componentsUsed: 0, componentsResolved: 0, coveragePercent: 100, warnings: [] },
        });
        mockComponents.mockResolvedValue([]);
    });

    describe("batch recipes", () => {
        // Doughs and sauces are not menu items, so they appear on no cost card -- and they are
        // where a good deal of the cost actually is.
        const dough: ComponentCost = {
            id: 9, name: "Dough", unit: "GRAMS", productId: null, productName: null,
            productPrice: null, cost: null, batchYield: 4854, resolvedUnitCost: 0.000117,
            costSource: "BATCH",
            ingredients: [
                {
                    id: 1, ingredientProductId: 26, ingredientProductName: "Pizza Flour",
                    ingredientComponentId: null, ingredientComponentName: null,
                    amount: 3000, lineCost: 0.39,
                },
            ],
        };
        const mozzarella: ComponentCost = {
            id: 10, name: "Mozarella", unit: "GRAMS", productId: 7, productName: "Mozarella",
            productPrice: 3, cost: null, batchYield: null, resolvedUnitCost: 0.003,
            costSource: "PRODUCT", ingredients: [],
        };

        const openBatches = async (): Promise<void> => {
            await openCard("🍕 Menu cost cards");
            await userEvent.click(await screen.findByRole("button", {name: "Batch recipes"}));
        };

        it("lists a component that is made from something", async () => {
            mockComponents.mockResolvedValue([dough, mozzarella]);

            render(<PricingCostCardsSection/>);
            await openBatches();

            expect(await screen.findByText("Dough")).toBeTruthy();
        });

        it("leaves out a component that is just a purchased price", async () => {
            // Mozzarella is bought, not made. Listing it under "recipes" would say it has one.
            mockComponents.mockResolvedValue([dough, mozzarella]);

            render(<PricingCostCardsSection/>);
            await openBatches();

            expect(screen.queryByText("Mozarella")).toBeNull();
        });

        it("shows the yield and the cost per kg rather than a per-gram figure", async () => {
            // 0.000117 per gram is unreadable; 0.117 per kg is the number the owner works in.
            mockComponents.mockResolvedValue([dough]);

            render(<PricingCostCardsSection/>);
            await openBatches();

            expect(await screen.findByText(/yields 4854 grams/)).toBeTruthy();
            expect(await screen.findByText(/0\.117 per kg/)).toBeTruthy();
        });

        it("says so plainly when nothing has a batch recipe yet", async () => {
            mockComponents.mockResolvedValue([mozzarella]);

            render(<PricingCostCardsSection/>);
            await openBatches();

            expect(await screen.findByText(/No batch recipes yet/)).toBeTruthy();
        });
    });

    describe("ingredient costs", () => {
        it("says nothing at all when every ingredient is costed", async () => {
            render(<PricingCostCardsSection/>);

            // Wait for both cost-card fetches to settle before asserting the badge is absent --
            // otherwise this would trivially pass before useCostCards() has had a chance to
            // compute uncostedCount from the (empty, in this suite's default mocks) data.
            await waitFor(() => expect(mockCostCards).toHaveBeenCalledTimes(1));
            await waitFor(() => expect(mockComponents).toHaveBeenCalledTimes(1));

            expect(screen.queryByText(/ingredients with no cost/)).toBeNull();
        });

        it("warns with the count when ingredients have no cost", async () => {
            mockComponents.mockResolvedValue([
                {
                    id: 5, name: "Oregano", unit: "GRAMS", productId: null, productName: null,
                    productPrice: null, cost: null, batchYield: null, ingredients: [],
                    resolvedUnitCost: 0, costSource: "MISSING",
                },
            ]);

            render(<PricingCostCardsSection/>);

            // Rides as a badge on the Menu cost cards header now, not a card of its own above
            // the report.
            expect(await screen.findByText(/1 ingredients with no cost/)).toBeTruthy();
        });
    });

    // Saving a cost from here must still trigger the Business Stats refresh — but only when the
    // caller (StatisticsComponent) handed one down, which it only does for OWNER. See
    // task-spec.md §4 item 12 and §6 step 4 of the Frontend algorithm.
    describe("saving a cost", () => {
        const oregano: ComponentCost = {
            id: 5, name: "Oregano", unit: "GRAMS", productId: null, productName: null,
            productPrice: null, cost: null, batchYield: null, ingredients: [],
            resolvedUnitCost: 0, costSource: "MISSING",
        };
        const basil: ComponentCost = { ...oregano, id: 6, name: "Basil" };

        const openDrawer = async (): Promise<void> => {
            const badge = await screen.findByText(/1 ingredients with no cost/);
            await userEvent.click(badge);
        };

        it("calls onCostSaved after the cost update resolves, when a callback was passed (OWNER)", async () => {
            mockComponents.mockResolvedValue([oregano]);
            mockUpdateComponentCost.mockResolvedValue({
                ...oregano, cost: 5, costSource: "MANUAL", resolvedUnitCost: 0.005,
            });
            const onCostSaved = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

            render(<PricingCostCardsSection onCostSaved={onCostSaved}/>);
            await openDrawer();

            await userEvent.type(await screen.findByLabelText("Cost for Oregano"), "5{Enter}");

            await waitFor(() => expect(mockUpdateComponentCost)
                .toHaveBeenCalledWith(5, {cost: 5, clearCost: false}));
            await waitFor(() => expect(onCostSaved).toHaveBeenCalledTimes(1));
        });

        it("releases the field once the cost is saved, without waiting for onCostSaved", async () => {
            // onCostSaved recomputes the whole Business Stats report; the drawer used to hold the
            // field (and the typed draft) until that finished.
            mockComponents.mockResolvedValue([oregano]);
            mockUpdateComponentCost.mockResolvedValue({
                ...oregano, cost: 5, costSource: "MANUAL", resolvedUnitCost: 0.005,
            });
            const onCostSaved = jest.fn<Promise<void>, []>().mockReturnValue(new Promise<void>(() => undefined));

            render(<PricingCostCardsSection onCostSaved={onCostSaved}/>);
            await openDrawer();
            await userEvent.type(await screen.findByLabelText("Cost for Oregano"), "5{Enter}");

            await waitFor(() => expect(onCostSaved).toHaveBeenCalledTimes(1));
            await waitFor(() => expect(costInput("Oregano").disabled).toBe(false));
        });

        it("saves once when Enter is pressed and the field is touched again while the save is in flight", async () => {
            // Enter used to save AND leave the field focused with the draft still in it, so the
            // blur that followed sent the same cost a second time.
            mockComponents.mockResolvedValue([oregano]);
            const save = deferred<ComponentCost>();
            mockUpdateComponentCost.mockReturnValue(save.promise);

            render(<PricingCostCardsSection/>);
            await openDrawer();
            await userEvent.type(await screen.findByLabelText("Cost for Oregano"), "5{Enter}");
            userEvent.click(costInput("Oregano"));
            userEvent.tab();

            expect(costInput("Oregano").value).toBe("5");
            await act(async () => save.resolve({ ...oregano, cost: 5, costSource: "MANUAL", resolvedUnitCost: 0.005 }));

            await waitFor(() => expect(costInput("Oregano").disabled).toBe(false));
            expect(mockUpdateComponentCost).toHaveBeenCalledTimes(1);
            expect(mockUpdateComponentCost).toHaveBeenCalledWith(5, {cost: 5, clearCost: false});
        });

        it("sends nothing when the field is left with the stored cost in it", async () => {
            // Basil only keeps the "no cost" badge, the way into the drawer, on screen.
            mockComponents.mockResolvedValue([{ ...oregano, cost: 5, costSource: "MANUAL" }, basil]);

            render(<PricingCostCardsSection/>);
            await openDrawer();
            userEvent.click(await screen.findByLabelText("Cost for Oregano"));
            userEvent.tab();
            userEvent.clear(costInput("Oregano"));
            await userEvent.type(costInput("Oregano"), "5.000{Enter}");

            expect(mockUpdateComponentCost).not.toHaveBeenCalled();
            expect(costInput("Oregano").value).toBe("5");
        });

        it("reads a comma as the decimal point", async () => {
            mockComponents.mockResolvedValue([oregano]);
            mockUpdateComponentCost.mockResolvedValue({
                ...oregano, cost: 12.5, costSource: "MANUAL", resolvedUnitCost: 0.0125,
            });

            render(<PricingCostCardsSection/>);
            await openDrawer();
            await userEvent.type(await screen.findByLabelText("Cost for Oregano"), "12,5{Enter}");

            await waitFor(() => expect(mockUpdateComponentCost)
                .toHaveBeenCalledWith(5, {cost: 12.5, clearCost: false}));
        });

        it("keeps what was typed and says so when the input is not a number, instead of dropping it", async () => {
            mockComponents.mockResolvedValue([oregano]);

            render(<PricingCostCardsSection/>);
            await openDrawer();
            await userEvent.type(await screen.findByLabelText("Cost for Oregano"), "abc{Enter}");

            expect(await screen.findByText("Not saved: the cost is not a number.")).toBeTruthy();
            expect(costInput("Oregano").value).toBe("abc");
            expect(mockUpdateComponentCost).not.toHaveBeenCalled();
        });

        it("refuses a negative cost", async () => {
            mockComponents.mockResolvedValue([oregano]);

            render(<PricingCostCardsSection/>);
            await openDrawer();
            await userEvent.type(await screen.findByLabelText("Cost for Oregano"), "-3{Enter}");

            expect(await screen.findByText("Not saved: the cost cannot be negative.")).toBeTruthy();
            expect(mockUpdateComponentCost).not.toHaveBeenCalled();
        });

        it("keeps the typed cost and says why when the server refuses it", async () => {
            // The hook used to swallow the failure, so the drawer dropped the draft and showed the
            // old cost again as if it had been saved.
            mockComponents.mockResolvedValue([oregano]);
            mockUpdateComponentCost.mockRejectedValue(new Error("the server had a problem — try again in a minute"));
            const onCostSaved = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

            render(<PricingCostCardsSection onCostSaved={onCostSaved}/>);
            await openDrawer();
            await userEvent.type(await screen.findByLabelText("Cost for Oregano"), "5{Enter}");

            expect(await screen.findByText("Not saved: the server had a problem — try again in a minute")).toBeTruthy();
            expect(costInput("Oregano").value).toBe("5");
            expect(costInput("Oregano").disabled).toBe(false);
            expect(onCostSaved).not.toHaveBeenCalled();
        });

        it("saves and refreshes locally without error when no onCostSaved was passed (MANAGER/SUPER_MANAGER)", async () => {
            // StatisticsComponent hands down undefined for these roles so the OWNER-only report
            // endpoint is never hit. The save itself must still complete and the drawer must still
            // reflect the new cost.
            mockComponents.mockResolvedValue([oregano]);
            mockUpdateComponentCost.mockResolvedValue({
                ...oregano, cost: 5, costSource: "MANUAL", resolvedUnitCost: 0.005,
            });

            render(<PricingCostCardsSection/>);
            await openDrawer();

            await userEvent.type(await screen.findByLabelText("Cost for Oregano"), "5{Enter}");

            await waitFor(() => expect(mockUpdateComponentCost)
                .toHaveBeenCalledWith(5, {cost: 5, clearCost: false}));
            // setComponentCost refetches both cost-card sources on a successful save (mount fetch
            // + this refetch = 2 calls each), proving the save flow ran to completion locally
            // with no callback to await.
            await waitFor(() => expect(mockComponents).toHaveBeenCalledTimes(2));
            expect(mockCostCards).toHaveBeenCalledTimes(2);
        });
    });
});
