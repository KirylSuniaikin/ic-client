import React, { useCallback, useMemo } from "react";
import {
    Autocomplete,
    Box,
    Checkbox,
    IconButton,
    Stack,
    TableCell,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import dayjs from "dayjs";
import Decimal from "decimal.js-light";
import { PurchaseInvoiceRow, PurchaseLineRow, VendorTO } from "../types";
import { ProductTO } from "../../inventory/types";
import { toDecimal } from "../mappers/purchaseMapper";
import { NumericField, PurchaseTableRow } from "./PurchaseTableRow";
import { InvoiceImageField } from "./InvoiceImageField";
import {
    binSx,
    editableFieldSx,
    fieldInputSx,
    groupStripSx,
    HeaderWithInfo,
    inlineHeaderCellSx,
    PRODUCT_COLUMN_COUNT,
} from "./cellChrome";

const BRAND = "#E44B4C";

const PAID_GREEN = "#34C759";
const UNPAID_RED = "#E53935";

// Red when off, green when on — MUI only colours the checked state, so the unchecked state has to
// be set explicitly or "unpaid" would read as the neutral grey of a disabled control.
const paidCheckboxSx = {
    color: UNPAID_RED,
    "&:hover": { backgroundColor: `${UNPAID_RED}14` },
    "&.Mui-checked": {
        color: PAID_GREEN,
        "&:hover": { backgroundColor: `${PAID_GREEN}14` },
    },
} as const;

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
 * One invoice rendered inside the shared purchase table as a full-width header strip — identity on
 * the left (collapse chevron, photo, date, vendor, paid), aggregates on the right (product count,
 * subtotal, delete, add) — followed by its own inline product header and product rows. A single
 * dense table rather than a stack of cards, because a month is ~40 invoices / ~200 lines and card
 * chrome would make that scroll for pages.
 *
 * Collapsed, only the strip renders — so collapse-all turns 200 lines into ~40 scannable rows.
 *
 * Returns a Fragment of <tr>s, so it must be rendered directly inside <TableBody>.
 *
 * NOTE ON MEMOIZATION: the invoice's identity cells live in the strip row, not inside any product
 * row's <tr>, so editing a line can never re-render the strip or a sibling line.
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

    const stripRow = (
        <TableRow
            data-testid={`invoice-group-${invoiceId}`}
            data-invoice={invoiceId}
            sx={{ ...groupStripSx, "&:hover > td": { backgroundColor: "rgba(0,0,0,0.03)" } }}
        >
            <TableCell colSpan={PRODUCT_COLUMN_COUNT}>
                <Stack direction="row" alignItems="center" gap={1}>
                    <IconButton
                        size="small"
                        aria-label={collapsed ? "expand invoice" : "collapse invoice"}
                        data-testid={`toggle-invoice-${invoiceId}`}
                        onClick={() => onToggleCollapse(invoiceId)}
                        sx={{ color: "text.secondary" }}
                    >
                        {collapsed ? <KeyboardArrowRightIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                    </IconButton>

                    <InvoiceImageField
                        invoiceId={invoiceId}
                        serverId={invoice.serverId}
                        hasImage={invoice.hasImage}
                        pendingImage={invoice.pendingImage}
                        removeImage={invoice.removeImage}
                        onUpdateInvoice={onUpdateInvoice}
                    />

                    <Box sx={{ ...editableFieldSx, minWidth: 150 }}>
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

                    <Box sx={{ ...editableFieldSx, minWidth: 170 }}>
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

                    <Stack direction="row" alignItems="center" gap={0.5}>
                        <Checkbox
                            size="small"
                            checked={invoice.paid}
                            data-testid={`paid-checkbox-${invoiceId}`}
                            slotProps={{ input: { "aria-label": "invoice paid" } }}
                            onChange={(e) => onUpdateInvoice(invoiceId, { paid: e.target.checked })}
                            sx={paidCheckboxSx}
                        />
                        <Typography variant="body2" color="text.secondary">
                            Paid
                        </Typography>
                    </Stack>

                    <Stack direction="row" alignItems="center" gap={2} sx={{ ml: "auto" }}>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                            {invoice.lines.length} product{invoice.lines.length === 1 ? "" : "s"}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
                        >
                            {subtotal}
                        </Typography>
                        <Tooltip title="Delete this invoice and all its products">
                            <IconButton
                                size="small"
                                aria-label="delete invoice"
                                onClick={() => onDeleteInvoice(invoiceId)}
                                sx={binSx}
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
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
                    </Stack>
                </Stack>
            </TableCell>
        </TableRow>
    );

    if (collapsed) {
        return stripRow;
    }

    if (invoice.lines.length === 0) {
        return (
            <React.Fragment>
                {stripRow}
                <TableRow>
                    <TableCell colSpan={PRODUCT_COLUMN_COUNT}>
                        <Typography variant="body2" color="text.disabled">
                            No products yet — use + to add one
                        </Typography>
                    </TableCell>
                </TableRow>
            </React.Fragment>
        );
    }

    return (
        <React.Fragment>
            {stripRow}
            <TableRow>
                <TableCell component="th" scope="col" sx={inlineHeaderCellSx}>Product</TableCell>
                <TableCell component="th" scope="col" align="right" sx={inlineHeaderCellSx}>
                    <HeaderWithInfo
                        align="right"
                        label="Amount"
                        info="How much was bought, in kg or units."
                    />
                </TableCell>
                <TableCell component="th" scope="col" align="right" sx={inlineHeaderCellSx}>Total</TableCell>
                <TableCell component="th" scope="col" align="right" sx={inlineHeaderCellSx}>
                    <HeaderWithInfo
                        align="right"
                        label="Unit"
                        info="Actual price paid per kg/unit — total price ÷ amount."
                    />
                </TableCell>
                <TableCell component="th" scope="col" align="right" sx={inlineHeaderCellSx}>
                    <HeaderWithInfo
                        align="right"
                        label="Target"
                        info="Price we aim to buy this product at, per kg/unit — from the product card."
                    />
                </TableCell>
                <TableCell component="th" scope="col" sx={inlineHeaderCellSx} />
            </TableRow>
            {invoice.lines.map((line, index) => (
                <PurchaseTableRow
                    key={line.id}
                    row={line}
                    invoiceId={invoiceId}
                    products={products}
                    product={productById.get(line.productId ?? -1) ?? null}
                    invalidFields={invalid.get(line.id)}
                    showAddLine={index === invoice.lines.length - 1}
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
