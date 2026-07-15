import React from "react";
import {
    Autocomplete,
    Box,
    IconButton,
    TableCell,
    TableRow,
    TextField,
    Tooltip,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import dayjs from "dayjs";
import Decimal from "decimal.js-light";
import { PurchaseRow, VendorTO } from "../types";
import { ProductTO } from "../../inventory/types";
import { toDecimal } from "../mappers/purchaseMapper";
import { fmt3 } from "../../../../shared/utils/decimalUtils";
import { DecimalCellInput } from "../../../../shared/components/DecimalCellInput";

export type NumericField = "quantity" | "finalPrice";

type PurchaseTableRowProps = {
    row: PurchaseRow;
    products: ProductTO[];
    vendors: VendorTO[];
    /** The row's selected product, resolved by the table (stable identity from its product map). */
    product: ProductTO | null;
    /** Fields flagged by `validateRows`; undefined when the row is valid. */
    invalidFields?: Set<string>;
    onUpdateRow: (id: string, patch: Partial<PurchaseRow>) => void;
    onCommitNumeric: (id: string, field: NumericField, raw: string) => void;
    onApplyProduct: (id: string, val: ProductTO | null) => void;
    onDelete: (id: string) => void;
};

const pillSx = {
    bg: "rgba(0,0,0,0.06)",
    text: "#333",
};

const noUnderlineSx = {
    "& .MuiInput-underline:before": { borderBottom: "none" },
    "& .MuiInput-underline:after": { borderBottom: "none" },
    "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottom: "none" },
};

const isDecFinite = (d: Decimal): boolean => Number.isFinite(d.toNumber());

// Unit price: the explicit one when set, otherwise derived from total / quantity.
function unitFromRow(row: PurchaseRow): Decimal {
    const price = toDecimal(row.price);
    if (row.price != null && isDecFinite(price)) return price;

    const tot = toDecimal(row.finalPrice);
    const qty = toDecimal(row.quantity);
    return (isDecFinite(tot) && isDecFinite(qty) && !qty.isZero())
        ? tot.div(qty)
        : toDecimal(NaN);
}

function isOverTarget(row: PurchaseRow, product: ProductTO | null): boolean {
    const unit = unitFromRow(row);
    const target = toDecimal(product?.targetPrice ?? NaN);
    return isDecFinite(unit) && isDecFinite(target) && unit.greaterThan(target);
}

/**
 * One purchase line. Memoized on its own props: each row carries a DatePicker and two
 * Autocompletes (both holding the full product / vendor list), so re-rendering every row on
 * any table-level state change is what made this table feel slow. All callbacks must be
 * referentially stable for the memo to hold.
 */
function PurchaseTableRowInner({
                                   row,
                                   products,
                                   vendors,
                                   product,
                                   invalidFields,
                                   onUpdateRow,
                                   onCommitNumeric,
                                   onApplyProduct,
                                   onDelete,
                               }: PurchaseTableRowProps) {
    const overTarget = isOverTarget(row, product);
    const rowInvalid = invalidFields != null;
    const selectedProduct = product;
    const vendorTrimmed = String(row.vendorName ?? "").trim();
    const selectedVendor = vendorTrimmed !== ""
        ? vendors.find(v => v.vendorName === vendorTrimmed) ?? null
        : null;

    // Invalid-cell highlight (validateRows result) as plain sx, merged onto the TableCell.
    const cellErrSx = (field: string) =>
        invalidFields?.has(field)
            ? {
                backgroundColor: "rgba(244,67,54,0.20)",
                color: "error.main",
                fontWeight: 700,
            }
            : {};

    return (
        <TableRow
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
                            onUpdateRow(row.id, { purchaseDate: iso });
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
                    onChange={(_, val) => onApplyProduct(row.id, val)}
                    renderInput={(p) => (
                        <TextField
                            {...p}
                            size="small"
                            variant="standard"
                            placeholder={product?.name ?? "Select Product"}
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
                    <DecimalCellInput
                        value={fmt3(row.quantity)}
                        onCommit={(raw) => onCommitNumeric(row.id, "quantity", raw)}
                        width={90}
                        sx={{
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
                    <DecimalCellInput
                        value={fmt3(row.finalPrice)}
                        onCommit={(raw) => onCommitNumeric(row.id, "finalPrice", raw)}
                        width={100}
                        sx={(t) => ({
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
                    onChange={(_, val) => onUpdateRow(row.id, { vendorName: val?.vendorName ?? "" })}
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
                    <IconButton size="small" onClick={() => onDelete(row.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}

export const PurchaseTableRow = React.memo(PurchaseTableRowInner);
