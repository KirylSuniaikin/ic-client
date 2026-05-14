import React, { useEffect, useState } from "react";
import { Alert, Box, CircularProgress } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import dayjs from "dayjs";
import { getMonthlyShiftReport } from "../api/api";
import type { MonthlyShiftReport } from "../types/shiftTypes";

type Props = {
    branchId: string;
};

const columns: GridColDef[] = [
    { field: "username", headerName: "Staff", flex: 1, minWidth: 120 },
    { field: "role", headerName: "Role", width: 130 },
    {
        field: "totalHours",
        headerName: "Total Hrs",
        type: "number",
        width: 100,
        renderCell: (params) => {
            const {totalHours, regularHours, overtimeHours} = params.row;

            if(overtimeHours === 0) return totalHours.toFixed(2);

            return `${totalHours.toFixed(2)}(${regularHours.toFixed(2)} + ${overtimeHours.toFixed(2)})`
        }
    },
    {
        field: "totalCost",
        headerName: "Total Cost",
        type: "number",
        width: 120,
        valueFormatter: (value: number | null) => (value == null ? "—" : value.toFixed(3)),
    },
];

export function StaffSummaryContent({ branchId }: Props): JSX.Element {
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
                const msg = e instanceof Error ? e.message : "Failed to load";
                if (alive) setError(msg);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [branchId, yearMonth]);

    const rows = (report?.summaries ?? []).map((s, i) => ({ id: s.staffId ?? i, ...s }));

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ mb: 2 }}>
                <input
                    type="month"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    style={{ padding: "8px", fontSize: "16px", borderRadius: 8, border: "1px solid #e0e0e0" }}
                />
            </Box>

            {loading && (
                <Box sx={{ display: "grid", placeItems: "center", minHeight: 200 }}>
                    <CircularProgress />
                </Box>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!loading && !error && (
                <DataGrid
                    rows={rows}
                    columns={columns}
                    autoHeight
                    disableRowSelectionOnClick
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                />
            )}
        </Box>
    );
}
