import React, {useState} from "react";
import {Box, Button, Card, CardContent, Chip, Typography} from "@mui/material";
import CategoryClassificationDrawer from "./CategoryClassificationDrawer";
import {useBusinessCategories} from "../../hooks/useBusinessCategories";
import {formatBd} from "./businessFormat";
import {StatSkeleton} from "../performance/statPlaceholders";
import {BRAND_RED} from "../../../../../shared/utils/theme";

/**
 * The owner's business-level monthly report.
 *
 * <p>Phase 1 carries only the classification step, which is the gate for everything else: the
 * monthly expense pivot, the P&L, the KPI block and the COGS reconciliation all read
 * {@code pnl_class} through a join, so until the ledger is classified none of them can be trusted.
 * The remaining cards land in later phases and slot in below this one.
 */
export default function BusinessTab(): React.JSX.Element {
    const {loading, categories, unclassifiedCount, classify} = useBusinessCategories();
    const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

    const unclassifiedTotal = categories
        .filter(c => c.pnlClass === null)
        .reduce((sum, c) => sum + c.lifetimeTotal, 0);

    return (
        <Box sx={{mt: 1}}>
            <Card sx={{borderRadius: 3, boxShadow: 3, mb: 2}}>
                <CardContent>
                    <Typography variant="h6" fontWeight="bold" sx={{mb: 1}}>
                        🧾 Category classification
                    </Typography>

                    {loading && categories.length === 0 ? (
                        <StatSkeleton lines={3}/>
                    ) : (
                        <>
                            <Typography variant="body2" sx={{color: '#8a807a', mb: 2}}>
                                Every accounting category needs a P&L class before the profit
                                statement can be computed. Spend in an unclassified category is shown
                                in the report but counted in no total.
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
                        </>
                    )}
                </CardContent>
            </Card>

            <CategoryClassificationDrawer
                open={drawerOpen}
                categories={categories}
                onClose={() => setDrawerOpen(false)}
                onChange={classify}
            />
        </Box>
    );
}
