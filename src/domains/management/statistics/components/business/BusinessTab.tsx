import React, {useState} from "react";
import {Alert, Box, Button, Card, CardContent, Chip, Typography} from "@mui/material";
import CategoryClassificationDrawer from "./CategoryClassificationDrawer";
import MonthlyExpensesPivotCard from "./MonthlyExpensesPivotCard";
import InventoryCogsCard from "./InventoryCogsCard";
import ChannelPerformanceCard from "./ChannelPerformanceCard";
import KpiBlockCard from "./KpiBlockCard";
import ProfitAndLossCard from "./ProfitAndLossCard";
import MenuCostCardsCard from "./MenuCostCardsCard";
import ComponentCostDrawer from "./ComponentCostDrawer";
import CollapsibleCard from "./CollapsibleCard";
import {useCostCards} from "../../hooks/useCostCards";
import {useBusinessCategories} from "../../hooks/useBusinessCategories";
import {formatBd} from "./businessFormat";
import {StatSkeleton} from "../performance/statPlaceholders";
import {BRAND_RED} from "../../../../../shared/utils/theme";
import type {BusinessStatsResponse, ChannelOverridePatch} from "../../types";

type Props = {
    data: BusinessStatsResponse | null;
    loading: boolean;
    rangeLabel: string;
    onRefresh: () => Promise<void>;
    onPatchChannel: (id: number, payload: ChannelOverridePatch) => Promise<void>;
    onRegenerateChannels: () => Promise<void>;
};

/**
 * The owner's business-level monthly report.
 *
 * <p>Classification sits at the top because it gates everything below it: the pivot, and later the
 * profit statement, read {@code pnl_class} through a join, so unclassified spend is money the report
 * can show but cannot place.
 *
 * <p>The month range lives in {@code StatisticsComponent}'s filter row rather than here, so it sits
 * alongside the other tabs' controls instead of inventing a second place to change scope.
 */

function monthLabel(period: string | undefined): string {
    if (!period) return "";
    const [y, m] = period.split("-");
    return new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString("en-US", {month: "long", year: "numeric"});
}

