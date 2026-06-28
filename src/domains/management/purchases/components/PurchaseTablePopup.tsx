import { logger } from "../../../../shared/utils/logger";
import {IBranch, IUser, ProductTO} from "../../inventory/types";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    BasePurchaseResponse,
    CreatePurchasePayload,
    EditPurchasePayload,
    PurchaseRow,
    PurchaseTO,
    VendorTO
} from "../types";
import {
    Autocomplete,
    Box, Button,
    Dialog,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography
} from "@mui/material";
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";
import dayjs from 'dayjs';
import {
    createPurchaseReport,
    editPurchaseReport,
    fetchProducts,
    fetchVendors,
    getPurchaseReport,
    getUser
} from "../../../../shared/api/management";
import { toDecimal, toPayloadLine, validateRows} from "../mappers/purchaseMapper";
import {normalizeDecimal} from "./DecimalCellEditor";
import {DatePicker, LocalizationProvider} from "@mui/x-date-pickers";
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Decimal from "decimal.js-light";

type Props = {
    open: boolean;
    mode: "new" | "edit";
    purchaseId?: number;
    userId: number;
    branch: IBranch;
    onClose: () => void;
    onSaved?: (report: BasePurchaseResponse) => void;
}

const pillSx = {
    bg: "rgba(0,0,0,0.06)",
    text: "#333",
};

const noUnderlineSx = {
    "& .MuiInput-underline:before": { borderBottom: "none" },
    "& .MuiInput-underline:after": { borderBottom: "none" },
    "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottom: "none" },
};

const headerCellSx = { fontWeight: "bold", color: "text.secondary" } as const;

