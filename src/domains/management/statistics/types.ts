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
};

export type ProductStatRow = {
    id: number;
    name: string;
    price: number;
    targetPrice: number;
};
