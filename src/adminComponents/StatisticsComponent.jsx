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

export default function StatisticsComponent({onClose, branchId, role}) {
    const [dateRange, setDateRange] = useState([
        {
            startDate: startOfDay(new Date()),
            endDate: endOfDay(new Date()),
            key: 'selection'
        }
    ]);
    const [globalStats, setGlobalStats] = useState(null);
    const [rangeStats, setRangeStats] = useState(null);
    const [retentionStats, setRetentionStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()))
    const [doughUsage, setDoughUsage] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const [sellStats, setSellStats] = useState([]);

    const handleOpenCalendar = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseCalendar = () => {
        setAnchorEl(null);
    };

    function countPercentage(total, number) {
        if (!total || Number.isNaN(Number(total))) {
            return 0;
        }
        return ((Number(number) / Number(total)) * 100).toFixed(2);
    }

    const open = Boolean(anchorEl);
    const id = open ? 'date-range-popover' : undefined;

    const formatDate = (date) => date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});


    const loadStats = useCallback(async (manualDateRange, manualSelectedDate) => {
        try {
            setLoading(true);

            const currentRange = manualDateRange || dateRange;
            const currentSelectedDate = manualSelectedDate || selectedDate;

            const start = formatInTimeZone(currentRange[0].startDate, 'Asia/Bahrain', 'yyyy-MM-dd');
            const end = formatInTimeZone(currentRange[0].endDate, 'Asia/Bahrain', 'yyyy-MM-dd');
            const retentionDate = formatInTimeZone(currentSelectedDate, 'Asia/Bahrain', 'yyyy-MM-dd');

            const response = await fetchStatistics(start, end, formatInTimeZone(retentionDate, 'Asia/Bahrain', 'yyyy-MM-dd'), branchId.toString());
            setGlobalStats({
                arpu: response.ARPU,
                uniqueClients: response.unique_customers_all_time,
                repeatClients: response.repeat_customers_all_time,
                aov: response.average_order_value_all_time,
            });

            setDoughUsage({
                doughUsage: response.doughUsageTOS
            })

            setRangeStats({
                totalPickUpRevenue: response.pick_up_total_revenue,
                totalPickUpOrders: response.pick_up_total_order_count,
                newCustomers: response.new_customer_ordered_count,
                oldCustomers: response.old_customer_ordered_count,
                totalJahezRevenue: response.jahez_total_revenue,
                totalJahezOrders: response.jahez_total_order_count,
                totalTalabatOrders: response.totalTalabatOrders,
                totalTalabatRevenue: response.totalTalabatRevenue,
                totalKeetaOrders: response.totalKeetaOrders,
                totalKeetaRevenue: response.totalKeetaRevenue,
                topProducts: response.topProducts
            });

            setSellStats({
                sellStats: response.sellsByHour,
            })

            setDoughUsage({
                doughUsage: response.doughUsageTOS
            })

            setRetentionStats({
                month_count: response.month_total_customers,
                retained_customers: response.retained_customers,
                percentage: response.retention_percentage
            });
        } catch (err) {
            console.error("Failed to load statistics:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const [retentionAnchorEl, setRetentionAnchorEl] = useState(null);
    const [mode, setMode] = useState(role === StaffRoles.SUPER_MANAGER ? "Performance" : "Consumption");
    const retentionOpen = Boolean(retentionAnchorEl);
    const retentionId = retentionOpen ? 'retention-date-popover' : undefined;

    return (
        <>
            {loading && (
                <Box sx={{position: 'fixed', top: 64, right: 16, zIndex: 1500}}>
                    <CircularProgress size={24}/>
                </Box>
            )}

            <Box sx={{
                gap: 1,
            }}>
                <BackTopBar
                    onClose={onClose}
                    title="Statistics"
                />
            </Box>

            <Box sx={{
                p: 1,
                height: "100vh",
                overflowX: 'hidden',
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
                    </ToggleButtonGroup>
                </Box>
                <Box sx={{
                    flex: 1,
                    overflowY: "auto",
                    overflowX: "hidden",
                    p: 1,
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": {display: "none"},
                }}>
                {mode === "Performance" && (<>
                        {rangeStats && (
                            <Grid item xs={12} md={6}>
                                    <CustomerStatCard
                                        title="Customer(Pick Up + Keeta)"
                                        items={[
                                            {label: "New Customers", value:  `${rangeStats.newCustomers}(${countPercentage(Number(rangeStats.newCustomers)+Number(rangeStats.oldCustomers), Number(rangeStats.newCustomers))}%)`},
                                            {label: "Returning", value: `${rangeStats.oldCustomers}(${countPercentage(Number(rangeStats.newCustomers)+Number(rangeStats.oldCustomers), Number(rangeStats.oldCustomers))}%)`}
                                        ]}
                                    ></CustomerStatCard>
                            </Grid>
                        )}
                            <Card sx={{borderRadius: 3, boxShadow: 3, width: "100%", mb: 2, mt: 1}}>
                                <CardContent>
                                    <Box sx={{mb: 2, flexWrap: 'wrap', gap: 1 }}>
                                        <Typography variant="h6">📆 <b>Stats by Date Range</b></Typography>
                                        <Box sx={{mt: 1}}></Box>
                                        <Button variant="outlined" onClick={handleOpenCalendar}>
                                            {formatDate(dateRange[0].startDate)} — {formatDate(dateRange[0].endDate)}
                                        </Button>
                                    </Box>

                                    <Popover
                                        id={id}
                                        open={open}
                                        anchorEl={anchorEl}
                                        onClose={handleCloseCalendar}
                                        anchorOrigin={{
                                            vertical: 'bottom',
                                            horizontal: 'left',
                                        }}
                                    >
                                        <Box sx={{p: 2}}>
                                            <DateRange
                                                editableDateInputs={true}
                                                onChange={item => {
                                                    setDateRange([item.selection]);
                                                }}
                                                moveRangeOnFirstSelection={false}
                                                ranges={dateRange}
                                                locale={enUS}
                                            />
                                            <Button
                                                variant="contained"
                                                fullWidth
                                                onClick={() => {
                                                    loadStats(dateRange, selectedDate);
                                                    handleCloseCalendar();
                                                }}
                                                sx={{mt: 2}}
                                            >
                                                🔁 Refresh
                                            </Button>
                                        </Box>
                                    </Popover>

                                    {rangeStats && (
                                        <>
                                            <Grid container spacing={4}>
                                                <Grid item xs={12} md={7} lg={8} >

                                                    <Typography variant="subtitle1" sx={{mt: {xs: 0, md: 0}, mb: 1, fontWeight: "bold"}}>
                                                        Platforms Statistics
                                                    </Typography>

                                                    <Grid container spacing={2}>

                                                        <Grid item xs={12} sm={6}>
                                                            <PlatformStatCard
                                                                title="Pick Up"
                                                                items={[
                                                                    { label: "Revenue", value: rangeStats.totalPickUpRevenue, subValue: "BD" },
                                                                    { label: "Orders", value: rangeStats.totalPickUpOrders },
                                                                ]}
                                                            />
                                                        </Grid>

                                                        <Grid item xs={12} sm={6}>
                                                            <PlatformStatCard
                                                                title="Jahez"
                                                                items={[
                                                                    { label: "Revenue", value: rangeStats.totalJahezRevenue, subValue: "BD" },
                                                                    { label: "Orders", value: rangeStats.totalJahezOrders }
                                                                ]}
                                                            />
                                                        </Grid>

                                                        <Grid item xs={12} sm={6}>
                                                            <PlatformStatCard
                                                                title="Talabat"
                                                                items={[
                                                                    { label: "Revenue", value: rangeStats.totalTalabatRevenue, subValue: "BD" },
                                                                    { label: "Orders", value: rangeStats.totalTalabatOrders }
                                                                ]}
                                                            />
                                                        </Grid>

                                                        <Grid item xs={12} sm={6}>
                                                            <PlatformStatCard
                                                                title="Keeta"
                                                                items={[
                                                                    { label: "Revenue", value: rangeStats.totalKeetaRevenue, subValue: "BD" },
                                                                    { label: "Orders", value: rangeStats.totalKeetaOrders }
                                                                ]}
                                                            />
                                                        </Grid>
                                                    </Grid>

                                                    <Box sx={{ display: { xs: 'block', md: 'none' }, height: 24 }} />
                                                </Grid>

                                                <Grid item xs={12} md={5} lg={4} sx={{
                                                    borderLeft: { md: "1px solid #e0e0e0" },
                                                    pl: { md: 2 }
                                                }}>
                                                    <Typography variant="subtitle1" sx={{mt: {xs: 0, md: 0}, mb: 1, fontWeight: "bold"}}>
                                                        Top 10 Products
                                                    </Typography>
                                                    <TopProductsTable topProducts={rangeStats.topProducts}/>
                                                </Grid>
                                            </Grid>

                                            <Box sx={{my: 3, borderBottom: "1px solid #e0e0e0"}}/>

                                            <Typography variant="subtitle1" sx={{mt: 2, mb: 1, fontWeight: "bold"}}>
                                                Revenue By Hour
                                            </Typography>
                                            <RevenueByHourTable rawData={sellStats.sellStats}/>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Grid container spacing={2} sx={{ mb: 2 }}>

                                <Grid item xs={12} md={6}>
                                    <Card sx={{
                                        borderRadius: 3,
                                        boxShadow: 3,
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column"
                                    }}>
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
                                                        onChange={(e) => {
                                                            setSelectedDate(new Date(e.target.value));
                                                        }}
                                                        style={{padding: "8px", fontSize: "16px", width: "100%"}}
                                                    />
                                                    <Button
                                                        variant="contained"
                                                        fullWidth
                                                        onClick={() => {
                                                            loadStats(dateRange, selectedDate);
                                                            setRetentionAnchorEl(null);
                                                        }}
                                                        sx={{mt: 2}}
                                                    >
                                                        🔁 Upload
                                                    </Button>
                                                </Box>
                                            </Popover>

                                            {retentionStats && (
                                                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', mt: 2 }}>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={6}>
                                                            <Box textAlign="center">
                                                                <Typography variant="body2" color="text.secondary">
                                                                    New Clients
                                                                </Typography>
                                                                <Typography variant="h5" fontWeight="bold">
                                                                    {retentionStats.month_count}
                                                                </Typography>
                                                            </Box>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Box textAlign="center">
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Retained
                                                                </Typography>
                                                                <Typography variant="h5" fontWeight="bold">
                                                                    {retentionStats.retained_customers} <Typography component="span" variant="caption" color="text.secondary">({retentionStats.percentage.toFixed(0)}%)</Typography>
                                                                </Typography>
                                                            </Box>
                                                        </Grid>
                                                    </Grid>
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <Card sx={{
                                        borderRadius: 3,
                                        boxShadow: 3,
                                        height: "100%"
                                    }}>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>📉 <b>Global Stats</b></Typography>
                                            {globalStats && (
                                                <Grid container spacing={2} sx={{ mt: 1 }}>
                                                    <Grid item xs={6}>
                                                        <Box textAlign="center">
                                                            <Typography variant="body2" color="text.secondary">
                                                                ARPU
                                                            </Typography>
                                                            <Typography variant="h5" fontWeight="bold">
                                                                {globalStats.arpu.toFixed(2)} <Typography component="span" variant="caption">BD</Typography>
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Box textAlign="center">
                                                            <Typography variant="body2" color="text.secondary">
                                                                AOV (All Time)
                                                            </Typography>
                                                            <Typography variant="h5" fontWeight="bold">
                                                                {globalStats.aov.toFixed(2)} <Typography component="span" variant="caption">BD</Typography>
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Box textAlign="center">
                                                            <Typography variant="body2" color="text.secondary">
                                                                Unique Customers
                                                            </Typography>
                                                            <Typography variant="h5" fontWeight="bold">
                                                                {globalStats.uniqueClients}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Box textAlign="center">
                                                            <Typography variant="body2" color="text.secondary">
                                                                Repeat Customers
                                                            </Typography>
                                                            <Typography variant="h5" fontWeight="bold">
                                                                {globalStats.repeatClients}
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
                {mode === "Consumption" &&(
                    <>
                        <Box sx={{mt: 1}}>
                            <DoughUsageTable
                                rows={doughUsage.doughUsage}
                            />
                            <Box sx={{mt: 1}}></Box>
                            <ConsumptionStatistics branchId={branchId}/>
                        </Box>
                    </>
                )}
                {mode === "Reports" && (
                    <VatReportCard branchId={branchId}/>
                )}

                {mode === "Pricing" && (
                    <ProductsTable/>
                )}
            </Box>
            </Box>
        </>
    );
}
