import React, { useEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Drawer,
    Stack,
    Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { fetchUnpaidPurchaseInvoices, setPurchaseInvoicePaid } from "../../../../shared/api/management";
import { logger } from "../../../../shared/utils/logger";
import { UnpaidInvoiceTO } from "../types";

type Props = {
    open: boolean;
    branchId: string;
    onClose: () => void;
    /** Fired after an invoice is settled, so the report list can refresh its badges. */
    onPaid?: () => void;
};

/**
 * Every outstanding supplier invoice for a branch, across ALL purchase reports — the question
 * "what do we still owe" is what the whole invoice level exists to answer, and it cannot be
 * answered from inside a single monthly report.
 */
export function UnpaidInvoicesDrawer({ open, branchId, onClose, onPaid }: Props) {
    const [invoices, setInvoices] = useState<UnpaidInvoiceTO[]>([]);
    const [totalOwed, setTotalOwed] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [settling, setSettling] = useState<number | null>(null);

    useEffect(() => {
        if (!open) return;
        let alive = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetchUnpaidPurchaseInvoices(branchId);
                if (!alive) return;
                setInvoices(res.invoices);
                setTotalOwed(res.totalOwed);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Failed to load outstanding invoices";
                if (alive) setError(msg);
                logger.error(msg);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [open, branchId]);

    async function markPaid(invoice: UnpaidInvoiceTO): Promise<void> {
        setSettling(invoice.invoiceId);
        setError(null);
        try {
            await setPurchaseInvoicePaid({ invoiceId: invoice.invoiceId, paid: true });
            // Drop it locally rather than refetching: the row is gone from "outstanding" by
            // definition, and the running total has to move with it.
            setInvoices(prev => prev.filter(i => i.invoiceId !== invoice.invoiceId));
            setTotalOwed(prev => Number((prev - Number(invoice.finalPrice ?? 0)).toFixed(3)));
            onPaid?.();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Could not mark the invoice as paid";
            setError(msg);
            logger.error(msg);
        } finally {
            setSettling(null);
        }
    }

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{ zIndex: 1350 }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                    maxHeight: "85vh",
                    overflowY: "auto",
                },
            }}
        >
            <Box sx={{ p: 3, pb: 4 }}>
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />

                <Typography variant="h6" fontWeight="bold" sx={{ textAlign: "center" }}>
                    Outstanding invoices
                </Typography>
                <Typography
                    data-testid="unpaid-total-owed"
                    sx={{ textAlign: "center", mb: 2, color: "warning.main", fontWeight: 700 }}
                >
                    Total owed: {Number(totalOwed).toFixed(3)} BHD
                </Typography>

                {loading && (
                    <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
                        <CircularProgress />
                    </Box>
                )}

                {error && !loading && (
                    <Typography color="error" sx={{ textAlign: "center", py: 1 }}>{error}</Typography>
                )}

                {!loading && invoices.length === 0 && !error && (
                    <Typography color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
                        Nothing outstanding — every invoice is paid.
                    </Typography>
                )}

                <Stack divider={<Divider flexItem />} gap={1}>
                    {invoices.map((invoice) => (
                        <Stack
                            key={invoice.invoiceId}
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            gap={1}
                            data-testid={`unpaid-row-${invoice.invoiceId}`}
                            sx={{ py: 1 }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700 }} noWrap>
                                    {invoice.vendorName ?? "No vendor"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                    {invoice.invoiceDate ? dayjs(invoice.invoiceDate).format("DD.MM.YYYY") : "No date"}
                                    {" · "}
                                    {invoice.reportTitle}
                                </Typography>
                            </Box>

                            <Stack direction="row" alignItems="center" gap={1}>
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    color="warning"
                                    label={Number(invoice.finalPrice ?? 0).toFixed(3)}
                                    sx={{ fontWeight: 700 }}
                                />
                                <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={settling === invoice.invoiceId}
                                    onClick={() => markPaid(invoice)}
                                    sx={{ textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}
                                >
                                    {settling === invoice.invoiceId ? "…" : "Mark paid"}
                                </Button>
                            </Stack>
                        </Stack>
                    ))}
                </Stack>

                <Button fullWidth onClick={onClose} sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}>
                    Close
                </Button>
            </Box>
        </Drawer>
    );
}
