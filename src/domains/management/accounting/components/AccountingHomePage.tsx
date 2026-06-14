import { logger } from "../../../../shared/utils/logger";
import { useEffect, useState } from "react";
import { IBranch } from "../../inventory/types";
import {
    AccountingPopupState,
    AccountingReportSummary,
    AccountingReportTO,
} from "../types";
import { getAccountingReports } from "../../../../shared/api/management";
import { AccountingReportPopup } from "./AccountingReportPopup";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    Dialog,
    Stack,
    Typography,
} from "@mui/material";
import { AccountingCard } from "./AccountingCard";
import { ManagementTopBar } from "../../_shared/components/ManagementTopBar";

type Props = {
    open: boolean;
    onClose: () => void;
    branch: IBranch;
};

export function AccountingHomePage({ open, onClose, branch }: Props): JSX.Element {
    const [reports, setReports] = useState<AccountingReportSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [accountingPopup, setAccountingPopup] = useState<AccountingPopupState>({ open: false });

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getAccountingReports(branch.id.toString());
                if (alive) {
                    setReports(data);
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
    }, [branch]);

    function handleCreateClick(): void {
        setAccountingPopup({ open: true, mode: "new" });
    }

    function handleEditClick(id: number): void {
        setAccountingPopup({ open: true, mode: "edit", reportId: id });
    }

    function upsertReport(list: AccountingReportSummary[], next: AccountingReportTO): AccountingReportSummary[] {
        const summary: AccountingReportSummary = {
            id: next.id,
            title: next.title,
            createdAt: next.createdAt,
            version: next.version,
            totalIncome: next.entries.filter(e => e.type === "CREDIT").reduce((s, e) => s + e.amount, 0),
            totalExpense: next.entries.filter(e => e.type === "DEBIT").reduce((s, e) => s + e.amount, 0),
        };
        const idx = list.findIndex(r => r.id === summary.id);
        if (idx === -1) return [summary, ...list];
        const copy = list.slice();
        copy[idx] = summary;
        return copy;
    }

    return (
        <>
            <Dialog
                fullScreen
                open={open}
                onClose={onClose}
                PaperProps={{ sx: { backgroundColor: "#fbfaf6" } }}
            >
                <ManagementTopBar
                    title="Accounting"
                    onBack={onClose}
                    actions={
                        <Button
                            variant="contained"
                            onClick={handleCreateClick}
                            sx={{ borderRadius: 4, textTransform: "none", fontWeight: 700, bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e" } }}
                        >
                            New Report
                        </Button>
                    }
                />

                <Container maxWidth="sm" sx={{ mt: 2, pb: 3 }}>
                    {loading && (
                        <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {error && !loading && (
                        <Box sx={{ p: 2 }}>
                            <Alert severity="error">{error}</Alert>
                        </Box>
                    )}

                    {!loading && !error && reports.length === 0 && (
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
                            <Typography color="text.secondary">No accounting reports yet</Typography>
                        </Box>
                    )}

                    {!loading && !error && reports.length > 0 && (
                        <Stack gap={1.5} sx={{ pb: 2 }}>
                            {reports.map((r) => (
                                <Box key={r.id}>
                                    <AccountingCard
                                        report={r}
                                        onEditClick={() => handleEditClick(r.id)}
                                    />
                                </Box>
                            ))}
                        </Stack>
                    )}
                </Container>
            </Dialog>

            {accountingPopup.open && (
                <AccountingReportPopup
                    open={accountingPopup.open}
                    mode={accountingPopup.mode ?? "new"}
                    reportId={accountingPopup.mode === "edit" ? accountingPopup.reportId : undefined}
                    branch={branch}
                    onClose={() => setAccountingPopup({ open: false })}
                    onSaved={(report) => {
                        setReports((prev) => upsertReport(prev, report));
                        setAccountingPopup({ open: false });
                    }}
                />
            )}
        </>
    );
}
