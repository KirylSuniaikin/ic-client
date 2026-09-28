import React from "react";
import {
    Autocomplete,
    Box,
    createFilterOptions,
    IconButton,
    Stack,
    TableCell,
    TableRow,
    TextField,
    Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Decimal from "decimal.js-light";
import { PurchaseLineRow } from "../types";
import { ProductTO } from "../../inventory/types";
import { toDecimal } from "../mappers/purchaseMapper";
import { fmt3 } from "../../../../shared/utils/decimalUtils";
import { DecimalCellInput } from "../../../../shared/components/DecimalCellInput";
import { cleanProductName, normalizeProductName } from "../../_shared/utils/productName";
import {
    binSx,
    ComputedNumber,
    EditableNumber,
    editableFieldSx,
    fieldInputSx,
    numericInputSx,
} from "./cellChrome";

export type NumericField = "quantity" | "finalPrice";

/** The dropdown's trailing "Add “<typed>”" entry, offered when the typed name matches no product. */
type AddProductOption = { kind: "add-product"; name: string };
type ProductOption = ProductTO | AddProductOption;

function isAddProductOption(option: ProductOption): option is AddProductOption {
    return "kind" in option && option.kind === "add-product";
}

// trim: a stray space typed around a name should still find the product.
const filterProducts = createFilterOptions<ProductOption>({ trim: true });

type PurchaseTableRowProps = {
    row: PurchaseLineRow;
    /**
     * Owning invoice, stamped onto the <tr> as data-invoice. The invoice's own identity now lives
     * in the strip row rather than this row's <tr>, so this is what lets a caller (or a test)
     * scope to one invoice's lines.
     */
    invoiceId: string;
    products: ProductTO[];
    /** The row's selected product, resolved by the table (stable identity from its product map). */
    product: ProductTO | null;
    /** Fields flagged by `validateInvoices`; undefined when the row is valid. */
    invalidFields?: Set<string>;
    /** "Add product" sits beside the bin on the last line of each invoice. */
    showAddLine?: boolean;
    onAddLine?: () => void;
    onUpdateRow: (id: string, patch: Partial<PurchaseLineRow>) => void;
    onCommitNumeric: (id: string, field: NumericField, raw: string) => void;
    onApplyProduct: (id: string, val: ProductTO | null) => void;
    /**
     * Asks for a new product named as typed, for this line. When absent (a role that may not
     * create products) the dropdown offers no "Add" entry.
     */
    onRequestCreateProduct?: (id: string, name: string) => void;
    onDelete: (id: string) => void;
};

const BRAND = "#E44B4C";

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
 * One product line. Memoized on its own props; the callbacks it receives are pre-bound to this
 * line's invoice by PurchaseInvoiceGroup, so the (id, …) signature stays flat.
 */
function PurchaseTableRowInner({
                                   row,
                                   invoiceId,
                                   products,
                                   product,
                                   invalidFields,
                                   showAddLine,
                                   onAddLine,
                                   onUpdateRow,
                                   onCommitNumeric,
                                   onApplyProduct,
                                   onRequestCreateProduct,
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
            data-invoice={invoiceId}
            sx={{
                "&:hover > td": { backgroundColor: "rgba(0,0,0,0.02)" },
                ...(rowInvalid
                    ? { "& td": (t: any) => ({ backgroundColor: `${t.palette.error.light}1a` }) }
                    : {}),
            }}
        >
            {/* Product */}
            <TableCell sx={{ minWidth: 180, ...cellErrSx("productId") }}>
                <Box sx={editableFieldSx}>
                    <Autocomplete<ProductOption, false, false, false>
                        openOnFocus
                        options={products}
                        value={selectedProduct}
                        autoHighlight
                        getOptionLabel={(o) => o.name}
                        isOptionEqualToValue={(o, v) =>
                            !isAddProductOption(o) && !isAddProductOption(v) && o.id === v.id}
                        filterOptions={(options, state) => {
                            const filtered = filterProducts(options, state);
                            if (!onRequestCreateProduct) return filtered;
                            // Offered only when nothing matches EXACTLY (by the server's duplicate
                            // rule), not merely when the fuzzy filter comes up empty: typing
                            // "tomato" must not offer to create "Tomato" beside the existing one.
                            const typedKey = normalizeProductName(state.inputValue);
                            if (typedKey === "") return filtered;
                            const exists = options.some(o =>
                                !isAddProductOption(o) && normalizeProductName(o.name) === typedKey);
                            return exists
                                ? filtered
                                : [...filtered, { kind: "add-product", name: cleanProductName(state.inputValue) }];
                        }}
                        renderOption={(props, option) => {
                            const { key, ...optionProps } = props;
                            return isAddProductOption(option) ? (
                                <li key={key} {...optionProps}>
                                    <Box
                                        component="span"
                                        sx={{ display: "flex", alignItems: "center", gap: 0.75, color: BRAND, fontWeight: 700 }}
                                    >
                                        <AddRoundedIcon fontSize="small" />
                                        Add “{option.name}”
                                    </Box>
                                </li>
                            ) : (
                                <li key={key} {...optionProps}>{option.name}</li>
                            );
                        }}
                        onChange={(_, val) => {
                            // The "Add" entry is a request, not a value: the line keeps its current
                            // product until the new one exists and the table applies it.
                            if (val === null) {
                                onApplyProduct(row.id, null);
                            } else if (isAddProductOption(val)) {
                                // The sheet's focus trap restores focus to whatever held it when it
                                // opened; with openOnFocus, handing it back to this input would pop
                                // the dropdown open again over the table as the sheet closes.
                                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                                onRequestCreateProduct?.(row.id, val.name);
                            } else {
                                onApplyProduct(row.id, val);
                            }
                        }}
                        renderInput={(p) => (
                            <TextField
                                {...p}
                                size="small"
                                variant="standard"
                                placeholder={product?.name ?? "Select Product"}
                                sx={fieldInputSx}
                            />
                        )}
                        fullWidth
                    />
                </Box>
            </TableCell>

            {/* Amount (quantity) */}
            <TableCell align="right" sx={{ minWidth: 110, ...cellErrSx("quantity") }}>
                <EditableNumber>
                    <DecimalCellInput
                        value={fmt3(row.quantity)}
                        onCommit={(raw) => onCommitNumeric(row.id, "quantity", raw)}
                        width={72}
                        sx={numericInputSx}
                    />
                </EditableNumber>
            </TableCell>

            {/* Total Price (finalPrice) */}
            <TableCell align="right" sx={{ minWidth: 120, ...cellErrSx("finalPrice") }}>
                <EditableNumber>
                    <DecimalCellInput
                        value={fmt3(row.finalPrice)}
                        onCommit={(raw) => onCommitNumeric(row.id, "finalPrice", raw)}
                        width={82}
                        sx={numericInputSx}
                    />
                </EditableNumber>
            </TableCell>

            {/* Unit Price (price) — total ÷ amount, read-only. The only cell that turns red. */}
            <TableCell align="right" sx={{ minWidth: 120, ...cellErrSx("price") }} data-testid="unit-price-cell">
                <ComputedNumber tone={overTarget ? "error" : "neutral"}>{fmt3(row.price) || "—"}</ComputedNumber>
            </TableCell>

            {/* Target Price — the price we aim to buy at, straight from the product. Read-only. */}
            <TableCell align="right" sx={{ minWidth: 120 }} data-testid="target-price-cell">
                <ComputedNumber>{fmt3(product?.targetPrice ?? null) || "—"}</ComputedNumber>
            </TableCell>

            {/* Line actions. Add-product sits right next to the bin, on the invoice's last line.
                The bin is muted and the + carries the brand colour, so the destructive one is not
                the eye-catching one. */}
            <TableCell sx={{ width: 84, whiteSpace: "nowrap" }}>
                <Stack direction="row" gap={0.25}>
                    <Tooltip title="Delete this product line">
                        <IconButton
                            size="small"
                            aria-label="delete line"
                            onClick={() => onDelete(row.id)}
                            sx={binSx}
                        >
                            <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    {showAddLine && onAddLine && (
                        <Tooltip title="Add product to this invoice">
                            <IconButton
                                size="small"
                                aria-label="add product"
                                data-testid={`add-line-${invoiceId}`}
                                onClick={onAddLine}
                                sx={{ color: BRAND }}
                            >
                                <AddIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Stack>
            </TableCell>
        </TableRow>
    );
}

export const PurchaseTableRow = React.memo(PurchaseTableRowInner);
