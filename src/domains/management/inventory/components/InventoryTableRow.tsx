import React from "react";
import { Box, TableCell, TableRow } from "@mui/material";
import Decimal from "decimal.js-light";
import { InventoryRow } from "../types";
import { fmt3 } from "../../../../shared/utils/decimalUtils";
import { DecimalCellInput } from "../../../../shared/components/DecimalCellInput";

export type QuantityField = "kitchenQuantity" | "storageQuantity";

type InventoryTableRowProps = {
    row: InventoryRow;
    onCommitQuantity: (productId: number, field: QuantityField, raw: string) => void;
};

const noUnderlineSx = {
    "& .MuiInput-underline:before": { borderBottom: "none" },
    "& .MuiInput-underline:after": { borderBottom: "none" },
    "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottom: "none" },
};

const pillSx = {
    bg: "rgba(0,0,0,0.06)",
    text: "#333",
};

const finalPricePillSx = {
    bg: "rgba(52, 199, 89, 0.12)",
    text: "#008a00",
};

const quantityInputSx = {
    ...noUnderlineSx,
    "& input": { color: pillSx.text, fontWeight: "bold", fontSize: "0.9rem", padding: 0 },
};

const quantityPillSx = {
    backgroundColor: pillSx.bg,
    color: pillSx.text,
    py: 0.5,
    px: 1.5,
    borderRadius: 2,
    display: "inline-flex",
    alignItems: "center",
    fontWeight: "bold",
    fontSize: "0.9rem",
};

const finalPriceCellSx = {
    ...quantityPillSx,
    backgroundColor: finalPricePillSx.bg,
    color: finalPricePillSx.text,
};

function getFinalPrice(row: InventoryRow): Decimal {
    const kitchen = row.kitchenQuantity instanceof Decimal ? row.kitchenQuantity : new Decimal(row.kitchenQuantity ?? 0);
    const storage = row.storageQuantity instanceof Decimal ? row.storageQuantity : new Decimal(row.storageQuantity ?? 0);
    const price = row.price instanceof Decimal ? row.price : new Decimal(row.price ?? 0);
    return kitchen.add(storage).mul(price).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/**
 * One inventory line. Memoized on its own `row`, so table-level state that doesn't touch this
 * row (the name filter, another row's commit) leaves it untouched instead of re-rendering
 * every product's inputs. Requires `onCommitQuantity` to be referentially stable.
 */
function InventoryTableRowInner({ row, onCommitQuantity }: InventoryTableRowProps) {
    return (
        <TableRow sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
            {/* Name */}
            <TableCell sx={{ color: "#333", fontSize: "0.9rem", minWidth: 140 }}>
                {row.name}
            </TableCell>

            {/* Storage Quantity */}
            <TableCell sx={{ minWidth: 130 }}>
                <Box sx={quantityPillSx}>
                    <DecimalCellInput
                        value={fmt3(row.storageQuantity)}
                        clearZeroOnFocus
                        onCommit={(raw) => onCommitQuantity(row.productId, "storageQuantity", raw)}
                        width={80}
                        sx={quantityInputSx}
                    />
                </Box>
            </TableCell>

            {/* Kitchen Quantity */}
            <TableCell sx={{ minWidth: 130 }}>
                <Box sx={quantityPillSx}>
                    <DecimalCellInput
                        value={fmt3(row.kitchenQuantity)}
                        clearZeroOnFocus
                        onCommit={(raw) => onCommitQuantity(row.productId, "kitchenQuantity", raw)}
                        width={80}
                        sx={quantityInputSx}
                    />
                </Box>
            </TableCell>

            {/* Price per unit */}
            <TableCell sx={{ minWidth: 130, color: "text.secondary", fontSize: "0.9rem" }}>
                {fmt3(row.price)}
            </TableCell>

            {/* Final Price — read-only */}
            <TableCell sx={{ minWidth: 130 }}>
                <Box sx={finalPriceCellSx}>
                    {getFinalPrice(row).toFixed(3)}
                </Box>
            </TableCell>
        </TableRow>
    );
}

export const InventoryTableRow = React.memo(InventoryTableRowInner);
