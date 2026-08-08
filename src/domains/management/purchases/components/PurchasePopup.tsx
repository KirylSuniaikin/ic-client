import { logger } from "../../../../shared/utils/logger";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {BasePurchaseResponse} from "../types";
import {getReports, getUser} from "../../../../shared/api/management";
import {IBranch, IUser} from "../../inventory/types";
import {
    Alert,
    Box,
    Button,
    Container,
    Dialog,
    Paper,
    Skeleton,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import {PurchaseCard} from "./PurchaseCard";
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";
import {PurchaseTablePopup} from "./PurchaseTablePopup";
import {UnpaidInvoicesDrawer} from "./UnpaidInvoicesDrawer";

const BRAND = "#E44B4C";
// MUI's warning.main (#ed6c02) at low alpha — the banner has to read as a warning without
// shouting as loudly as a filled orange block would on every visit.
const WARN_TINT = "rgba(237, 108, 2, 0.08)";
const WARN_BORDER = "rgba(237, 108, 2, 0.35)";

type Props = {
    open: boolean;
    onClose: () => void;
    adminId: number;
    branch: IBranch;
};

function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}

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
            (acc, r) => {
                const count = r.unpaidCount ?? 0;
                return {
                    count: acc.count + count,
                    amount: acc.amount + Number(r.unpaidAmount ?? 0),
                    reports: acc.reports + (count > 0 ? 1 : 0),
                };
            },
            { count: 0, amount: 0, reports: 0 },
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

    return (
        <>
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
                        <Button
                            variant="contained"
                            disableElevation
                            onClick={handleCreatePurchaseClick}
                            sx={{ borderRadius: 4, textTransform: "none", fontWeight: 700, bgcolor: BRAND }}
                        >
                            New Report
                        </Button>
                    }
                />

                <Container
                    maxWidth="sm"
                    sx={{
                        pt: 2,
                        pb: 4,
                    }}
                >
                    {error && (
                        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, borderRadius: 3 }}>
                            {error}
                        </Alert>
                    )}

                    {/* What the whole invoice level exists to answer — "what do we still owe" — gets
                        the top of the screen and a real number, not a chip competing with New Report
                        for space in the toolbar. Nothing is rendered at zero. */}
                    {unpaidSummary.count > 0 && (
                        <Paper
                            variant="outlined"
                            data-testid="unpaid-summary"
                            sx={{
                                p: 2,
                                mb: 2,
                                borderRadius: 4,
                                bgcolor: WARN_TINT,
                                borderColor: WARN_BORDER,
                            }}
                        >
                            <Stack direction="row" alignItems="center" gap={1.5}>
                                <ErrorOutlineRoundedIcon sx={{ color: "warning.main" }} />

                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            display: "block",
                                            fontWeight: 700,
                                            letterSpacing: 0.6,
                                            textTransform: "uppercase",
                                            color: "text.secondary",
                                        }}
                                    >
                                        Outstanding
                                    </Typography>
                                    <Typography
                                        data-testid="unpaid-summary-amount"
                                        sx={{ fontWeight: 800, fontSize: 22, lineHeight: 1.25, color: "warning.dark" }}
                                    >
                                        {unpaidSummary.amount.toFixed(3)} BHD
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {plural(unpaidSummary.count, "invoice")}
                                        {" in "}
                                        {plural(unpaidSummary.reports, "report")}
                                    </Typography>
                                </Box>

                                <Button
                                    variant="outlined"
                                    color="warning"
                                    data-testid="unpaid-summary-review"
                                    onClick={() => setUnpaidDrawerOpen(true)}
                                    sx={{ borderRadius: 4, textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}
                                >
                                    Review
                                </Button>
                            </Stack>
                        </Paper>
                    )}

                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={1}
                        sx={{ mb: 1.5 }}
                    >
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {loading ? " " : plural(visibleReports.length, "report")}
                        </Typography>

                        {/* A segmented control rather than a switch: the two states are a filter over
                            the list, and naming both makes "All" a visible way back out. */}
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={unpaidOnly ? "unpaid" : "all"}
                            onChange={(_, val) => {
                                // Exclusive groups emit null when the active button is re-tapped;
                                // dropping that keeps a filter always selected.
                                if (val !== null) setUnpaidOnly(val === "unpaid");
                            }}
                            sx={{
                                bgcolor: "background.paper",
                                borderRadius: 4,
                                "& .MuiToggleButton-root": {
                                    border: "none",
                                    px: 2,
                                    py: 0.5,
                                    borderRadius: 4,
                                    textTransform: "none",
                                    fontWeight: 700,
                                },
                                "& .MuiToggleButton-root.Mui-selected": {
                                    bgcolor: BRAND,
                                    color: "#fff",
                                    "&:hover": { bgcolor: BRAND },
                                },
                            }}
                        >
                            <ToggleButton value="all" aria-label="all reports">All</ToggleButton>
                            <ToggleButton value="unpaid" aria-label="outstanding only">Outstanding</ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>

                    {loading ? (
                        // Skeletons in place of the list, rather than swapping the whole screen for a
                        // spinner: the top bar and filters stay put, so opening Purchase doesn't flash.
                        <Stack gap={1.5}>
                            {[0, 1, 2].map((i) => (
                                <Skeleton key={i} variant="rounded" height={84} sx={{ borderRadius: 4 }} />
                            ))}
                        </Stack>
                    ) : visibleReports.length === 0 ? (
                        <Stack
                            alignItems="center"
                            gap={1}
                            sx={{
                                mt: 4,
                                p: 4,
                                border: "1px dashed",
                                borderColor: "divider",
                                borderRadius: 4,
                                textAlign: "center",
                            }}
                        >
                            <ReceiptLongRoundedIcon sx={{ fontSize: 40, color: "text.disabled" }} />
                            <Typography color="text.secondary">
                                {unpaidOnly ? "No reports with outstanding invoices" : "No purchase reports yet"}
                            </Typography>
                            {unpaidOnly ? (
                                <Button
                                    onClick={() => setUnpaidOnly(false)}
                                    sx={{ textTransform: "none", fontWeight: 700, color: BRAND }}
                                >
                                    Show all reports
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleCreatePurchaseClick}
                                    sx={{ textTransform: "none", fontWeight: 700, color: BRAND }}
                                >
                                    Create the first one
                                </Button>
                            )}
                        </Stack>
                    ) : (
                        <Stack gap={1.5}>
                            {visibleReports.map((r) => (
                                <PurchaseCard
                                    key={r.id}
                                    report={r}
                                    onEditClick={() => handleEditClick(r.id)}
                                />
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
        </>
    );
}
