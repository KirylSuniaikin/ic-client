import React, {useState} from "react";
import {Alert, Box, Button, Card, CardContent, Chip, Typography} from "@mui/material";
import CategoryClassificationDrawer from "./CategoryClassificationDrawer";
import MonthlyExpensesPivotCard from "./MonthlyExpensesPivotCard";
import InventoryCogsCard from "./InventoryCogsCard";
import {useBusinessCategories} from "../../hooks/useBusinessCategories";
import {formatBd} from "./businessFormat";
import {StatSkeleton} from "../performance/statPlaceholders";
import {BRAND_RED} from "../../../../../shared/utils/theme";
import type {BusinessStatsResponse} from "../../types";

type Props = {
    data: BusinessStatsResponse | null;
    loading: boolean;
    onRefresh: () => Promise<void>;
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
export default function BusinessTab({data, loading, onRefresh}: Props): React.JSX.Element {
    const {categories, unclassifiedCount, classify} = useBusinessCategories();
    const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

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

                    <MonthlyExpensesPivotCard
                        pivot={data.expensePivot}
                        onClassify={() => setDrawerOpen(true)}
                    />
                    <InventoryCogsCard months={data.inventoryCogs}/>
                </>
            )}

            <CategoryClassificationDrawer
                open={drawerOpen}
                categories={categories}
                onClose={() => setDrawerOpen(false)}
                onChange={handleClassify}
            />
        </Box>
    );
}
