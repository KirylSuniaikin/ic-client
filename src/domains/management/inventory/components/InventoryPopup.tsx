import {
    IBranch, IManagementResponse,
    InventoryRow, IUser,
    ReportTO
} from "../types";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {mapProductToRow, normalizeReportPayload, p2, rowToPayloadNumber, toDecimal, withRecalc} from "../mappers/inventoryMapper";
import CloseIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import {createReport, editReport, fetchProducts, getReport} from "../../../../shared/api/management";
import Decimal from "decimal.js-light";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from "@mui/material";
import {dateFormatter} from "../../../../shared/utils/dateFormatter";
import {InventoryTableRow, QuantityField} from "./InventoryTableRow";

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
    const [filterText, setFilterText] = useState("");
    const isDataLoadedRef = useRef<boolean>(false);

    useEffect(() => {
        if (!open) {
            isDataLoadedRef.current = false;
            return;
        }
        if (isDataLoadedRef.current) return;
        if (!author?.id) return;

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
                    if (alive) {
                        isDataLoadedRef.current = true;
                        setTitle((dateFormatter() + "-" + branch.branchName + "-" + author.userName).toLowerCase());
                        setRows(data);
                    }
                } else {
                    const rep: ReportTO = await getReport(reportId!);
                    setTitle(rep.title as string);
                    if (alive) {
                        isDataLoadedRef.current = true;
                        setRows(normalizeReportPayload(rep));
                    }
                }
            } catch (e: any) {
                if (alive) setError(e?.message ?? "Failed to load");
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => { alive = false; };
    }, [open, mode, reportId, author?.id, branch?.id]);

    // Stable identity: InventoryTableRow is memoized on it, so a new closure per render
    // would re-render every row on any table-level state change (e.g. typing in the filter).
    const updateQuantity = useCallback((productId: number, field: QuantityField, value: string) => {
        setRows(prev => prev.map(r => {
            if (r.productId !== productId) return r;
            const oldKitchen = r.kitchenQuantity;
            const oldStorage = r.storageQuantity;
            if (value.trim() === "") {
                // Blurring an empty cell must leave it null (placeholder state), not
                // coerce to a literal "0.000" — finalPrice is recomputed treating the
                // null field as 0, same as getFinalPrice/total already do elsewhere.
                const kitchen = field === "kitchenQuantity" ? null : oldKitchen;
                const storage = field === "storageQuantity" ? null : oldStorage;
                return {
                    ...r,
                    kitchenQuantity: kitchen,
                    storageQuantity: storage,
                    finalPrice: p2(toDecimal(kitchen).add(toDecimal(storage)).mul(r.price)),
                };
            }
            return withRecalc(
                r,
                field === "kitchenQuantity" ? value : oldKitchen?.toString?.() ?? "",
                field === "storageQuantity" ? value : oldStorage?.toString?.() ?? "",
            );
        }));
        setDirty(prev => {
            const s = new Set(prev);
            s.add(productId);
            return s;
        });
    }, []);

    const filteredRows = useMemo(
        () => filterText
            ? rows.filter(r => r.name.toLowerCase().includes(filterText.toLowerCase()))
            : rows,
        [rows, filterText]
    );

    const total = useMemo(
        () => rows.reduce((acc, r) => acc.add(toDecimal(r.finalPrice)), new Decimal(0)).toFixed(3),
        [rows]
    );

    const handleSave = async () => {
        if (!Number.isFinite(branch.branchNo)) throw new Error("branchNo is required");
        try {
            const inventoryProducts = rows.map(rowToPayloadNumber);
            setSaving(true);
            if (mode === "new") {
                const report: IManagementResponse = await createReport({
                    title,
                    type: "INVENTORY",
                    branchNo: branch.branchNo!,
                    userId: author.id,
                    finalPrice: Number(total),
                    inventoryProducts,
                });
                onSaved(report);
            } else {
                const report: IManagementResponse = await editReport({
                    id: reportId!,
                    type: "INVENTORY",
                    title,
                    branchNo: branch.branchNo,
                    userId: author.id,
                    finalPrice: Number(total),
                    inventoryProducts,
                });
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
            sx={{ display: "flex", flexDirection: "column", height: "100dvh", maxHeight: "100dvh", overflow: "hidden" }}
        >
            {/* ── Top bar (unchanged) ── */}
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
                    disabled={dirty.size === 0 || saving}
                    sx={{ bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e" }, borderRadius: 4 }}
                    onClick={handleSave}
                >
                    {saving ? "Saving..." : "Save"}
                </Button>
            </Stack>

            {/* ── Content ── */}
            <Box sx={{ p: 2, flex: 1, minHeight: 0, overflow: "auto", overscrollBehavior: "contain" }}>
                {loading ? (
                    <Box sx={{ display: "grid", placeItems: "center", flex: 1, minHeight: 200 }}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Box sx={{ p: 2, border: 1, borderColor: "error.main", color: "error.main", borderRadius: 2 }}>
                        {error}
                    </Box>
                ) : (
                    <>
                        {/* Filter */}
                        <Box sx={{ mb: 2 }}>
                            <TextField
                                size="small"
                                label="Filter by product name"
                                placeholder="Type to filter"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                autoFocus
                                fullWidth
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                            />
                        </Box>

                        {/* Table */}
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
                            <Table size="small" aria-label="inventory" sx={{ minWidth: 580 }}>
                                <TableHead sx={{ bgcolor: "#fafafa" }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Name</TableCell>
                                        <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Storage Qty</TableCell>
                                        <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Kitchen Qty</TableCell>
                                        <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Price / unit</TableCell>
                                        <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Final Price</TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {filteredRows.map((row) => (
                                        <InventoryTableRow
                                            key={row.productId}
                                            row={row}
                                            onCommitQuantity={updateQuantity}
                                        />
                                    ))}

                                    {filteredRows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                                                No products match the filter
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </Box>
        </Dialog>
    );
}
