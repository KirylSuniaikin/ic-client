// The dispatcher board's own vocabulary for why a rider was passed over. Imported
// rather than restated: an aggregate that classified skips differently from the
// board a manager reads one rider at a time would be worse than no aggregate.
import type {NoOfferReason} from "../couriers/types";
import type { MeasureUnit } from "../../../shared/utils/unitFormat";

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
    // Orders in the customer card's window (Pick Up + Delivery + Talabat + Keeta) with no phone at
    // all (masked Keeta number, a Talabat order imported without one, or a POS Pick Up rung up
    // without one) -- can't be attributed to New or Returning. Backing the customer card's third
    // "Unknown / No phone" column.
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
    price: number | null;
    targetPrice: number;
    // The four settings editable inline on the Pricing table (PATCH /api/products/{id}/settings).
    isInventory: boolean;
    isPurchasable: boolean;
    unit: MeasureUnit | null;
    topVendor: string | null;
};

// --- Business Stats -----------------------------------------------------------------------
// Mirrors the backend records in domain/businessstats/dto field-for-field.

/** Mirrors backend PnlClass. null on the wire means Unclassified — a real state, not missing data. */
export type PnlClass =
    | "REVENUE"
    | "COGS_PURCHASES"
    | "OPEX"
    | "NOT_APPLICABLE"
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
    // Null while a channel has live orders but nobody has edited it yet: nothing is stored until
    // the first override, so there is no row to carry an id.
    id: number | null;
    period: string;
    channelKey: string;
    channelLabel: string;
    // Live from the orders on every read, not a stored snapshot.
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
    // Always null now that the figures are live; kept so the shape still matches the server's.
    generatedAt: string | null;
    updatedAt: string | null;
    updatedByName: string | null;
    // Null exactly when id is: the first write creates the row and must say it expects none.
    version: number | null;
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

// An upsert keyed on (period, channelKey), because a channel with live orders has no stored row
// until its first edit. The clear* flags exist because in a PATCH a JSON null is indistinguishable
// from an absent field, so "revert this cell to the figure from orders" would otherwise be
// inexpressible.
export type ChannelOverridePatch = {
    period: string;
    channelKey: string;
    // The stored row's version, or null when the caller believes no row exists yet. Either being
    // wrong is a 409, never a silent overwrite.
    version: number | null;
    orders: number | null;
    grossRevenue: number | null;
    appFees: number | null;
    note: string | null;
    clearOrders: boolean;
    clearGrossRevenue: boolean;
    clearAppFees: boolean;
};

export type ChannelField = "orders" | "grossRevenue" | "appFees";

export const CHANNEL_ROW_CONFLICT_MESSAGE = "This row changed since it was loaded";

// A 409 from the channel override PATCH. Deliberately does not say "someone else": the conflicting
// write can just as well be the owner's own edit from another tab.
export class ChannelRowConflictError extends Error {
    constructor() {
        super(CHANNEL_ROW_CONFLICT_MESSAGE);
        this.name = "ChannelRowConflictError";
    }
}

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
    variancePercentOfGrossRevenue: number | null;
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
    notApplicable: number;      // mirrors backend ProfitAndLossTO.notApplicable; a cost, positive
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

export type DeliveryOrderTotalTime = {
    // Its own denominator (orders with a total). Equals deliveredOrderCount and is NOT
    // comparable with deliveredOrders, which counts delivered parts (courier drop-offs).
    sampleCount: number;
    // Unsigned durations in minutes; all null (never 0) when sampleCount is 0.
    medianMinutes: number | null;
    meanMinutes: number | null;
    p90Minutes: number | null;
};

