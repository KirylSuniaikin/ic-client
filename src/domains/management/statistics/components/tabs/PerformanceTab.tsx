import React from "react";
import {Grid} from "@mui/material";
import {CustomerStatCard, CustomerColumn} from "../CustomerStatCard";
import {DateRangeStatsCard} from "../performance/DateRangeStatsCard";
import {RetentionCheckCard} from "../performance/RetentionCheckCard";
import {GlobalStatsCard} from "../performance/GlobalStatsCard";
import {DeliveryAvailabilityCard} from "../performance/DeliveryAvailabilityCard";
import {countPercentage} from "../performance/statsFormat";
import type {AvailabilityScope} from "../performance/DeliveryAvailabilityCard";
import type {DeliveryAvailabilityStats, SellsByHourStat, StatsResponse} from "../../types";

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
    deliveryAvailability: DeliveryAvailabilityStats | null;
    /** Passed straight through: the card pins the branches and dates its figures were fetched for. */
    deliveryAvailabilityScope: AvailabilityScope | null;
    selectedDate: Date;
    onSelectedDateChange: (date: Date) => void;
    onRefresh: () => void;
};

export function PerformanceTab({
                                   rangeStats,
                                   globalStats,
                                   retentionStats,
                                   sellStats,
                                   deliveryAvailability,
                                   deliveryAvailabilityScope,
                                   selectedDate,
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
                sellStats={sellStats}
            />

            {/* Directly under the revenue card: the staffing question is about the same
                period and the same branches, and a manager reading "Keeta took 40% of
                orders" wants to know how much of that was our own delivery being shut. */}
            <DeliveryAvailabilityCard stats={deliveryAvailability} scope={deliveryAvailabilityScope}/>

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
