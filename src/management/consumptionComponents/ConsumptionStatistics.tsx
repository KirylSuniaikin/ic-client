import React, {useEffect, useMemo, useState} from "react";
import {fetchLatestConsumptionReport} from "../api/api";
import {ConsumptionProductTO, ConsumptionReportTO} from "../types/consumptionTypes";
import {DataGrid, GridColDef, GridFilterModel} from "@mui/x-data-grid";
import { getDaysInMonth } from "date-fns";
import {Box, Card, CardContent, TextField, Typography} from "@mui/material";

function parseYearMonthFromTitle(title: string): { year: number; month: number } | null {
    const m = title.trim().toLowerCase().match(/^([a-z]{3})-(\d{2})/);
    if (!m) return null;
    const mm = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[1]) + 1;
    if (mm <= 0) return null;
    const yy = 2000 + parseInt(m[2], 10);
    return { year: yy, month: mm };
}

function countMondays(year: number, month1to12: number): number {
    let count = 0;
    const days = getDaysInMonth(new Date(year, month1to12 - 1, 1));
    for (let d = 1; d <= days; d++) {
        const w = new Date(year, month1to12 - 1, d).getDay(); // 0..6, Mon=1
        if (w === 1) count++;
    }
    return count;
}

type Row = {
    id: number;
    name: string;
    price: number;
    usage: number;
    usagePerWeek: number;
    usagePerShift: number;
};

export function  ConsumptionStatistics() {
    const [report, setReport] = useState<ConsumptionReportTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [filterModel, setFilterModel] = useState<GridFilterModel>({items: []});


    useEffect(() => {
        (async () => {
            try {
                const r = await fetchLatestConsumptionReport();
                setReport(r);
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const meta = useMemo(() => {
        if (!report) return null;
        const parsed = parseYearMonthFromTitle(report.title);
        if (!parsed) return null;
        const days = getDaysInMonth(new Date(parsed.year, parsed.month - 1, 1));
        const mondays = countMondays(parsed.year, parsed.month);
        const shifts = Math.max(1, days - mondays);
        return { ...parsed, days, mondays, shifts };
    }, [report]);

    const rows = useMemo<Row[]>(() => {
        if (!report) return [];
        const shifts = meta?.shifts ?? 30;
        return (report.consumptionProducts ?? [])
            .map<Row>((p: ConsumptionProductTO, idx) => {
                const usage = p.quantity ?? 0;
                const price = p.finalPrice ?? 0;
                return {
                    id: idx,
                    name: p.productName,
                    price,
                    usage,
                    usagePerWeek: usage / 4.3,
                    usagePerShift: usage / shifts,
                };
            })
            .sort((a, b) => b.price - a.price);
    }, [report, meta]);

    const columns: GridColDef<Row>[] = [
        { field: "name", headerName: "Name", flex: 1, minWidth: 200 },
        { field: "price", headerName: "Price (BD)", width: 130, renderCell: (p) => ((p.value as number).toFixed(3))},
        { field: "usage", headerName: "Usage", width: 120, renderCell: (p) => ((p.value as number).toFixed(3)) },
        { field: "usagePerWeek", headerName: "Usage / Week", width: 150, renderCell: (p) => ((p.value as number).toFixed(3)) },
        { field: "usagePerShift", headerName: "Usage / Shift", width: 150, renderCell: (p) => ((p.value as number).toFixed(3)) },
    ];

    const handleFilterParamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFilterModel({
            items: value ? [{
                id: 0,
                field: "name",
                operator: "contains",
                value: value
            }]: []
        });
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
                <Box
                    sx={{p:2
                    }}
                >
                    <TextField
                        variant="outlined"
                        size="small"
                        label="Filter by product name"
                        placeholder="Type to filter"
                        onChange={handleFilterParamChange}
                        fullWidth
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 3,
                                borderColor: '#a5a5a5',

                                '& fieldset': { borderColor: '#a5a5a5' },
                                '&:hover fieldset': { borderColor: '#a5a5a5' },
                                '&.Mui-focused fieldset': {
                                    borderColor: '#a5a5a5'
                                },
                                '&.Mui-disabled fieldset': { borderColor: '#a5a5a5' }
                            },
                            '& .MuiInputLabel-root': {
                                color: '#6b7280',
                            },

                            '& .MuiInputBase-input': { py: 1, px: 1.5 },
                        }}
                    />
                </Box>
                <CardContent>
                    {report && (
                        <Typography variant="h6" sx={{ mb: 1 }}>
                            Title: <b>{report.title}</b>
                        </Typography>
                    )}

                    <Box sx={{ height: 560, width: "100%" }}>
                        <DataGrid
                            rows={rows}
                            columns={columns}
                            loading={loading}
                            disableRowSelectionOnClick
                            onFilterModelChange={setFilterModel}
                            filterModel={filterModel}
                            pageSizeOptions={[10, 25, 50]}
                            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                        />
                    </Box>

                    {report && (
                        <Typography sx={{ mt: 1.5, fontWeight: 600 }}>
                            Report Total: {report.finalPrice.toFixed(3)} BD
                        </Typography>
                    )}
                    {err && <Typography color="error" sx={{ mt: 1 }}>{err}</Typography>}
                </CardContent>
            </Card>
        </Box>
    );
}