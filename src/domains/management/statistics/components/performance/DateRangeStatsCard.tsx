import React from "react";
import {Box, Card, CardContent, Grid, Typography} from "@mui/material";
import {PlatformsStatisticsGrid} from "./PlatformsStatisticsGrid";
import {TopProductsTable} from "../TopProductsTable";
import {RevenueByHourTable} from "../RevenueByHourTable";
import {StatEmptyState, StatSkeleton} from "./statPlaceholders";
import {formatStatRange} from "./statsFormat";
import type {SellsByHourStat, StatsResponse} from "../../types";

type Props = {
    stats: StatsResponse | null;
    sellStats: SellsByHourStat[];
};

// The date-range picker button + popover moved up into StatisticsComponent's sticky
// filter row (MULTIBRANCH_SPEC.md Part 4) -- this card keeps only its stats rendering.
export function DateRangeStatsCard({stats, sellStats}: Props): JSX.Element {
    return (
        <Card sx={{borderRadius: 3, boxShadow: 3, width: "100%", mb: 2, mt: 1}}>
            <CardContent>
                <Box sx={{mb: 2, flexWrap: "wrap", gap: 1}}>
                    <Typography variant="h6">📆 <b>Stats by Date Range</b></Typography>
                </Box>

                {stats == null ? (
                    <StatSkeleton lines={4}/>
                ) : (stats.totalPickUpOrderCount + stats.totalTalabatOrders + stats.totalKeetaOrders) === 0 ? (
                    <StatEmptyState message="No orders in this range"/>
                ) : (
                    <>
                        <Grid container spacing={4}>
                            <Grid size={{xs: 12, md: 7, lg: 8}}>
                                <Typography variant="subtitle1" sx={{mb: stats.previous ? 0 : 1, fontWeight: "bold"}}>
                                    Platforms Statistics
                                </Typography>
                                {stats.previous && (
                                    <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 1}}>
                                        revenue trend vs {formatStatRange(stats.previous.startDate, stats.previous.finishDate)}
                                    </Typography>
                                )}
                                <PlatformsStatisticsGrid stats={stats}/>
                                <Box sx={{display: {xs: "block", md: "none"}, height: 24}}/>
                            </Grid>

                            <Grid
                                size={{xs: 12, md: 5, lg: 4}}
                                sx={{borderLeft: {md: "1px solid #e0e0e0"}, pl: {md: 2}}}
                            >
                                <Typography variant="subtitle1" sx={{mb: 1, fontWeight: "bold"}}>
                                    Top 10 Products
                                </Typography>
                                <Box sx={{overflowX: "auto"}}>
                                    <TopProductsTable topProducts={stats.topProducts}/>
                                </Box>
                            </Grid>
                        </Grid>

                        <Box sx={{my: 3, borderBottom: "1px solid #e0e0e0"}}/>

                        <Typography variant="subtitle1" sx={{mt: 2, mb: 1, fontWeight: "bold"}}>
                            Revenue By Hour
                        </Typography>
                        <Box sx={{overflowX: "auto"}}>
                            <RevenueByHourTable rawData={sellStats}/>
                        </Box>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
