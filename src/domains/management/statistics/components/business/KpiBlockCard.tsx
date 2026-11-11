import React from "react";
import {Box, Card, CardContent, Grid, Tooltip, Typography} from "@mui/material";
import type {InventoryCogs, Kpi, KpiBlock, ProfitAndLoss} from "../../types";
import {formatBd} from "./businessFormat";
import {TrendChip} from "../performance/TrendChip";

type Props = {
    blocks: KpiBlock[];
    /** Source of the Food cost tile: the COGS% the Inventory COGS card shows, matched by period. */
    inventoryCogs: InventoryCogs[];
    /** Supplies the recipe COGS and gross revenue needed to rebuild Prime cost on inventory COGS. */
    profitAndLoss: ProfitAndLoss[];
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
 * Food cost is the inventory-movement COGS % (opening + purchases - ending), the same figure as the
 * Inventory COGS card -- not the server's recipe-costed KPI, which counted tech cards. Missing a
 * stock count yields an em dash with the reason, never a zero.
 */
function withInventoryFoodCost(kpi: Kpi, cogs: InventoryCogs | undefined): Kpi {
    if (kpi.key !== "foodCost") return kpi;
    const value = cogs?.cogsPercentOfGrossRevenue ?? null;
    return {
        ...kpi,
        value,
        previousValue: null,
        unavailableReason: value === null
            ? "COGS is not available for this month yet — a stock count or revenue is missing (see Inventory COGS)."
            : null,
        detail: "inventory COGS, of gross revenue",
    };
}

/**
 * Prime cost = inventory COGS + labour, the same COGS the Food cost tile uses. The server adds
 * labour to recipe-costed COGS, so labour is recovered as (server prime cost - recipe COGS) and
 * re-added to the inventory COGS. An em dash when labour is untagged (the server's own null) or the
 * month has no COGS yet -- never a zero.
 */
function withInventoryPrimeCost(
    kpis: Kpi[], cogs: InventoryCogs | undefined, pnl: ProfitAndLoss | undefined,
): Kpi[] {
    const serverPrime = kpis.find(k => k.key === "primeCost");
    const movement = cogs?.movementCogs ?? null;
    const labour = serverPrime?.value != null && pnl ? serverPrime.value - pnl.recipeCogs : null;
    const primeCost = labour !== null && movement !== null ? labour + movement : null;
    const reason = labour === null
        ? serverPrime?.unavailableReason ?? "Labour is not available for this month."
        : "COGS is not available for this month yet — a stock count or revenue is missing (see Inventory COGS).";
    const percent = primeCost !== null && pnl && pnl.grossRevenue > 0
        ? (primeCost / pnl.grossRevenue) * 100 : null;

    return kpis.map(kpi => {
        if (kpi.key === "primeCost") {
            return {
                ...kpi, value: primeCost, previousValue: null,
                unavailableReason: primeCost === null ? reason : null,
                detail: "inventory COGS + labour",
            };
        }
        if (kpi.key === "primeCostPercent") {
            return {
                ...kpi, value: percent, previousValue: null,
                unavailableReason: percent === null
                    ? (primeCost === null ? reason : "No gross revenue this month.") : null,
            };
        }
        return kpi;
    });
}

/**
 * The headline block, showing the most recent month in the range.
 *
 * <p>A KPI that could not be computed renders an em dash with the reason on hover — never a zero.
 * "0% margin" and "we cannot tell you the margin" look identical on a dashboard and mean opposite
 * things, and only one of them is ever true.
 */
export default function KpiBlockCard({blocks, inventoryCogs, profitAndLoss}: Props): React.JSX.Element {
    const latest = blocks[blocks.length - 1];

    if (!latest) {
        return (
            <Typography variant="body2" sx={{color: '#8a807a'}}>
                No months in this range.
            </Typography>
        );
    }

    const latestCogs = inventoryCogs.find(m => m.period === latest.period);
    const latestPnl = profitAndLoss.find(m => m.period === latest.period);
    const kpis = withInventoryPrimeCost(
        latest.kpis.map(kpi => withInventoryFoodCost(kpi, latestCogs)), latestCogs, latestPnl);

    return (
        <>
            <Typography variant="body2" sx={{color: '#8a807a', mb: 2}}>
                {monthLabel(latest.period)}
            </Typography>

            <Grid container spacing={2}>
                {kpis.map(kpi => (
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
        </>
    );
}
