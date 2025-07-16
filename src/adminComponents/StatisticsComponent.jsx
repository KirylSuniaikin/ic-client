import React, { useEffect, useState } from 'react';
import {Box, Typography, Button, CircularProgress, Fab} from '@mui/material';
import { DateRange } from 'react-date-range';
import {endOfDay, startOfDay} from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import {fetchStatistics} from "../api/api";
import CloseIcon from "@mui/icons-material/Close";
import {arSA} from "date-fns/locale";
import { formatInTimeZone } from 'date-fns-tz';


const brandRed = "#E44B4C";

export default function StatisticsComponent({isOpen, onClose}) {
    const [dateRange, setDateRange] = useState([
        {
            startDate: startOfDay(new Date()),
            endDate: endOfDay(new Date()),
            key: 'selection'

        }
    ]);    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [changed, setChanged] = useState(false);

    const loadStats = async () => {
        try {
            setLoading(true);
            console.log(dateRange[0].startDate)
            console.log(dateRange[0].endDate)
            const start = formatInTimeZone(dateRange[0].startDate, 'Asia/Bahrain', 'yyyy-MM-dd');
            const end = formatInTimeZone(dateRange[0].endDate, 'Asia/Bahrain', 'yyyy-MM-dd');
            const response = await fetchStatistics(start, end);
            setData(response);
        } catch (err) {
            console.error("Failed to load statistics:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    return (
        <Box sx={{ p: 0, position: "relative", height: "100vh", display: "flex", flexDirection: "column" }}>
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
        <Typography variant="h5" sx={{ mb: 2 }}>📊 Statistics</Typography>
            <DateRange
                editableDateInputs={true}
                onChange={item => {
                    setDateRange([item.selection]);
                    setChanged(true);
                }}
                moveRangeOnFirstSelection={false}
                ranges={dateRange}
                locale={arSA}
            />

            {changed && (
                <Button variant="contained" onClick={loadStats} sx={{ mt: 2 }}>
                    🔁 Upload
                </Button>
            )}
            {loading ? (
                <Box sx={{ mt: 4 }}><CircularProgress /></Box>
            ) : data ? (
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h6"><strong>💰 Total revenue:</strong> {data.total_revenue} BD</Typography>
                    <Typography variant="h6"><strong>📦 Orders:</strong> {data.total_order_count}</Typography>
                    <Typography variant="h6"><strong>🆕 New Clients order:</strong> {data.new_customer_ordered_count}</Typography>
                    <Typography variant="h6"><strong>🔁 Old Clients order:</strong> {data.old_customer_ordered_count}</Typography>
                </Box>
            ) : (
                <Typography variant="body2" sx={{ mt: 4 }}>Нет данных</Typography>
            )}
        </Box>
    );
}
