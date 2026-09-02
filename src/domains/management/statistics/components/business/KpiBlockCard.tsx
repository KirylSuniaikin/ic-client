import React from "react";
import {Box, Card, CardContent, Grid, Tooltip, Typography} from "@mui/material";
import type {Kpi, KpiBlock} from "../../types";
import {formatBd} from "./businessFormat";
import {TrendChip} from "../performance/TrendChip";

type Props = {
    blocks: KpiBlock[];
};

function monthLabel(period: string): string {
    const [year, month] = period.split("-");
    return new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString("en-US", {month: "long", year: "numeric"});
}

function formatValue(kpi: Kpi): string {
    if (kpi.value === null) return "—";
    if (kpi.unit === "%") return `${kpi.value.toFixed(2)}%`;
    if (kpi.unit === "x") return `${kpi.value.toFixed(2)}x`;
    if (kpi.unit === "BD") return `${formatBd(kpi.value)} BHD`;
    return String(kpi.value);
}

/**
 * The headline block, showing the most recent month in the range.
 *
 * <p>A KPI that could not be computed renders an em dash with the reason on hover — never a zero.
 * "0% margin" and "we cannot tell you the margin" look identical on a dashboard and mean opposite
 * things, and only one of them is ever true.
 */
export default function KpiBlockCard({blocks}: Props): React.JSX.Element {
    const latest = blocks[blocks.length - 1];

    if (!latest) {
        return (
            <Card sx={{borderRadius: 3, boxShadow: 3, mb: 2}}>
                <CardContent>
                    <Typography variant="h6" fontWeight="bold">📊 Key metrics</Typography>
                    <Typography variant="body2" sx={{color: '#8a807a', mt: 1}}>
                        No months in this range.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card sx={{borderRadius: 3, boxShadow: 3, mb: 2}}>
            <CardContent>
                <Typography variant="h6" fontWeight="bold">📊 Key metrics</Typography>
                <Typography variant="body2" sx={{color: '#8a807a', mb: 2}}>
                    {monthLabel(latest.period)}
                </Typography>

                <Grid container spacing={2}>
                    {latest.kpis.map(kpi => (
                        <Grid key={kpi.key} size={{xs: 6, sm: 4, md: 3}}>
                            <Box
                                data-testid={`kpi-${kpi.key}`}
                                sx={{
                                    border: '1px solid #f1eae4',
                                    borderRadius: 3,
                                    p: 1.5,
                                    height: '100%',
                                }}
                            >
                                <Typography variant="caption" sx={{color: '#8a807a', display: 'block'}}>
                                    {kpi.label}
                                </Typography>

                                <Box sx={{display: 'flex', alignItems: 'baseline', gap: 1}}>
                                    <Tooltip title={kpi.unavailableReason ?? ""}>
                                        <Typography
                                            variant="h5"
                                            fontWeight="bold"
                                            sx={{color: kpi.value === null ? '#8a807a' : '#3b352c'}}
                                        >
                                            {formatValue(kpi)}
                                        </Typography>
                                    </Tooltip>
                                    {kpi.value !== null && kpi.previousValue !== null && (
                                        <TrendChip current={kpi.value} previous={kpi.previousValue}/>
                                    )}
                                </Box>

                                {/* The divisor lives here so a constant can never hide inside a KPI
                                    again -- the spreadsheet divided daily orders by a fixed 26. */}
                                {kpi.detail && (
                                    <Typography variant="caption" sx={{color: '#8a807a'}}>
                                        {kpi.detail}
                                    </Typography>
                                )}
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </CardContent>
        </Card>
    );
}
