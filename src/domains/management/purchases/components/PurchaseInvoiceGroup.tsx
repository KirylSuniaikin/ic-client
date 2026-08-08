import React, { useCallback, useMemo } from "react";
import {
    Autocomplete,
    Box,
    IconButton,
    Stack,
    Switch,
    TableCell,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import AddIcon from "@mui/icons-material/Add";
import DeleteSweepOutlinedIcon from "@mui/icons-material/DeleteSweepOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import dayjs from "dayjs";
import Decimal from "decimal.js-light";
import { PurchaseInvoiceRow, PurchaseLineRow, VendorTO } from "../types";
import { ProductTO } from "../../inventory/types";
import { toDecimal } from "../mappers/purchaseMapper";
import { NumericField, PurchaseTableRow } from "./PurchaseTableRow";
import { InvoiceImageField } from "./InvoiceImageField";
import { editableFieldSx, fieldInputSx, groupStartSx } from "./cellChrome";

const BRAND = "#E44B4C";

const groupCellSx = { verticalAlign: "top" as const };

type PurchaseInvoiceGroupProps = {
    invoice: PurchaseInvoiceRow;
    products: ProductTO[];
    vendors: VendorTO[];
    productById: Map<number, ProductTO>;
    invalid: Map<string, Set<string>>;
    collapsed: boolean;
    onToggleCollapse: (invoiceId: string) => void;
    onUpdateInvoice: (invoiceId: string, patch: Partial<PurchaseInvoiceRow>) => void;
    onDeleteInvoice: (invoiceId: string) => void;
    onAddLine: (invoiceId: string) => void;
    onUpdateLine: (invoiceId: string, lineId: string, patch: Partial<PurchaseLineRow>) => void;
    onCommitNumeric: (invoiceId: string, lineId: string, field: NumericField, raw: string) => void;
    onApplyProduct: (invoiceId: string, lineId: string, val: ProductTO | null) => void;
    onDeleteLine: (invoiceId: string, lineId: string) => void;
};

/**
 * One invoice rendered as a rowSpan group inside the shared purchase table: its date, photo,
 * vendor and paid cells span that invoice's product rows. A single dense table rather than a
 * stack of cards, because a month is ~40 invoices / ~200 lines and card chrome would make that
 * scroll for pages.
 *
 * Collapsed, the same cells span a single summary row — so collapse-all turns 200 lines into
 * ~40 scannable rows.
 *
 * Returns a Fragment of <tr>s, so it must be rendered directly inside <TableBody>.
 *
 * NOTE ON MEMOIZATION: rowSpan puts the invoice-level cells physically inside the FIRST product
 * row's <tr>. So editing any line in this invoice re-renders that first row too — unavoidable
 * with rowSpan, and the price of the density. Sibling invoices and lines 2..N are still skipped.
 */
function PurchaseInvoiceGroupInner({
                                       invoice,
                                       products,
                                       vendors,
                                       productById,
                                       invalid,
                                       collapsed,
                                       onToggleCollapse,
                                       onUpdateInvoice,
                                       onDeleteInvoice,
                                       onAddLine,
                                       onUpdateLine,
                                       onCommitNumeric,
                                       onApplyProduct,
                                       onDeleteLine,
                                   }: PurchaseInvoiceGroupProps) {
    const invoiceId = invoice.id;

    const boundUpdateLine = useCallback(
        (lineId: string, patch: Partial<PurchaseLineRow>) => onUpdateLine(invoiceId, lineId, patch),
        [onUpdateLine, invoiceId],
    );
    const boundCommitNumeric = useCallback(
        (lineId: string, field: NumericField, raw: string) => onCommitNumeric(invoiceId, lineId, field, raw),
        [onCommitNumeric, invoiceId],
    );
    const boundApplyProduct = useCallback(
        (lineId: string, val: ProductTO | null) => onApplyProduct(invoiceId, lineId, val),
        [onApplyProduct, invoiceId],
    );
    const boundDeleteLine = useCallback(
        (lineId: string) => onDeleteLine(invoiceId, lineId),
        [onDeleteLine, invoiceId],
    );
    const boundAddLine = useCallback(() => onAddLine(invoiceId), [onAddLine, invoiceId]);

    const subtotal = useMemo(
        () => invoice.lines
            .reduce((acc, l) => acc.add(toDecimal(l.finalPrice)), new Decimal(0))
            .toFixed(3),
        [invoice.lines],
    );

    const vendorTrimmed = String(invoice.vendorName ?? "").trim();
    const selectedVendor = vendorTrimmed !== ""
        ? vendors.find(v => v.vendorName === vendorTrimmed) ?? null
        : null;
    const invoiceInvalid = invalid.get(invoiceId);

    // rowSpan must cover every product row of this invoice; collapsed (or empty) is a single row.
    const span = collapsed || invoice.lines.length === 0 ? 1 : invoice.lines.length;

    const dateCell = (
        <TableCell rowSpan={span} sx={{ minWidth: 200, ...groupCellSx }}>
            <Stack direction="row" alignItems="center" gap={0.25}>
                <IconButton
                    size="small"
                    aria-label={collapsed ? "expand invoice" : "collapse invoice"}
                    data-testid={`toggle-invoice-${invoiceId}`}
                    onClick={() => onToggleCollapse(invoiceId)}
                    sx={{ color: "text.secondary" }}
                >
                    {collapsed ? <KeyboardArrowRightIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                </IconButton>
                <Box sx={{ ...editableFieldSx, flex: 1, minWidth: 0 }}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                            reduceAnimations
                            format="DD.MM.YYYY"
                            value={invoice.invoiceDate ? dayjs(invoice.invoiceDate) : null}
                            onChange={(val) => {
                                const iso = val ? val.startOf("day").format("YYYY-MM-DD") : "";
                                onUpdateInvoice(invoiceId, { invoiceDate: iso });
                            }}
                            slotProps={{ textField: { size: "small", variant: "standard", sx: fieldInputSx, fullWidth: true } }}
                        />
                    </LocalizationProvider>
                </Box>
                {/* A distinct glyph and an error tone, because this bin removes the whole invoice
                    while the one at the end of each row removes a single product — they used to be
                    the same icon in the same size, three of them per row counting the photo. */}
                <Tooltip title="Delete this invoice and all its products">
                    <IconButton
                        size="small"
                        aria-label="delete invoice"
                        onClick={() => onDeleteInvoice(invoiceId)}
                        sx={{ color: "error.light", "&:hover": { color: "error.main" } }}
                    >
                        <DeleteSweepOutlinedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>
        </TableCell>
    );

    const photoCell = (
        <TableCell rowSpan={span} sx={{ width: 96, ...groupCellSx }}>
            <InvoiceImageField
                invoiceId={invoiceId}
                serverId={invoice.serverId}
                hasImage={invoice.hasImage}
                pendingImage={invoice.pendingImage}
                removeImage={invoice.removeImage}
                onUpdateInvoice={onUpdateInvoice}
            />
        </TableCell>
    );

    const vendorCell = (
        <TableCell rowSpan={span} sx={{ minWidth: 170, ...groupCellSx }}>
            <Box sx={editableFieldSx}>
                <Autocomplete<VendorTO, false, false, false>
                    openOnFocus
                    options={vendors}
                    value={selectedVendor}
                    getOptionLabel={(o) => o.vendorName}
                    isOptionEqualToValue={(o, v) => !!v && o.vendorName === v.vendorName}
                    onChange={(_, val) => onUpdateInvoice(invoiceId, { vendorName: val?.vendorName ?? "" })}
                    renderInput={(p) => (
                        <TextField
                            {...p}
                            size="small"
                            variant="standard"
                            error={invoiceInvalid?.has("vendorName")}
                            placeholder={vendorTrimmed !== "" ? vendorTrimmed : "Select Vendor"}
                            sx={fieldInputSx}
                        />
                    )}
                    fullWidth
                />
            </Box>
        </TableCell>
    );

    const paidCell = (
        <TableCell rowSpan={span} sx={{ width: 120, ...groupCellSx }}>
            <Stack direction="row" alignItems="center" gap={0.25}>
                {/* MUI v7 routes native input attrs through slotProps.input; the older
                    `inputProps` shorthand is not forwarded, so the label never lands. */}
                <Switch
                    size="small"
                    checked={invoice.paid}
                    color={invoice.paid ? "success" : "warning"}
                    slotProps={{ input: { "aria-label": "invoice paid" } }}
                    onChange={(e) => onUpdateInvoice(invoiceId, { paid: e.target.checked })}
                />
                <Typography
                    variant="caption"
                    data-testid={`paid-label-${invoiceId}`}
                    sx={{ color: invoice.paid ? "success.main" : "warning.main", fontWeight: 700 }}
                >
                    {invoice.paid ? "Paid" : "Unpaid"}
                </Typography>
            </Stack>
        </TableCell>
    );

    const addLineButton = (
        <Tooltip title="Add product to this invoice">
            <IconButton
                size="small"
                aria-label="add product"
                data-testid={`add-line-${invoiceId}`}
                onClick={boundAddLine}
                sx={{ color: BRAND }}
            >
                <AddIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );

    // Collapsed, or an invoice with no lines yet: one row, product columns replaced by a summary.
    if (collapsed || invoice.lines.length === 0) {
        return (
            <TableRow
                data-testid={`invoice-group-${invoiceId}`}
                data-invoice={invoiceId}
                data-group-start="true"
                sx={{ ...groupStartSx, "&:hover > td": { backgroundColor: "rgba(0,0,0,0.02)" } }}
            >
                {dateCell}
                {photoCell}
                {vendorCell}
                <TableCell colSpan={5}>
                    {invoice.lines.length === 0 ? (
                        <Typography variant="body2" color="text.disabled">
                            No products yet — use + to add one
                        </Typography>
                    ) : (
                        <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={2}>
                            <Typography variant="body2" color="text.secondary">
                                {invoice.lines.length} product{invoice.lines.length === 1 ? "" : "s"}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                            >
                                {subtotal}
                            </Typography>
                        </Stack>
                    )}
                </TableCell>
                {paidCell}
                <TableCell sx={{ width: 84 }}>{addLineButton}</TableCell>
            </TableRow>
        );
    }

    return (
        <React.Fragment>
            {invoice.lines.map((line, index) => (
                <PurchaseTableRow
                    key={line.id}
                    row={line}
                    invoiceId={invoiceId}
                    products={products}
                    product={productById.get(line.productId ?? -1) ?? null}
                    invalidFields={invalid.get(line.id)}
                    leadingCells={index === 0 ? <>{dateCell}{photoCell}{vendorCell}</> : undefined}
                    trailingCells={index === 0 ? paidCell : undefined}
                    showAddLine={index === invoice.lines.length - 1}
                    groupStart={index === 0}
                    onAddLine={boundAddLine}
                    onUpdateRow={boundUpdateLine}
                    onCommitNumeric={boundCommitNumeric}
                    onApplyProduct={boundApplyProduct}
                    onDelete={boundDeleteLine}
                />
            ))}
        </React.Fragment>
    );
}

export const PurchaseInvoiceGroup = React.memo(PurchaseInvoiceGroupInner);
