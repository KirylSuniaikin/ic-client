import React, {useState} from "react";
import {Alert, Box, Card, CardContent, Chip, Typography} from "@mui/material";
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
    const {categories, classify} = useBusinessCategories();
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

    // The unclassified count and total used to be computed here for the setup card at the top.
    // The badge that replaced it takes both straight from the report's own pivot, which is the
    // figure that actually matters -- spend in the months on screen, not lifetime.

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
            {/* The two setup cards that used to sit here -- "Category classification" and
                "Ingredient costs" -- are gone on purpose. They were a permanent banner about data
                entry on a screen whose job is to report, and they said "all good" far more often
                than they said anything useful.

                Nothing was lost: each warning now rides as a badge on the report it actually
                affects (unclassified spend on Monthly expenses, uncosted ingredients on Menu cost
                cards), where it is next to the number it distorts, and each badge opens the same
                drawer. A clean report now means there is nothing to say. */}

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
                                     info="Every metric is business-wide, all branches summed. A metric showing an em dash is missing an input rather than reading zero — hover it for the reason. Margins divide by net revenue (gross revenue less app fees), and trading days are counted from the orders themselves, not assumed."
                                     summary={monthLabel(data.months[data.months.length - 1])}>
                        <KpiBlockCard blocks={data.kpi}/>
                    </CollapsibleCard>

                    {/* Above the profit statement on purpose: the P&L takes its revenue from here,
                        so until this card has been refreshed the statement below reads zeros. The
                        button that fixes it must not sit underneath the thing it fixes. */}
                    <CollapsibleCard
                        title="🛵 Channel performance"
                        summary={channelSummary}
                        info={<>
                            Orders and revenue come from our own order records. App fees have no
                            other source — they are whatever you enter here.
                            <br/><br/>
                            Click any underlined figure to edit it, then press Enter to save. Your
                            edits survive a refresh: regenerating rewrites the generated figures and
                            never touches yours.
                        </>}
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

                    <CollapsibleCard
                        title="📈 Profit &amp; loss"
                        summary={pnlSummary}
                        info="Net profit is a cash view with one exception: COGS is recipe-costed, not cash. To reconcile to cash see net cash movement in the memo below the statement. There is no depreciation — capital expenditure is expensed in the month of purchase."
                    >
                        <ProfitAndLossCard months={data.profitAndLoss}/>
                    </CollapsibleCard>

                    <CollapsibleCard
                        title="🧾 Monthly expenses"
                        summary={`${data.expensePivot.blocks.length} blocks`}
                        info="Every ledger entry in the range, grouped by its category's P&L class. Groceries and packaging appear here but are deliberately kept out of operating expenses — they reach the statement through COGS. Spend in an unclassified category is shown and counted in no total."
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

                    <CollapsibleCard
                        title="📦 Inventory COGS"
                        summary={inventorySummary}
                        info="Opening + purchases − closing stock, across the whole business. Measured from stock counts, so it will not equal the recipe-costed COGS in the profit statement — that gap is waste, yield and miscounts. Purchases is split by what was bought; the split always adds back up to the total."
                    >
                        <InventoryCogsCard months={data.inventoryCogs}/>
                    </CollapsibleCard>

                    <CollapsibleCard
                        title="🍕 Menu cost cards"
                        summary={costCards.cards ? `${costCards.cards.cards.length} items` : undefined}
                        info="What each item costs to make, at the latest price paid for every ingredient. Each line prints its resolved unit cost, which is the only place a per-kg price applied to a per-gram amount becomes visible. Batch recipes — doughs and sauces, which are not menu items — are on the second tab."
                        badge={costCards.uncostedCount > 0
                            ? <Chip
                                label={`⚠ ${costCards.uncostedCount} ingredients with no cost`}
                                onClick={() => setCostDrawerOpen(true)}
                                sx={{backgroundColor: BRAND_RED, color: '#fff', fontWeight: 'bold'}}/>
                            : undefined}
                    >
                        <MenuCostCardsCard
                            data={costCards.cards}
                            loading={costCards.loading}
                            components={costCards.components}
                            onSetCosts={() => setCostDrawerOpen(true)}
                        />
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
