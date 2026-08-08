import { logger } from "../../../../shared/utils/logger";
import { IBranch, IUser, ProductTO } from "../../inventory/types";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    BasePurchaseResponse,
    CreatePurchasePayload,
    EditPurchasePayload,
    PurchaseInvoiceRow,
    PurchaseLineRow,
    PurchaseSort,
    PurchaseSortKey,
    PurchaseTO,
    SortDir,
    VendorTO,
} from "../types";
import {
    Box,
    Button,
    Dialog,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { ManagementTopBar } from "../../_shared/components/ManagementTopBar";
import dayjs from "dayjs";
import {
    createPurchaseReport,
    deletePurchaseInvoiceImage,
    editPurchaseReport,
    fetchProducts,
    fetchVendors,
    getPurchaseReport,
    getUser,
    uploadPurchaseInvoiceImage,
} from "../../../../shared/api/management";
import type { SavePurchaseResponse } from "../types";
import {
    DEFAULT_SORT_DIR,
    sortPurchaseInvoices,
    toDecimal,
    toPayloadInvoice,
    validateInvoices,
} from "../mappers/purchaseMapper";
import { normalizeDecimal } from "../../../../shared/utils/decimalUtils";
import { NumericField } from "./PurchaseTableRow";
import { PurchaseInvoiceGroup } from "./PurchaseInvoiceGroup";
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

const BRAND = "#E44B4C";

const headerCellSx = { fontWeight: "bold", color: "text.secondary", whiteSpace: "nowrap" } as const;

/**
 * Column header with a tap-to-open ⓘ. Purchases are entered on tablets, where hover never
 * fires — enterTouchDelay/leaveTouchDelay are the house idiom for that.
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
    const [invoices, setInvoices] = useState<PurchaseInvoiceRow[]>([]);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [admin, setAdmin] = useState<IUser>(null);
    const [invalid, setInvalid] = useState<Map<string, Set<string>>>(new Map());
    const [sort, setSort] = useState<PurchaseSort | null>(null);
    // Ids of COLLAPSED invoices. A month is ~40 invoices / ~200 lines, so an existing report
    // opens fully collapsed and is scanned as ~40 rows; a freshly added invoice starts expanded
    // because it has to be filled in.
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!open) {
            isDataLoadedRef.current = false;
            return;
        }

        if (isDataLoadedRef.current) return;
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
                    setInvoices([mkEmptyInvoice()]);
                    isDataLoadedRef.current = true
                    setDirty(false);
                } else {
                    if (!purchaseId) throw new Error("purchaseId is required for edit");
                    const rep: PurchaseTO = await getPurchaseReport({id: purchaseId});
                    if (!alive) return;
                    setTitle(rep.title);
                    setReportDate(rep.purchaseDate);
                    const loaded: PurchaseInvoiceRow[] = rep.invoices.map((inv, i) => ({
                        // A null id is the backend's synthetic "unassigned" invoice, holding lines
                        // the one-shot backfill has not linked yet. It saves as a new invoice.
                        id: `inv-${i}`,
                        serverId: inv.id,
                        invoiceDate: inv.invoiceDate ?? "",
                        vendorName: inv.vendorName,
                        paid: inv.paid,
                        hasImage: inv.hasImage,
                        pendingImage: null,
                        removeImage: false,
                        lines: inv.products.map((x, j) => ({
                            id: `inv-${i}-line-${j}`,
                            productId: x.product.id,
                            price: Number(x.price),
                            quantity: Number(x.quantity),
                            finalPrice: Number(x.finalPrice),
                        })),
                    }));
                    setInvoices(loaded);
                    // ~40 invoices a month: opening collapsed makes the whole report scannable,
                    // and the unpaid ones stand out immediately.
                    setCollapsed(new Set(loaded.map(inv => inv.id)));
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

    // Every table-level callback uses the functional setState form and holds NO dependency on
    // `invoices`. If any of them closed over it, its identity would change on every committed
    // keystroke and every memo below would break at once.
    const updateInvoice = useCallback((invoiceId: string, patch: Partial<PurchaseInvoiceRow>) => {
        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, ...patch } : inv));
        setDirty(true);
    }, []);

    const deleteInvoice = useCallback((invoiceId: string) => {
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
        setDirty(true);
    }, []);

    const addInvoice = useCallback(() => {
        setInvoices(prev => [mkEmptyInvoice(), ...prev]);
        setDirty(true);
    }, []);

    const toggleCollapse = useCallback((invoiceId: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(invoiceId)) next.delete(invoiceId); else next.add(invoiceId);
            return next;
        });
    }, []);

    const collapseAll = useCallback(() => {
        setInvoices(prev => {
            setCollapsed(new Set(prev.map(inv => inv.id)));
            return prev;
        });
    }, []);

    const expandAll = useCallback(() => setCollapsed(new Set()), []);

    const addLine = useCallback((invoiceId: string) => {
        setInvoices(prev => prev.map(inv => inv.id === invoiceId
            ? { ...inv, lines: [...inv.lines, mkEmptyLine()] }
            : inv));
        setDirty(true);
    }, []);

    // Recomputes the unit price (price = finalPrice / quantity) on edits. A genuinely-empty
    // quantity or finalPrice must not derive a bogus 0.000 — leave price untouched in that case.
    const updateLine = useCallback((invoiceId: string, lineId: string, patch: Partial<PurchaseLineRow>) => {
        setInvoices(prev => prev.map(inv => {
            if (inv.id !== invoiceId) return inv;
            return {
                ...inv,
                lines: inv.lines.map(l => {
                    if (l.id !== lineId) return l;
                    const next = { ...l, ...patch };
                    if (next.quantity != null && next.finalPrice != null) {
                        const q = toDecimal(next.quantity);
                        const tot = toDecimal(next.finalPrice);
                        if (isDecFinite(q) && !q.isZero() && isDecFinite(tot)) {
                            next.price = Number(tot.div(q).toFixed(3));
                        }
                    }
                    return next;
                }),
            };
        }));
        setDirty(true);
    }, [isDecFinite]);

    // Raw keystrokes are held inside DecimalCellInput; the table only sees the value on blur.
    const commitNumericCell = useCallback((invoiceId: string, lineId: string, field: NumericField, raw: string) => {
        const norm = normalizeDecimal(raw);
        updateLine(invoiceId, lineId, { [field]: norm === "" ? null : Number(norm) });
    }, [updateLine]);

    const deleteLine = useCallback((invoiceId: string, lineId: string) => {
        setInvoices(prev => prev.map(inv => inv.id === invoiceId
            ? { ...inv, lines: inv.lines.filter(l => l.id !== lineId) }
            : inv));
        setDirty(true);
    }, []);

    // Picking a product fills the INVOICE's vendor from the product's top vendor — but only while
    // that vendor is still empty, so an explicit choice is never overwritten.
    const applyProduct = useCallback((invoiceId: string, lineId: string, val: ProductTO | null) => {
        const productId = val?.id ?? null;
        const top = String(val?.topVendor ?? "").trim().toLowerCase();

        setInvoices(prev => prev.map(inv => {
            if (inv.id !== invoiceId) return inv;
            const next: PurchaseInvoiceRow = {
                ...inv,
                lines: inv.lines.map(l => l.id === lineId ? { ...l, productId } : l),
            };
            if (val && top && String(inv.vendorName ?? "") === "") {
                const v = vendorByName.get(top);
                if (v) next.vendorName = v.vendorName;
            }
            return next;
        }));
        setDirty(true);
    }, [vendorByName]);

    // Sorting reorders the invoices once, on tap. It is not a data change, so it must not mark
    // the report dirty — nobody should be asked to save because they re-ordered the view.
    const applySort = useCallback((key: PurchaseSortKey) => {
        const dir: SortDir = sort?.key === key
            ? (sort.dir === "asc" ? "desc" : "asc")
            : DEFAULT_SORT_DIR[key];
        setSort({ key, dir });
        setInvoices(prev => sortPurchaseInvoices(prev, key, dir));
    }, [sort]);

    const total = useMemo(
        () =>
            invoices
                .flatMap(inv => inv.lines)
                .reduce((acc, l) => acc.add(toDecimal(l.finalPrice)), new Decimal(0))
                .toFixed(3),
        [invoices]
    );

    /**
     * Uploads/removes invoice photos AFTER the report is saved — a brand-new invoice has no id
     * until the save assigns one, and the response's clientRef -> invoiceId map is what connects
     * a blob held in memory to its row.
     *
     * allSettled, not all: one failed photo must not hide the fact that the report itself saved.
     * Each upload gets one retry, since the usual cause is a momentary tablet wifi drop.
     * @returns how many photo operations ultimately failed
     */
    const syncInvoiceImages = async (saved: SavePurchaseResponse): Promise<number> => {
        const serverIdByRef = new Map(saved.invoices.map(r => [r.clientRef, r.invoiceId] as const));

        const jobs: Array<() => Promise<unknown>> = [];
        for (const inv of invoices) {
            const serverId = serverIdByRef.get(inv.id);
            if (serverId == null) continue;
            if (inv.pendingImage) {
                const blob = inv.pendingImage;
                jobs.push(() => uploadPurchaseInvoiceImage(serverId, blob));
            } else if (inv.removeImage && inv.hasImage) {
                jobs.push(() => deletePurchaseInvoiceImage(serverId));
            }
        }
        if (jobs.length === 0) return 0;

        const runWithOneRetry = async (job: () => Promise<unknown>): Promise<unknown> => {
            try {
                return await job();
            } catch {
                return job();
            }
        };

        const results = await Promise.allSettled(jobs.map(runWithOneRetry));
        const failed = results.filter(r => r.status === "rejected");
        failed.forEach(r => logger.error((r as PromiseRejectedResult).reason, "invoice photo sync failed"));
        return failed.length;
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);

            const invalidMap = validateInvoices(invoices);
            setInvalid(invalidMap);

            if (invalidMap.size > 0) {
                logger.error("[save] validation failed, blocking save");
                return;
            }

            if (invoices.length === 0 || invoices.every(inv => inv.lines.length === 0)) {
                throw new Error("Nothing to save: add at least one invoice with one product.");
            }

            const payloadInvoices = invoices.map(toPayloadInvoice);

            const base: CreatePurchasePayload = {
                title,
                finalPrice: Number(total),
                userId: admin.id,
                branchNo: branch.branchNo,
                purchaseDate: reportDate,
                invoices: payloadInvoices,
            };

            try {
                const saved = mode === "new"
                    ? await createPurchaseReport(base)
                    : await editPurchaseReport({ id: purchaseId!, ...base } as EditPurchasePayload);

                const failedPhotos = await syncInvoiceImages(saved);

                // The report itself is already persisted, so the parent list is updated and the
                // form is no longer dirty either way. A failed photo must never present itself as
                // a failed save.
                onSaved?.(saved.report);
                setDirty(false);

                if (failedPhotos > 0) {
                    setError(
                        `Report saved, but ${failedPhotos} invoice photo(s) could not be uploaded. ` +
                        `Re-attach them and save again — the report data is safe.`
                    );
                    return;
                }
                onClose();
            }
            catch (e: any) {
                logger.error(e, "error with an api");
                setError(e?.message ?? "Save failed");
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
                            data-testid="add-invoice"
                            onClick={addInvoice}
                            sx={{ bgcolor: BRAND, "&:hover": { bgcolor: "#c93d3e"}, borderRadius: 4 }}
                        >
                            Add invoice
                        </Button>
                        <Button
                            variant="contained"
                            disabled={!dirty || saving}
                            sx={{ bgcolor: BRAND, "&:hover": { bgcolor: "#c93d3e"}, borderRadius: 4 }}
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
                    <Stack gap={1.5}>
                        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                            <Typography variant="body2" color="text.secondary">Sort by:</Typography>
                            <ToggleButtonGroup size="small" exclusive value={sort?.key ?? null}>
                                <ToggleButton value="invoiceDate" data-testid="sort-invoiceDate" onClick={() => applySort("invoiceDate")} sx={{ textTransform: "none" }}>
                                    Date {sort?.key === "invoiceDate" ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                                </ToggleButton>
                                <ToggleButton value="vendorName" data-testid="sort-vendorName" onClick={() => applySort("vendorName")} sx={{ textTransform: "none" }}>
                                    Vendor {sort?.key === "vendorName" ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                                </ToggleButton>
                            </ToggleButtonGroup>
                            <Box sx={{ flexGrow: 1 }} />
                            <Button size="small" data-testid="collapse-all" onClick={collapseAll} sx={{ textTransform: "none" }}>
                                Collapse all
                            </Button>
                            <Button size="small" data-testid="expand-all" onClick={expandAll} sx={{ textTransform: "none" }}>
                                Expand all
                            </Button>
                        </Stack>

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
                            <Table size="small" stickyHeader aria-label="purchases" sx={{ minWidth: 1180 }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={headerCellSx}>Date</TableCell>
                                        <TableCell sx={headerCellSx}>Invoice</TableCell>
                                        <TableCell sx={headerCellSx}>Vendor</TableCell>
                                        <TableCell sx={headerCellSx}>Product</TableCell>
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
                                        <TableCell sx={headerCellSx}>Status</TableCell>
                                        <TableCell sx={headerCellSx} />
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {invoices.map((invoice) => (
                                        <PurchaseInvoiceGroup
                                            key={invoice.id}
                                            invoice={invoice}
                                            products={products}
                                            vendors={vendors}
                                            productById={productById}
                                            invalid={invalid}
                                            collapsed={collapsed.has(invoice.id)}
                                            onToggleCollapse={toggleCollapse}
                                            onUpdateInvoice={updateInvoice}
                                            onDeleteInvoice={deleteInvoice}
                                            onAddLine={addLine}
                                            onUpdateLine={updateLine}
                                            onCommitNumeric={commitNumericCell}
                                            onApplyProduct={applyProduct}
                                            onDeleteLine={deleteLine}
                                        />
                                    ))}

                                    {invoices.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={10} align="center" sx={{ py: 3, color: "text.secondary" }}>
                                                No invoices yet — use Add invoice to create one
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Stack>
                )}
            </Box>
        </Dialog>
    );
}

function mkEmptyLine(): PurchaseLineRow {
    return {
        id: crypto.randomUUID(),
        productId: null,
        price: null,
        quantity: null,
        finalPrice: null,
    };
}

function mkEmptyInvoice(): PurchaseInvoiceRow {
    return {
        id: crypto.randomUUID(),
        serverId: null,
        invoiceDate: dayjs().format("YYYY-MM-DD"),
        vendorName: "",
        paid: false,
        hasImage: false,
        pendingImage: null,
        removeImage: false,
        lines: [mkEmptyLine()],
    };
}
