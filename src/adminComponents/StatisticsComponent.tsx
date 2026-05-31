// Assumed: Actual props are {onClose, branchId, role} — spec's simplified {branchId} doesn't match codebase.
import React, {useCallback, useEffect, useState} from 'react';
import {
    Box,
    Typography,
    Button,
    Grid,
    CardContent,
    Card,
    Popover,
    ToggleButton,
    ToggleButtonGroup, CircularProgress
} from '@mui/material';
import {DateRange} from 'react-date-range';
import {endOfDay, startOfDay} from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import {fetchStatistics} from "../api/api";
import {enUS} from "date-fns/locale";
import {formatInTimeZone} from 'date-fns-tz';
import {format} from 'date-fns';
import {BackTopBar} from "../management/consumptionComponents/BackTopBar";
import {ConsumptionStatistics} from "../management/consumptionComponents/ConsumptionStatistics";
import {DoughUsageTable} from "./DoughUsageTable";
import {RevenueByHourTable} from "./RevenueByHourTable";
import {TopProductsTable} from "./TopProductsTable";
import {PlatformStatCard} from "./PlatformStatCatd";
import {ProductsTable} from "../management/productsTable/ProductsTable";
import {VatReportCard} from "./VatReportCard";
import {CustomerStatCard} from "./CustomerStatCard";
import {StaffRoles} from "../management/types/authTypes";
import {StaffSummaryContent} from "../management/shiftComponents/StaffSummaryContent";
import PrepPlanTable from "./PrepPlanTable";
import type {StatsResponse, DoughUsageTO, SellsByHourStat, TopFiveProducts} from "./types/statsTypes";

interface DateRangeState {
    startDate: Date;
    endDate: Date;
    key: string;
}

interface StatisticsComponentProps {
    onClose: () => void;
    branchId: string;
    role: StaffRoles | null;
}

