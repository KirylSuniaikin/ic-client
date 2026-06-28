import React from "react";
import {Box, Card, CardContent, Chip, Grid, Stack, Tooltip, Typography} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {StatEmptyState, StatSkeleton} from "./performance/statPlaceholders";

export type CustomerColumn = {
    heading: string;        // "New" / "Returning"
    orders: number;         // orders placed by this segment
    sharePct: string;       // share of all orders, whole number (e.g. "30")
    customers?: number;     // unique customers (returning segment only)
    ordersPerCustomer?: string; // avg orders per customer (returning only)
};

type Props = {
    title: string;
    columns: CustomerColumn[] | null; // null while the first fetch is loading
};

// Plain-English definitions so an admin never has to decode the numbers.
const metricLegend = (
    <Box sx={{p: 0.5, maxWidth: 240}}>
        <Typography variant="caption" component="div" sx={{mb: 0.5}}>
            <b>orders</b> — orders placed in the selected range
        </Typography>
        <Typography variant="caption" component="div" sx={{mb: 0.5}}>
            <b>% of orders</b> — share of all (new + returning) orders
        </Typography>
        <Typography variant="caption" component="div" sx={{mb: 0.5}}>
            <b>customers</b> — unique returning customers
        </Typography>
        <Typography variant="caption" component="div">
            <b>orders each</b> — average orders per returning customer
        </Typography>
    </Box>
);

export const CustomerStatCard = ({title, columns}: Props): JSX.Element => {
    return (
        <Card variant="outlined" sx={{mb: 2, borderRadius: 3, borderColor: "#eee", backgroundColor: "#fff", boxShadow: 3}}>
            <CardContent sx={{pb: 2, "&:last-child": {pb: 2}}}>
                <Stack direction="row" alignItems="center" gap={0.5} sx={{mb: 1.5}}>
                    <Typography variant="subtitle1" fontWeight="bold">
                        {title}
                    </Typography>
                    <Tooltip title={metricLegend} arrow enterTouchDelay={0} leaveTouchDelay={4000}>
                        <InfoOutlinedIcon fontSize="small" sx={{color: "text.disabled", cursor: "pointer"}}/>
                    </Tooltip>
                </Stack>

                {columns == null ? (
                    <Grid container spacing={2}>
                        {[0, 1].map((i) => (
                            <Grid size={{xs: 6}} key={i}>
                                <StatSkeleton lines={3}/>
                            </Grid>
                        ))}
                    </Grid>
                ) : columns.every((c) => c.orders === 0) ? (
                    <StatEmptyState message="No orders in this range"/>
                ) : (
                <Grid container spacing={2} alignItems="flex-start">
                    {columns.map((col, index) => (
                        <Grid
                            size={{xs: 6}}
                            key={index}
                            sx={{
                                borderLeft: index > 0 ? "1px solid #f0f0f0" : "none",
                                pl: index > 0 ? 2 : 0,
                            }}
                        >
                            <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 0.5}}>
                                {col.heading}
                            </Typography>

                            <Stack direction="row" alignItems="baseline" gap={0.5}>
                                <Typography variant="h4" fontWeight="bold" sx={{lineHeight: 1}}>
                                    {col.orders}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    orders
                                </Typography>
                            </Stack>

                            <Chip
                                size="small"
                                label={`${col.sharePct}% of orders`}
                                sx={{
                                    mt: 1,
                                    height: 22,
                                    fontWeight: 600,
                                    // Neutral Apple-gray fill — a share-of-orders figure is
                                    // informational, not a warning, so avoid the red.
                                    backgroundColor: "rgba(120, 120, 128, 0.12)",
                                    color: "#3a3a3c",
                                }}
                            />

                            {col.customers != null && (
                                <Typography variant="caption" color="text.secondary" sx={{display: "block", mt: 1, lineHeight: 1.4}}>
                                    {col.customers} customers
                                    {col.ordersPerCustomer != null && (
                                        <>
                                            <br/>
                                            {col.ordersPerCustomer} orders each
                                        </>
                                    )}
                                </Typography>
                            )}
                        </Grid>
                    ))}
                </Grid>
                )}
            </CardContent>
        </Card>
    );
};
