import {
    IBranch,
    InventoryRow, IUser,
    ReportTO
} from "./types";
import  {useEffect, useMemo, useState} from "react";
import {mapProductToRow, normalizeReportPayload, rowToPayloadNumber, withRecalc} from "./mapper";
import CloseIcon from "@mui/icons-material/Close";
import {createReport, editReport, fetchProducts, getReport} from "./api";
import Decimal from "decimal.js-light";
import {
    DataGrid,
    GridColDef,
    GridRowModel, GridValueFormatter, GridValueGetter,
} from '@mui/x-data-grid';
import { Box, Button, CircularProgress, Dialog, IconButton, Stack, Typography} from "@mui/material";
import {dateFormatter} from "./dateFormatter";


type InventoryPopupProps = {
    open: boolean;
    mode: "new" | "edit";
    branch?: IBranch;
    reportId?: number;
    author: IUser;
    onClose: () => void;
    onSaved?: () => void;
};

export default function InventoryPopup({
                                           open,
                                           mode,
                                           branch,
                                           reportId,
                                           author,
                                           onClose,
                                           onSaved,
                                       }: InventoryPopupProps) {
    const [rows, setRows] = useState<InventoryRow[]>([]);
    const [dirty, setDirty] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reportToEdit, setReportToEdit] = useState<ReportTO | null>(null);
    const [title, setTitle] = useState<string>("");

    const fmt2: GridValueFormatter = (value: any) =>
        value instanceof Decimal ? value.toFixed(2) : new Decimal(value ?? 0).toFixed(4);

    const fmt3: GridValueFormatter = (value: any) =>
        value instanceof Decimal ? value.toFixed(3) : new Decimal(value ?? 0).toFixed(3);

    const finalGetter: GridValueGetter = (_value, row: any) => {
        const qty = row?.quantity instanceof Decimal ? row.quantity : new Decimal(row?.quantity ?? 0);
        const price = row?.price instanceof Decimal ? row.price : new Decimal(row?.price ?? 0);
        return qty.mul(price).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    };

    useEffect(() => {
        if (!open) return;
        let alive = true;
        (async () => {
            try {
                setLoading(true); setError(null); setDirty(new Set()); setRows([]);
                if (mode === "new") {
                    if (!Number.isFinite(branch.branchNo)) throw new Error("branchNo is required");
                    const products = await fetchProducts();
                    const data = products.filter(p => p.isInventory).map(mapProductToRow);
                    setTitle(dateFormatter() + "-" + branch.externalId + "-" + author.userName)
                    if (alive) setRows(data);
                } else {
                    if (!Number.isFinite(reportId)) throw new Error("reportId is required");
                    const rep: ReportTO = await getReport(reportId!);
                    console.log("Received report! ", rep);
                    setReportToEdit(rep as ReportTO);
                    setTitle(rep.title as string);
                    if (alive) setRows(normalizeReportPayload(rep));
                }
            } catch (e:any) {
                if (alive) setError(e?.message ?? "Failed to load");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [open, mode, reportId]);

    const columns = useMemo<GridColDef<InventoryRow>[]>(() => [
        { field: "name", headerName: "Name", flex: 1, minWidth: 140 },
        { field: "price", headerName: "Price per unit/kg", width: 160, valueFormatter:  fmt2},
        {
            field: "quantity",
            headerName: "Quantity",
            width: 140,
            editable: true,
            type: "number",
            valueFormatter: fmt3,
        },
        {
            field: "finalPrice",
            headerName: "Final Price",
            width: 140,
            valueGetter: finalGetter,
            valueFormatter: fmt2,
        },
    ], []);

    const processRowUpdate = (newRow: GridRowModel, oldRow: GridRowModel) => {
        const nr = newRow as unknown as InventoryRow;
        const or = oldRow as unknown as InventoryRow;
        const next = withRecalc(or, (nr.quantity as any)?.toString?.() ?? "");

        setRows(prev => prev.map(r => (r.productId === next.productId ? next : r)));

        setDirty(prev => {
            const s = new Set(prev);
            const changed = next.quantity.toFixed(3) !== or.quantity.toFixed(3);
            changed ? s.add(next.productId) : s.delete(next.productId);
            return s;
        });
        return next;
    };

    const handleSave = async () => {
        try {
            const inventoryProducts = rows.map(rowToPayloadNumber);
            console.log(inventoryProducts);
            setSaving(true);
            if (mode === "new") {
                if (!Number.isFinite(branch.branchNo)) throw new Error("branchNo is required");
                await createReport({
                    title: title,
                    type: "INVENTORY",
                    branchNo: branch.branchNo!,
                    userId: author.id,
                    inventoryProducts: inventoryProducts,
                });
            } else {
                await editReport({
                    id: reportId!,
                    type: "INVENTORY",
                    title: title,
                    branchNo: branch.branchNo,
                    userId: author.id,
                    inventoryProducts: inventoryProducts,
                });
            }
            onClose();
            onSaved?.();
        } catch (e:any) {
            setError(e?.message ?? "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen
            sx = {{
            display: "flex",
            flexDirection: "column",
            height: "100dvh",
            maxHeight: "100dvh",
            overflow: "hidden",
            }}
        >
            <Box
                component="header"
                sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: (t) => t.zIndex.appBar,
                    bgcolor: "background.paper",
                    borderBottom: 1,
                    borderColor: "divider",
                    px: 2,
                    py: 3,
                }}
            >
                <Stack direction="row" alignItems="center" gap={2}>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {title}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Stack direction="row" alignItems="center" gap={1.5}>
                        <Button
                            variant="contained"
                            disabled={saving || dirty.size === 0}
                            sx={{ bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e"}, borderRadius: 4 }}
                            onClick={handleSave}
                        >
                            {saving ? "Saving..." : `Save`}
                        </Button>
                        <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </Stack>
            </Box>

            <Box sx={{
                p: 2,
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                overscrollBehavior: "contain"
            }}>
                {loading ? (
                    <Box sx={{ display: "grid", placeItems: "center", flex: 1 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Box
                        sx={{
                            p: 2,
                            m: 0,
                            border: 1,
                            borderColor: "error.main",
                            color: "error.main",
                            borderRadius: 2,
                            width: "100%",
                        }}
                    >
                        {error}
                    </Box>
                ) : (
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                        <DataGrid
                            rows={rows.map((r) => ({ id: r.productId, ...r }))}
                            columns={columns}
                            disableRowSelectionOnClick
                            processRowUpdate={processRowUpdate}
                            editMode="row"
                            onRowEditStop={() => setRows((r) => [...r])}
                            onProcessRowUpdateError={(err) => setError(String(err))}
                        />
                    </Box>
                )}
            </Box>
        </Dialog>
    );
}