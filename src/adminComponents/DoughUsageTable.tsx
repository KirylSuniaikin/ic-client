import React, {useMemo} from "react";
import {Box, Typography} from "@mui/material";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {
    GRAMS_BY_TYPE,
    makeTotalsDynamic,
} from "../management/mappers/doughMapper";
import dayjs from "dayjs";
import {DoughUsageRow, DoughUsageTO} from "../management/types/statTypes";

type Props = {
    rows: DoughUsageTO[];
};

export function DoughUsageTable({rows}: Props) {
    const dateKeys = useMemo(() => {
        if (!rows || rows.length === 0) return [];
        return rows[0].history
            .map(h => h.date)
            .sort((a, b) => a.localeCompare(b));
    }, [rows]);

    const flatData = useMemo<DoughUsageRow[]>(() => {
        return (rows || []).map((r) => {
            const row: DoughUsageRow = {
                id: r.doughType,
                doughType: r.doughType,
            };
            r.history.forEach((h) => {
                row[h.date] = h.quantity;
            });
            return row;
        });
    }, [rows]);

    const totalsByDate = useMemo<Record<string, number>>(() => {
        const totals: Record<string, number> = {};
        for (const date of dateKeys) {
            totals[date] = flatData.reduce((sum, r) => {
                const gramsPerUnit = GRAMS_BY_TYPE[r.doughType] ?? 0;
                const count = (r[date] as number) ?? 0;
                return sum + count * gramsPerUnit;
            }, 0);
        }
        return totals;
    }, [flatData, dateKeys]);

    const dataWithTotal = useMemo(() => {
        if (!flatData.length) return [];
        const totalRow = makeTotalsDynamic(flatData, dateKeys);
        return [...flatData, totalRow];
    }, [flatData, dateKeys]);

    const renderQtyCell = (dateKey: string): GridColDef<DoughUsageRow>["renderCell"] => {
        return (params) => {
            const row = params.row;
            if (row.isTotal) return;

            const count = Number(row[dateKey] ?? 0);
            if (count === 0) return <span style={{ opacity: 0.3 }}>-</span>;

            const gramsPerUnit = GRAMS_BY_TYPE[row.doughType] ?? 0;
            const grams = Math.round(count * gramsPerUnit);
            const totalGramsDay = totalsByDate[dateKey] || 0;

            const pct = totalGramsDay > 0
                ? ((grams / totalGramsDay) * 100).toFixed(1)
                : "0.0";

            return (
                <span>
                    {count} <span style={{ opacity: 0.6, fontSize: "0.85em" }}>({grams}g, {pct}%)</span>
                </span>
            );
        };
    };

    const formatHeader = (dateStr: string) => {
        const d = dayjs(dateStr);
        return `${d.format("dddd")} (${d.format("DD.MM")})`;
    };

    const columns = useMemo<GridColDef<DoughUsageRow>[]>(() => [
        { field: "doughType", headerName: "Dough type", width: 160, frozen: true },
        ...dateKeys.map((dateStr) => ({
            field: dateStr,
            headerName: formatHeader(dateStr),
            minWidth: 180,
            flex: 1,
            sortable: false,
            filterable: false,
            renderCell: (p) =>
                p.row.isTotal
                    ? <b>{(p.value as number)?.toFixed(0) ?? 0} g</b>
                    : renderQtyCell(dateStr)(p),
        })),
    ], [dateKeys, totalsByDate]);

    return (
        <Box sx={{ borderRadius: 3, width: '100%', boxShadow: 3, bgcolor: 'background.paper' }}>
            <Box sx={{ p: 2 }}>
                <Typography variant="h6" component="div">
                    <b>Dough Usage</b>
                </Typography>
            </Box>
            <DataGrid
                rows={dataWithTotal}
                getRowId={(r) => r.doughType}
                columns={columns}
                hideFooter
                disableRowSelectionOnClick
                sx={{
                    borderRadius: 3,
                    pt: 1,
                    "& .MuiDataGrid-columnHeaders": { fontWeight: 700 },
                    "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover" },
                }}
            />
        </Box>
    );
}