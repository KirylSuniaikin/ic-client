import {Box, Card, CardContent,Grid, Typography} from "@mui/material";
import React from "react";
import {TrendChip} from "./performance/TrendChip";

interface StatItem {
    label: string;
    value: string | number;
    subValue?: string;
    previousValue?: number; // when set and value is numeric, renders a vs-previous trend
}

export const PlatformStatCard = ({ title, items }: { title: string; items: StatItem[] }) => {
    return (
        <Card variant="outlined" sx={{ mb: 2, borderRadius: 3, borderColor: '#eee', backgroundColor: '#fff', boxShadow: 3, width: '100%' }}>
            <CardContent sx={{ pb: 2, "&:last-child": { pb: 2 } }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
                    {title}
                </Typography>

                <Grid container spacing={2} alignItems="flex-start">
                    {items.map((item, index) => (
                        <Grid
                            size={{ xs: 6, sm: 12 / items.length }}
                            key={index}
                        >
                            <Box>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'end',
                                        mb: 0.5,
                                        height: 32,
                                        lineHeight: 1.2,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis"
                                    }}
                                >
                                    {item.label}
                                </Typography>

                                {/* Amount and its trend on one row — trend sits to the right of
                                    the value rather than stacked beneath it. */}
                                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
                                    <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1 }}>
                                        {item.value}
                                        {item.subValue && (
                                            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                                                {item.subValue}
                                            </Typography>
                                        )}
                                    </Typography>
                                    {item.previousValue != null && typeof item.value === "number" && (
                                        <TrendChip current={item.value} previous={item.previousValue} />
                                    )}
                                </Box>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </CardContent>
        </Card>
    );
};