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
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Decimal from "decimal.js-light";
import { PurchaseLineRow } from "../types";
import { ProductTO } from "../../inventory/types";
import { toDecimal } from "../mappers/purchaseMapper";
import { fmt3 } from "../../../../shared/utils/decimalUtils";
import { DecimalCellInput } from "../../../../shared/components/DecimalCellInput";

export type NumericField = "quantity" | "finalPrice";

type PurchaseTableRowProps = {
    row: PurchaseLineRow;
    products: ProductTO[];
    /** The row's selected product, resolved by the table (stable identity from its product map). */
    product: ProductTO | null;
    /** Fields flagged by `validateInvoices`; undefined when the row is valid. */
    invalidFields?: Set<string>;
    onUpdateRow: (id: string, patch: Partial<PurchaseLineRow>) => void;
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

type PillTone = "neutral" | "error";

/**
 * Shared wrapper for every numeric cell. The over-target highlight lives on this pill rather
 * than on the TableCell so it keeps the same rounded shape as the neutral cells.
 * `data-tone` is what the tests assert on — emotion class names are not stable.
 */
function CellPill({ tone = "neutral", children }: { tone?: PillTone; children: React.ReactNode }) {
    return (
        <Box
            data-tone={tone}
            sx={(t) => ({
                backgroundColor: tone === "error" ? `${t.palette.error.light}33` : pillSx.bg,
                color: tone === "error" ? t.palette.error.main : pillSx.text,
                py: 0.5, px: 1.5, borderRadius: 2,
                display: "inline-flex", alignItems: "center",
                fontWeight: "bold", fontSize: "0.9rem",
            })}
        >
            {children}
        </Box>
    );
}

const inputSx = {
    ...noUnderlineSx,
    "& input": { color: pillSx.text, fontWeight: "bold", fontSize: "0.9rem", padding: 0 },
};

const isDecFinite = (d: Decimal): boolean => Number.isFinite(d.toNumber());

// Unit price: the explicit one when set, otherwise derived from total / quantity.
function unitFromRow(row: PurchaseLineRow): Decimal {
    const price = toDecimal(row.price);
    if (row.price != null && isDecFinite(price)) return price;

    const tot = toDecimal(row.finalPrice);
    const qty = toDecimal(row.quantity);
    return (isDecFinite(tot) && isDecFinite(qty) && !qty.isZero())
        ? tot.div(qty)
        : toDecimal(NaN);
}

function isOverTarget(row: PurchaseLineRow, product: ProductTO | null): boolean {
    const unit = unitFromRow(row);
    const target = toDecimal(product?.targetPrice ?? NaN);
    return isDecFinite(unit) && isDecFinite(target) && unit.greaterThan(target);
}

/**
 * One product line inside an invoice. Date and vendor used to live here; they moved up to the
 * invoice header, which removes a DatePicker and an Autocomplete from every single line.
 *
 * Memoized on its own props, and the callbacks it receives are already bound to this line's
 * invoice by PurchaseInvoiceBlock — so the (id, ...) signature is unchanged and the memo only
 * breaks when this line's own data changes.
 */
function PurchaseTableRowInner({
                                   row,
                                   products,
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

    // Invalid-cell highlight (validateInvoices result) as plain sx, merged onto the TableCell.
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
                <CellPill>
                    <DecimalCellInput
                        value={fmt3(row.quantity)}
                        onCommit={(raw) => onCommitNumeric(row.id, "quantity", raw)}
                        width={90}
                        sx={inputSx}
                    />
                </CellPill>
            </TableCell>

            {/* Total Price (finalPrice) */}
            <TableCell sx={{ minWidth: 140, ...cellErrSx("finalPrice") }}>
                <CellPill>
                    <DecimalCellInput
                        value={fmt3(row.finalPrice)}
                        onCommit={(raw) => onCommitNumeric(row.id, "finalPrice", raw)}
                        width={100}
                        sx={inputSx}
                    />
                </CellPill>
            </TableCell>

            {/* Unit Price (price) — total ÷ amount, read-only. The only cell that turns red. */}
            <TableCell sx={{ minWidth: 160, ...cellErrSx("price") }} data-testid="unit-price-cell">
                <CellPill tone={overTarget ? "error" : "neutral"}>{fmt3(row.price) || "—"}</CellPill>
            </TableCell>

            {/* Target Price — the price we aim to buy at, straight from the product. Read-only. */}
            <TableCell sx={{ minWidth: 160 }} data-testid="target-price-cell">
                <CellPill>{fmt3(product?.targetPrice ?? null) || "—"}</CellPill>
            </TableCell>

            {/* Delete action */}
            <TableCell sx={{ width: 64 }}>
                <Tooltip title="Delete Line">
                    <IconButton size="small" aria-label="delete line" onClick={() => onDelete(row.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}

export const PurchaseTableRow = React.memo(PurchaseTableRowInner);