export function PurchaseTablePopup({open, mode, purchaseId, branch, onClose, onSaved, userId}: Props) {
    const [products, setProducts] = useState<ProductTO[]>([]);
    const [vendors, setVendors] = useState<VendorTO[]>([]);
    const productById = useMemo(() => new Map(products.map(p => [p.id, p] as const)), [products]);
    const isDataLoadedRef = useRef<boolean>(false);
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
    const hasErr = useCallback((id: string, field: string) => invalid.get(id)?.has(field) === true, [invalid]);


    useEffect(() => {
        if (!open) {
            isDataLoadedRef.current = false;
            return;
        }

        if(isDataLoadedRef.current) return;
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
                    isDataLoadedRef.current = true
                    setDirty(false);
                } else {
                    if (!purchaseId) throw new Error("purchaseId is required for edit");
                    const rep: PurchaseTO = await getPurchaseReport({id: purchaseId});
                    if (!alive) return;
                    setTitle(rep.title);
                    setReportDate(rep.purchaseDate);
                    setRows(rep.purchaseProducts.map((x, i) => ({
                        id: `r-${i}`,
                        purchaseDate: x.purchaseDate,
                        productId: x.product.id,
                        price: Number(x.price),
                        quantity: Number(x.quantity),
                        finalPrice: Number(x.finalPrice),
                        vendorName: x.vendorName,
                    })));
                    setDirty(false);
                    isDataLoadedRef.current = true
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
    const fmt3 = useCallback((value: unknown): string => fixedSafe(asDec(value), 3), [fixedSafe, asDec]);


    const unitFromRow = useCallback((row: PurchaseRow) => {
        const price = toDecimal(row.price);
        if (row.price != null && isDecFinite(price)) return price;

        const tot = toDecimal(row.finalPrice);
        const qty = toDecimal(row.quantity);
        return (isDecFinite(tot) && isDecFinite(qty) && !qty.isZero())
            ? tot.div(qty)
            : toDecimal(NaN);
    }, [isDecFinite]);

    const isOverTarget = useCallback((row: PurchaseRow) => {
        const unit   = unitFromRow(row);
        const target = toDecimal(productById.get(row.productId ?? -1)?.targetPrice ?? NaN);
        return isDecFinite(unit) && isDecFinite(target) && unit.greaterThan(target);
    }, [productById, unitFromRow, isDecFinite]);

    // Recompute target unit price (price = finalPrice / quantity) on edits, keeping rows in sync + marking dirty.
    const updateRow = useCallback((id: string, patch: Partial<PurchaseRow>) => {
        setRows(prev => prev.map(r => {
            if (r.id !== id) return r;
            const next = { ...r, ...patch };

            const q   = toDecimal(next.quantity);
            const tot = toDecimal(next.finalPrice);
            if (isDecFinite(q) && !q.isZero() && isDecFinite(tot)) {
                next.price = Number(tot.div(q).toFixed(3));
            }
            return next;
        }));
        setDirty(true);
    }, [isDecFinite]);

    const applyProduct = useCallback((id: string, val: ProductTO | null) => {
        const productId = val?.id ?? null;
        const top = String(val?.topVendor ?? "").trim().toLowerCase();

        setRows(prev => prev.map(r => {
            if (r.id !== id) return r;
            const next: PurchaseRow = { ...r, productId };

            if (val && top) {
                const vendorSelected = ((r.vendorName ?? "") !== "");
                if (!vendorSelected) {
                    const v = vendorByName.get(top);
                    if (v) {
                        next.vendorName = v.vendorName;
                    }
                    next.price = val.targetPrice;
                }
            }
            return next;
        }));
        setDirty(true);
    }, [vendorByName]);

    const total = useMemo(
        () =>
            rows
                .reduce((acc, r) => acc.add(toDecimal(r.finalPrice)), new Decimal(0))
                .toFixed(3),
        [rows]
    );

    const isFilledNumber = (v: unknown) => {
        return !toDecimal(v).isZero();
    }

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);

            const invalidMap = validateRows(rows);
            setInvalid(invalidMap);

            if (invalidMap.size > 0) {
                logger.error("[save] validation failed, blocking save");
                return;
            }

            const readyRows = rows.filter(r =>
                r.productId != null &&
                String(r.vendorName ?? "").trim() !== "" &&
                isFilledNumber(r.price) &&
                isFilledNumber(r.quantity)
            );
            if (readyRows.length === 0) {
                throw new Error("Nothing to save: fill product, vendor, price and quantity at least in one row.");
            }

            const lines = readyRows.map(toPayloadLine);

            let totalDecimal = new Decimal(0);
            for (const r of readyRows) {
                try {
                    totalDecimal = totalDecimal.add( r.finalPrice );
                } catch (e) {
                    logger.error("[total fail on row]", r, e);
                }
            }
            const base: CreatePurchasePayload = {
                title,
                finalPrice: Number(total),
                userId: admin.id,
                branchNo: branch.branchNo,
                purchaseDate: reportDate,
                purchaseProducts: lines as any,
            };

            try {
                if (mode === "new") {
                    const newReport: BasePurchaseResponse = await createPurchaseReport(base);
                    onSaved?.(newReport);
                } else {
                    if (purchaseId == null) throw new Error("purchaseId is required in edit mode");
                    const newReport: BasePurchaseResponse = await editPurchaseReport({id: purchaseId, ...(base as any)} as EditPurchasePayload);
                    onSaved?.(newReport);
                }

                setDirty(false);
                onClose();
            }
            catch (e: any) {
                logger.error(e, "error with an api");
            }
        } catch (e: any) {
            logger.error(e);
            setError(e?.message ?? "Save failed");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <Dialog fullScreen open={open} onClose={onClose} PaperProps={{ sx: { bgcolor: "background.default" } }}>
            <ManagementTopBar
                title={title}
                onBack={onClose}
                actions={
                    <>
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
                        <Button
                            variant="contained"
                            disabled={!dirty || saving}
                            sx={{ bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e"}, borderRadius: 4 }}
                            onClick={handleSave}
                        >
                            {saving ? "Saving..." : "Save"}
                        </Button>
                    </>
                }
            />

            <Box sx={{ p: 2, height: "calc(100vh - 72px)", overflow: "auto", overscrollBehavior: "contain" }}>
                {loading ? (
                    <Typography color="text.secondary">Loading…</Typography>
                ) : error ? (
                    <Box sx={{ p: 2, border: "1px solid", borderColor: "error.main", color: "error.main", borderRadius: 2 }}>
                        {error}
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
                        <Table size="small" aria-label="purchases" sx={{ minWidth: 900 }}>
                            <TableHead sx={{ bgcolor: "#fafafa" }}>
                                <TableRow>
                                    <TableCell sx={headerCellSx}>Date of purchase</TableCell>
                                    <TableCell sx={headerCellSx}>Product</TableCell>
                                    <TableCell sx={headerCellSx}>Amount(kg/unit)</TableCell>
                                    <TableCell sx={headerCellSx}>Total Price</TableCell>
                                    <TableCell sx={headerCellSx}>Target Price(kg/unit)</TableCell>
                                    <TableCell sx={headerCellSx}>Vendor</TableCell>
                                    <TableCell sx={headerCellSx} />
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {rows.map((row) => {
                                    const overTarget = isOverTarget(row);
                                    const rowInvalid = invalid.has(row.id);
                                    const productName = productById.get(row.productId ?? -1)?.name;
                                    const selectedProduct = row.productId != null
                                        ? products.find(p => p.id === row.productId) ?? null
                                        : null;
                                    const vendorTrimmed = String(row.vendorName ?? "").trim();
                                    const selectedVendor = vendorTrimmed !== ""
                                        ? vendors.find(v => v.vendorName === vendorTrimmed) ?? null
                                        : null;

                                    // Invalid-cell highlight (validateRows result) as plain sx, merged onto the TableCell.
                                    const cellErrSx = (field: string) =>
                                        hasErr(row.id, field)
                                            ? {
                                                backgroundColor: "rgba(244,67,54,0.20)",
                                                color: "error.main",
                                                fontWeight: 700,
                                            }
                                            : {};

                                    return (
                                        <TableRow
                                            key={row.id}
                                            sx={{
                                                "&:last-child td, &:last-child th": { border: 0 },
                                                ...(rowInvalid
                                                    ? { "& td": (t: any) => ({ backgroundColor: `${t.palette.error.light}1a` }) }
                                                    : {}),
                                            }}
                                        >
                                            {/* Date of purchase */}
                                            <TableCell sx={{ minWidth: 160, ...cellErrSx("purchaseDate") }}>
                                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                                    <DatePicker
                                                        reduceAnimations
                                                        format="DD.MM.YYYY"
                                                        value={row.purchaseDate ? dayjs(row.purchaseDate) : null}
                                                        onChange={(val) => {
                                                            const iso = val ? val.startOf("day").format("YYYY-MM-DD") : "";
                                                            updateRow(row.id, { purchaseDate: iso });
                                                        }}
                                                        slotProps={{ textField: { size: "small", fullWidth: true, variant: "standard", sx: noUnderlineSx } }}
                                                    />
                                                </LocalizationProvider>
                                            </TableCell>

                                            {/* Product */}
                                            <TableCell sx={{ minWidth: 200, ...cellErrSx("productId") }}>
                                                <Autocomplete<ProductTO, false, false, false>
                                                    openOnFocus
                                                    options={products}
                                                    value={selectedProduct}
                                                    autoHighlight
                                                    getOptionLabel={(o) => o.name}
                                                    isOptionEqualToValue={(o, v) => o.id === v.id}
                                                    onChange={(_, val) => applyProduct(row.id, val)}
                                                    renderInput={(p) => (
                                                        <TextField
                                                            {...p}
                                                            size="small"
                                                            variant="standard"
                                                            placeholder={productName ?? "Select Product"}
                                                            sx={noUnderlineSx}
                                                        />
                                                    )}
                                                    fullWidth
                                                />
                                            </TableCell>

                                            {/* Amount (quantity) */}
                                            <TableCell sx={{ minWidth: 130, ...cellErrSx("quantity") }}>
                                                <Box sx={{
                                                    backgroundColor: pillSx.bg,
                                                    color: pillSx.text,
                                                    py: 0.5, px: 1.5, borderRadius: 2,
                                                    display: "inline-flex", alignItems: "center",
                                                    fontWeight: "bold", fontSize: "0.9rem",
                                                }}>
                                                    <TextField
                                                        type="text"
                                                        inputMode="decimal"
                                                        defaultValue={fmt3(row.quantity)}
                                                        key={`qty-${row.id}-${fmt3(row.quantity)}`}
                                                        onBlur={(e) => {
                                                            const norm = normalizeDecimal(e.target.value);
                                                            updateRow(row.id, { quantity: norm === "" ? 0 : (Number(norm) as PurchaseRow["quantity"]) });
                                                        }}
                                                        size="small"
                                                        variant="standard"
                                                        sx={{
                                                            width: 90,
                                                            ...noUnderlineSx,
                                                            "& input": { color: pillSx.text, fontWeight: "bold", fontSize: "0.9rem", padding: 0 },
                                                        }}
                                                    />
                                                </Box>
                                            </TableCell>

                                            {/* Total Price (finalPrice) */}
                                            <TableCell sx={{ minWidth: 140, ...cellErrSx("finalPrice") }}>
                                                <Box sx={(t) => ({
                                                    backgroundColor: overTarget ? `${t.palette.error.light}33` : pillSx.bg,
                                                    color: overTarget ? t.palette.error.main : pillSx.text,
                                                    py: 0.5, px: 1.5, borderRadius: 2,
                                                    display: "inline-flex", alignItems: "center",
                                                    fontWeight: "bold", fontSize: "0.9rem",
                                                })}>
                                                    <TextField
                                                        type="text"
                                                        inputMode="decimal"
                                                        defaultValue={fmt3(row.finalPrice)}
                                                        key={`fp-${row.id}-${fmt3(row.finalPrice)}`}
                                                        onBlur={(e) => {
                                                            const norm = normalizeDecimal(e.target.value);
                                                            updateRow(row.id, { finalPrice: norm === "" ? 0 : (Number(norm) as PurchaseRow["finalPrice"]) });
                                                        }}
                                                        size="small"
                                                        variant="standard"
                                                        sx={(t) => ({
                                                            width: 100,
                                                            ...noUnderlineSx,
                                                            "& input": {
                                                                color: overTarget ? t.palette.error.main : pillSx.text,
                                                                fontWeight: "bold", fontSize: "0.9rem", padding: 0,
                                                            },
                                                        })}
                                                    />
                                                </Box>
                                            </TableCell>

                                            {/* Target Price (price) — read-only */}
                                            <TableCell sx={(t) => ({
                                                minWidth: 160,
                                                fontSize: "0.9rem",
                                                ...(overTarget
                                                    ? { backgroundColor: `${t.palette.error.light}33`, color: t.palette.error.main, fontWeight: 700 }
                                                    : { color: "text.secondary" }),
                                            })}>
                                                {fmt3(row.price)}
                                            </TableCell>

                                            {/* Vendor */}
                                            <TableCell sx={{ minWidth: 200, ...cellErrSx("vendorName") }}>
                                                <Autocomplete<VendorTO, false, false, false>
                                                    openOnFocus
                                                    options={vendors}
                                                    value={selectedVendor}
                                                    getOptionLabel={(o) => o.vendorName}
                                                    isOptionEqualToValue={(o, v) => !!v && o.vendorName === v.vendorName}
                                                    onChange={(_, val) => updateRow(row.id, { vendorName: val?.vendorName ?? "" })}
                                                    renderInput={(p) => (
                                                        <TextField
                                                            {...p}
                                                            size="small"
                                                            variant="standard"
                                                            placeholder={vendorTrimmed !== "" ? vendorTrimmed : "Select Vendor"}
                                                            sx={noUnderlineSx}
                                                        />
                                                    )}
                                                    fullWidth
                                                />
                                            </TableCell>

                                            {/* Delete action */}
                                            <TableCell sx={{ width: 64 }}>
                                                <Tooltip title="Delete Line">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setRows(prev => prev.filter(r => r.id !== row.id));
                                                            setDirty(true);
                                                        }}
                                                    >
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}

                                {rows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: "text.secondary" }}>
                                            No lines yet — use Add to create one
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
