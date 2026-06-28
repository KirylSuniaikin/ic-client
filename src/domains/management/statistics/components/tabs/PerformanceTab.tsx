import React from "react";
import {Grid} from "@mui/material";
import {CustomerStatCard, CustomerColumn} from "../CustomerStatCard";
import {DateRangeStatsCard} from "../performance/DateRangeStatsCard";
import {RetentionCheckCard} from "../performance/RetentionCheckCard";
import {GlobalStatsCard} from "../performance/GlobalStatsCard";
import {countPercentage} from "../performance/statsFormat";
import type {DateRangeState, SellsByHourStat, StatsResponse} from "../../types";

// Decodes the raw customer counts into the labeled two-column shape the card renders.
function buildCustomerColumns(stats: StatsResponse): CustomerColumn[] {
    const newOrders = stats.newCustomerOrderedCount;
    const returningOrders = stats.oldCstmrOrderCount;
    const totalOrders = newOrders + returningOrders;
    const returningCustomers = stats.oldCustomerOrderedCount;

    const share = (orders: number): string => String(Math.round(Number(countPercentage(totalOrders, orders))));
    const ordersPerCustomer = returningCustomers
        ? (returningOrders / returningCustomers).toFixed(1)
        : "0.0";

    return [
        {heading: "New", orders: newOrders, sharePct: share(newOrders)},
        {
            heading: "Returning",
            orders: returningOrders,
            sharePct: share(returningOrders),
            customers: returningCustomers,
            ordersPerCustomer,
        },
    ];
}

type Props = {
    rangeStats: StatsResponse | null;
    globalStats: StatsResponse | null;
    retentionStats: StatsResponse | null;
    sellStats: SellsByHourStat[];
    dateRange: DateRangeState[];
    selectedDate: Date;
    onRangeChange: (range: DateRangeState[]) => void;
    onSelectedDateChange: (date: Date) => void;
    onRefresh: () => void;
};

export function PerformanceTab({
                                   rangeStats,
                                   globalStats,
                                   retentionStats,
                                   sellStats,
                                   dateRange,
                                   selectedDate,
                                   onRangeChange,
                                   onSelectedDateChange,
                                   onRefresh,
                               }: Props): JSX.Element {
    return (
        <>
            <CustomerStatCard
                title="Customers · Pick Up + Keeta"
                columns={rangeStats ? buildCustomerColumns(rangeStats) : null}
            />

            <DateRangeStatsCard
                stats={rangeStats}
                dateRange={dateRange}
                sellStats={sellStats}
                onRangeChange={onRangeChange}
                onRefresh={onRefresh}
            />

            <Grid container spacing={2} sx={{mb: 2}}>
                <Grid size={{xs: 12, md: 6}}>
                    <RetentionCheckCard
                        stats={retentionStats}
                        selectedDate={selectedDate}
                        onSelectedDateChange={onSelectedDateChange}
                        onRefresh={onRefresh}
                    />
                </Grid>
                <Grid size={{xs: 12, md: 6}}>
                    <GlobalStatsCard stats={globalStats}/>
                </Grid>
            </Grid>
        </>
    );
}