export default function BusinessTab(
    {data, loading, rangeLabel, onRefresh, onPatchChannel, onRegenerateChannels}: Props
): React.JSX.Element {
    const {categories, unclassifiedCount, classify} = useBusinessCategories();
    const costCards = useCostCards();
    const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
    const [costDrawerOpen, setCostDrawerOpen] = useState<boolean>(false);

    // A card that shows nothing while shut just forces you to open all six, so each carries the
    // one number you would have opened it for.
    const latestPnl = data?.profitAndLoss[data.profitAndLoss.length - 1];
    const pnlSummary = latestPnl
        ? `net profit ${formatBd(latestPnl.netProfit)} BHD in ${monthLabel(latestPnl.period)}`
        : undefined;
    const needsChannels = (data?.channels ?? []).every(m => m.rows.length === 0);
    const feesMissing = (data?.channels ?? []).some(m => m.appFeesMissing);
    const channelSummary = needsChannels
        ? "press Refresh channel data — the profit statement reads zero until you do"
        : `${data?.channels[data.channels.length - 1]?.rows.length ?? 0} channels`;
    const blockedMonths = (data?.inventoryCogs ?? [])
        .filter(m => m.movementCogs === null && !m.monthInProgress).length;
    const inventorySummary = blockedMonths > 0
        ? `${blockedMonths} month${blockedMonths === 1 ? "" : "s"} missing a count`
        : "complete";

    const unclassifiedTotal = categories
        .filter(c => c.pnlClass === null)
        .reduce((sum, c) => sum + c.lifetimeTotal, 0);

    // A classification change rewrites every month of the report, so the figures below have to be
    // refetched -- the server evicts its cache on the write, but this client still holds the old
    // payload.
    const handleClassify = async (id: number, payload: Parameters<typeof classify>[1]): Promise<void> => {
        await classify(id, payload);
        await onRefresh();
    };

    // A cost change moves COGS in every month of the statement, so the report is refetched too --
    // the server evicts its cache on the write, but this client still holds the old payload.
    const handleSetComponentCost = async (
        id: number,
        payload: Parameters<typeof costCards.setComponentCost>[1]
    ): Promise<void> => {
        await costCards.setComponentCost(id, payload);
        await onRefresh();
    };

    return (
        <Box sx={{mt: 1}}>
            <Card sx={{borderRadius: 3, boxShadow: 3, mb: 2}}>
                <CardContent>
                    <Typography variant="h6" fontWeight="bold" sx={{mb: 1}}>
                        🧾 Category classification
                    </Typography>
                    <Typography variant="body2" sx={{color: '#8a807a', mb: 2}}>
                        Every accounting category needs a P&L class before the profit statement can be
                        computed. Spend in an unclassified category is shown in the report but counted
                        in no total.
                    </Typography>

                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
                        {unclassifiedCount > 0 ? (
                            <Chip
                                label={`⚠ ${unclassifiedCount} unclassified · ${formatBd(unclassifiedTotal)} BHD`}
                                sx={{backgroundColor: BRAND_RED, color: '#fff', fontWeight: 'bold'}}
                                onClick={() => setDrawerOpen(true)}
                            />
                        ) : (
                            <Chip
                                label={`✓ All ${categories.length} categories classified`}
                                sx={{backgroundColor: '#4CAF50', color: '#fff', fontWeight: 'bold'}}
                            />
                        )}

                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setDrawerOpen(true)}
                            sx={{
                                ml: 'auto',
                                textTransform: 'none',
                                borderRadius: 999,
                                borderColor: '#e0e0e0',
                                color: '#3b352c',
                                '&:hover': {borderColor: BRAND_RED, color: BRAND_RED},
                            }}
                        >
                            Classify categories
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            <Card sx={{borderRadius: 3, boxShadow: 3, mb: 2}}>
                <CardContent>
                    <Typography variant="h6" fontWeight="bold" sx={{mb: 1}}>
                        🍕 Ingredient costs
                    </Typography>
                    <Typography variant="body2" sx={{color: '#8a807a', mb: 2}}>
                        Every ingredient needs a cost before the profit statement means anything.
                        An uncosted ingredient contributes nothing, which understates cost and
                        overstates margin on every recipe that uses it.
                    </Typography>

                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
                        {costCards.uncostedCount > 0 ? (
                            <Chip
                                label={`⚠ ${costCards.uncostedCount} ingredients with no cost`}
                                sx={{backgroundColor: BRAND_RED, color: '#fff', fontWeight: 'bold'}}
                                onClick={() => setCostDrawerOpen(true)}
                            />
                        ) : (
                            <Chip
                                label={`✓ All ${costCards.components.length} ingredients costed`}
                                sx={{backgroundColor: '#4CAF50', color: '#fff', fontWeight: 'bold'}}
                            />
                        )}

                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setCostDrawerOpen(true)}
                            sx={{
                                ml: 'auto',
                                textTransform: 'none',
                                borderRadius: 999,
                                borderColor: '#e0e0e0',
                                color: '#3b352c',
                                '&:hover': {borderColor: BRAND_RED, color: BRAND_RED},
                            }}
                        >
                            Set ingredient costs
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {loading && data === null ? (
                <Card sx={{borderRadius: 3, boxShadow: 3, mb: 2}}>
                    <CardContent><StatSkeleton lines={6}/></CardContent>
                </Card>
            ) : data === null ? (
                <Card sx={{borderRadius: 3, boxShadow: 3, mb: 2}}>
                    <CardContent>
                        <Typography variant="body2" sx={{color: '#8a807a'}}>
                            The report could not be loaded.
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {data.notices.map(notice => (
                        <Alert key={notice} severity="info" sx={{mb: 2, borderRadius: 2}}>
                            {notice}
                        </Alert>
                    ))}

                    <CollapsibleCard title="📊 Key metrics" defaultExpanded
                                     summary={monthLabel(data.months[data.months.length - 1])}>
                        <KpiBlockCard blocks={data.kpi}/>
                    </CollapsibleCard>

                    {/* Above the profit statement on purpose: the P&L takes its revenue from here,
                        so until this card has been refreshed the statement below reads zeros. The
                        button that fixes it must not sit underneath the thing it fixes. */}
                    <CollapsibleCard
                        title="🛵 Channel performance"
                        summary={channelSummary}
                        badge={needsChannels
                            ? <Chip label="⚠ not generated yet"
                                    sx={{backgroundColor: BRAND_RED, color: '#fff', fontWeight: 'bold'}}/>
                            : feesMissing
                                ? <Chip label="⚠ app fees missing" color="warning"/>
                                : undefined}
                        defaultExpanded={needsChannels}
                    >
                        <ChannelPerformanceCard
                            months={data.channels}
                            rangeLabel={rangeLabel}
                            onPatch={onPatchChannel}
                            onRegenerate={onRegenerateChannels}
                        />
                    </CollapsibleCard>

                    <CollapsibleCard title="📈 Profit &amp; loss" summary={pnlSummary}>
                        <ProfitAndLossCard months={data.profitAndLoss}/>
                    </CollapsibleCard>

                    <CollapsibleCard
                        title="🧾 Monthly expenses"
                        summary={`${data.expensePivot.blocks.length} blocks`}
                        badge={data.expensePivot.unclassifiedCategoryCount > 0
                            ? <Chip
                                label={`⚠ ${data.expensePivot.unclassifiedCategoryCount} unclassified · ${formatBd(data.expensePivot.unclassifiedTotal)} BHD`}
                                onClick={() => setDrawerOpen(true)}
                                sx={{backgroundColor: BRAND_RED, color: '#fff', fontWeight: 'bold'}}/>
                            : undefined}
                    >
                        <MonthlyExpensesPivotCard
                            pivot={data.expensePivot}
                            onClassify={() => setDrawerOpen(true)}
                        />
                    </CollapsibleCard>

                    <CollapsibleCard title="📦 Inventory COGS" summary={inventorySummary}>
                        <InventoryCogsCard months={data.inventoryCogs}/>
                    </CollapsibleCard>

                    <CollapsibleCard title="🍕 Menu cost cards"
                                     summary={costCards.cards ? `${costCards.cards.cards.length} items` : undefined}>
                        <MenuCostCardsCard data={costCards.cards} loading={costCards.loading}/>
                    </CollapsibleCard>
                </>
            )}

            <CategoryClassificationDrawer
                open={drawerOpen}
                categories={categories}
                onClose={() => setDrawerOpen(false)}
                onChange={handleClassify}
            />

            <ComponentCostDrawer
                open={costDrawerOpen}
                components={costCards.components}
                onClose={() => setCostDrawerOpen(false)}
                onChange={handleSetComponentCost}
            />
        </Box>
    );
}
