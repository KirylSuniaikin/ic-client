import React from "react";
import {Box, Card, CardContent, Grid, Stack, Tooltip, Typography} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {StatSkeleton} from "./statPlaceholders";
import {formatPrepTime} from "./statsFormat";
import type {StatsResponse} from "../../types";

type Props = {
    stats: StatsResponse | null;
};

// Caption with an optional ⓘ tooltip, centered to match the stat number below it.
function StatLabel({label, info}: {label: string; info?: string}): JSX.Element {
    return (
        <Stack direction="row" alignItems="center" justifyContent="center" gap={0.5}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            {info && (
                <Tooltip title={info} arrow enterTouchDelay={0} leaveTouchDelay={4000}>
                    <InfoOutlinedIcon sx={{fontSize: 16, color: "text.disabled", cursor: "pointer"}}/>
                </Tooltip>
            )}
        </Stack>
    );
}

export function GlobalStatsCard({stats}: Props): JSX.Element {
    return (
        <Card sx={{borderRadius: 3, boxShadow: 3, height: "100%"}}>
            <CardContent>
                <Typography variant="h6" gutterBottom>📉 <b>Global Stats</b></Typography>
                {stats == null ? (
                    <StatSkeleton lines={2}/>
                ) : (
                    <Grid container spacing={2} sx={{mt: 1}}>
                        <Grid size={{xs: 6}}>
                            <Box textAlign="center">
                                <StatLabel label="ARPU" info="Average Revenue Per User — total revenue ÷ unique customers (all time)."/>
                                <Typography variant="h5" fontWeight="bold">
                                    {stats.arpu?.toFixed(2) ?? "-"}{" "}
                                    <Typography component="span" variant="caption">BD</Typography>
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid size={{xs: 6}}>
                            <Box textAlign="center">
                                <StatLabel label="AOV (All Time)" info="Average Order Value — total revenue ÷ number of orders (all time)."/>
                                <Typography variant="h5" fontWeight="bold">
                                    {stats.averageOrderValueAllTime?.toFixed(2) ?? "-"}{" "}
                                    <Typography component="span" variant="caption">BD</Typography>
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid size={{xs: 6}}>
                            <Box textAlign="center">
                                <Typography variant="body2" color="text.secondary">Unique Customers</Typography>
                                <Typography variant="h5" fontWeight="bold">
                                    {stats.uniqueCustomersAllTime}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid size={{xs: 6}}>
                            <Box textAlign="center">
                                <Typography variant="body2" color="text.secondary">Repeat Customers</Typography>
                                <Typography variant="h5" fontWeight="bold">
                                    {stats.repeatCustomersAllTime}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid size={{xs: 12}}>
                            <Box textAlign="center">
                                <StatLabel label="Avg Prep Time" info="Average order preparation time — from order creation to Ready (all time, orders with a recorded prep time only)."/>
                                <Typography variant="h5" fontWeight="bold">
                                    {formatPrepTime(stats.averagePrepTimeSeconds)}
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                )}
            </CardContent>
        </Card>
    );
}
