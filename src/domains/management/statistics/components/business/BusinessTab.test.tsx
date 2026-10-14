import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BusinessTab from "./BusinessTab";
import type { BusinessStatsResponse, CategoryClassification, ChannelField } from "../../types";
import { PreResponseNetworkError } from "../../../../../shared/api/client";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts. useBusinessCategories
// runs for real, so the fetch -> classify -> report refresh wiring is genuine.
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
            // First, as the server sends it (REVENUE is the first PnlClass), and signed negative
            // because the pivot treats a credit as a negative cost.
            {
                pnlClass: "REVENUE", label: "Revenue (ledger)",
                note: "Shown for reconciliation only — the P&L takes revenue from orders, not from the ledger.",
                includedInOperatingExpenses: false,
                rows: [
                    { categoryId: 13, categoryName: "Business Income", kpiTag: null, amounts: [-3000.5, -3500], total: -6500.5 },
                    { categoryId: 14, categoryName: "Gateway payouts", kpiTag: null, amounts: [-120, 0], total: -120 },
                ],
                totals: [-3120.5, -3500], grandTotal: -6620.5,
            },
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
            operatingExpenses: 936.17, notApplicable: 0, operatingProfit: 852.62,
            capex: 763.906, financing: 0, ownerWithdrawals: 21.38, adjustments: 0,
            netProfit: 67.334, unclassified: 4102.5,
            reconciliation: {
                ledgerCogsPurchases: 808.69, invoicePurchases: 808.69, ledgerVsInvoices: 0,
                openingInventory: 553.679, endingInventory: 522.673, inventoryDelta: 31.006,
                movementCogs: 839.696, recipeCogs: 800.0, unexplainedVariance: 39.696,
                variancePercentOfGrossRevenue: 1.53, netCashMovement: 58.644, complete: true,
            },
            flags: ["UNCLASSIFIED_SPEND"],
        },
        {
            period: "2026-07",
            grossRevenue: 3935.269, appFees: 858.264, netRevenue: 3077.005,
            recipeCogs: 1000.0, grossProfit: 2077.005,
            operatingExpenses: 893.542, notApplicable: 0, operatingProfit: 1183.463,
            capex: 661.283, financing: 0, ownerWithdrawals: 74.988, adjustments: 0,
            netProfit: 447.192, unclassified: 0,
            reconciliation: {
                ledgerCogsPurchases: 1119.317, invoicePurchases: null, ledgerVsInvoices: null,
                openingInventory: 522.673, endingInventory: 896.003, inventoryDelta: -373.33,
                movementCogs: null, recipeCogs: 1000.0, unexplainedVariance: null,
                variancePercentOfGrossRevenue: null, netCashMovement: null, complete: false,
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
                    key: "tradingDays", label: "Trading days", value: 23, unit: "days",
                    previousValue: null, unavailableReason: null, detail: "days with a shift opening or orders",
                },
                {
                    key: "grossProfitMargin", label: "Gross profit margin", value: 67.5, unit: "%",
                    previousValue: 69.1, unavailableReason: null, detail: "of net revenue",
                },
                {
                    key: "dailyOrders", label: "Daily orders (avg)", value: 23.88, unit: "count",
                    previousValue: null, unavailableReason: null, detail: "÷ 27 trading days",
                },
                {
                    key: "primeCost", label: "Prime cost", value: 1250.5, unit: "BD",
                    previousValue: null, unavailableReason: null, detail: "recipe-costed COGS + labour",
                },
                {
                    key: "primeCostPercent", label: "Prime cost %", value: 31.78, unit: "%",
                    previousValue: null, unavailableReason: null, detail: "of gross revenue",
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

const mockRefresh = jest.fn<Promise<void>, []>();
const mockSaveChannelCell = jest.fn<void, [string, string, ChannelField, number | null]>();
const mockRevertChannelRow = jest.fn<void, [string, string]>();
const mockDismissChannelSaveError = jest.fn<void, []>();

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T>(): Deferred<T> {
    let resolve: (value: T) => void = () => undefined;
    const promise = new Promise<T>(res => {
        resolve = res;
    });
    return { promise, resolve };
}

function renderTab(
    data: BusinessStatsResponse | null = report,
    channelSaveError: string | null = null
): ReturnType<typeof render> {
    return render(
        <BusinessTab
            data={data}
            loading={false}
            onRefresh={mockRefresh}
            channelSaving={new Set()}
            channelErrors={new Map()}
            channelSaveError={channelSaveError}
            onSaveChannelCell={mockSaveChannelCell}
            onRevertChannelRow={mockRevertChannelRow}
            onDismissChannelSaveError={mockDismissChannelSaveError}
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
        mockRefresh.mockResolvedValue(undefined);
        // Inventory COGS embeds the menu cost cards; without these the factoryless mock returns
        // undefined and the card crashes on data.cards.
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

        describe("in the drawer", () => {
            // The drawer is reached from the warning badge on the Monthly expenses card, which is
            // the report the classification actually distorts.
            async function openDrawer(): Promise<void> {
                renderTab();
                await userEvent.click(await screen.findByText(/1 unclassified/));
            }

            function picker(rowId: number, name: RegExp): HTMLElement {
                return within(screen.getByTestId(`category-row-${rowId}`)).getByRole("combobox", { name });
            }

            async function pick(rowId: number, name: RegExp, option: RegExp): Promise<void> {
                await userEvent.click(picker(rowId, name));
                await userEvent.click(await screen.findByRole("option", { name: option }));
            }

            function rowOrder(): string[] {
                return screen.getAllByTestId(/^category-row-/).map(row => row.getAttribute("data-testid") ?? "");
            }

            it("patches only the chosen category and puts the server's copy in place, without refetching the list", async () => {
                // The server re-sorts the list (unclassified first), so a refetch after every pick
                // moved the row just classified out from under the cursor.
                mockGet.mockResolvedValueOnce([marketing, rent]).mockResolvedValue([rent, { ...marketing, pnlClass: "OPEX" }]);
                await openDrawer();

                await pick(1, /P&L class/i, /Operating expense/);

                await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
                // Both fields go every time: sending only the changed one would clear the other.
                expect(mockUpdate).toHaveBeenCalledTimes(1);
                expect(mockUpdate).toHaveBeenCalledWith(1, { pnlClass: "OPEX", kpiTag: null });
                expect(mockGet).toHaveBeenCalledTimes(1);
                expect(rowOrder()).toEqual(["category-row-1", "category-row-2"]);
                expect(picker(1, /P&L class/i).textContent).toMatch(/Operating expense/);
            });

            it("shows the picked class at once and locks only that row until the server answers", async () => {
                const save = deferred<CategoryClassification>();
                mockUpdate.mockReturnValue(save.promise);
                await openDrawer();

                await pick(1, /P&L class/i, /Operating expense/);

                expect(picker(1, /P&L class/i).textContent).toMatch(/Operating expense/);
                expect(picker(1, /P&L class/i).getAttribute("aria-disabled")).toBe("true");
                expect(picker(1, /KPI tag/i).getAttribute("aria-disabled")).toBe("true");
                expect(picker(2, /P&L class/i).getAttribute("aria-disabled")).toBeNull();

                await act(async () => save.resolve({ ...marketing, pnlClass: "OPEX" }));

                await waitFor(() => expect(picker(1, /KPI tag/i).getAttribute("aria-disabled")).toBeNull());
                expect(picker(1, /P&L class/i).textContent).toMatch(/Operating expense/);
            });

            it("sends the class just saved when the KPI tag is picked next, not the class the row loaded with", async () => {
                // The old drawer built the body from its stale prop, so this second pick sent
                // pnlClass: null and quietly undid the first one.
                await openDrawer();
                await pick(1, /P&L class/i, /Operating expense/);
                await waitFor(() => expect(picker(1, /KPI tag/i).getAttribute("aria-disabled")).toBeNull());

                mockUpdate.mockResolvedValue({ ...marketing, pnlClass: "OPEX", kpiTag: "MARKETING" });
                await pick(1, /KPI tag/i, /Marketing \(drives MER\)/);

                await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
                expect(mockUpdate).toHaveBeenLastCalledWith(1, { pnlClass: "OPEX", kpiTag: "MARKETING" });
            });

            it("puts the row back and says why when the save is refused", async () => {
                mockUpdate.mockRejectedValue(new Error("the server had a problem — try again in a minute"));
                await openDrawer();

                await pick(1, /P&L class/i, /Operating expense/);

                expect(await screen.findByText(
                    "Couldn't save “Marketing”: the server had a problem — try again in a minute")).toBeTruthy();
                expect(picker(1, /P&L class/i).textContent).not.toMatch(/Operating expense/);
                expect(within(screen.getByTestId("category-row-1")).getByText("Unclassified")).toBeTruthy();
                expect(picker(1, /P&L class/i).getAttribute("aria-disabled")).toBeNull();
                expect(mockRefresh).not.toHaveBeenCalled();
            });

            it("says the connection dropped, not the browser's 'Failed to fetch', when the save never reached the server", async () => {
                mockUpdate.mockRejectedValue(new PreResponseNetworkError(new TypeError("Failed to fetch")));
                await openDrawer();

                await pick(1, /P&L class/i, /Operating expense/);

                expect(await screen.findByText(
                    "Couldn't save “Marketing”: no connection to the server — check the internet and try again"))
                    .toBeTruthy();
            });

            it("unlocks the row as soon as the save answers, without waiting for the report to refresh", async () => {
                // The report refresh recomputes every month of the report; the drawer must not
                // hold a row that is already saved while it runs.
                mockRefresh.mockReturnValue(new Promise<void>(() => undefined));
                await openDrawer();

                await pick(1, /P&L class/i, /Operating expense/);

                await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
                await waitFor(() => expect(picker(1, /KPI tag/i).getAttribute("aria-disabled")).toBeNull());
                expect(screen.getByTestId("category-row-1").getAttribute("aria-busy")).toBe("false");
            });
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

        it("no longer lists business income, and counts only the expense blocks", async () => {
            renderTab();

            expect(await screen.findByText("2 blocks")).toBeTruthy();
            await openCard("🧾 Monthly expenses");

            expect(await screen.findByText("Rent")).toBeTruthy();
            expect(screen.queryByText("Business Income")).toBeNull();
            expect(screen.queryByText("Revenue (ledger)")).toBeNull();
        });
    });

    describe("N/A", () => {
        const naBlock = {
            pnlClass: "NOT_APPLICABLE" as const, label: "N/A",
            note: "Counted as an expense above Operating Profit, but not part of Operating Expenses, COGS or Prime Cost.",
            includedInOperatingExpenses: false,
            rows: [{ categoryId: 41, categoryName: "N/A", kpiTag: null, amounts: [25.5, 0], total: 25.5 }],
            totals: [25.5, 0], grandTotal: 25.5,
        };
        const naCategory: CategoryClassification = {
            ...marketing, id: 41, name: "N/A", pnlClass: null,
        };

        it("shows an N/A row between operating expenses and operating profit, negative like the other costs", async () => {
            const withNa: BusinessStatsResponse = {
                ...report,
                profitAndLoss: report.profitAndLoss.map((m, i) => i === 0 ? { ...m, notApplicable: 25.5 } : m),
            };
            renderTab(withNa);
            await openCard("📈 Profit & loss");

            const labelOf = (row: HTMLElement): string | null => row.querySelector("td, th")?.textContent ?? null;
            const rows = (await screen.findAllByRole("row")).map(labelOf);
            const na = rows.indexOf("N/A");
            expect(na).toBeGreaterThan(-1);
            expect(rows[na - 1]).toBe("Operating expenses");
            expect(rows[na + 1]).toBe("Operating profit (EBITDA)");
            const row = screen.getAllByRole("row")[na];
            expect(within(row).getAllByRole("cell")[1].textContent).toBe("-25.500");
        });

        it("explains in the Profit & loss info that N/A is subtracted before operating profit", async () => {
            renderTab();

            await userEvent.hover(await screen.findByRole("img", { name: "About 📈 Profit & loss" }));

            expect(await screen.findByText(/N\/A is subtracted before operating profit, but is not part of operating expenses\./)).toBeTruthy();
            expect(screen.getByText(/Net profit is a cash view with one exception/)).toBeTruthy();
        });

        it("renders the N/A block in the pivot, outside operating expenses, and counts it", async () => {
            const withNa: BusinessStatsResponse = {
                ...report,
                expensePivot: { ...report.expensePivot, blocks: [...report.expensePivot.blocks, naBlock] },
            };
            renderTab(withNa);

            expect(await screen.findByText("3 blocks")).toBeTruthy();
            await openCard("🧾 Monthly expenses");

            expect((await screen.findAllByText("N/A")).length).toBeGreaterThanOrEqual(2);
            expect(screen.getByText(naBlock.note)).toBeTruthy();
            expect(screen.getAllByText(/not in Operating Expenses/).length).toBeGreaterThanOrEqual(2);
        });

        describe("in the drawer", () => {
            it("classifies a category as N/A, shows its hint, and does not leave it unclassified", async () => {
                mockGet.mockResolvedValue([naCategory, rent]);
                mockUpdate.mockResolvedValue({ ...naCategory, pnlClass: "NOT_APPLICABLE" });
                renderTab();
                await userEvent.click(await screen.findByText(/1 unclassified/));
                const row = screen.getByTestId("category-row-41");

                await userEvent.click(within(row).getByRole("combobox", { name: /P&L class/i }));
                await userEvent.click(await screen.findByRole("option", { name: /N\/A/ }));

                await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(41, { pnlClass: "NOT_APPLICABLE", kpiTag: null }));
                expect(within(row).getByRole("combobox", { name: /P&L class/i }).textContent)
                    .toMatch(/N\/A \(expense outside Operating Expenses\)/);
                expect(within(row).queryByText(/Unclassified/i)).toBeNull();
                expect(within(row).getByText(/Spend that fits nowhere else/)).toBeTruthy();
            });
        });
    });

    describe("business income removal", () => {
        it("has no Business income card, and Monthly expenses directly follows Profit & loss", async () => {
            renderTab();

            const cards = (await screen.findAllByRole("button", { name: /^Expand / }))
                .map(button => button.getAttribute("aria-label"));

            expect(cards).not.toContain("Expand 💰 Business income");
            expect(cards.indexOf("Expand 🧾 Monthly expenses")).toBe(cards.indexOf("Expand 📈 Profit & loss") + 1);
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
        it("keeps an input in an empty app fees cell, so the fee can be typed straight in", async () => {
            // Keeta's fee is unset, so the cell reads "—". It must still be editable: there is no
            // other way into that number, and nothing computes it.
            renderTab();
            await openCard("🛵 Channel performance");

            const input = screen.getByLabelText("app fees Keeta") as HTMLInputElement;
            expect(input.value).toBe("");
            expect(input.placeholder).toBe("—");
        });

        it("saves the fee once, as a number, when one is typed and Enter is pressed", async () => {
            renderTab();
            await openCard("🛵 Channel performance");

            await userEvent.type(screen.getByLabelText("app fees Keeta"), "88.5{Enter}");

            expect(mockSaveChannelCell).toHaveBeenCalledTimes(1);
            expect(mockSaveChannelCell).toHaveBeenCalledWith("2026-06", "keeta", "appFees", 88.5);
        });

        it("warns when a channel has revenue but no app fee", async () => {
            // No channel is genuinely fee-free -- even pick-up carries a card-gateway cut -- so a
            // blank fee overstates profit rather than merely leaving a gap.
            renderTab();
            await openCard("🛵 Channel performance");

            expect(await screen.findByText(/no app fee entered/)).toBeTruthy();
        });

        it("puts the missing-fee warning below the table, so it cannot move the rows when it comes or goes", async () => {
            renderTab();
            await openCard("🛵 Channel performance");

            const warning = await screen.findByText(/no app fee entered/);
            const table = screen.getByTestId("cell-orders-keeta").closest("table") as HTMLTableElement;
            expect(table.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        it("marks an overridden cell so an edited figure cannot pass for a measured one", async () => {
            renderTab();
            await openCard("🛵 Channel performance");

            const cell = await screen.findByTestId("cell-grossRevenue-keeta");
            expect((within(cell).getByRole("textbox") as HTMLInputElement).value).toBe("530.000");
        });

        it("asks the hook to revert the row when Revert is pressed", async () => {
            renderTab();
            await openCard("🛵 Channel performance");

            await userEvent.click(await screen.findByRole("button", { name: "Revert Keeta" }));

            expect(mockRevertChannelRow).toHaveBeenCalledWith("2026-06", "keeta");
        });

        it("enables revert only on a row whose orders or gross revenue are overridden", async () => {
            // Revert no longer touches the app fee, so a row whose only edit is its fee (Talabat)
            // has nothing to revert, and offering the action would imply otherwise.
            renderTab();
            await openCard("🛵 Channel performance");

            expect((await screen.findByRole("button", { name: "Revert Keeta" })).hasAttribute("disabled"))
                .toBe(false);
            expect(screen.getByRole("button", { name: "Revert Talabat" }).hasAttribute("disabled"))
                .toBe(true);
        });

        it("has no Refresh channel data button: the figures are live", async () => {
            renderTab();
            await openCard("🛵 Channel performance");

            expect(screen.queryByRole("button", { name: /Refresh channel data/ })).toBeNull();
        });

        it("says how to edit in one legend line above the table", async () => {
            renderTab();
            await openCard("🛵 Channel performance");

            expect(screen.getByText("Figures in the boxes are editable · Enter saves and moves down · Esc cancels"))
                .toBeTruthy();
        });

        it("explains that the figures are live and why the Performance tab can differ", async () => {
            renderTab();

            await userEvent.hover(await screen.findByRole("img", { name: /About .*Channel performance/ }));

            expect(await screen.findByText(/live from our own order records/)).toBeTruthy();
            expect(screen.getByText(/counts once it has been picked/)).toBeTruthy();
            expect(screen.getByText(/also counts orders still open and only the/)).toBeTruthy();
        });

        it("shows a save error in a snackbar until it is dismissed", async () => {
            renderTab(report, "Couldn't save Keeta orders (Jun 26): HTTP 500");

            expect(await screen.findByText("Couldn't save Keeta orders (Jun 26): HTTP 500")).toBeTruthy();

            await userEvent.click(screen.getByRole("button", { name: /close/i }));
            expect(mockDismissChannelSaveError).toHaveBeenCalled();
        });
    });

    describe("profit and loss", () => {
        it("shows the reconciliation memo inside the same card as the statement", async () => {
            // Beside it in its own card it would be scrolled past -- which matters, because with
            // recipe-costed COGS the net profit line above is no longer a cash figure.
            renderTab();
            await openCard("📈 Profit & loss");

            expect(await screen.findByText(/COGS reconciliation/)).toBeTruthy();
            expect(screen.getByText("COGS from stock movement")).toBeTruthy();
            // The variance moved to the Inventory COGS card.
            expect(screen.queryByText(/Unexplained variance/)).toBeNull();
            expect(screen.queryByText("as % of gross revenue")).toBeNull();
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

        it("shows how many days the business actually opened", async () => {
            // Days with a shift opening or an order: a day the kitchen opened and sold nothing is
            // still a day that was paid for, and it is the divisor every per-day figure rests on.
            renderTab();

            const tile = await screen.findByTestId("kpi-tradingDays");
            expect(tile.textContent).toContain("23");
            expect(tile.textContent).toContain("days with a shift opening or orders");
        });

        it("prints the divisor beside a KPI that has one", async () => {
            // So a constant can never hide inside a KPI again.
            renderTab();

            expect((await screen.findByTestId("kpi-dailyOrders")).textContent).toContain("trading days");
        });

        it("shows prime cost and its share of gross revenue as formatted tiles", async () => {
            renderTab();

            expect((await screen.findByTestId("kpi-primeCost")).textContent).toContain("1,250.500 BHD");
            expect(screen.getByTestId("kpi-primeCostPercent").textContent).toContain("31.78%");
        });

        it("renders an em dash, never 0.000, when prime cost is unavailable", async () => {
            const unavailable: BusinessStatsResponse = {
                ...report,
                kpi: report.kpi.map(block => ({
                    ...block,
                    kpis: block.kpis.map(k => k.key === "primeCost"
                        ? { ...k, value: null, unavailableReason: "No category is tagged LABOUR — tag one to compute this." }
                        : k),
                })),
            };
            renderTab(unavailable);

            const tile = await screen.findByTestId("kpi-primeCost");
            expect(tile.textContent).toContain("—");
            expect(tile.textContent).not.toContain("0.000");
        });

        it("explains prime cost in the Key metrics info", async () => {
            renderTab();

            await userEvent.hover(await screen.findByRole("img", { name: "About 📊 Key metrics" }));

            expect(await screen.findByText(/Prime cost is recipe-costed COGS plus labour/)).toBeTruthy();
        });

        it("shows the latest month in the range", async () => {
            renderTab();

            expect(await screen.findByText("July 2026")).toBeTruthy();
        });

        it("explains which revenue each ratio divides by, and where trading days come from", async () => {
            // Margins and cost ratios sit side by side but have different bases, so a gross margin
            // and a food cost no longer add up to 100%; the card has to say why.
            renderTab();

            await userEvent.hover(await screen.findByRole("img", { name: "About 📊 Key metrics" }));

            expect(await screen.findByText(/Margins divide by net revenue/)).toBeTruthy();
            expect(screen.getByText(/food cost, COGS and labour divide by gross revenue/)).toBeTruthy();
            expect(screen.getByText(/Trading days are the days with a shift opening or any order/)).toBeTruthy();
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

        it("embeds the menu cost cards card", async () => {
            renderTab();
            await openCard("📦 Inventory COGS");

            expect(await screen.findByRole("button", { name: "Expand 🍕 Menu cost cards" })).toBeTruthy();
        });

        // Found by its text rather than by role name: the hinted labels sit in a Tooltip, which
        // overrides the row's accessible name with the hint.
        function cellsOfRow(label: string): (string | null)[] {
            const row = screen.getByText(label).closest("tr");
            if (row === null) throw new Error(`No row for ${label}`);
            return within(row).getAllByRole("cell").map(cell => cell.textContent);
        }

        it("shows the recipe COGS per month as Current COGS", async () => {
            renderTab();
            await openCard("📦 Inventory COGS");

            await screen.findByText("Current COGS (recipe)");
            expect(cellsOfRow("Current COGS (recipe)"))
                .toEqual(["Current COGS (recipe)", "800.000", "1,000.000"]);
        });

        it("shows the unexplained variance, with a dash for a month that has none", async () => {
            renderTab();
            await openCard("📦 Inventory COGS");

            await screen.findByText("Unexplained variance (waste / yield / theft)");
            expect(cellsOfRow("Unexplained variance (waste / yield / theft)"))
                .toEqual(["Unexplained variance (waste / yield / theft)", "39.696", "—"]);
        });

        it("states the variance as a share of gross revenue, with a dash for a month that has none", async () => {
            renderTab();
            await openCard("📦 Inventory COGS");

            await screen.findByText("as % of gross revenue");
            expect(cellsOfRow("as % of gross revenue")).toEqual(["as % of gross revenue", "1.53%", "—"]);
            expect(screen.queryByText("as % of net revenue")).toBeNull();
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

    it("surfaces the server's notices", async () => {
        renderTab();

        expect(await screen.findByText(/includes orders recorded before branches existed/)).toBeTruthy();
    });

    it("says the report could not be loaded when it is absent", async () => {
        renderTab(null);

        expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
    });
});
