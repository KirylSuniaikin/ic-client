import React, {useEffect, useMemo, useState} from "react";
import {fetchLatestConsumptionReport} from "../../../../shared/api/management";
import {ConsumptionProductTO, ConsumptionReportTO} from "../types";
import {ConsumptionSummaryRow} from "./ConsumptionSummaryRow";
import {SpendHistoryDialog} from "./SpendHistoryDialog";
import {distinctVendors, filterRows, NO_VENDOR, Row, summarizeRows} from "../consumptionRows";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import { getDaysInMonth } from "date-fns";
import {Badge, Box, Button, ButtonBase, Card, Chip, Collapse, InputAdornment, MenuItem, TextField, Typography} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";

type Props = {
    branchId: string;
}

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

export function ConsumptionStatistics({branchId}: Props) {
    const [report, setReport] = useState<ConsumptionReportTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [nameQuery, setNameQuery] = useState("");
    const [vendorFilter, setVendorFilter] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    // product "" = the whole filtered selection; vendor "" = every vendor.
    const [history, setHistory] = useState<{vendor: string; product: string} | null>(null);


    useEffect(() => {
        setLoading(true);
        (async () => {
            try {
                const r = await fetchLatestConsumptionReport(branchId.toString());
                setReport(r);
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load");
            } finally {
                setLoading(false);
            }
        })();
    }, [branchId]);

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
                const spent = p.spent ?? 0;
                return {
                    id: idx,
                    name: p.productName,
                    vendor: p.vendorName ?? "",
                    spent,
                    usage,
                    usagePerWeek: usage / 4.3,
                    usagePerShift: usage / shifts,
                };
            })
            .sort((a, b) => b.spent - a.spent);
    }, [report, meta]);

    const vendors = useMemo(() => distinctVendors(rows), [rows]);
    const visibleRows = useMemo(() => filterRows(rows, nameQuery, vendorFilter), [rows, nameQuery, vendorFilter]);
    const summary = useMemo(() => summarizeRows(visibleRows), [visibleRows]);
    const reportSpent = useMemo(() => summarizeRows(rows).total, [rows]);
    const vendorLabel = vendorFilter === NO_VENDOR ? "No vendor" : vendorFilter || "All vendors";

    const money = (p: {value?: unknown}) => (p.value as number).toFixed(3);
    const columns: GridColDef<Row>[] = [
        { field: "name", headerName: "Name", flex: 1, minWidth: 200 },
        {
            field: "vendor", headerName: "Vendor", width: 180,
            renderCell: (p) => p.value ? <Chip label={p.value as string} size="small" variant="outlined" /> : <Typography color="text.disabled">—</Typography>,
        },
        { field: "spent", headerName: "Spent (BD)", width: 130, type: "number", renderCell: (p) => (
                <ButtonBase
                    onClick={() => setHistory({vendor: "", product: p.row.name})}
                    aria-label={`Show purchase history of ${p.row.name}`}
                    sx={{fontWeight: 700, fontSize: "inherit", textDecoration: "underline dotted", textUnderlineOffset: 4}}
                >
                    {money(p)}
                </ButtonBase>
            ),
        },
        { field: "usage", headerName: "Usage", width: 110, type: "number", renderCell: money },
        { field: "usagePerWeek", headerName: "Usage / Week", width: 140, type: "number", renderCell: money },
        { field: "usagePerShift", headerName: "Usage / Shift", width: 140, type: "number", renderCell: money },
    ];

    const handleFilterParamChange = (e: React.ChangeEvent<HTMLInputElement>) => setNameQuery(e.target.value);

    return (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                {report && <Typography variant="h6" sx={{ fontWeight: 700 }}>{report.title}</Typography>}
                {report?.missingBranches && report.missingBranches.length > 0 && (
                    <Typography variant="caption" color="error">
                        No report for this month from: {report.missingBranches.join(", ")} — totals below are partial.
                    </Typography>
                )}
                <Box sx={{ display: "flex", gap: 1 }}>
                    <TextField
                        variant="outlined"
                        size="small"
                        placeholder="Type to filter"
                        onChange={handleFilterParamChange}
                        fullWidth
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: "text.disabled" }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                    />
                    <Badge color="primary" variant="dot" invisible={!vendorFilter}>
                        <Button
                            variant={filtersOpen ? "contained" : "outlined"}
                            color="inherit"
                            startIcon={<FilterListIcon />}
                            onClick={() => setFiltersOpen((open) => !open)}
                            sx={{ borderRadius: 3, textTransform: "none", height: "100%", whiteSpace: "nowrap" }}
                        >
                            Filters
                        </Button>
                    </Badge>
                </Box>
                <Collapse in={filtersOpen} unmountOnExit>
                    <TextField
                        select
                        size="small"
                        label="Vendor"
                        value={vendorFilter}
                        onChange={(e) => setVendorFilter(e.target.value)}
                        fullWidth
                        // "All vendors" is the empty value; without a forced shrink the label sits on top of it.
                        slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                    >
                        <MenuItem value="">All vendors</MenuItem>
                        {vendors.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                        <MenuItem value={NO_VENDOR}>No vendor</MenuItem>
                    </TextField>
                </Collapse>
                <ConsumptionSummaryRow
                    vendorLabel={vendorLabel}
                    onClearVendor={vendorFilter ? () => setVendorFilter("") : undefined}
                    summary={summary}
                    onOpenHistory={() => setHistory({vendor: vendorFilter === NO_VENDOR ? "" : vendorFilter, product: ""})}
                />
            </Box>
            <Box sx={{ height: 560, width: "100%" }}>
                <DataGrid
                    rows={visibleRows}
                    columns={columns}
                    loading={loading}
                    rowHeight={46}
                    disableRowSelectionOnClick
                    disableColumnFilter
                    pageSizeOptions={[10, 25, 50]}
                    initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                    sx={{
                        border: 0,
                        borderTop: 1,
                        borderColor: "divider",
                        "& .MuiDataGrid-columnSeparator": { display: "none" },
                        "& .MuiDataGrid-columnHeaders": { borderColor: "divider" },
                        "& .MuiDataGrid-columnHeaderTitle": {
                            fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, color: "text.secondary",
                        },
                        "& .MuiDataGrid-cell": { borderColor: "divider", fontVariantNumeric: "tabular-nums" },
                        "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": { outline: "none" },
                        "& .MuiDataGrid-footerContainer": { borderColor: "divider" },
                    }}
                />
            </Box>
            <Box sx={{ p: 2 }}>
                {report && (
                    <Typography sx={{ fontWeight: 600 }}>
                        Report total spent: {reportSpent.toFixed(3)} BD
                    </Typography>
                )}
                {err && <Typography color="error" sx={{ mt: 1 }}>{err}</Typography>}
            </Box>
            <SpendHistoryDialog
                open={history !== null}
                onClose={() => setHistory(null)}
                branchId={branchId}
                vendor={history?.vendor ?? ""}
                product={history?.product ?? ""}
            />
        </Card>
    );
}
