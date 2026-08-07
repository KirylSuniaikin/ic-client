import React, { useCallback, useMemo } from "react";
import {
    Autocomplete,
    Box,
    Button,
    IconButton,
    Paper,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import dayjs from "dayjs";
import Decimal from "decimal.js-light";
import { PurchaseInvoiceRow, PurchaseLineRow, VendorTO } from "../types";
import { ProductTO } from "../../inventory/types";
import { toDecimal } from "../mappers/purchaseMapper";
import { NumericField, PurchaseTableRow } from "./PurchaseTableRow";

const BRAND = "#E44B4C";

const noUnderlineSx = {
    "& .MuiInput-underline:before": { borderBottom: "none" },
    "& .MuiInput-underline:after": { borderBottom: "none" },
    "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottom: "none" },
};

const headerCellSx = { fontWeight: "bold", color: "text.secondary" } as const;

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

type PurchaseInvoiceBlockProps = {
    invoice: PurchaseInvoiceRow;
    products: ProductTO[];
    vendors: VendorTO[];
    /** Stable identity map from the table, so line props do not churn. */
    productById: Map<number, ProductTO>;
    /** validateInvoices output, keyed by invoice id AND line id. */
    invalid: Map<string, Set<string>>;
    onUpdateInvoice: (invoiceId: string, patch: Partial<PurchaseInvoiceRow>) => void;
    onDeleteInvoice: (invoiceId: string) => void;
    onAddLine: (invoiceId: string) => void;
    onUpdateLine: (invoiceId: string, lineId: string, patch: Partial<PurchaseLineRow>) => void;
    onCommitNumeric: (invoiceId: string, lineId: string, field: NumericField, raw: string) => void;
    onApplyProduct: (invoiceId: string, lineId: string, val: ProductTO | null) => void;
    onDeleteLine: (invoiceId: string, lineId: string) => void;
};

/**
 * One supplier invoice: a header strip (date · vendor · paid · subtotal) over its own product
 * table, with its own "Add product" button. A stack of these cards replaces the single flat
 * table — a real nested <table> inside a <td> cannot align columns across invoices anyway, and
 * fights the horizontal scroll on a tablet.
 *
 * Memoized. The table-level callbacks it receives take (invoiceId, ...) and are stable with
 * empty deps; this block binds its own id to them so PurchaseTableRow keeps its (id, ...)
 * signature. Both the bound function and invoice.id are stable, so editing one invoice never
 * re-renders its siblings.
 */
function PurchaseInvoiceBlockInner({
                                       invoice,
                                       products,
                                       vendors,
                                       productById,
                                       invalid,
                                       onUpdateInvoice,
                                       onDeleteInvoice,
                                       onAddLine,
                                       onUpdateLine,
                                       onCommitNumeric,
                                       onApplyProduct,
                                       onDeleteLine,
                                   }: PurchaseInvoiceBlockProps) {
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

    return (
        <Paper
            elevation={0}
            data-testid={`invoice-block-${invoiceId}`}
            sx={{ borderRadius: 4, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}
        >
            <Stack
                direction="row"
                alignItems="center"
                flexWrap="wrap"
                gap={2}
                sx={{ px: 2, py: 1.5, bgcolor: "#fafafa", borderBottom: "1px solid rgba(0,0,0,0.06)" }}
            >
                <Box sx={{ minWidth: 150 }}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                            reduceAnimations
                            label="Invoice date"
                            format="DD.MM.YYYY"
                            value={invoice.invoiceDate ? dayjs(invoice.invoiceDate) : null}
                            onChange={(val) => {
                                const iso = val ? val.startOf("day").format("YYYY-MM-DD") : "";
                                onUpdateInvoice(invoiceId, { invoiceDate: iso });
                            }}
                            slotProps={{ textField: { size: "small", variant: "standard", sx: noUnderlineSx } }}
                        />
                    </LocalizationProvider>
                </Box>

                <Box sx={{ minWidth: 200, flexGrow: 1 }}>
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
                                label="Vendor"
                                size="small"
                                variant="standard"
                                error={invoiceInvalid?.has("vendorName")}
                                placeholder={vendorTrimmed !== "" ? vendorTrimmed : "Select Vendor"}
                                sx={noUnderlineSx}
                            />
                        )}
                        fullWidth
                    />
                </Box>

                <Stack direction="row" alignItems="center" gap={0.5}>
                    {/* MUI v7 routes native input attrs through slotProps.input; the older
                        `inputProps` shorthand is not forwarded, so the label never lands. */}
                    <Switch
                        checked={invoice.paid}
                        slotProps={{ input: { "aria-label": "invoice paid" } }}
                        onChange={(e) => onUpdateInvoice(invoiceId, { paid: e.target.checked })}
                    />
                    <Typography
                        variant="body2"
                        data-testid={`paid-label-${invoiceId}`}
                        sx={{ color: invoice.paid ? "success.main" : "warning.main", fontWeight: 700 }}
                    >
                        {invoice.paid ? "Paid" : "Unpaid"}
                    </Typography>
                </Stack>

                <Typography sx={{ whiteSpace: "nowrap" }} data-testid={`invoice-subtotal-${invoiceId}`}>
                    Subtotal: <b>{subtotal}</b>
                </Typography>

                <Tooltip title="Delete Invoice">
                    <IconButton
                        size="small"
                        aria-label="delete invoice"
                        onClick={() => onDeleteInvoice(invoiceId)}
                    >
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>

            <TableContainer sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <Table size="small" aria-label={`invoice ${invoiceId} products`} sx={{ minWidth: 760 }}>
                    <TableHead>
                        <TableRow>
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
                            <TableCell sx={headerCellSx} />
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {invoice.lines.map((line) => (
                            <PurchaseTableRow
                                key={line.id}
                                row={line}
                                products={products}
                                product={productById.get(line.productId ?? -1) ?? null}
                                invalidFields={invalid.get(line.id)}
                                onUpdateRow={boundUpdateLine}
                                onCommitNumeric={boundCommitNumeric}
                                onApplyProduct={boundApplyProduct}
                                onDelete={boundDeleteLine}
                            />
                        ))}

                        {invoice.lines.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 2, color: "text.secondary" }}>
                                    No products yet — use Add product
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{ px: 2, py: 1.5, display: "flex", justifyContent: "flex-end" }}>
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    data-testid={`add-line-${invoiceId}`}
                    onClick={() => onAddLine(invoiceId)}
                    sx={{ textTransform: "none", fontWeight: 700, color: BRAND }}
                >
                    Add product
                </Button>
            </Box>
        </Paper>
    );
}

export const PurchaseInvoiceBlock = React.memo(PurchaseInvoiceBlockInner);
