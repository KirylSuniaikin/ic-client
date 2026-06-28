import React, {useState} from "react";
import {Box, Button, Card, CardContent, Grid, Typography} from "@mui/material";
import {DateRangePickerPopover} from "./DateRangePickerPopover";
import {StatEmptyState, StatSkeleton} from "./statPlaceholders";
import {formatStatDate} from "./statsFormat";
import {useStatsLayout} from "../../hooks/useStatsLayout";
import type {StatsResponse} from "../../types";

type Props = {
    stats: StatsResponse | null;
    selectedDate: Date;
    onSelectedDateChange: (date: Date) => void;
    onRefresh: () => void;
};

export function RetentionCheckCard({stats, selectedDate, onSelectedDateChange, onRefresh}: Props): JSX.Element {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const isMobile = useStatsLayout() === "mobile";
    const open = Boolean(anchorEl);

    return (
        <Card sx={{borderRadius: 3, boxShadow: 3, height: "100%", display: "flex", flexDirection: "column"}}>
            <CardContent>
                <Typography variant="h6" gutterBottom>🔄 <b>Retention Check</b></Typography>
                <Button
                    variant="outlined"
                    fullWidth={isMobile}
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                >
                    {formatStatDate(selectedDate)}
                </Button>

                <DateRangePickerPopover
                    mode="single"
                    id="retention-date-popover"
                    open={open}
                    anchorEl={anchorEl}
                    onClose={() => setAnchorEl(null)}
                    date={selectedDate}
                    onDateChange={onSelectedDateChange}
                    applyLabel="🔁 Upload"
                    onApply={() => {
                        onRefresh();
                        setAnchorEl(null);
                    }}
                />

                {stats == null ? (
                    <Box sx={{mt: 2}}><StatSkeleton lines={2}/></Box>
                ) : stats.monthTotalCustomers === 0 && stats.retainedCustomers === 0 ? (
                    <StatEmptyState message="No retention data for this date"/>
                ) : (
                    <Box sx={{flexGrow: 1, display: "flex", alignItems: "center", mt: 2}}>
                        {/* width:100% so the grid fills the card (it's a flex child, which would
                            otherwise shrink to content and cluster the stats to the left). */}
                        <Grid container spacing={2} sx={{width: "100%"}}>
                            <Grid size={{xs: 6}}>
                                <Box sx={{display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center"}}>
                                    {/* Reserve two lines so a wrapped label ("New Clients") and a
                                        single-line one ("Retained") keep their numbers aligned. */}
                                    <Typography variant="body2" color="text.secondary" sx={{minHeight: "2.4em", display: "flex", alignItems: "center", lineHeight: 1.2}}>
                                        New Clients
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {stats.monthTotalCustomers}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid size={{xs: 6}}>
                                <Box sx={{display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center"}}>
                                    <Typography variant="body2" color="text.secondary" sx={{minHeight: "2.4em", display: "flex", alignItems: "center", lineHeight: 1.2}}>
                                        Retained
                                    </Typography>
                                    <Typography variant="h5" fontWeight="bold">
                                        {stats.retainedCustomers}{" "}
                                        <Typography component="span" variant="caption" color="text.secondary">
                                            ({stats.retentionPercentage?.toFixed(0) ?? "-"}%)
                                        </Typography>
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
