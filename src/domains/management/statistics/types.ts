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
