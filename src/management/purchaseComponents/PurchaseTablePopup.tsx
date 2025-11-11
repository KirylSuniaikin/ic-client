import {IBranch, IUser, ProductTO} from "../types/inventoryTypes";
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {
    BasePurchaseResponse,
    CreatePurchasePayload,
    EditPurchasePayload,
    PurchaseRow,
    PurchaseTO,
    VendorTO
} from "../types/purchaseTypes";
import {
    Autocomplete,
    Box, Button,
    Dialog,
    IconButton,
    Stack,
    TextField,
    Tooltip,
    Typography
} from "@mui/material";
import * as dayjs from "dayjs";
import {
    createPurchaseReport,
    editPurchaseReport,
    fetchProducts,
    fetchVendors,
    getPurchaseReport,
    getUser
} from "../api/api";
import {toDecimal, toPayloadLine, validateRows} from "../mappers/mapper";
import {
    DataGrid,
    GridColDef,
    GridValueGetter,
    useGridApiRef,
    GridValueFormatter,
} from "@mui/x-data-grid";
import {DatePicker, LocalizationProvider} from "@mui/x-date-pickers";
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Decimal from "decimal.js-light";
import CloseIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import {DecimalCellEditor, normalizeDecimal} from "./DecimalCellEditor";
import {gridFilteredSortedRowIdsSelector} from "@mui/x-data-grid"

type Props = {
    open: boolean;
    mode: "new" | "edit";
    purchaseId?: number;
    userId: number;
    branch: IBranch;
    onClose: () => void;
    onSaved?: (report: BasePurchaseResponse) => void;
}

