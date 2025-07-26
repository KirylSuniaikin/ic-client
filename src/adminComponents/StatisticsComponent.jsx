import React, { useEffect, useState } from 'react';
import {Box, Typography, Button, Fab, Grid, CardContent, Card, Popover} from '@mui/material';
import { DateRange } from 'react-date-range';
import {endOfDay, startOfDay} from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import {fetchStatistics} from "../api/api";
import {enUS} from "date-fns/locale";
import { formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';
import CloseIcon from "@mui/icons-material/Close";


const brandRed = "#E44B4C";

export default function StatisticsComponent({isOpen, onClose}) {
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
    const [changed, setChanged] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);

    const handleOpenCalendar = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseCalendar = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const id = open ? 'date-range-popover' : undefined;

    const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });


    const loadStats = async () => {
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

            setRangeStats({
                totalRevenue: response.total_revenue,
                totalOrders: response.total_order_count,
                newCustomers: response.new_customer_ordered_count,
                oldCustomers: response.old_customer_ordered_count,
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
    };

    useEffect(() => {
        loadStats();
    }, []);

    const [retentionAnchorEl, setRetentionAnchorEl] = useState(null);
    const retentionOpen = Boolean(retentionAnchorEl);
    const retentionId = retentionOpen ? 'retention-date-popover' : undefined;

    return (
        <Box sx={{ p: 1, height: "100vh", overflowY: "auto",scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
            <Fab
                color="primary"
                aria-label="close"
                onClick={onClose}
                sx={{
                    position: 'fixed',
                    top: 16,
                    right: 16,
                    backgroundColor: brandRed,
                    color: "white",
                    '&:hover': {
                        backgroundColor: '#d23c3d',
                    },
                }}
            >
                <CloseIcon sx={{ fontSize: 30 }} />
            </Fab>

            <Card sx={{ borderRadius: 3, boxShadow: 3, maxWidth: 500, mb: 2}}>
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

                    {/* Button to open calendar */}
                    <Button variant="outlined" onClick={handleOpenCalendar}>
                        {formatDate(dateRange[0].startDate)} — {formatDate(dateRange[0].endDate)}
                    </Button>

                    {/* Popover with calendar + Refresh */}
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
                                    setChanged(true);
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
                        <Grid container spacing={2} sx={{ mt: 2 }}>
                            <Grid item xs={6}>
                                <Box textAlign="center">
                                    <Typography variant="body2" color="text.secondary">
                                        Revenue
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {rangeStats.totalRevenue} BD
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6}>
                                <Box textAlign="center">
                                    <Typography variant="body2" color="text.secondary">
                                        Orders
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {rangeStats.totalOrders}
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
                                    setChanged(true);
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
        </Box>
    );
}