export type DeliveryEstimateAccuracy = {
    // Delivered PARTS (courier drop-offs), one row per part; equals the order count only
    // when every order has one part. The denominator for every leg's sampleCount: a leg
    // measured on 12 of 400 drop-offs is not evidence, and the reader must see that
    // without asking.
    deliveredOrders: number;
    // Always one entry per leg, always in enum order, even at zero samples.
    legs: DeliveryLegAccuracy[];
    // Placed → last part's drop-off, one sample per order. Not a leg: it has no quote, so no gap.
    orderTotalTime: DeliveryOrderTotalTime;
    // Delivered ORDERS, each once (status Delivered, every part delivered); always
    // equals orderTotalTime.sampleCount. Not deliveredOrders ÷ parts-per-order.
    deliveredOrderCount: number;
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

// ---------------------------------------------------------------------------
// Delivery zones — mirrors backend DeliveryZoneStatsTO (GET /stats/zones).
//
// The same delivered in-house orders as the estimate-accuracy report, placed on
// a hexagon grid by their drop-off pin. Only cells with at least one order are
// sent, and an order whose pin is unusable is counted in `unlocatedOrders`
// instead of being dropped, so the map can say how much of the window it is
// not showing.
// ---------------------------------------------------------------------------

// The hexagon's circumradius (= edge length), in metres. Only these three are
// accepted; anything else is a 400.
export type DeliveryZoneCellMeters = 250 | 500 | 1000;

export type DeliveryZonePoint = {
    latitude: number;
    longitude: number;
};

export type DeliveryZoneCell = {
    // Axial "q:r", stable for one cellMeters across requests — but "0:0" at 250 m
    // and "0:0" at 1000 m are different places, so an id is only meaningful
    // together with the cellMeters of the response it came from.
    id: string;
    center: DeliveryZonePoint;
    // Six corners, an open ring (first != last).
    vertices: DeliveryZonePoint[];
    orders: number;
    // BHD, three decimals.
    revenue: number;
    // Minutes. Null means no sample, never zero.
    avgTotalMinutes: number | null;
    p90TotalMinutes: number | null;
    avgRoadMinutes: number | null;
    // Share of `lateSampleSize` delivered after the customer promise, 0..1.
    // Null exactly when lateSampleSize is 0.
    lateShare: number | null;
    // Orders in the cell with a promise on record — the denominator of lateShare,
    // which can be smaller than `orders`.
    lateSampleSize: number;
};

export type DeliveryZoneStats = {
    cellMeters: DeliveryZoneCellMeters;
    // Orders placed on the map, i.e. the sum of every cell's `orders`.
    totalOrders: number;
    // Delivered orders with no usable drop-off coordinates; on no cell.
    unlocatedOrders: number;
    cells: DeliveryZoneCell[];
};

// ---------------------------------------------------------------------------
// Delivery metrics M1–M5 — mirror the backend DTOs behind
// /api/management/delivery/stats/{time-to-courier,quality,lost-demand,lost-demand/zones,
// courier-productivity}.
//
// Some of these figures only exist from the deploy that started capturing them. Each such
// section travels with `dataSince` and a `coverage`, and the server sends the section itself as
// null when the whole window predates capture. A null there means "we were not recording", never
// zero — a screen that printed 0 would be reporting a fact nobody measured.
// ---------------------------------------------------------------------------

// FULL: capture began at or before the window's start. PARTIAL: it began inside the window, so
// the earlier days are missing. NONE: it began after the window ended — nothing in it was recorded.
export type MetricCoverage = "FULL" | "PARTIAL" | "NONE";

// Every minute figure is null (never 0) when sampleCount is 0.
export type DurationSummary = {
    sampleCount: number;
    meanMinutes: number | null;
    medianMinutes: number | null;
    p90Minutes: number | null;
};

// A wait with the two thresholds a manager reads it against: values strictly above 5 and 10 min.
export type WaitSummary = DurationSummary & {
    over5Minutes: number;
    over10Minutes: number;
};

// M1 — mirrors TimeToCourierStatsTO. Delivered-part grain.
export type TimeToCourierStats = {
    dataSince: string;
    coverage: MetricCoverage;
    // Derived, so always filled — even when nothing was captured.
    deliveredParts: number;
    // The captured fields below are null exactly when coverage is NONE.
    measuredParts: number | null;
    // Food Ready -> the assignment that stuck. Clamped at 0: assigned before Ready is no wait.
    readyToAssigned: WaitSummary | null;
    firstOfferToAssigned: WaitSummary | null;
    assignedBeforeReady: number | null;
    // Measured parts the engine never offered (e.g. a manual assign before any offer).
    assignedWithoutOffer: number | null;
};

// M2 — late against the customer promise. Order grain; deliveredOrders equals the
// estimate-accuracy card's deliveredOrderCount.
export type DeliveryLateness = {
    deliveredOrders: number;
    ordersWithPromise: number;
    lateOrders: number;
    // 0..1, null when ordersWithPromise is 0.
    lateShare: number | null;
    meanMinutesLate: number | null;
    p90MinutesLate: number | null;
};

// M4 — delivered within budgetMinutes of the kitchen's Ready. Part grain.
export type DeliveryFreshness = {
    budgetMinutes: number;
    deliveredParts: number;
    measuredParts: number;
    freshParts: number;
    freshShare: number | null;
    unmeasurableParts: number;
};

// A captured duration: `summary` is null when coverage is NONE.
export type CapturedDurationSummary = {
    dataSince: string;
    coverage: MetricCoverage;
    summary: DurationSummary | null;
};

// Paid delivery orders that ended without reaching the customer. amountBhd is money taken that
// has to be refunded by hand.
export type DeliveryOutcome = {
    count: number;
    // Of concludedOrders; null when that is 0.
    share: number | null;
    amountBhd: number;
};

// M2 + M4 — mirrors DeliveryQualityStatsTO.
export type DeliveryQualityStats = {
    lateness: DeliveryLateness;
    freshness: DeliveryFreshness;
    // Ready -> handed to the rider: the food waiting on the pass.
    readyToHandover: DurationSummary;
    // Rider at the kitchen -> handed over. Not clamped: a negative sample is a data defect.
    courierWaitAtKitchen: DurationSummary;
    // First proof photo -> Delivered tap. The photo stands in for "arrived at the door".
    timeAtDoor: CapturedDurationSummary;
    cancellations: DeliveryOutcome;
    returns: DeliveryOutcome;
    // lateness.deliveredOrders + cancellations.count + returns.count
    concludedOrders: number;
};

// Every reason the customer-facing availability gate can refuse with (backend
// DeliveryAvailabilityTO.Reason), in enum order. Deliberately its own type: the customer-facing
// DeliveryUnavailableReason lists only the ones the storefront has copy for.
export type LostDemandReason =
    | "NO_BRANCH"
    | "OUTSIDE_RADIUS"
    | "NO_COURIER"
    | "DELIVERY_DISABLED"
    | "OUTSIDE_ZONE"
    | "INSUFFICIENT_COURIERS";

// Where in the flow the customer was refused: before a pin, with a pin, or at payment.
export type DemandStage = "CART" | "ADDRESS" | "CHECKOUT";

// X-Client-Platform as the server recorded it; UNKNOWN when the header was missing.
export type DemandPlatform = "WEB" | "MOBILE" | "KIOSK" | "KIOSK_WEB" | "UNKNOWN";

export type LostDemandReasonCount = { reason: LostDemandReason; count: number };
// A Keeta event may arrive without a reason; those are counted under UNKNOWN.
export type KeetaReasonCount = { reason: LostDemandReason | "UNKNOWN"; count: number };
export type DemandStageCount = { stage: DemandStage; count: number };
export type DemandPlatformCount = { platform: DemandPlatform; count: number };

export type LostDemandRefusals = {
    // De-duplicated refusal rows: one per session, per ~100 m spot, per 30 minutes.
    total: number;
    // The first refusal of each session — an estimate of people, not of checks.
    estimatedAttempts: number;
    byReason: LostDemandReasonCount[];
    byStage: DemandStageCount[];
    byPlatform: DemandPlatformCount[];
};

export type LostDemandKeeta = {
    total: number;
    // CART and ADDRESS only: there is no Keeta card at the payment step.
    byStage: DemandStageCount[];
    byReason: KeetaReasonCount[];
    byPlatform: DemandPlatformCount[];
};

export type AbandonedOrderStatus = "Pending Payment" | "Payment Failed";

// Delivery orders created and never paid. Derived, so present for any window.
export type LostDemandAbandoned = {
    orders: number;
    // Followed within two hours by a paid order on the same phone — not lost revenue.
    recovered: number;
    lost: number;
    lostValueBhd: number;
    // Counts ALL abandoned orders, recovered or not.
    byStatus: { status: AbandonedOrderStatus; count: number }[];
};

// One calendar day. A captured count is null for a day that ended before capture began.
export type LostDemandDay = {
    date: string;
    refusals: number | null;
    estimatedAttempts: number | null;
    keetaChosen: number | null;
    abandonedLost: number;
};

// Sparse: only weekday/hour cells with at least one refusal.
export type LostDemandHourCell = {
    dayOfWeek: number; // ISO: 1 = Monday .. 7 = Sunday
    hour: number;      // 0..23, Bahrain local
    refusals: number;
    estimatedAttempts: number;
};

// M3 — mirrors LostDemandStatsTO.
export type LostDemandStats = {
    refusalsDataSince: string;
    refusalsCoverage: MetricCoverage;
    keetaDataSince: string;
    keetaCoverage: MetricCoverage;
    refusals: LostDemandRefusals | null;
    keeta: LostDemandKeeta | null;
    abandoned: LostDemandAbandoned;
    // Context, not a rate: successful availability checks are not stored, so there is no exact
    // denominator for the refusals.
    paidDeliveryOrders: number;
    byDay: LostDemandDay[];
    byHour: LostDemandHourCell[];
};

// One hexagon of the lost-demand map. Same axial id space as DeliveryZoneCell for the same
// cellMeters, but a separate list: these cells mostly lie where nothing was delivered.
export type LostDemandZoneCell = {
    id: string;
    center: DeliveryZonePoint;
    vertices: DeliveryZonePoint[];
    refusals: number;
    // Non-zero reasons only, in enum order.
    refusalsByReason: LostDemandReasonCount[];
    abandonedLost: number;
    // refusals + abandonedLost; always > 0.
    total: number;
};

// M3 per hexagon — mirrors LostDemandZoneStatsTO (GET /stats/lost-demand/zones).
export type LostDemandZoneStats = {
    cellMeters: DeliveryZoneCellMeters;
    refusalsDataSince: string;
    // When NONE, every refusal count is 0 and only abandoned orders place cells.
    refusalsCoverage: MetricCoverage;
    locatedRefusals: number;
    // Refused before a pin existed (the cart check), so they have no place on a map.
    unlocatedRefusals: number;
    locatedAbandoned: number;
    unlocatedAbandoned: number;
    // Busiest first, then by id.
    cells: LostDemandZoneCell[];
};

// One rider's — or, with courierId and name null, the fleet's — time and distance. Minutes and
// km carry one decimal. freeMinutes + toKitchenMinutes + atKitchenMinutes + carryingMinutes is
// onShiftMinutes (up to rounding).
export type CourierProductivityRow = {
    courierId: string | null;
    name: string | null;
    onShiftMinutes: number;
    freeMinutes: number;
    toKitchenMinutes: number;
    atKitchenMinutes: number;
    carryingMinutes: number;
    // Null when the whole window predates the GPS that is still kept; never a guessed 0.
    kmDriven: number | null;
    deliveredParts: number;
    kmPerDelivery: number | null;
};

// M5 fleet — mirrors CourierProductivityTO. No branch: couriers do not belong to one.
export type CourierProductivity = {
    // GPS is kept for a fixed number of days; km before this date cannot be counted.
    gpsDataSince: string;
    // Before this moment "going to the kitchen" was not recorded and counts as free time.
    splitDataSince: string;
    splitCoverage: MetricCoverage;
    couriers: CourierProductivityRow[];
    total: CourierProductivityRow;
};

// M5 for one rider, as the courier panel's period stats carry it.
export type CourierProductivitySingle = {
    gpsDataSince: string;
    splitDataSince: string;
    splitCoverage: MetricCoverage;
    row: CourierProductivityRow;
};
