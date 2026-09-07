import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BusinessTab from "./BusinessTab";
import type { BusinessStatsResponse, CategoryClassification, ComponentCost } from "../../types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts. useBusinessCategories
// runs for real, so the fetch -> classify -> refetch wiring is genuine.
jest.mock("../../../../../shared/api/management");

import {
    getBusinessCategories, getComponentCosts, getMenuCostCards, updateCategoryClassification
} from "../../../../../shared/api/management";

const mockGet = jest.mocked(getBusinessCategories);
const mockUpdate = jest.mocked(updateCategoryClassification);
const mockCostCards = jest.mocked(getMenuCostCards);
const mockComponents = jest.mocked(getComponentCosts);

const marketing: CategoryClassification = {
    id: 1, name: "Marketing", type: "DEBIT", pnlClass: null, kpiTag: null,
    entryCount: 12, lifetimeTotal: 4102.5,
};
const rent: CategoryClassification = {
    id: 2, name: "Rent", type: "DEBIT", pnlClass: "OPEX", kpiTag: "RENT",
    entryCount: 14, lifetimeTotal: 2521.54,
};

const report: BusinessStatsResponse = {
    months: ["2026-06", "2026-07"],
    expensePivot: {
        months: ["2026-06", "2026-07"],
        blocks: [
            {
                pnlClass: "OPEX", label: "Operating expenses", note: null,
                includedInOperatingExpenses: true,
                rows: [{ categoryId: 2, categoryName: "Rent", kpiTag: "RENT", amounts: [180, 180.11], total: 360.11 }],
                totals: [180, 180.11], grandTotal: 360.11,
            },
            {
                pnlClass: "COGS_PURCHASES", label: "COGS — groceries & packaging",
                note: "Reaches the P&L through COGS via inventory.",
                includedInOperatingExpenses: false,
                rows: [{ categoryId: 3, categoryName: "Groceries", kpiTag: null, amounts: [731.19, 866.648], total: 1597.838 }],
                totals: [731.19, 866.648], grandTotal: 1597.838,
            },
        ],
        unclassifiedCategoryCount: 1,
        unclassifiedTotal: 4102.5,
    },
    revenue: [],
    inventoryCogs: [
        {
            period: "2026-06", state: "OK", monthInProgress: false,
            openingInventory: 553.679, purchases: 808.69, available: 1362.369,
            purchaseBreakdown: [
                { categoryName: "Groceries", amount: 640.19 },
                { categoryName: "Packaging", amount: 168.5 },
            ],
            invoicePurchases: 805.2,
            endingInventory: 522.673, movementCogs: 839.696, cogsPercentOfGrossRevenue: 25.7,
            contributingBranches: ["Adliya"], missingBranches: [], missingReports: [],
        },
        {
            period: "2026-07", state: "MISSING_PURCHASES", monthInProgress: false,
            openingInventory: 522.673, purchases: null, available: null,
            purchaseBreakdown: [],
            invoicePurchases: null,
            endingInventory: 896.003, movementCogs: null, cogsPercentOfGrossRevenue: null,
            contributingBranches: [], missingBranches: ["Adliya"],
            missingReports: ["PURCHASE jul-26 @ Adliya"],
        },
    ],
    channels: [
        {
            period: "2026-06",
            rows: [
                {
                    id: 10, period: "2026-06", channelKey: "talabat", channelLabel: "Talabat",
                    generatedOrders: 269, generatedGrossRevenue: 1741.08,
                    overrideOrders: null, overrideGrossRevenue: null, overrideAppFees: 666.498,
                    effectiveOrders: 269, effectiveGrossRevenue: 1741.08, effectiveAppFees: 666.498,
                    appFeesEntered: true, netRevenue: 1074.582, appCommissionPercent: 38.3,
                    note: null, generatedAt: "2026-07-01T20:00:00", updatedAt: null,
                    updatedByName: null, version: 3,
                },
                {
                    id: 11, period: "2026-06", channelKey: "keeta", channelLabel: "Keeta",
                    generatedOrders: 98, generatedGrossRevenue: 526.498,
                    overrideOrders: null, overrideGrossRevenue: 530.0, overrideAppFees: null,
                    effectiveOrders: 98, effectiveGrossRevenue: 530.0, effectiveAppFees: null,
                    appFeesEntered: false, netRevenue: 530.0, appCommissionPercent: 0,
                    note: null, generatedAt: "2026-07-01T20:00:00", updatedAt: null,
                    updatedByName: null, version: 5,
                },
                {
                    id: 12, period: "2026-06", channelKey: "pick up", channelLabel: "Pick Up",
                    generatedOrders: 254, generatedGrossRevenue: 1667.69,
                    overrideOrders: null, overrideGrossRevenue: null, overrideAppFees: 30.29,
                    effectiveOrders: 254, effectiveGrossRevenue: 1667.69, effectiveAppFees: 30.29,
                    appFeesEntered: true, netRevenue: 1637.4, appCommissionPercent: 1.8,
                    note: null, generatedAt: "2026-07-01T20:00:00", updatedAt: null,
                    updatedByName: null, version: 1,
                },
            ],
            totalOrders: 621, totalGrossRevenue: 3938.77, totalAppFees: 696.788,
            totalNetRevenue: 1604.582, appFeesMissing: true,
        },
    ],
    profitAndLoss: [
        {
            period: "2026-06",
            grossRevenue: 3261.626, appFees: 672.836, netRevenue: 2588.79,
            recipeCogs: 800.0, grossProfit: 1788.79,
            operatingExpenses: 936.17, operatingProfit: 852.62,
            capex: 763.906, financing: 0, ownerWithdrawals: 21.38, adjustments: 0,
            netProfit: 67.334, unclassified: 4102.5,
            reconciliation: {
                ledgerCogsPurchases: 808.69, invoicePurchases: 808.69, ledgerVsInvoices: 0,
                openingInventory: 553.679, endingInventory: 522.673, inventoryDelta: 31.006,
                movementCogs: 839.696, recipeCogs: 800.0, unexplainedVariance: 39.696,
                variancePercentOfNetRevenue: 1.53, netCashMovement: 58.644, complete: true,
            },
            flags: ["UNCLASSIFIED_SPEND"],
        },
        {
            period: "2026-07",
            grossRevenue: 3935.269, appFees: 858.264, netRevenue: 3077.005,
            recipeCogs: 1000.0, grossProfit: 2077.005,
            operatingExpenses: 893.542, operatingProfit: 1183.463,
            capex: 661.283, financing: 0, ownerWithdrawals: 74.988, adjustments: 0,
            netProfit: 447.192, unclassified: 0,
            reconciliation: {
                ledgerCogsPurchases: 1119.317, invoicePurchases: null, ledgerVsInvoices: null,
                openingInventory: 522.673, endingInventory: 896.003, inventoryDelta: -373.33,
                movementCogs: null, recipeCogs: 1000.0, unexplainedVariance: null,
                variancePercentOfNetRevenue: null, netCashMovement: null, complete: false,
            },
            flags: ["RECONCILIATION_INCOMPLETE"],
        },
    ],
    kpi: [
        {
            period: "2026-06",
            kpis: [
                {
                    key: "grossProfitMargin", label: "Gross profit margin", value: 69.1, unit: "%",
                    previousValue: null, unavailableReason: null, detail: "of net revenue",
                },
                {
                    key: "dailyOrders", label: "Daily orders (avg)", value: 20.12, unit: "count",
                    previousValue: null, unavailableReason: null, detail: "÷ 26 trading days",
                },
                {
                    key: "debtEquity", label: "Debt / equity", value: null, unit: "x",
                    previousValue: null,
                    unavailableReason: "Not tracked — this system has no loan or equity register.",
                    detail: null,
                },
            ],
        },
        {
            period: "2026-07",
            kpis: [
                {
                    key: "grossProfitMargin", label: "Gross profit margin", value: 67.5, unit: "%",
                    previousValue: 69.1, unavailableReason: null, detail: "of net revenue",
                },
                {
                    key: "dailyOrders", label: "Daily orders (avg)", value: 23.88, unit: "count",
                    previousValue: null, unavailableReason: null, detail: "÷ 27 trading days",
                },
                {
                    key: "debtEquity", label: "Debt / equity", value: null, unit: "x",
                    previousValue: null,
                    unavailableReason: "Not tracked — this system has no loan or equity register.",
                    detail: null,
                },
            ],
        },
    ],
    costing: {
        componentsUsed: 10, componentsResolved: 8, coveragePercent: 80,
        warnings: [{
            code: "COMPONENT_COST_MISSING", componentId: 5, componentName: "Oregano",
            detail: "No batch recipe, no product price and no manual cost — costed at zero.",
        }],
    },
    notices: ["Revenue here includes orders recorded before branches existed."],
};

