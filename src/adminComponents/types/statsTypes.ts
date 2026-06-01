export interface DoughDailyUsageTO {
    date: string;
    quantity: number;
}

export interface DoughUsageTO {
    doughType: string;
    history: DoughDailyUsageTO[];
}

export interface SellsByHourStat {
    hour: number;
    sellsByDay: Record<string, number>;
}

export interface TopFiveProducts {
    name: string;
    quantity: number;
}

export interface StatsResponse {
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
}