export function PurchaseTablePopup({open, mode, purchaseId, branch, onClose, onSaved, userId}: Props) {
    const [products, setProducts] = useState<ProductTO[]>([]);
    const [vendors, setVendors] = useState<VendorTO[]>([]);
    const productById = useMemo(() => new Map(products.map(p => [p.id, p] as const)), [products]);
    const apiRef = useGridApiRef();
    const [columnVisibilityModel, setColumnVisibilityModel] = useState({
        targetPrice: false,
        productName: false,
    });
    const vendorByName = useMemo(() => new Map(vendors.map(v => [String(v.vendorName).toLowerCase(), v] as const)), [vendors]);

    const [title, setTitle] = useState<string>("");
    const [reportDate, setReportDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
    const [rows, setRows] = useState<PurchaseRow[]>([]);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [admin, setAdmin] = useState<IUser>(null);
    const [invalid, setInvalid] = useState<Map<string, Set<string>>>(new Map());
    const hasErr = (id: string, field: string) => invalid.get(id)?.has(field) === true;


    useEffect(() => {
        if (!open) return;
        let alive = true;
        (async () => {
            try {
                setLoading(true); setError(null);
                const [ps, vs, adminResponse] = await Promise.all([fetchProducts(), fetchVendors(), getUser(userId)]);
                if (!alive) return;
                setProducts(ps.filter(p => p.isPurchasable === true));
                setVendors(vs);
                setAdmin(adminResponse)

                if (mode === "new") {
                    setTitle(`${dayjs().format("MMM-YY")}-BH-${adminResponse.userName}`.toLowerCase());
                    setReportDate(dayjs().format("YYYY-MM-DD"));
                    setRows([mkEmptyRow()]);
                    setDirty(false);
                } else {
                    if (!purchaseId) throw new Error("purchaseId is required for edit");
                    const rep: PurchaseTO = await getPurchaseReport({id: purchaseId});
                    if (!alive) return;
                    setTitle(rep.title);
                    setReportDate(rep.purchaseDate);
                    setRows(rep.purchaseProducts.map((x, i) => ({
                        id: `r-${i}`,
                        purchaseDate: rep.purchaseDate,
                        productId: x.product.id,
                        price: Number(x.price),
                        quantity: Number(x.quantity),
                        finalPrice: Number(x.finalPrice),
                        vendorName: x.vendorName,
                    })));
                    setDirty(false);
                }
            } catch (e: any) {
                if (alive) setError(e?.message ?? "Failed to load");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [open, mode, purchaseId, userId]);
    const asDec = useCallback((v: unknown): Decimal => toDecimal(v), []);
    const isDecFinite = useCallback((d: Decimal) => Number.isFinite(d.toNumber()), []);
    const fixedSafe = useCallback((d: Decimal, dp: number) => (isDecFinite(d) ? d.toFixed(dp) : ""), [isDecFinite]);

    const fmt3: GridValueFormatter = useCallback((value: any) => fixedSafe(asDec(value), 3), [fixedSafe, asDec]);

    const columns = useMemo<GridColDef<PurchaseRow>[]>(() => [
        {
            field: "purchaseDate",
            headerName: "Date of purchase",
            width: 150,
            headerAlign: "left",
            align: "left",
            editable: true,
            valueFormatter: (v) => (v ? dayjs(String(v)).format("DD.MM.YYYY") : ""),
            renderEditCell: (params) => {
                const { api, id, field } = params;

                return (
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                            reduceAnimations
                            value={params.value ? dayjs(String(params.value)) : null}
                            onChange={(val) => {
                                const iso = val ? val.startOf("day").format("YYYY-MM-DD") : "";
                                api.setEditCellValue({ id, field, value: iso });
                            }}
                            onClose={() => {
                                queueMicrotask(() => { try { api.stopCellEditMode({ id, field }); } catch {} });
                            }}
                            slotProps={{ textField: { size: "small", fullWidth: true, autoFocus: true } }}
                        />
                    </LocalizationProvider>
                );
            },
        },
        {
            field: "productId",
            headerName: "Product",
            headerAlign: "left",
            align: "left",
            width: 180,
            editable: true,
            renderCell: (params) => {
                const name = productById.get(params.row.productId ?? -1)?.name;
                return <span>{name ?? "Select Product"}</span>;
            },
            renderEditCell: (params) => {
                const { api, id } = params;
                const value = params.value as number | undefined;
                const current = value ? products.find(p => p.id === value) ?? null : null;

                const applyProduct = async (val: ProductTO | null) => {
                    await api.setEditCellValue({ id, field: "productId",   value: val?.id });

                    const top = String(val?.topVendor ?? "").trim().toLowerCase();
                    if (top) {
                        const row = api.getRow(id) as PurchaseRow;
                        const vendorSelected = ((row?.vendorName ?? "") !== "");

                        if (!vendorSelected) {
                            console.log("[LOOKING FOR VENDOR]")
                            const v = vendorByName.get(top);
                            console.log(v)
                            if (v) {
                                api.updateRows([
                                    {
                                        id: id,
                                        vendorName: v.vendorName
                                    }
                                ]);
                            }
                        }
                        console.log(row)
                    }

                    queueMicrotask(() => { try { api.stopCellEditMode({ id, field: "productId" }); } catch {} });
                };

                return (
                    <Autocomplete<ProductTO, false, false, false>
                        openOnFocus
                        options={products}
                        value={current}
                        autoHighlight
                        getOptionLabel={(o) => o.name}
                        isOptionEqualToValue={(o, v) => o.id === v.id}
                        onChange={(_, val) => applyProduct(val)}
                        renderInput={(p) => <TextField {...p} autoFocus size="small" placeholder="Search product…" />}
                        disablePortal
                        fullWidth
                    />
                );
            },
        },
        {
            field: "quantity",
            headerName: "Quantity",
            width: 130,
            headerAlign: "left",
            align: "left",
            editable: true,
            type: "number",
            valueFormatter: fmt3,
            renderEditCell: (params) => <DecimalCellEditor {...params} />,
        },
        {
            field: "price",
            headerName: "Price Per Unit",
            width: 140,
            editable: true,
            type: "number",
            headerAlign: "left",
            align: "left",
            valueFormatter: fmt3,
            renderEditCell: (params) => {
                const row = params.row as PurchaseRow;
                const targetRaw = row.productId != null ? productById.get(row.productId!)?.targetPrice : undefined;
                return (
                    <DecimalCellEditor
                        {...params}
                        highlightPredicate={(text: string) => {
                            const price = asDec(normalizeDecimal(text));
                            const target = asDec(targetRaw);
                            return isDecFinite(price) && isDecFinite(target) && price.greaterThan(target);
                        }}
                    />
                );
            },
            getCellClassName: (p) => {
                const r = p.row as PurchaseRow;
                const price = asDec(r.price);
                const target = asDec(r.productId != null ? productById.get(r.productId!)?.targetPrice : undefined);
                if (!isDecFinite(price) || !isDecFinite(target)) return "";
                return price.greaterThan(target) ? "cell-overTarget" : "";
            },
        },
        {
            field: "finalPrice",
            headerName: "Final Price",
            width: 140,
            headerAlign: "left",
            align: "left",
            valueGetter: ((_v, row) => {
                const q = asDec(row.quantity);
                const p = asDec(row.price);
                if (!isDecFinite(q) || !isDecFinite(p)) return null;
                return q.mul(p);
            }) as GridValueGetter,
            valueFormatter: (v) => fixedSafe(asDec(v), 4),
        },
        {
            field: "vendorName",
            headerName: "Vendor",
            width: 180,
            editable: true,
            headerAlign: "left",
            align: "left",

            renderCell: (params) => {
                const vn = params.row.vendorName;

                if (vn === null || vn === undefined) {
                    return <span>Select Vendor</span>;
                }

                const vnString = String(vn);

                const trimmedText = vnString.trim();
                const text = trimmedText !== "" ? trimmedText : "Select Vendor";

                return (
                    <span>
                {text}
            </span>
                );
            },

            renderEditCell: (params) => {
                const { api, id, field } = params;

                const currentName = (params.value as string) || "";
                const current = (currentName
                    ? vendors.find(v => v.vendorName === currentName)
                    : null) ?? null;

                const handleChange = async (_: unknown, val: VendorTO | null) => {
                    await api.setEditCellValue({
                        id,
                        field,
                        value: val?.vendorName ?? "",
                    });

                    queueMicrotask(() => {
                        try { api.stopCellEditMode({ id, field }); } catch {}
                    });
                };

                return (
                    <Autocomplete<VendorTO, false, false, false>
                        openOnFocus
                        options={vendors}
                        value={current}
                        getOptionLabel={(o) => o.vendorName}
                        isOptionEqualToValue={(o, v) => !!v && o.vendorName === v.vendorName}
                        onChange={handleChange}
                        renderInput={(p) => (
                            <TextField {...p} autoFocus size="small" placeholder="Search vendor…" />
                        )}
                        disablePortal
                        fullWidth
                    />
                );
            },
        },
        {
            field: "__actions",
            headerName: "",
            width: 64,
            headerAlign: "left",
            align: "left",
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <Tooltip title="Delete Line">
                    <IconButton
                        size="small"
                        onClick={() => {
                            const id = params.id as string;
                            setRows(prev => prev.filter(r => r.id !== id));
                            setDirty(true);
                        }}
                    >
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ),
        },
    ], [products, vendors, fixedSafe, fmt3, productById, vendorByName, asDec, isDecFinite]);

    const handleCellEditStop = React.useCallback((params) => {
        const { id } = params;
        queueMicrotask(() => {
            const updated = apiRef.current.getRow(id) as PurchaseRow;
            setRows(prev => prev.map(r => (r.id === id ? updated : r)));
            setDirty(true);
        });
    }, [apiRef]);

    const total = useMemo(
        () => rows.reduce((acc, r) => acc.add(toDecimal(r.quantity).mul(toDecimal(r.price))), new Decimal(0)).toFixed(3),
        [rows]
    );

    const isFilledNumber = (v: unknown) => {
        return !toDecimal(v).isZero();
    }

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);

            console.log(rows)

            try {
                const api: any = apiRef.current;
                const focusCell = api?.state?.focus?.cell ?? api?.state?.tabIndex?.cell ?? null;
                const fid  = focusCell?.id;
                const fcol = focusCell?.field;
                if (fid != null && typeof fcol === "string" && api?.getCellMode?.(fid, fcol) === "edit") {
                    await api.stopCellEditMode({ id: fid, field: fcol });
                }
            } catch (e) {
                console.warn("[save] skip commit active cell:", e);
            }

            let gridRows: PurchaseRow[] = [];
            try {
                const api: any = apiRef.current;
                const models = api?.getRowModels?.();
                gridRows = models && typeof models.values === "function"
                    ? Array.from(models.values()) as PurchaseRow[]
                    : rows;
            } catch {
                gridRows = rows;
            }
            console.log("[gridRows]", gridRows);

            const invalidMap = validateRows(gridRows);
            setInvalid(invalidMap);

            if (invalidMap.size > 0) {
                const [badId, badFields] = invalidMap.entries().next().value as [string, Set<string>];
                const badField = Array.from(badFields)[0] ?? "productId";
                const ids = gridFilteredSortedRowIdsSelector(apiRef);
                const rowIndex = ids.indexOf(badId);
                const colIndex = columns.findIndex(c => c.field === badField);
                try {
                    apiRef.current.scrollToIndexes?.({ rowIndex, colIndex});
                    apiRef.current.setCellFocus?.(badId, badField);
                    apiRef.current.startCellEditMode?.({ id: badId, field: badField });
                } catch {}
                console.error("[save] skip commit active cell:");
                return;
            }

            const readyRows = gridRows.filter(r =>
                r.productId != null &&
                String(r.vendorName ?? "").trim() !== "" &&
                isFilledNumber(r.price) &&
                isFilledNumber(r.quantity)
            );
            if (readyRows.length === 0) {
                throw new Error("Nothing to save: fill product, vendor, price and quantity at least in one row.");
            }

            const lines = readyRows.map(toPayloadLine);

            console.log('[gridRows]', lines);

            let totalDecimal = new Decimal(0);
            for (const r of readyRows) {
                try {
                    totalDecimal = totalDecimal.add( toDecimal(r.quantity).mul( toDecimal(r.price) ) );
                } catch (e) {
                    console.error("[total fail on row]", r, e);
                }
            }
            const totalNumber = Number(totalDecimal.toFixed(3));
            const base: CreatePurchasePayload = {
                title,
                finalPrice: totalNumber,
                userId: admin.id,
                branchNo: branch.branchNo,
                purchaseDate: reportDate,
                purchaseProducts: lines as any,
            };
            console.log("[payload]", base);

            try {
                if (mode === "new") {
                    const newReport: BasePurchaseResponse = await createPurchaseReport(base);
                    console.log(newReport);
                    onSaved?.(newReport);
                } else {
                    if (purchaseId == null) throw new Error("purchaseId is required in edit mode");
                    const newReport: BasePurchaseResponse = await editPurchaseReport({id: purchaseId, ...(base as any)} as EditPurchasePayload);
                    console.log(newReport);
                    onSaved?.(newReport);
                }

                setDirty(false);
                onClose();
            }
            catch (e: any) {
                console.error(e, "error with an api");
            }
        } catch (e: any) {
            console.error(e);
            setError(e?.message ?? "Save failed");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <Dialog fullScreen open={open} onClose={onClose} PaperProps={{ sx: { bgcolor: "background.default" } }}>
            <Stack direction="row" gap={2} alignItems="center" sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
                <Typography
                    variant="body1"
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
                <Box flex={1} />
                <Typography>Total: <b>{total}</b></Typography>
                <Button
                    variant="contained"
                    onClick={() => {
                        const r = mkEmptyRow();
                        setRows(prev => [r, ...(prev ?? [])]);
                        setDirty(true);
                    }}
                    sx={{ bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e"}, borderRadius: 4 }}
                >
                    Add
                </Button>
                <Button variant="contained"
                        disabled={!dirty || saving}
                        sx={{ bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e"}, borderRadius: 4 }}
                        onClick={handleSave}
                >
                    {saving ? "Saving..." : "Save"}
                </Button>
            </Stack>

            <Box
                sx={{
                    p: 2,
                    height: "calc(100vh - 72px)",
                    "& .MuiDataGrid-cell.cell-overTarget, & .MuiDataGrid-cell--editing.cell-overTarget": (theme) => ({
                        backgroundColor: `${theme.palette.error.light}33`,
                        color: theme.palette.error.main,
                        fontWeight: 700,
                    }),
                    "& .cell-invalid, & .MuiDataGrid-cell--editing.cell-invalid": (t) => ({
                        backgroundColor: `${t.palette.error.light}33`,
                        color: t.palette.error.main,
                        fontWeight: 700,
                    }),
                    "& .row-invalid .MuiDataGrid-cell": (t) => ({
                        backgroundColor: `${t.palette.error.light}1a`,
                    }),
                }}
            >
                {loading ? (
                    <Typography color="text.secondary">Loading…</Typography>
                ) : error ? (
                    <Box sx={{ p: 2, border: "1px solid", borderColor: "error.main", color: "error.main", borderRadius: 2 }}>
                        {error}
                    </Box>
                ) : (
                    <DataGrid
                    apiRef={apiRef}
                    rows={rows}
                    columns={columns}
                    getRowId={(r) => r.id}
                    editMode="cell"
                    disableRowSelectionOnClick
                    onCellClick={(p) => {
                    if (!p.isEditable || p.field === "__actions") return;
                    const mode = apiRef.current.getCellMode(p.id, p.field);
                    if (mode !== "edit") apiRef.current.startCellEditMode({ id: p.id, field: p.field });
                }}
                    processRowUpdate={(newRow) => {
                        setRows(prev => prev.map(r => r.id === newRow.id ? (newRow as PurchaseRow) : r));
                        setDirty(true);
                        return newRow;
                    }}
                    onCellEditStop={handleCellEditStop}
                    columnVisibilityModel={columnVisibilityModel}
                    onColumnVisibilityModelChange={(model) =>
                        setColumnVisibilityModel({ ...model, targetPrice: false, productName: false})
                    }
                    getRowClassName={(p) => (invalid.has(p.id as string) ? "row-invalid" : "")}
                    getCellClassName={(p) => (hasErr(p.id as string, p.field) ? "cell-invalid" : "")}
                    />
                )}
            </Box>
        </Dialog>
    );

    function mkEmptyRow(): PurchaseRow {
        return {
            id: crypto.randomUUID(),
            purchaseDate: dayjs().format("YYYY-MM-DD"),
            productId: undefined,
            price: null,
            quantity: null,
            finalPrice: null,
            vendorName: "",
        };
    }
}