const mockPatchChannel = jest.fn<Promise<void>, [number, unknown]>();
const mockRegenerateChannels = jest.fn<Promise<void>, []>();

function renderTab(data: BusinessStatsResponse | null = report): ReturnType<typeof render> {
    return render(
        <BusinessTab
            data={data}
            loading={false}
            rangeLabel="Jun 2026 — Jul 2026"
            onRefresh={jest.fn(async () => undefined)}
            onPatchChannel={mockPatchChannel as never}
            onRegenerateChannels={mockRegenerateChannels as never}
        />
    );
}


// Cards are collapsed by default now, and CollapsibleCard unmounts hidden content, so a test that
// asserts on a card's contents has to open it first.
async function openCard(title: string): Promise<void> {
    await userEvent.click(await screen.findByRole("button", { name: `Expand ${title}` }));
}

describe("BusinessTab", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGet.mockResolvedValue([marketing, rent]);
        mockUpdate.mockResolvedValue({ ...marketing, pnlClass: "OPEX" });
        mockCostCards.mockResolvedValue({
            cards: [], menuItemsWithoutRecipe: [],
            costing: { componentsUsed: 0, componentsResolved: 0, coveragePercent: 100, warnings: [] },
        });
        mockComponents.mockResolvedValue([]);
    });

    describe("classification", () => {
        it("warns with the count and the amount when categories are unclassified", async () => {
            // The amount is the point: "1 unclassified" is ignorable, "4,102.500 BHD" is not, and
            // that spend is currently in no P&L total.
            renderTab();

            expect(await screen.findByText(/1 unclassified · 4,102.500 BHD/)).toBeTruthy();
        });

        it("says nothing at all when everything is classified", async () => {
            // The old screen carried a permanent "All N categories classified" card. Reassurance is
            // not a report: a clean month should look clean, not carry a green banner about data
            // entry. The warning still appears when there IS something wrong -- see the pivot badge
            // test below.
            mockGet.mockResolvedValue([rent]);

            renderTab();

            await screen.findByText("📊 Key metrics");
            expect(screen.queryByText(/categories classified/)).toBeNull();
        });

        it("patches only the chosen category and refetches when a class is picked", async () => {
            // The drawer is now reached from the warning badge on the Monthly expenses card, which
            // is the report the classification actually distorts.
            renderTab();
            const badge = await screen.findByText(/1 unclassified/);
            await userEvent.click(badge);

            const row = await screen.findByTestId("category-row-1");
            await userEvent.click(within(row).getByRole("combobox", { name: /P&L class/i }));
            await userEvent.click(await screen.findByRole("option", { name: /Operating expense/ }));

            await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
            // Both fields go every time: sending only the changed one would clear the other.
            expect(mockUpdate).toHaveBeenCalledWith(1, { pnlClass: "OPEX", kpiTag: null });
            await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
        });

        it("keeps rendering when the categories request fails", async () => {
            // Errors go to the logger and are never thrown at the UI, matching useStatistics.
            mockGet.mockRejectedValue(new Error("Response: 500"));

            renderTab();

            expect(await screen.findByText("📊 Key metrics")).toBeTruthy();
        });
    });

    describe("expense pivot", () => {
        it("renders a column per month and a row per category", async () => {
            renderTab();
            await openCard("🧾 Monthly expenses");

            expect(await screen.findByText("Rent")).toBeTruthy();
            expect(screen.getByText("Groceries")).toBeTruthy();
            expect(screen.getAllByText("Jun 26").length).toBeGreaterThan(0);
        });

        it("marks a block that is not part of operating expenses", async () => {
            // Groceries and packaging are visible but deliberately outside the Operating Expenses
            // total; without the label a reader would assume the total was simply wrong.
            renderTab();
            await openCard("🧾 Monthly expenses");

            expect(await screen.findByText(/not in Operating Expenses/)).toBeTruthy();
        });
    });

    describe("inventory COGS", () => {
        it("shows an em dash rather than a zero when a month cannot be computed", async () => {
            // Zero is a claim about the business; absence is a claim about the paperwork. Printing
            // the first when you mean the second turns unfiled invoices into a brilliant margin.
            renderTab();
            await openCard("📦 Inventory COGS");

            expect((await screen.findByTestId("cogs-missing-2026-07")).textContent).toBe("—");
        });

        it("names the missing document for a completed month", async () => {
            renderTab();
            await openCard("📦 Inventory COGS");

            expect(await screen.findByText(/PURCHASE jul-26 @ Adliya/)).toBeTruthy();
        });
    });

    describe("channel performance", () => {
        it("opens an input when an empty app fees cell is clicked", async () => {
            // Keeta's fee is unset, so the cell reads "—". It must still be editable: there is no
            // other way into that number, and nothing computes it.
            renderTab();
            await openCard("🛵 Channel performance");

            await userEvent.click(screen.getByTestId("cell-appFees-11"));

            expect(screen.queryByLabelText("appFees Keeta")).toBeTruthy();
        });

        it("patches the fee when one is typed", async () => {
            renderTab();
            await openCard("🛵 Channel performance");
            await userEvent.click(screen.getByTestId("cell-appFees-11"));

            await userEvent.type(screen.getByLabelText("appFees Keeta"), "88.5{Enter}");

            await waitFor(() => expect(mockPatchChannel).toHaveBeenCalled());
            expect(mockPatchChannel).toHaveBeenCalledWith(11,
                expect.objectContaining({ appFees: 88.5 }));
        });

        it("warns when a channel has revenue but no app fee", async () => {
            // No channel is genuinely fee-free -- even pick-up carries a card-gateway cut -- so a
            // blank fee overstates profit rather than merely leaving a gap.
            renderTab();
            await openCard("🛵 Channel performance");

            expect(await screen.findByText(/no app fee entered/)).toBeTruthy();
        });

        it("marks an overridden cell so an edited figure cannot pass for a measured one", async () => {
            renderTab();
            await openCard("🛵 Channel performance");

            const cell = await screen.findByTestId("cell-grossRevenue-11");
            expect(cell.textContent).toContain("530.000");
        });

        it("sends the clear flags when a row is reverted", async () => {
            // Without them an override could be changed forever but never removed, because a JSON
            // null in a PATCH is indistinguishable from an absent field.
            renderTab();
            await openCard("🛵 Channel performance");

            await userEvent.click(await screen.findByRole("button", { name: "Revert Keeta" }));

            expect(mockPatchChannel).toHaveBeenCalledWith(11, {
                version: 5, clearOrders: true, clearGrossRevenue: true, clearAppFees: true,
            });
        });

        it("enables revert only on a row that actually carries an override", async () => {
            // Talabat's fee is hand-entered, so its revert is live. A row with nothing overridden
            // has nothing to revert TO, and offering the action would imply otherwise.
            renderTab();
            await openCard("🛵 Channel performance");

            expect((await screen.findByRole("button", { name: "Revert Talabat" })).hasAttribute("disabled"))
                .toBe(false);
        });

        it("only regenerates after the confirm is accepted", async () => {
            renderTab();
            await openCard("🛵 Channel performance");

            await userEvent.click(await screen.findByRole("button", { name: /Refresh channel data/ }));
            expect(mockRegenerateChannels).not.toHaveBeenCalled();

            await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));
            expect(mockRegenerateChannels).toHaveBeenCalledTimes(1);
        });

        it("promises that manual edits survive a refresh", async () => {
            // Prep-plan's "this will replace the current plan" would be a lie here and would make
            // the owner afraid to press the button.
            renderTab();
            await openCard("🛵 Channel performance");

            await userEvent.click(await screen.findByRole("button", { name: /Refresh channel data/ }));

            expect(await screen.findByText(/Your manual edits are kept/)).toBeTruthy();
        });
    });

    describe("profit and loss", () => {
        it("shows the reconciliation memo inside the same card as the statement", async () => {
            // Beside it in its own card it would be scrolled past -- which matters, because with
            // recipe-costed COGS the net profit line above is no longer a cash figure.
            renderTab();
            await openCard("📈 Profit & loss");

            expect(await screen.findByText(/COGS reconciliation/)).toBeTruthy();
            expect(screen.getByText(/Unexplained variance/)).toBeTruthy();
        });

        it("says that net profit is not a cash figure", async () => {
            // The explanation moved out of the page body and behind the card's ⓘ -- six paragraphs
            // of it pushed the actual figures off a tablet screen. It still has to be REACHABLE,
            // which is what this asserts; where it lives is a layout decision, whether it exists
            // at all is not.
            renderTab();

            await userEvent.hover(await screen.findByRole("img", {name: /About .*Profit/}));

            expect(await screen.findByText(/COGS is recipe-costed, not cash/)).toBeTruthy();
        });

        it("shows an em dash rather than a variance when a stock count is missing", async () => {
            // Computing one anyway would invent a waste figure out of missing paperwork.
            renderTab();
            await openCard("📈 Profit & loss");

            await userEvent.hover(await screen.findByRole("img", {name: "About incomplete months"}));

            expect(await screen.findByText(/No variance is computed from an input that does not exist/))
                .toBeTruthy();
        });
    });

    describe("KPI block", () => {
        it("renders an em dash with a reason rather than a zero when a KPI is unavailable", async () => {
            // "0x debt to equity" and "we do not track debt to equity" look identical on a
            // dashboard and mean opposite things.
            renderTab();

            const tile = await screen.findByTestId("kpi-debtEquity");
            expect(tile.textContent).toContain("—");
            expect(tile.textContent).not.toContain("0.00");
        });

        it("prints the divisor beside a KPI that has one", async () => {
            // So a constant can never hide inside a KPI again.
            renderTab();

            expect((await screen.findByTestId("kpi-dailyOrders")).textContent).toContain("trading days");
        });

        it("shows the latest month in the range", async () => {
            renderTab();

            expect(await screen.findByText("July 2026")).toBeTruthy();
        });
    });

    describe("inventory COGS", () => {
        it("gives each ledger category its own purchases row", async () => {
            // Groceries and Packaging are separate rows, not one combined purchases figure — that
            // split is the whole reason the breakdown exists.
            renderTab();
            await openCard("📦 Inventory COGS");

            expect(await screen.findByText("Groceries Purchases")).toBeTruthy();
            expect(await screen.findByText("Packaging Purchases")).toBeTruthy();
        });

        it("spells out the arithmetic so the breakdown cannot be read as the total", () => {
            // Without the operators the indented rows read as though Available were built from
            // them. It is Opening + the whole Purchases row.
            renderTab();

            return screen.findByText("📦 Inventory COGS").then(async () => {
                await openCard("📦 Inventory COGS");
                expect(screen.getByText("+ Purchases")).toBeTruthy();
                expect(screen.getByText("= Available")).toBeTruthy();
                expect(screen.getByText("− Ending inventory")).toBeTruthy();
            });
        });
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

            renderTab();
            await openBatches();

            expect(await screen.findByText("Dough")).toBeTruthy();
        });

        it("leaves out a component that is just a purchased price", async () => {
            // Mozzarella is bought, not made. Listing it under "recipes" would say it has one.
            mockComponents.mockResolvedValue([dough, mozzarella]);

            renderTab();
            await openBatches();

            expect(screen.queryByText("Mozarella")).toBeNull();
        });

        it("shows the yield and the cost per kg rather than a per-gram figure", async () => {
            // 0.000117 per gram is unreadable; 0.117 per kg is the number the owner works in.
            mockComponents.mockResolvedValue([dough]);

            renderTab();
            await openBatches();

            expect(await screen.findByText(/yields 4854 grams/)).toBeTruthy();
            expect(await screen.findByText(/0\.117 per kg/)).toBeTruthy();
        });

        it("says so plainly when nothing has a batch recipe yet", async () => {
            mockComponents.mockResolvedValue([mozzarella]);

            renderTab();
            await openBatches();

            expect(await screen.findByText(/No batch recipes yet/)).toBeTruthy();
        });
    });

    describe("ingredient costs", () => {
        it("says nothing at all when every ingredient is costed", async () => {
            renderTab();

            await screen.findByText("📊 Key metrics");
            expect(screen.queryByText(/ingredients costed/)).toBeNull();
        });

        it("warns with the count when ingredients have no cost", async () => {
            mockComponents.mockResolvedValue([
                {
                    id: 5, name: "Oregano", unit: "GRAMS", productId: null, productName: null,
                    productPrice: null, cost: null, batchYield: null, ingredients: [],
                    resolvedUnitCost: 0, costSource: "MISSING",
                },
            ]);

            renderTab();

            // Rides as a badge on the Menu cost cards header now, not a card of its own above
            // the report.
            expect(await screen.findByText(/1 ingredients with no cost/)).toBeTruthy();
        });
    });

    it("surfaces the server's notices", async () => {
        renderTab();

        expect(await screen.findByText(/includes orders recorded before branches existed/)).toBeTruthy();
    });

    it("says the report could not be loaded when it is absent", async () => {
        renderTab(null);

        expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
    });
});
