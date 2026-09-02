export type DoughDailyUsageTO = {
    date: string;
    quantity: number;
};

export type DoughUsageTO = {
    doughType: string;
    history: DoughDailyUsageTO[];
};

export type DoughUsageRow = {
    id: string;
    doughType: string;
    isTotal?: boolean;
    [date: string]: string | number | boolean | undefined;
};

export type TopProduct = {
    name: string;
    quantity: number;
};

export type VatStatePayload = {
    branchId: string;
    fromDate: string;
    toDate: string;
};

export type SellsByHourStat = {
    hour: number;
    sellsByDay: Record<string, number>;
};

export type DateRangeState = {
    startDate: Date;
    endDate: Date;
    key: string;
};

export type TopFiveProducts = {
    name: string;
    quantity: number;
};

export type PreviousPeriod = {
    startDate: string;
    finishDate: string;
    totalRevenue: number;
    totalOrders: number;
    totalPickUpRevenue: number;
    totalPickUpOrderCount: number;
    totalTalabatRevenue: number;
    totalTalabatOrders: number;
    totalKeetaRevenue: number;
    totalKeetaOrders: number;
};

export type StatsResponse = {
    totalPickUpRevenue: number;
    totalPickUpOrderCount: number;
    newCustomerOrderedCount: number;
    oldCustomerOrderedCount: number;
    oldCstmrOrderCount: number;
    arpu: number | null;
    uniqueCustomersAllTime: number;
    repeatCustomersAllTime: number;
    averageOrderValueAllTime: number | null;
    monthTotalCustomers: number;
    retainedCustomers: number;
    retentionPercentage: number | null;
    doughUsageTOS: DoughUsageTO[];
    sellsByHour: SellsByHourStat[];
    totalTalabatOrders: number;
    totalTalabatRevenue: number;
    topProducts: TopFiveProducts[];
    totalKeetaOrders: number;
    totalKeetaRevenue: number;
    previous?: PreviousPeriod;
    // All-time average order preparation time in whole seconds (createdAt -> Ready).
    // null when no order has a recorded prep time yet (legacy-only data).
    averagePrepTimeSeconds: number | null;
    sourceBreakdown?: SourceBreakdown[];
};

// Mirrors backend SourceBreakdownTO — task-spec.md §4. Optional: absent on any
// response predating this field, and no UI consumes it yet.
export type SourceBreakdown = {
    source: string;
    orders: number;
    revenue: number;
};

export type ProductStatRow = {
    id: number;
    name: string;
    price: number;
    targetPrice: number;
};

// --- Business Stats -----------------------------------------------------------------------
// Mirrors the backend records in domain/businessstats/dto field-for-field.

/** Mirrors backend PnlClass. null on the wire means Unclassified — a real state, not missing data. */
export type PnlClass =
    | "REVENUE"
    | "COGS_PURCHASES"
    | "OPEX"
    | "CAPEX"
    | "OWNER_WITHDRAWAL"
    | "FINANCING"
    | "ADJUSTMENT"
    | "EXCLUDED";

/** Mirrors backend KpiTag. Orthogonal to PnlClass — Marketing is OPEX *and* MARKETING. */
export type KpiTag = "MARKETING" | "LABOUR" | "RENT" | "UTILITIES";

// Mirrors backend CategoryClassificationTO. The server returns these already ordered
// (unclassified first, then heaviest lifetime spend first) — do not re-sort on the client.
export type CategoryClassification = {
    id: number;
    name: string;
    type: "DEBIT" | "CREDIT";
    pnlClass: PnlClass | null;
    kpiTag: KpiTag | null;
    entryCount: number;
    lifetimeTotal: number;
};

// Mirrors backend UpdateCategoryClassificationTO. null clears the field: "unclassified" is a
// legitimate resting state a misclassified category must be returnable to.
export type UpdateCategoryClassification = {
    pnlClass: PnlClass | null;
    kpiTag: KpiTag | null;
};

