import React, {useState} from "react";
import {Box, Button, Card, CardContent, Grid, Typography} from "@mui/material";
import {PlatformsStatisticsGrid} from "./PlatformsStatisticsGrid";
import {TopProductsTable} from "../TopProductsTable";
import {RevenueByHourTable} from "../RevenueByHourTable";
import {DateRangePickerPopover} from "./DateRangePickerPopover";
import {StatEmptyState, StatSkeleton} from "./statPlaceholders";
import {formatStatDate, formatStatRange} from "./statsFormat";
import {useStatsLayout} from "../../hooks/useStatsLayout";
import type {DateRangeState, SellsByHourStat, StatsResponse} from "../../types";

type Props = {
    stats: StatsResponse | null;
    dateRange: DateRangeState[];
    sellStats: SellsByHourStat[];
    onRangeChange: (range: DateRangeState[]) => void;
    onRefresh: () => void;
};

export function DateRangeStatsCard({stats, dateRange, sellStats, onRangeChange, onRefresh}: Props): JSX.Element {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const layout = useStatsLayout();
    const isMobile = layout === "mobile";
    const open = Boolean(anchorEl);

    return (
        <Card sx={{borderRadius: 3, boxShadow: 3, width: "100%", mb: 2, mt: 1}}>
            <CardContent>
                <Box sx={{mb: 2, flexWrap: "wrap", gap: 1}}>
                    <Typography variant="h6">📆 <b>Stats by Date Range</b></Typography>
                    <Box sx={{mt: 1}}/>
                    <Button
                        variant="outlined"
                        fullWidth={isMobile}
                        onClick={(e) => setAnchorEl(e.currentTarget)}
                    >
                        {formatStatDate(dateRange[0].startDate)} — {formatStatDate(dateRange[0].endDate)}
                    </Button>
                </Box>

                <DateRangePickerPopover
                    mode="range"
                    id="date-range-popover"
                    open={open}
                    anchorEl={anchorEl}
                    onClose={() => setAnchorEl(null)}
                    range={dateRange}
                    onRangeChange={onRangeChange}
                    applyLabel="🔁 Refresh"
                    onApply={() => {
                        onRefresh();
                        setAnchorEl(null);
                    }}
                />

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
