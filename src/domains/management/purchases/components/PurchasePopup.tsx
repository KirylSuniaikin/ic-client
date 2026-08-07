import { logger } from "../../../../shared/utils/logger";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {BasePurchaseResponse} from "../types";
import {getReports, getUser} from "../../../../shared/api/management";
import {IBranch, IUser} from "../../inventory/types";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    FormControlLabel,
    Stack,
    Switch,
    Typography,
} from "@mui/material";
import {PurchaseCard} from "./PurchaseCard";
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";
import {PurchaseTablePopup} from "./PurchaseTablePopup";
import {UnpaidInvoicesDrawer} from "./UnpaidInvoicesDrawer";

type Props = {
    open: boolean;
    onClose: () => void;
    adminId: number;
    branch: IBranch;
};

export function PurchasePopup({open, onClose, adminId, branch}: Props) {
    const [purchaseReports, setPurchaseReports] = useState<BasePurchaseResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [admin, setAdmin] = useState<IUser>();
    const [unpaidOnly, setUnpaidOnly] = useState(false);
    const [unpaidDrawerOpen, setUnpaidDrawerOpen] = useState(false);
    const [purchasePopup, setPurchasePopup] = useState<{
        open: boolean;
        mode: "new" | "edit";
        purchaseId?: number;
    }>({open: false, mode: "new"});

    function upsertReport(list: BasePurchaseResponse[], next: BasePurchaseResponse): BasePurchaseResponse[] {
        const idx = list.findIndex(r => r.id === next.id);
        if (idx === -1) return [next, ...list];
        const copy = list.slice();
        copy[idx] = next;
        return copy;
    }

    const loadReports = useCallback(async (): Promise<void> => {
        const reports = await getReports({ branchId: branch.id.toString(), reportType: 'PURCHASE' });
        setPurchaseReports(reports);
    }, [branch.id]);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const [baseManagementResponse, userResponse] = await Promise.all([
                    getReports({ branchId: branch.id.toString(), reportType: 'PURCHASE' }),
                    getUser(adminId),
                ]);
                if (alive) {
                    setPurchaseReports(baseManagementResponse);
                    setAdmin(userResponse);
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Failed to load";
                if (alive) setError(msg);
                logger.error(msg);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [adminId]);

    // Derived from the already-loaded list — the per-report unpaid totals ride along on
    // BasePurchaseResponse, so the badge and the filter cost no extra request.
    const unpaidSummary = useMemo(() => {
        return purchaseReports.reduce(
            (acc, r) => ({
                count: acc.count + (r.unpaidCount ?? 0),
                amount: acc.amount + Number(r.unpaidAmount ?? 0),
            }),
            { count: 0, amount: 0 },
        );
    }, [purchaseReports]);

    const visibleReports = useMemo(
        () => (unpaidOnly ? purchaseReports.filter(r => (r.unpaidCount ?? 0) > 0) : purchaseReports),
        [purchaseReports, unpaidOnly],
    );

    function handleCreatePurchaseClick() {
        setPurchasePopup({open: true, mode: "new"});
    }

    function handleEditClick(purchaseId: number) {
        setPurchasePopup({open: true, mode: "edit", purchaseId});
    }

    function handleCloseClick() {
        setPurchasePopup({open: false, mode: "new"});
    }

    if (loading) {
        return (
            <Box sx={{display: "grid", placeItems: "center", minHeight: 240}}>
                <CircularProgress/>
            </Box>
        );
    }

    return (
        <>
            {error && (
                <Box sx={{p: 2}}>
                    <Alert severity="error">{error}</Alert>
                </Box>
            )}
            <Dialog
                fullScreen
                open={open}
                onClose={onClose}
                PaperProps={{
                    sx: {
                        backgroundColor: "#fbfaf6",
                    }
                }}>
                <ManagementTopBar
                    title="Purchase"
                    onBack={onClose}
                    actions={
                        <>
                            {unpaidSummary.count > 0 && (
                                <Chip
                                    color="warning"
                                    variant="outlined"
                                    clickable
                                    data-testid="unpaid-summary-chip"
                                    onClick={() => setUnpaidDrawerOpen(true)}
                                    label={`Unpaid ${unpaidSummary.count} · ${unpaidSummary.amount.toFixed(3)}`}
                                    sx={{ fontWeight: 700 }}
                                />
                            )}
                            <Button
                                variant="contained"
                                onClick={handleCreatePurchaseClick}
                                sx={{ borderRadius: 4, textTransform: "none", fontWeight: 700, bgcolor: "#E44B4C" }}
                            >
                                New Report
                            </Button>
                        </>
                    }
                />

                <Container
                    maxWidth="sm"
                    sx={{
                        pt: `${64 + 12}px`,
                        pb: 3,
                    }}
                >
                    <FormControlLabel
                        sx={{ mb: 1 }}
                        control={
                            <Switch
                                checked={unpaidOnly}
                                slotProps={{ input: { "aria-label": "outstanding only" } }}
                                onChange={(e) => setUnpaidOnly(e.target.checked)}
                            />
                        }
                        label="Outstanding only"
                    />

                    {visibleReports.length === 0 ? (
                        <Box
                            sx={{
                                mt: 2,
                                p: 3,
                                border: "1px dashed",
                                borderColor: "divider",
                                borderRadius: 2,
                                textAlign: "center",
                            }}
                        >
                            <Typography color="text.secondary">
                                {unpaidOnly ? "No reports with outstanding invoices" : "No purchase reports yet"}
                            </Typography>
                        </Box>
                    ) : (
                        <Stack gap={1.5} sx={{pb: 2}}>
                            {visibleReports.map((r) => (
                                <Box key={r.id}>
                                    <PurchaseCard
                                        report={r}
                                        onEditClick={() => {
                                            handleEditClick(r.id)
                                        }}
                                    />
                                </Box>
                            ))}
                        </Stack>
                    )}
                </Container>
            </Dialog>

            <UnpaidInvoicesDrawer
                open={unpaidDrawerOpen}
                branchId={branch.id.toString()}
                onClose={() => setUnpaidDrawerOpen(false)}
                onPaid={() => {
                    // Settling an invoice changes the per-report badges, which live on the report
                    // list rather than in the drawer's own response.
                    loadReports().catch((e: unknown) => {
                        const msg = e instanceof Error ? e.message : "Failed to refresh reports";
                        setError(msg);
                        logger.error(msg);
                    });
                }}
            />

            {purchasePopup.open && (
                <PurchaseTablePopup
                    open={purchasePopup.open}
                    mode={purchasePopup.mode}
                    purchaseId={purchasePopup?.purchaseId}
                    userId={admin ? admin.id : adminId}
                    branch={branch}
                    onClose={handleCloseClick}
                    onSaved={(report) => {
                        setPurchaseReports(prev => upsertReport(prev, report));
                    }}
                />
            )}

            {loading && (
                <Box sx={{position: 'fixed', top: 64, right: 16, zIndex: 1500}}>
                    <CircularProgress size={24}/>
                </Box>
            )}

            {error && (
                <Alert severity="error">{error}</Alert>
            )}
        </>
    );
}
