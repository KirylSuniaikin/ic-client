import React, {useEffect, useState} from "react";
import {
    Alert,
    Box,
    CircularProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import dayjs from "dayjs";
import {getMonthlyShiftReport} from "../../../../shared/api/management";
import type {MonthlyShiftReport} from "../types";

type Props = {
    branchId: string;
};

const pillSx = {
    bg: "rgba(0,0,0,0.06)",
    text: "#333",
};

const costPillSx = {
    bg: "rgba(52, 199, 89, 0.12)",
    text: "#008a00",
};

const overtimePillSx = {
    bg: "rgba(255, 59, 48, 0.12)",
    text: "#c41c00",
};

export function StaffSummaryContent({branchId}: Props): JSX.Element {
    const [yearMonth, setYearMonth] = useState<string>(dayjs().format("YYYY-MM"));
    const [report, setReport] = useState<MonthlyShiftReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getMonthlyShiftReport(branchId, yearMonth);
                if (alive) setReport(data);
            } catch (e: unknown) {
                if (alive) setError(e instanceof Error ? e.message : "Failed to load");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [branchId, yearMonth]);

    const rows = report?.summaries ?? [];

    return (
        <Box sx={{p: 2, backgroundColor: "#fff", minHeight: "100%"}}>
            <Box sx={{mb: 2}}>
                <TextField
                    type="month"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    size="small"
                    variant="outlined"
                    sx={{"& .MuiOutlinedInput-root": {borderRadius: 2}}}
                />
            </Box>

            {error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}

            {loading ? (
                <Box sx={{display: "grid", placeItems: "center", minHeight: 200}}>
                    <CircularProgress/>
                </Box>
            ) : (
                <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{
                        borderRadius: 4,
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch",
                        border: "1px solid rgba(0,0,0,0.08)",
                    }}
                >
                    <Table size="small" aria-label="staff summary" sx={{minWidth: 480}}>
                        <TableHead sx={{bgcolor: "#fafafa"}}>
                            <TableRow>
                                <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Staff</TableCell>
                                <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Role</TableCell>
                                <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Total Hrs</TableCell>
                                <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Total Cost</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {rows.map((s, i) => {
                                const hasOvertime = (s.overtimeHours ?? 0) > 0;

                                return (
                                    <TableRow
                                        key={s.staffId ?? i}
                                        sx={{"&:last-child td, &:last-child th": {border: 0}}}
                                    >
                                        {/* Staff */}
                                        <TableCell sx={{color: "#333", fontSize: "0.9rem"}}>
                                            {s.username}
                                        </TableCell>

                                        {/* Role */}
                                        <TableCell>
                                            <Box sx={{
                                                backgroundColor: pillSx.bg,
                                                color: pillSx.text,
                                                py: 0.5,
                                                px: 1.5,
                                                borderRadius: 2,
                                                display: "inline-flex",
                                                fontWeight: "bold",
                                                fontSize: "0.85rem",
                                            }}>
                                                {s.role}
                                            </Box>
                                        </TableCell>

                                        {/* Total Hours */}
                                        <TableCell>
                                            <Box sx={{
                                                backgroundColor: pillSx.bg,
                                                color: pillSx.text,
                                                py: 0.5,
                                                px: 1.5,
                                                borderRadius: 2,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                                fontWeight: "bold",
                                                fontSize: "0.9rem",
                                            }}>
                                                {s.totalHours?.toFixed(2)}
                                                {hasOvertime && (
                                                    <Typography component="span" sx={{
                                                        fontSize: "0.78rem",
                                                        opacity: 0.75,
                                                        fontWeight: "normal"
                                                    }}>
                                                        ({s.regularHours?.toFixed(2)} + {s.overtimeHours?.toFixed(2)} OT)
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>

                                        {/* Total Cost */}
                                        <TableCell>
                                            <Box sx={{
                                                backgroundColor: s.totalCost != null ? costPillSx.bg : pillSx.bg,
                                                color: s.totalCost != null ? costPillSx.text : pillSx.text,
                                                py: 0.5,
                                                px: 1.5,
                                                borderRadius: 2,
                                                display: "inline-flex",
                                                fontWeight: "bold",
                                                fontSize: "0.9rem",
                                            }}>
                                                {s.totalCost != null ? s.totalCost.toFixed(3) : "—"}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}

                            {rows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{py: 3, color: "text.secondary"}}>
                                        No data for this period
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}
