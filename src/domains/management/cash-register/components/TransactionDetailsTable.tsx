import React, { useEffect, useState } from "react";
import {
    Dialog,
    Box,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper
} from "@mui/material";
import { ManagementTopBar } from "../../_shared/components/ManagementTopBar";
import { useCashRegisterHistory } from "../hooks/useCashRegisterHistory";
import { CashUpdateType } from "../types";

type Props = {
    branchId: string;
    open: boolean;
    onClose: () => void;
};

const brandGray = "#f3f3f3";


const styles = {
    cashIn: {
        bg: "rgba(52, 199, 89, 0.12)",
        text: "#008a00",
    },
    cashOut: {
        bg: "rgba(255, 59, 48, 0.12)",
        text: "#c41c00",
    },
    cashCheck:{
        bg: brandGray,
        text: "#000",
    }
};

export default function TransactionDetailsTable({ branchId, open, onClose }: Props) {
    const { events, loading, hasMore, error, loadMore } = useCashRegisterHistory(branchId, open);
    // Callback ref rather than useRef: Dialog renders through a portal that only mounts its
    // children on a second commit, so a plain ref is still null when an effect keyed on the
    // hook state first runs. Holding the node in state re-runs the effect the moment it mounts.
    const [sentinel, setSentinel] = useState<HTMLTableRowElement | null>(null);

    useEffect(() => {
        if (!open || loading || !hasMore || error || !sentinel) return;

        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) loadMore();
        });
        observer.observe(sentinel);

        return () => observer.disconnect();
    }, [open, loading, hasMore, error, sentinel, loadMore]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen
            sx={{ "& .MuiDialog-paper": { backgroundColor: "#F2F2F7" } }} // Серый фон iOS
        >
            <ManagementTopBar title="Transaction History" onBack={onClose} />

            <Box sx={{ p: 2 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, overflow: 'hidden' }}>
                        <Table sx={{ minWidth: 300 }} aria-label="history table">
                            <TableHead sx={{ bgcolor: "#fff" }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Amount</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Note</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {events.map((row) => {
                                    const isIncome = row.type === CashUpdateType.CASH_IN;
                                    const isCheck = row.type === CashUpdateType.CLOSE_SHIFT_CASH_CHECK || row.type === CashUpdateType.OPEN_SHIFT_CASH_CHECK;
                                    const style = isCheck ? styles.cashCheck : isIncome ? styles.cashIn : styles.cashOut;

                                    return (
                                        <TableRow
                                            key={row.id}
                                            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                        >
                                            <TableCell component="th" scope="row" sx={{ color: '#333', fontSize: '0.9rem' }}>
                                                {formatDate(row.date)}
                                            </TableCell>

                                            <TableCell>
                                                <Box
                                                    sx={{
                                                        backgroundColor: style.bg,
                                                        color: style.text,
                                                        py: 0.5,
                                                        px: 1.5,
                                                        borderRadius: 2,
                                                        display: 'inline-block',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.9rem'
                                                    }}
                                                >
                                                    {!isCheck ? (isIncome ? '+' : '-') : ''}{row.amount}
                                                </Box>
                                            </TableCell>

                                            <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                                                {row.notes || "—"}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {/* hasMore starts true and only flips once the server has answered,
                                    so this renders on a confirmed-empty list, not on the first frame. */}
                                {!loading && !error && events.length === 0 && !hasMore && (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                            No transactions found
                                        </TableCell>
                                    </TableRow>
                                )}
                                {error && (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'error.main' }}>
                                            Failed to load transactions
                                        </TableCell>
                                    </TableRow>
                                )}
                                {/* Hidden on error so the observer cannot retry the failed page in a loop. */}
                                {hasMore && !error && (
                                    <TableRow ref={setSentinel}>
                                        <TableCell colSpan={3} align="center" sx={{ py: 2, border: 0 }}>
                                            <CircularProgress size={20} />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </Dialog>
    );
}