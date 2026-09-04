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
