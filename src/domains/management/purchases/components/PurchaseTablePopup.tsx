import { logger } from "../../../../shared/utils/logger";
import {IBranch, IUser, ProductTO} from "../../inventory/types";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    BasePurchaseResponse,
    CreatePurchasePayload,
    EditPurchasePayload,
    PurchaseRow,
    PurchaseSort,
    PurchaseSortKey,
    PurchaseTO,
    SortDir,
    VendorTO
} from "../types";
import {
    Box, Button,
    Dialog,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Tooltip,
    Typography
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
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
import { DEFAULT_SORT_DIR, sortPurchaseRows, toDecimal, toPayloadLine, validateRows} from "../mappers/purchaseMapper";
import {normalizeDecimal} from "../../../../shared/utils/decimalUtils";
import {NumericField, PurchaseTableRow} from "./PurchaseTableRow";
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

const headerCellSx = { fontWeight: "bold", color: "text.secondary" } as const;

/** Tappable column header. The arrow shows the direction the CURRENT order was built with. */
function SortableHeader({label, sortKey, sort, onSort}: {
    label: string;
    sortKey: PurchaseSortKey;
    sort: PurchaseSort | null;
    onSort: (key: PurchaseSortKey) => void;
}) {
    const active = sort?.key === sortKey;
    return (
        <TableCell sx={headerCellSx} sortDirection={active ? sort.dir : false}>
            <TableSortLabel
                active={active}
                direction={active ? sort.dir : DEFAULT_SORT_DIR[sortKey]}
                onClick={() => onSort(sortKey)}
                sx={{ whiteSpace: "nowrap" }}
            >
                {label}
            </TableSortLabel>
        </TableCell>
    );
}

/**
 * Column header with a tap-to-open ⓘ. Purchases are entered on tablets, where hover never
 * fires — enterTouchDelay/leaveTouchDelay are the house idiom for that
 * (see menu/components/RecipeComponentsLine.tsx).
 */
function HeaderWithInfo({ label, info }: { label: string; info: string }) {
    return (
        <Stack direction="row" alignItems="center" gap={0.5} sx={{ whiteSpace: "nowrap" }}>
            <span>{label}</span>
            <Tooltip title={info} arrow enterTouchDelay={0} leaveTouchDelay={6000}>
                <InfoOutlinedIcon fontSize="small" sx={{ color: "text.disabled", cursor: "pointer" }} />
            </Tooltip>
        </Stack>
    );
}

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
    const [sort, setSort] = useState<PurchaseSort | null>(null);


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


    const isDecFinite = useCallback((d: Decimal) => Number.isFinite(d.toNumber()), []);

    // Recompute target unit price (price = finalPrice / quantity) on edits, keeping rows in sync + marking dirty.
    const updateRow = useCallback((id: string, patch: Partial<PurchaseRow>) => {
        setRows(prev => prev.map(r => {
            if (r.id !== id) return r;
            const next = { ...r, ...patch };

            // A genuinely-empty quantity or finalPrice must not derive a bogus 0.000
            // target price — leave next.price untouched in that case.
            if (next.quantity != null && next.finalPrice != null) {
                const q   = toDecimal(next.quantity);
                const tot = toDecimal(next.finalPrice);
                if (isDecFinite(q) && !q.isZero() && isDecFinite(tot)) {
                    next.price = Number(tot.div(q).toFixed(3));
                }
            }
            return next;
        }));
        setDirty(true);
    }, [isDecFinite]);

    // Raw keystrokes are held inside DecimalCellInput; the table only sees the value on blur.
    const commitNumericCell = useCallback((id: string, field: NumericField, raw: string) => {
        const norm = normalizeDecimal(raw);
        updateRow(id, { [field]: norm === "" ? null : Number(norm) });
    }, [updateRow]);

    const deleteRow = useCallback((id: string) => {
        setRows(prev => prev.filter(r => r.id !== id));
        setDirty(true);
    }, []);

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
                }
            }
            return next;
        }));
        setDirty(true);
    }, [vendorByName]);

    // Sorting reorders the rows once, on tap. It is not a data change, so it must not mark
    // the report dirty — nobody should be asked to save because they re-ordered the view.
    const applySort = useCallback((key: PurchaseSortKey) => {
        const dir: SortDir = sort?.key === key
            ? (sort.dir === "asc" ? "desc" : "asc")
            : DEFAULT_SORT_DIR[key];
        setSort({ key, dir });
        setRows(prev => sortPurchaseRows(prev, key, dir, id => productById.get(id ?? -1)?.name ?? ""));
    }, [sort, productById]);

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
                                    <SortableHeader label="Date of purchase" sortKey="purchaseDate" sort={sort} onSort={applySort} />
                                    <SortableHeader label="Product" sortKey="product" sort={sort} onSort={applySort} />
                                    <TableCell sx={headerCellSx}>Amount(kg/unit)</TableCell>
                                    <TableCell sx={headerCellSx}>Total Price</TableCell>
                                    <TableCell sx={headerCellSx}>
                                        <HeaderWithInfo
                                            label="Unit Price(kg/unit)"
                                            info="Actual price paid per kg/unit — total price ÷ amount."
                                        />
                                    </TableCell>
                                    <TableCell sx={headerCellSx}>
                                        <HeaderWithInfo
                                            label="Target Price(kg/unit)"
                                            info="Price we aim to buy this product at, from the product card."
                                        />
                                    </TableCell>
                                    <SortableHeader label="Vendor" sortKey="vendorName" sort={sort} onSort={applySort} />
                                    <TableCell sx={headerCellSx} />
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {rows.map((row) => (
                                    <PurchaseTableRow
                                        key={row.id}
                                        row={row}
                                        products={products}
                                        vendors={vendors}
                                        product={productById.get(row.productId ?? -1) ?? null}
                                        invalidFields={invalid.get(row.id)}
                                        onUpdateRow={updateRow}
                                        onCommitNumeric={commitNumericCell}
                                        onApplyProduct={applyProduct}
                                        onDelete={deleteRow}
                                    />
                                ))}

                                {rows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center" sx={{ py: 3, color: "text.secondary" }}>
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
