import React, { useEffect, useState } from "react";
import {
    Dialog,
    Box,
    Typography,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip
} from "@mui/material";
import { BackTopBar } from "../consumptionComponents/BackTopBar"; // Твой компонент заголовка
import { getBranchEvents } from "../api/api";
import { CashRegisterEventTO, CashUpdateType } from "../types/branchBalanceTypes";

type Props = {
    branchId: string;
    open: boolean;
    onClose: () => void;
};

const styles = {
    cashIn: {
        bg: "rgba(52, 199, 89, 0.12)",
        text: "#008a00",
    },
    cashOut: {
        bg: "rgba(255, 59, 48, 0.12)",
        text: "#c41c00",
    }
};

export default function TransactionDetailsTable({ branchId, open, onClose }: Props) {
    const [events, setEvents] = useState<CashRegisterEventTO[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setLoading(true);
            getBranchEvents(branchId)
                .then(data => setEvents(data))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [branchId, open]);

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
            <BackTopBar title="Transaction History" onClose={onClose} />

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
                                    const style = isIncome ? styles.cashIn : styles.cashOut;

                                    return (
                                        <TableRow
                                            key={row.id}
                                            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                        >
                                            {/* Дата */}
                                            <TableCell component="th" scope="row" sx={{ color: '#333', fontSize: '0.9rem' }}>
                                                {formatDate(row.date)}
                                            </TableCell>

                                            {/* Сумма с цветным фоном */}
                                            <TableCell>
                                                <Box
                                                    sx={{
                                                        backgroundColor: style.bg,
                                                        color: style.text,
                                                        py: 0.5,
                                                        px: 1.5,
                                                        borderRadius: 2, // Скругленный чип
                                                        display: 'inline-block',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.9rem'
                                                    }}
                                                >
                                                    {isIncome ? '+' : '-'}{row.amount}
                                                </Box>
                                            </TableCell>

                                            {/* Заметка */}
                                            <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                                                {row.notes || "—"}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {events.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                            No transactions found
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