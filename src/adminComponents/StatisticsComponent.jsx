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
import { DateRange } from 'react-date-range';
import {endOfDay, startOfDay} from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import {fetchStatistics} from "../api/api";
import {enUS} from "date-fns/locale";
import { formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';
import {BackTopBar} from "../management/consumptionComponents/BackTopBar";
import {ConsumptionStatistics} from "../management/consumptionComponents/ConsumptionStatistics";
import DoughUsageTable from "./DoughUsageTable";

export default function StatisticsComponent({onClose}) {
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
    const [anchorEl, setAnchorEl] = useState(null);
    const [doughUsage, setDoughUsage] = useState([]);

    const handleOpenCalendar = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseCalendar = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? 'date-range-popover' : undefined;

    const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });


    const loadStats = useCallback(async () => {
        try {
            setLoading(true);
            const start = formatInTimeZone(dateRange[0].startDate, 'Asia/Bahrain', 'yyyy-MM-dd');
            const end = formatInTimeZone(dateRange[0].endDate, 'Asia/Bahrain', 'yyyy-MM-dd');

            const response = await fetchStatistics(start, end, formatInTimeZone(selectedDate, 'Asia/Bahrain', 'yyyy-MM-dd'));
            setGlobalStats({
                arpu: response.ARPU,
                uniqueClients: response.unique_customers_all_time,
                repeatClients: response.repeat_customers_all_time,
                aov: response.average_order_value_all_time,
            });

            setDoughUsage({
                doughUsage: response.doughUsageTOS
            })

            console.log(response.doughUsageTOS)

            setRangeStats({
                totalPickUpRevenue: response.pick_up_total_revenue,
                totalPickUpOrders: response.pick_up_total_order_count,
                newCustomers: response.new_customer_ordered_count,
                oldCustomers: response.old_customer_ordered_count,
                totalJahezRevenue: response.jahez_total_revenue,
                totalJahezOrders: response.jahez_total_order_count,
            });

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
    }, [dateRange, selectedDate]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const [retentionAnchorEl, setRetentionAnchorEl] = useState(null);
    const [mode, setMode] = useState("Performance");
    const retentionOpen = Boolean(retentionAnchorEl);
    const retentionId = retentionOpen ? 'retention-date-popover' : undefined;

    if (loading) {
        return (
            <Box sx={{ display: "grid", placeItems: "center", minHeight: 240}}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            <Box sx={{
                gap: 1,
            }}>
            <BackTopBar
                onClose={onClose}
                title="Statistics"
            />
            </Box>

            <Box sx={{ px: 1, pt: 1, backgroundColor: "#fbfaf6" }}>
                <ToggleButtonGroup
                    exclusive
                    value={mode}
                    onChange={(_, v) => v && setMode(v)}
                    size="small"
                    sx={{
                        '& .MuiToggleButton-root': {
                            textTransform: 'none',
                            px: 2,
                            border: '1px solid #e0e0e0',
                        },
                        '& .MuiToggleButtonGroup-grouped': {
                            borderRadius: '999px !important',
                            margin: 0,
                            border: '1px solid #e0e0e0',
                        },
                        '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
                            marginLeft: 1,
                            borderLeft: '1px solid #e0e0e0',
                        },
                        '& .Mui-selected': {
                            backgroundColor: '#E44B4C',
                            color: '#fff',
                            borderColor: '#E44B4C',
                            '&:hover': { backgroundColor: '#d23c3d', borderColor: '#d23c3d' },
                        },
                    }}
                >
                    <ToggleButton value="Performance">Performance</ToggleButton>
                    <ToggleButton value="Consumption">Consumption</ToggleButton>
                </ToggleButtonGroup>
            </Box>

        <Box sx={{ p: 1, height: "100vh", overflowY: "auto",scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }, backgroundColor: "#fbfaf6" }}>
            {mode === "Performance" ? ( <>

                        <DoughUsageTable
                            rows={doughUsage.doughUsage}
                    />

            <Card sx={{ borderRadius: 3, boxShadow: 3, maxWidth: 500, mb: 2, mt: 1}}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>📉 Global Stats</Typography>
                    {globalStats && (
                        <Grid container spacing={4}>
                            <Grid item xs={6}>
                                <Box textAlign="center">
                                    <Typography variant="body2" color="text.secondary">
                                        ARPU
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {globalStats.arpu.toFixed(2)} BD
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6}>
                                <Box textAlign="center">
                                    <Typography variant="body2" color="text.secondary">
                                        AOV (All Time)
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {globalStats.aov.toFixed(2)} BD
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

            <Card sx={{ borderRadius: 3, boxShadow: 3, maxWidth: 600, mb: 2 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>📆 Stats by Date Range</Typography>

                    <Button variant="outlined" onClick={handleOpenCalendar}>
                        {formatDate(dateRange[0].startDate)} — {formatDate(dateRange[0].endDate)}
                    </Button>

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
                        <Box sx={{ p: 2 }}>
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
                                    loadStats();
                                    handleCloseCalendar();
                                }}
                                sx={{ mt: 2 }}
                            >
                                🔁 Refresh
                            </Button>
                        </Box>
                    </Popover>

                    {rangeStats && (
                        <>
                        <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: "bold" }}>
                            Pick Up
                        </Typography>
                        <Grid container spacing={2} sx={{ mt: 2 }}>
                            <Grid item xs={6}>
                                <Box textAlign="center">
                                    <Typography variant="body2" color="text.secondary">
                                        Revenue
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {rangeStats.totalPickUpRevenue} BD
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6}>
                                <Box textAlign="center">
                                    <Typography variant="body2" color="text.secondary">
                                        Orders
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {rangeStats.totalPickUpOrders}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6}>
                                <Box textAlign="center">
                                    <Typography variant="body2" color="text.secondary">
                                        New Customers
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {rangeStats.newCustomers}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6}>
                                <Box textAlign="center">
                                    <Typography variant="body2" color="text.secondary">
                                        Returning Customers
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {rangeStats.oldCustomers}
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                            <Box sx={{ my: 2, borderBottom: "1px solid #e0e0e0" }} />
                            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: "bold" }}>
                                Jahez
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <Box textAlign="center">
                                        <Typography variant="body2" color="text.secondary">Revenue</Typography>
                                        <Typography variant="h5" fontWeight="bold">
                                            {rangeStats.totalJahezRevenue} BD
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={6}>
                                    <Box textAlign="center">
                                        <Typography variant="body2" color="text.secondary">Orders</Typography>
                                        <Typography variant="h5" fontWeight="bold">
                                            {rangeStats.totalJahezOrders}
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card sx={{ borderRadius: 3, boxShadow: 3, maxWidth: 500, mb: 2 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>🔄 Retention Check (Pick up from last month)</Typography>

                    <Button variant="outlined" onClick={(e) => setRetentionAnchorEl(e.currentTarget)}>
                        {formatDate(selectedDate)}
                    </Button>

                    <Popover
                        id={retentionId}
                        open={retentionOpen}
                        anchorEl={retentionAnchorEl}
                        onClose={() => setRetentionAnchorEl(null)}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    >
                        <Box sx={{ p: 2 }}>
                            <input
                                type="date"
                                value={format(selectedDate, 'yyyy-MM-dd')}
                                onChange={(e) => {
                                    setSelectedDate(new Date(e.target.value));
                                }}
                                style={{ padding: "8px", fontSize: "16px", width: "100%" }}
                            />
                            <Button
                                variant="contained"
                                fullWidth
                                onClick={() => {
                                    loadStats();
                                    setRetentionAnchorEl(null);
                                }}
                                sx={{ mt: 2 }}
                            >
                                🔁 Upload
                            </Button>
                        </Box>
                    </Popover>

                    {retentionStats && (
                        <Grid container spacing={2} sx={{ mt: 2 }}>
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
                                        Retained Clients
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {retentionStats.retained_customers} ({retentionStats.percentage.toFixed(2)}%)
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    )}
                </CardContent>
            </Card>
                </>
            ):
            <ConsumptionStatistics/>}
        </Box>
        </>
    );
}