export type ExpenseRow = {
    categoryId: number;
    categoryName: string;
    kpiTag: KpiTag | null;
    // Positionally aligned to BusinessStatsResponse.months — an unused month is 0, never a gap.
    amounts: number[];
    total: number;
};

export type ExpenseBlock = {
    // "UNCLASSIFIED" for the null bucket — a real block, not an omission.
    pnlClass: PnlClass | "UNCLASSIFIED";
    label: string;
    note: string | null;
    // False for COGS_PURCHASES, CAPEX and others. Carried so the screen can say WHY a visible
    // block is outside the Operating Expenses total.
    includedInOperatingExpenses: boolean;
    rows: ExpenseRow[];
    totals: number[];
    grandTotal: number;
};

export type ExpensePivot = {
    months: string[];
    blocks: ExpenseBlock[];
    unclassifiedCategoryCount: number;
    unclassifiedTotal: number;
};

export type MonthlyRevenue = {
    period: string;
    orders: number;
    grossRevenue: number;
    operatingDays: number;
    // Null, not 0, when there were no orders: "no orders" is not "a basket worth nothing".
    averageBasketSize: number | null;
    dailyOrdersAverage: number | null;
};

export type InventoryCogsState =
    | "OK"
    | "PARTIAL_BRANCHES"
    | "MISSING_OPENING"
    | "MISSING_ENDING"
    | "MISSING_PURCHASES"
    | "NO_DATA";

export type InventoryCogs = {
    period: string;
    state: InventoryCogsState;
    // When true a missing closing count is expected, not a failure — do not nag.
    monthInProgress: boolean;
    openingInventory: number | null;
    purchases: number | null;
    available: number | null;
    endingInventory: number | null;
    // Null, NEVER 0, when an input is missing. Zero is a claim; absence is not.
    movementCogs: number | null;
    cogsPercentOfGrossRevenue: number | null;
    contributingBranches: string[];
    missingBranches: string[];
    missingReports: string[];
};

export type BusinessStatsResponse = {
    months: string[];
    expensePivot: ExpensePivot;
    revenue: MonthlyRevenue[];
    inventoryCogs: InventoryCogs[];
    channels: ChannelPerformanceMonth[];
    notices: string[];
};

export type ChannelPerformanceRow = {
    id: number;
    period: string;
    channelKey: string;
    channelLabel: string;
    generatedOrders: number | null;
    generatedGrossRevenue: number | null;
    overrideOrders: number | null;
    overrideGrossRevenue: number | null;
    overrideAppFees: number | null;
    effectiveOrders: number | null;
    effectiveGrossRevenue: number | null;
    effectiveAppFees: number | null;
    // False when nobody has entered a fee. Distinct from a fee of zero — there is no fee-free
    // channel, so an absent fee overstates profit rather than merely leaving a blank.
    appFeesEntered: boolean;
    netRevenue: number | null;
    appCommissionPercent: number | null;
    note: string | null;
    generatedAt: string | null;
    updatedAt: string | null;
    updatedByName: string | null;
    version: number;
};

export type ChannelPerformanceMonth = {
    period: string;
    rows: ChannelPerformanceRow[];
    totalOrders: number;
    totalGrossRevenue: number;
    totalAppFees: number;
    totalNetRevenue: number;
    appFeesMissing: boolean;
};

// The clear* flags exist because in a PATCH a JSON null is indistinguishable from an absent field,
// so "revert this cell to the generated figure" would otherwise be inexpressible.
export type ChannelOverridePatch = {
    orders?: number | null;
    grossRevenue?: number | null;
    appFees?: number | null;
    note?: string | null;
    clearOrders?: boolean;
    clearGrossRevenue?: boolean;
    clearAppFees?: boolean;
    version: number;
};

export type ChannelRegenerateResponse = {
    succeeded: number;
    failed: number;
    failedPeriods: string[];
};