export default function StatisticsComponent({onClose, branchId, role}: StatisticsComponentProps): JSX.Element {
    const [dateRange, setDateRange] = useState<DateRangeState[]>([
        {
            startDate: startOfDay(new Date()),
            endDate: endOfDay(new Date()),
            key: 'selection'
        }
    ]);
    const [globalStats, setGlobalStats] = useState<StatsResponse | null>(null);
    const [rangeStats, setRangeStats] = useState<StatsResponse | null>(null);
    const [retentionStats, setRetentionStats] = useState<StatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
    const [doughUsage, setDoughUsage] = useState<DoughUsageTO[]>([]);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [sellStats, setSellStats] = useState<SellsByHourStat[]>([]);

    const handleOpenCalendar = (event: React.MouseEvent<HTMLElement>): void => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseCalendar = (): void => {
        setAnchorEl(null);
    };

    function countPercentage(total: number, number: number): string {
        if (!total || Number.isNaN(total)) return "0";
        return ((number / total) * 100).toFixed(2);
    }

    const open = Boolean(anchorEl);
    const id = open ? 'date-range-popover' : undefined;

    const formatDate = (date: Date): string => date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});

    const loadStats = useCallback(async (manualDateRange?: DateRangeState[], manualSelectedDate?: Date): Promise<void> => {
        try {
            setLoading(true);

            const currentRange = manualDateRange || dateRange;
            const currentSelectedDate = manualSelectedDate || selectedDate;

            const start = formatInTimeZone(currentRange[0].startDate, 'Asia/Bahrain', 'yyyy-MM-dd');
            const end = formatInTimeZone(currentRange[0].endDate, 'Asia/Bahrain', 'yyyy-MM-dd');
            const retentionDate = formatInTimeZone(currentSelectedDate, 'Asia/Bahrain', 'yyyy-MM-dd');

            const response = await fetchStatistics(start, end, formatInTimeZone(retentionDate, 'Asia/Bahrain', 'yyyy-MM-dd'), branchId.toString()) as StatsResponse;

            setGlobalStats(response);
            setRangeStats(response);
            setRetentionStats(response);
            setDoughUsage(response.doughUsageTOS);
            setSellStats(response.sellsByHour);
        } catch (err) {
            console.error("Failed to load statistics:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const [retentionAnchorEl, setRetentionAnchorEl] = useState<HTMLElement | null>(null);
    const [mode, setMode] = useState(role === StaffRoles.SUPER_MANAGER ? "Performance" : "Consumption");
    const retentionOpen = Boolean(retentionAnchorEl);
    const retentionId = retentionOpen ? 'retention-date-popover' : undefined;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
            {loading && (
                <Box sx={{position: 'fixed', top: 64, right: 16, zIndex: 1500}}>
                    <CircularProgress size={24}/>
                </Box>
            )}

            <Box sx={{ flexShrink: 0 }}>
                <BackTopBar onClose={onClose} title="Statistics" />
            </Box>

            <Box sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                p: 1,
                backgroundColor: "#fbfaf6"
            }}>
                <Box sx={{
                    px: 1, pt: 2, pb: 1,
                    flexShrink: 0,
                    backgroundColor: "#fbfaf6",
                    overflowX: 'auto',
                    whiteSpace: 'nowrap'
                }}>
                    <ToggleButtonGroup
                        exclusive
                        value={mode}
                        onChange={(_, v) => v && setMode(v)}
                        size="small"
                        sx={{
                            columnGap: 1,
                            '& .MuiToggleButtonGroup-grouped': {
                                border: '1px solid #e0e0e0',
                                borderRadius: 999,
                                margin: 0,
                                '&:not(:first-of-type)': {
                                    marginLeft: 0,
                                    borderLeft: '1px solid #e0e0e0',
                                },
                            },
                            '& .MuiToggleButton-root': {
                                textTransform: 'none',
                                px: 2,
                            },
                            '& .MuiToggleButton-root.Mui-selected': {
                                backgroundColor: '#E44B4C',
                                color: '#fff',
                                borderColor: '#E44B4C',
                                '&:hover': {backgroundColor: '#d23c3d', borderColor: '#d23c3d'},
                            },
                        }}
                    >
                        {role === StaffRoles.SUPER_MANAGER && (
                            <ToggleButton value="Performance">Performance</ToggleButton>
                        )}
                        <ToggleButton value="Consumption">Consumption</ToggleButton>
                        <ToggleButton value="Pricing">Pricing</ToggleButton>
                        <ToggleButton value="Reports">Reports</ToggleButton>
                        {(role === StaffRoles.MANAGER || role === StaffRoles.SUPER_MANAGER) && (
                            <ToggleButton value="Shifts">Shifts</ToggleButton>
                        )}
                    </ToggleButtonGroup>
                </Box>

                <Box sx={{
                    flex: 1,
                    overflowY: "auto",
                    overscrollBehaviorY: 'contain',
                    p: 1,
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": {display: "none"},
                }}>
                    {mode === "Performance" && (<>
                            {rangeStats && (
                                <Grid size={{xs: 12, md: 6}}>
                                    <CustomerStatCard
                                        title="Customer(Pick Up + Keeta)"
                                        items={[
                                            {
                                                label: "New Customers",
                                                value: `${rangeStats.newCustomerOrderedCount}(${countPercentage(rangeStats.newCustomerOrderedCount + rangeStats.oldCstmrOrderCount, rangeStats.newCustomerOrderedCount)}%)`
                                            },
                                            {
                                                label: "Returning",
                                                value: `${rangeStats.oldCstmrOrderCount}(${countPercentage(rangeStats.newCustomerOrderedCount + rangeStats.oldCstmrOrderCount, rangeStats.oldCstmrOrderCount)}%, ${rangeStats.oldCustomerOrderedCount}, ${rangeStats.oldCustomerOrderedCount ? (rangeStats.oldCstmrOrderCount / rangeStats.oldCustomerOrderedCount).toFixed(2) : '0.00'})`
                                            }
                                        ]}
                                    />
                                </Grid>
                            )}
                            <Card sx={{borderRadius: 3, boxShadow: 3, width: "100%", mb: 2, mt: 1}}>
                                <CardContent>
                                    <Box sx={{mb: 2, flexWrap: 'wrap', gap: 1}}>
                                        <Typography variant="h6">📆 <b>Stats by Date Range</b></Typography>
                                        <Box sx={{mt: 1}}/>
                                        <Button variant="outlined" onClick={handleOpenCalendar}>
                                            {formatDate(dateRange[0].startDate)} — {formatDate(dateRange[0].endDate)}
                                        </Button>
                                    </Box>

                                    <Popover
                                        id={id}
                                        open={open}
                                        anchorEl={anchorEl}
                                        onClose={handleCloseCalendar}
                                        anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                                    >
                                        <Box sx={{p: 2}}>
                                            <DateRange
                                                editableDateInputs={true}
                                                onChange={item => setDateRange([item.selection as DateRangeState])}
                                                moveRangeOnFirstSelection={false}
                                                ranges={dateRange}
                                                locale={enUS}
                                            />
                                            <Button
                                                variant="contained"
                                                fullWidth
                                                onClick={() => { loadStats(dateRange, selectedDate); handleCloseCalendar(); }}
                                                sx={{mt: 2}}
                                            >
                                                🔁 Refresh
                                            </Button>
                                        </Box>
                                    </Popover>

                                    {rangeStats && (
                                        <>
                                            <Grid container spacing={4}>
                                                <Grid size={{xs: 12, md: 7, lg: 8}}>
                                                    <Typography variant="subtitle1" sx={{mt: {xs: 0, md: 0}, mb: 1, fontWeight: "bold"}}>
                                                        Platforms Statistics
                                                    </Typography>
                                                    <Grid container spacing={2}>
                                                        <Grid size={{xs: 12, sm: 6}}>
                                                            <PlatformStatCard
                                                                title="Pick Up"
                                                                items={[
                                                                    {label: "Revenue", value: rangeStats.pickUpTotalRevenue, subValue: "BD"},
                                                                    {label: "Orders", value: rangeStats.pickUpTotalOrderCount},
                                                                ]}
                                                            />
                                                        </Grid>
                                                        <Grid size={{xs: 12, sm: 6}}>
                                                            <PlatformStatCard
                                                                title="Talabat"
                                                                items={[
                                                                    {label: "Revenue", value: rangeStats.totalTalabatRevenue, subValue: "BD"},
                                                                    {label: "Orders", value: rangeStats.totalTalabatOrders},
                                                                ]}
                                                            />
                                                        </Grid>
                                                        <Grid size={{xs: 12, sm: 6}}>
                                                            <PlatformStatCard
                                                                title="Keeta"
                                                                items={[
                                                                    {label: "Revenue", value: rangeStats.totalKeetaRevenue, subValue: "BD"},
                                                                    {label: "Orders", value: rangeStats.totalKeetaOrders},
                                                                ]}
                                                            />
                                                        </Grid>
                                                    </Grid>
                                                    <Box sx={{display: {xs: 'block', md: 'none'}, height: 24}}/>
                                                </Grid>

                                                <Grid size={{xs: 12, md: 5, lg: 4}} sx={{borderLeft: {md: "1px solid #e0e0e0"}, pl: {md: 2}}}>
                                                    <Typography variant="subtitle1" sx={{mt: {xs: 0, md: 0}, mb: 1, fontWeight: "bold"}}>
                                                        Top 10 Products
                                                    </Typography>
                                                    <TopProductsTable topProducts={rangeStats.topProducts as TopFiveProducts[]}/>
                                                </Grid>
                                            </Grid>

                                            <Box sx={{my: 3, borderBottom: "1px solid #e0e0e0"}}/>

                                            <Typography variant="subtitle1" sx={{mt: 2, mb: 1, fontWeight: "bold"}}>
                                                Revenue By Hour
                                            </Typography>
                                            <RevenueByHourTable rawData={sellStats}/>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Grid container spacing={2} sx={{mb: 2}}>
                                <Grid size={{xs: 12, md: 6}}>
                                    <Card sx={{borderRadius: 3, boxShadow: 3, height: "100%", display: "flex", flexDirection: "column"}}>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>🔄 <b>Retention Check</b></Typography>
                                            <Button variant="outlined" onClick={(e) => setRetentionAnchorEl(e.currentTarget)}>
                                                {formatDate(selectedDate)}
                                            </Button>

                                            <Popover
                                                id={retentionId}
                                                open={retentionOpen}
                                                anchorEl={retentionAnchorEl}
                                                onClose={() => setRetentionAnchorEl(null)}
                                                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                                            >
                                                <Box sx={{p: 2}}>
                                                    <input
                                                        type="date"
                                                        value={format(selectedDate, 'yyyy-MM-dd')}
                                                        onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                                        style={{padding: "8px", fontSize: "16px", width: "100%"}}
                                                    />
                                                    <Button
                                                        variant="contained"
                                                        fullWidth
                                                        onClick={() => { loadStats(dateRange, selectedDate); setRetentionAnchorEl(null); }}
                                                        sx={{mt: 2}}
                                                    >
                                                        🔁 Upload
                                                    </Button>
                                                </Box>
                                            </Popover>

                                            {retentionStats && (
                                                <Box sx={{flexGrow: 1, display: 'flex', alignItems: 'center', mt: 2}}>
                                                    <Grid container spacing={2}>
                                                        <Grid size={{xs: 6}}>
                                                            <Box textAlign="center">
                                                                <Typography variant="body2" color="text.secondary">New Clients</Typography>
                                                                <Typography variant="h5" fontWeight="bold">
                                                                    {retentionStats.monthTotalCustomers}
                                                                </Typography>
                                                            </Box>
                                                        </Grid>
                                                        <Grid size={{xs: 6}}>
                                                            <Box textAlign="center">
                                                                <Typography variant="body2" color="text.secondary">Retained</Typography>
                                                                <Typography variant="h5" fontWeight="bold">
                                                                    {retentionStats.retainedCustomers}{' '}
                                                                    <Typography component="span" variant="caption" color="text.secondary">
                                                                        ({retentionStats.retentionPercentage?.toFixed(0) ?? '-'}%)
                                                                    </Typography>
                                                                </Typography>
                                                            </Box>
                                                        </Grid>
                                                    </Grid>
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid size={{xs: 12, md: 6}}>
                                    <Card sx={{borderRadius: 3, boxShadow: 3, height: "100%"}}>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>📉 <b>Global Stats</b></Typography>
                                            {globalStats && (
                                                <Grid container spacing={2} sx={{mt: 1}}>
                                                    <Grid size={{xs: 6}}>
                                                        <Box textAlign="center">
                                                            <Typography variant="body2" color="text.secondary">ARPU</Typography>
                                                            <Typography variant="h5" fontWeight="bold">
                                                                {globalStats.arpu?.toFixed(2) ?? '-'}{' '}
                                                                <Typography component="span" variant="caption">BD</Typography>
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid size={{xs: 6}}>
                                                        <Box textAlign="center">
                                                            <Typography variant="body2" color="text.secondary">AOV (All Time)</Typography>
                                                            <Typography variant="h5" fontWeight="bold">
                                                                {globalStats.averageOrderValueAllTime?.toFixed(2) ?? '-'}{' '}
                                                                <Typography component="span" variant="caption">BD</Typography>
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid size={{xs: 6}}>
                                                        <Box textAlign="center">
                                                            <Typography variant="body2" color="text.secondary">Unique Customers</Typography>
                                                            <Typography variant="h5" fontWeight="bold">
                                                                {globalStats.uniqueCustomersAllTime}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid size={{xs: 6}}>
                                                        <Box textAlign="center">
                                                            <Typography variant="body2" color="text.secondary">Repeat Customers</Typography>
                                                            <Typography variant="h5" fontWeight="bold">
                                                                {globalStats.repeatCustomersAllTime}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                </Grid>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </>
                    )}
                    {mode === "Consumption" && (
                        <>
                            <Box sx={{mt: 1}}>
                                <PrepPlanTable branchId={branchId}/>
                                <DoughUsageTable rows={doughUsage}/>
                                <Box sx={{mt: 1}}/>
                                <ConsumptionStatistics branchId={branchId.toString()}/>
                            </Box>
                        </>
                    )}
                    {mode === "Reports" && <VatReportCard branchId={branchId}/>}
                    {mode === "Pricing" && <ProductsTable/>}
                    {mode === "Shifts" && <StaffSummaryContent branchId={branchId}/>}
                </Box>
            </Box>
        </Box>
    );
}
