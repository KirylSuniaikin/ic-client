import {
    IBranch, IManagementResponse,
    InventoryRow, IUser,
    ReportTO
} from "../types/inventoryTypes";
import React, {useEffect, useMemo, useState} from "react";
import {mapProductToRow, normalizeReportPayload, rowToPayloadNumber, toDecimal, withRecalc} from "../mappers/mapper";
import CloseIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import {createReport, editReport, fetchProducts, getReport} from "../api/api";
import Decimal from "decimal.js-light";
import {
    DataGrid,
    GridColDef, GridFilterModel,
    GridRowModel, GridValueFormatter, GridValueGetter,
} from '@mui/x-data-grid';
import {Box, Button, CircularProgress, Dialog, IconButton, Stack, TextField, Typography} from "@mui/material";
import {dateFormatter} from "../mappers/dateFormatter";


type InventoryPopupProps = {
    open: boolean;
    mode: "new" | "edit";
    branch?: IBranch;
    reportId?: number;
    author: IUser;
    onClose: () => void;
    onSaved?: (report: IManagementResponse) => void;
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
    const [title, setTitle] = useState<string>("");
    const [filterModel, setFilterModel] = useState<GridFilterModel>({items: []});

    const fmt3: GridValueFormatter = (value: any) =>
        value instanceof Decimal ? value.toFixed(3) : new Decimal(value ?? 0).toFixed(3);

    const finalGetter: GridValueGetter = (_value, row: any) => {
        const kitchenQ: Decimal = row?.kitchenQuantity instanceof Decimal ? row.kitchenQuantity : new Decimal(row?.kitchenQuantity ?? 0);
        const storageQ : Decimal = row?.storageQuantity instanceof Decimal ? row.storageQuantity : new Decimal(row?.storageQuantity ?? 0);
        const qty = storageQ.add(kitchenQ);
        const price = row?.price instanceof Decimal ? row.price : new Decimal(row?.price ?? 0);
        return qty.mul(price).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    };

    useEffect(() => {
        if (!open) return;
        let alive = true;

        if (mode === "new" && !Number.isFinite(branch.branchNo)) {
            setError("branchNo is required");
            setLoading(false);
            return;
        }
        if (mode === "edit" && !Number.isFinite(reportId)) {
            setError("reportId is required");
            setLoading(false);
            return;
        }

        (async () => {
            try {
                setLoading(true);
                setError(null);
                setDirty(new Set());
                setRows([]);

                if (mode === "new") {
                    const products = await fetchProducts();
                    const data = products.filter(p => p.isInventory).map(mapProductToRow);
                    setTitle((dateFormatter() + "-" + branch.branchName + "-" + author.userName).toLowerCase());
                    if (alive) setRows(data);
                } else {
                    const rep: ReportTO = await getReport(reportId!);
                    console.log("Received report! ", rep);
                    setTitle(rep.title as string);
                    if (alive) setRows(normalizeReportPayload(rep));
                }
            } catch (e: any) {
                if (alive) setError(e?.message ?? "Failed to load");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [open, mode, reportId, author, branch]);

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

    const columns = useMemo<GridColDef<InventoryRow>[]>(() => [
        {
            field: "name",
            headerName: "Name",
            flex: 1,
            headerAlign: "left",
            align: "left",
            minWidth: 140
        },
        {
            field: "kitchenQuantity",
            headerName: "Kitchen Quantity",
            width: 140,
            editable: true,
            type: "number",
            headerAlign: "left",
            align: "left",
            valueFormatter: fmt3,
        },
        {
        field: "storageQuantity",
            headerName: "Storage Quantity",
            width: 140,
            editable: true,
            type: "number",
            headerAlign: "left",
            align: "left",
            valueFormatter: fmt3,
        },
        {
            field: "finalPrice",
            headerName: "Final Price",
            width: 140,
            headerAlign: "left",
            align: "left",
            valueGetter: finalGetter,
            valueFormatter: fmt3,
        },
        {
            field: "price",
            headerName: "Price per unit/kg",
            width: 160,
            headerAlign: "left",
            align: "left",
            valueFormatter: fmt3
        },
    ], []);

    const total = useMemo(
        () => rows.reduce((acc, r) => acc.add(toDecimal(r.finalPrice)), new Decimal(0)).toFixed(3),
        [rows]
    );

    const processRowUpdate = (newRow: GridRowModel, oldRow: GridRowModel) => {
        const nr = newRow as unknown as InventoryRow;
        const or = oldRow as unknown as InventoryRow;
        const next = withRecalc(or, (nr.kitchenQuantity as any)?.toString?.() ?? "", (nr.storageQuantity as any)?.toString?.() ?? "");

        setRows(prev => prev.map(r => (r.productId === next.productId ? next : r)));

        // setDirty(prev => {
        //     const s = new Set(prev);
        //     const changed = next.quantity.toFixed(3) !== or.quantity.toFixed(3);
        //     changed ? s.add(next.productId) : s.delete(next.productId);
        //     return s;
        // });
        // return next;
        setDirty(prev => {
            const s = new Set(prev);


            const isKitchenChanged = nr.kitchenQuantity.toFixed(3) !== or.kitchenQuantity.toFixed(3);
            const isStorageChanged = nr.storageQuantity.toFixed(3) !== or.storageQuantity.toFixed(3);

            const changed = isKitchenChanged || isStorageChanged;

            changed ? s.add(next.productId) : s.delete(next.productId);

            return s;
        });

        return next;
    };

    const handleSave = async () => {
        if (!Number.isFinite(branch.branchNo)) throw new Error("branchNo is required");
        try {
            const inventoryProducts = rows.map(rowToPayloadNumber);
            setSaving(true);
            if (mode === "new") {
                const report: IManagementResponse = await createReport({
                    title: title,
                    type: "INVENTORY",
                    branchNo: branch.branchNo!,
                    userId: author.id,
                    finalPrice: Number(total),
                    inventoryProducts: inventoryProducts,
                });
                console.log(report);
                onSaved(report);
            } else {
                const report: IManagementResponse = await editReport({
                    id: reportId!,
                    type: "INVENTORY",
                    title: title,
                    branchNo: branch.branchNo,
                    userId: author.id,
                    finalPrice: Number(total),
                    inventoryProducts: inventoryProducts,
                });
                console.log(report);
                onSaved(report);
            }
            onClose();
        } catch (e: any) {
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
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100dvh",
                maxHeight: "100dvh",
                overflow: "hidden",
            }}
        >
            <Stack direction="row" gap={2} alignItems="center" sx={{p: 2, borderBottom: 1, borderColor: "divider"}}>
                <IconButton onClick={onClose}>
                    <CloseIcon/>
                </IconButton>
                <Typography variant="body1"
                            sx={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                >
                    {title}
                </Typography>
                <Box flex={1}/>
                <Typography>Total: <b>{total}</b></Typography>
                <Button variant="contained"
                        disabled={!dirty || saving}
                        sx={{bgcolor: "#E44B4C", "&:hover": {bgcolor: "#c93d3e"}, borderRadius: 4}}
                        onClick={handleSave}
                >
                    {saving ? "Saving..." : "Save"}
                </Button>
            </Stack>

            <Box sx={{
                p: 2,
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                overscrollBehavior: "contain"
            }}>
                {loading ? (
                    <Box sx={{display: "grid", placeItems: "center", flex: 1}}>
                        <CircularProgress/>
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
                    <>
                        <Box
                            sx={{mb: 1, borderRadius: 4}}
                        >
                            <TextField
                                size="small"
                                label="Filter by product name"
                                placeholder="Type to filter"
                                onChange={handleFilterParamChange}
                                autoFocus
                                fullWidth
                                sx={{
                                    borderRadius: 4
                                }}
                            />
                        </Box>

                        <Box sx={{flex: 1, minHeight: 0}}>
                            <DataGrid rows={rows.map((r) => ({id: r.productId, ...r}))}
                                      columns={columns}
                                      disableRowSelectionOnClick
                                      processRowUpdate={processRowUpdate}
                                      editMode="row"
                                      onFilterModelChange={setFilterModel}
                                      filterModel={filterModel}
                                      onRowEditStop={() => setRows((r) => [...r])}
                                      onProcessRowUpdateError={(err) => setError(String(err))}
                            />
                        </Box>
                    </>
                )}
            </Box>
        </Dialog>
    );
}