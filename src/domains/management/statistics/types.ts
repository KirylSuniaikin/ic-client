// The dispatcher board's own vocabulary for why a rider was passed over. Imported
// rather than restated: an aggregate that classified skips differently from the
// board a manager reads one rider at a time would be worse than no aggregate.
import type {NoOfferReason} from "../couriers/types";

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
    ordersByDay: Record<string, number>;
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
    // Orders in the Pick Up + Keeta window with no phone at all (masked Keeta number, or a POS
    // Pick Up rung up without one) -- can't be attributed to New or Returning. Backing the
    // customer card's third "Unknown / No phone" column.
    unknownCustomerOrderCount: number;
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

export type PurchaseCategory = {
    categoryName: string;
    // Null when the category does not exist in the ledger at all — a rename, most likely. Rendered
    // as an em dash, not a zero: a zero would quietly shrink COGS and read as a cheap month.
    amount: number | null;
};

export type InventoryCogs = {
    period: string;
    state: InventoryCogsState;
    // When true a missing closing count is expected, not a failure — do not nag.
    monthInProgress: boolean;
    openingInventory: number | null;
    // Spend on goods and packaging, from the ledger — every accounting category classified
    // COGS_PURCHASES. Not from the purchase invoices, which record the same money a second time.
    purchases: number | null;
    // `purchases` broken down by category. Always sums back to it. Category names rather than a
    // fixed pair, so classifying a new category as COGS_PURCHASES adds a row on its own.
    purchaseBreakdown: PurchaseCategory[];
    // The same month per the purchase invoices. Not shown here — it feeds the P&L memo's
    // ledger-vs-invoices row, which is what would notice the two entry paths drifting apart.
    invoicePurchases: number | null;
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
    profitAndLoss: ProfitAndLoss[];
    kpi: KpiBlock[];
    costing: CostingCoverage;
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

export type CostSource = "BATCH" | "PRODUCT" | "MANUAL" | "MISSING";

export type CostingWarning = {
    code: string;
    componentId: number;
    componentName: string;
    detail: string;
};

export type CostingCoverage = {
    componentsUsed: number;
    componentsResolved: number;
    coveragePercent: number;
    warnings: CostingWarning[];
};

export type CogsReconciliation = {
    ledgerCogsPurchases: number | null;
    invoicePurchases: number | null;
    ledgerVsInvoices: number | null;
    openingInventory: number | null;
    endingInventory: number | null;
    inventoryDelta: number | null;
    movementCogs: number | null;
    recipeCogs: number | null;
    // Positive means more was consumed than the recipes predict: waste, over-portioning or theft.
    unexplainedVariance: number | null;
    variancePercentOfNetRevenue: number | null;
    // netProfit + recipeCogs − invoicePurchases: what the bank balance actually moved by.
    netCashMovement: number | null;
    complete: boolean;
};

export type ProfitAndLoss = {
    period: string;
    grossRevenue: number;
    appFees: number;
    netRevenue: number;
    recipeCogs: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingProfit: number;
    capex: number;
    financing: number;
    ownerWithdrawals: number;
    adjustments: number;
    netProfit: number;
    unclassified: number;
    reconciliation: CogsReconciliation;
    flags: string[];
};

export type Kpi = {
    key: string;
    label: string;
    // Null whenever it could not be computed. NEVER rendered as 0 in that case.
    value: number | null;
    unit: string;
    previousValue: number | null;
    unavailableReason: string | null;
    detail: string | null;
};

export type KpiBlock = {
    period: string;
    kpis: Kpi[];
};

export type CostCardLine = {
    componentId: number;
    componentName: string;
    unit: string | null;
    amount: number;
    // Printed on screen: a per-kilogram price mistaken for a per-gram one is invisible in a total.
    unitCost: number;
    costSource: CostSource;
    lineCost: number;
};

export type MenuItemCostCard = {
    menuItemId: number;
    category: string | null;
    name: string;
    size: string | null;
    salePrice: number | null;
    lines: CostCardLine[];
    totalCost: number;
    grossProfit: number | null;
    foodCostPercent: number | null;
    // False when a line resolved to nothing — the card understates cost and overstates margin.
    complete: boolean;
};

export type UncostedMenuItem = {
    menuItemId: number;
    category: string | null;
    name: string;
    size: string | null;
};

export type MenuCostCardsResponse = {
    cards: MenuItemCostCard[];
    menuItemsWithoutRecipe: UncostedMenuItem[];
    costing: CostingCoverage;
};

export type ComponentIngredientLine = {
    id: number;
    ingredientProductId: number | null;
    ingredientProductName: string | null;
    ingredientComponentId: number | null;
    ingredientComponentName: string | null;
    amount: number;
    // What this line contributes to the batch, in BD. Zero when the ingredient has no cost.
    lineCost: number;
};

export type ComponentCost = {
    id: number;
    name: string;
    unit: string | null;
    productId: number | null;
    productName: string | null;
    productPrice: number | null;
    // Per kg / litre / piece — the basis the owner works in.
    cost: number | null;
    batchYield: number | null;
    ingredients: ComponentIngredientLine[];
    // Per gram / ml / piece, after resolution.
    resolvedUnitCost: number;
    costSource: CostSource;
};

export type UpdateComponentCost = {
    productId?: number | null;
    cost?: number | null;
    batchYield?: number | null;
    clearProduct?: boolean;
    clearCost?: boolean;
    clearBatchYield?: boolean;
};

// ---------------------------------------------------------------------------
// Delivery availability — mirrors backend DeliveryAvailabilityStatsTO.
//
// Answers one question: do we need another rider? The reasons are reported
// separately and MUST NOT be summed into a single "unavailable" figure — a
// branch a manager switched off would otherwise read as a courier shortage.
// ---------------------------------------------------------------------------

// The three outage states a timer can actually observe. OUTSIDE_RADIUS and
// OUTSIDE_ZONE — two of the five reasons the availability gate refuses a
// customer for — are properties of the CUSTOMER'S PIN, not of the branch: a
// branch is zero km from itself and a zone only narrows which pins it serves.
// Neither is sampleable, so neither exists here or in the stored data.
export type DeliveryOutageReason = "NO_COURIER" | "DELIVERY_DISABLED" | "NO_BRANCH";

export type DeliveryOutageBucket = {
    reason: DeliveryOutageReason;
    seconds: number;
    // Separate episodes, not just total time: ten two-minute gaps and one
    // twenty-minute gap are the same total and different problems.
    occurrences: number;
};

export type DeliveryAvailabilityHourBucket = {
    dayOfWeek: number; // ISO: 1 = Monday .. 7 = Sunday
    hour: number;      // 0..23, Bahrain local
    noCourierSeconds: number;
    observedSeconds: number;
};

export type DeliveryAvailabilityStats = {
    // Open time actually sampled — the denominator. Excludes minutes lost to a
    // redeploy rather than guessing at them, so the ratios stay honest.
    observedSeconds: number;
    unavailableSeconds: number;
    byReason: DeliveryOutageBucket[];
    byHour: DeliveryAvailabilityHourBucket[];
};

// ---------------------------------------------------------------------------
// Delivered-by-hour — mirrors backend DeliveryHourBucketTO.
//
// Both numbers, never just the money. A cell holding 200 BHD from four orders
// and one holding 200 BHD from twenty are opposite operational situations —
// the first is fine, the second is the hour that needs another rider — and a
// revenue-only heatmap cannot tell them apart.
// ---------------------------------------------------------------------------
export type DeliveryHourBucket = {
    // ISO day, 1 = Monday .. 7 = Sunday. Same convention as
    // DeliveryAvailabilityHourBucket, so the two grids share one axis and can
    // be read against each other.
    dayOfWeek: number;
    // 0..23, Bahrain local, taken from delivered_at: the question is when the
    // food arrived, not when the order was placed.
    hour: number;
    total: number;
    count: number;
};

// ---------------------------------------------------------------------------
// Estimate accuracy — mirrors backend DeliveryEstimateAccuracyTO.
//
// Every number below is a GAP, and a gap is `actual - quoted`, in minutes:
// positive is late, negative is early. Stated once here rather than per field,
// because a reader who gets the sign backwards tunes the estimate the wrong way.
//
// Two things this type refuses to let a screen do. It never offers a single
// blended accuracy figure — the kitchen quote (a WorkLoadLevel step function)
// and the road quote (the Routes API) are produced by unrelated mechanisms, and
// prep running 8 minutes long against a drive running 8 minutes short is a
// perfect total and two broken estimates. And it never offers a mean without a
// median, a p90 and the histogram beside it — a mean of zero is produced equally
// by an estimate that is always right and by one that is wildly wrong in both
// directions, and only the second is a problem.
// ---------------------------------------------------------------------------

// TOTAL is deliberately NOT the sum of the other two: it is measured end to end,
// and the difference between it and KITCHEN + ROAD is the unquoted span where the
// food sat on the pass waiting for a rider.
export type DeliveryLeg = "KITCHEN" | "ROAD" | "TOTAL";

// Half-open [fromMinutes, toMinutes), so adjacent buckets tile without a gap and
// no sample lands in two. A null edge is an OPEN end — `fromMinutes: null` means
// unbounded-early, `toMinutes: null` unbounded-late — never a zero.
export type DeliveryGapBucket = {
    fromMinutes: number | null;
    toMinutes: number | null;
    // Zero is a real answer and the bucket is still emitted: a missing bucket
    // would read as a rendering fault, an empty one reads as what it is.
    count: number;
};

export type DeliveryLegAccuracy = {
    leg: DeliveryLeg;
    // Orders where BOTH ends of this leg were known and a quote existed.
    sampleCount: number;
    // The rest of the window. Reported rather than dropped, because a leg that
    // quietly stops being measurable otherwise shows up only as an improbably
    // good number computed from the handful of rows left.
    unmeasurableCount: number;
    // Every one of these is null when sampleCount is 0 — "no samples", never 0,
    // which would read as "we quoted instant delivery".
    quotedMeanMinutes: number | null;
    actualMeanMinutes: number | null;
    gapMeanMinutes: number | null;
    // The number to read FIRST: the typical order. Where it disagrees with the
    // mean, the mean is being dragged by a tail and must not be tuned against.
    gapMedianMinutes: number | null;
    // The promise that actually gets broken.
    gapP90Minutes: number | null;
    gapMinMinutes: number | null;
    gapMaxMinutes: number | null;
    earlyCount: number;
    onTimeCount: number;
    lateCount: number;
    // The width of the on-time band, echoed back so no client hard-codes it.
    toleranceMinutes: number;
    distribution: DeliveryGapBucket[];
};

export type DeliveryEstimateAccuracy = {
    // The denominator for every leg's sampleCount: a leg measured on 12 of 400
    // orders is not evidence, and the reader must see that without asking.
    deliveredOrders: number;
    // Always one entry per leg, always in enum order, even at zero samples.
    legs: DeliveryLegAccuracy[];
};

// ---------------------------------------------------------------------------
// Skip reasons — mirrors backend DeliverySkipReasonStatsTO.
//
// Two counts per reason, never one: a skip count alone cannot tell twenty skips
// against one order from twenty skips against twenty, and those are different
// problems with different fixes. The orders figure is what prices each reason.
//
// The totals are NOT the sum of the buckets — one order passed over for two
// reasons is in two buckets and is still one affected order.
// ---------------------------------------------------------------------------
export type DeliverySkipReasonBucket = {
    // The engine's own verdict, from the same vocabulary the dispatcher board
    // renders one rider at a time.
    reason: NoOfferReason;
    skips: number;
    // The actionable number.
    ordersAffected: number;
    couriersAffected: number;
};

export type DeliverySkipReasonStats = {
    totalSkips: number;
    ordersAffected: number;
    couriersAffected: number;
    // One entry per reason, always all of them and always in enum order, so a
    // zero reads as a real zero rather than as missing data.
    byReason: DeliverySkipReasonBucket[];
};
