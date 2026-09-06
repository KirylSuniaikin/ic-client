import React from "react";
import {
    Alert, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography
} from "@mui/material";
import type {InventoryCogs, InventoryCogsState} from "../../types";
import {formatBd} from "./businessFormat";

type Props = {
    months: InventoryCogs[];
};

/**
 * What the message says when a month cannot be computed.
 *
 * <p>Each names the document that is missing, because "no data" tells the owner nothing they can act
 * on and "0.000" would be an outright lie.
 */
const STATE_MESSAGES: Record<InventoryCogsState, string | null> = {
    OK: null,
    PARTIAL_BRANCHES: "Covers only part of the business",
    MISSING_OPENING: "No closing stock count for the previous month — there is no opening balance to work from",
    MISSING_ENDING: "No stock count for this month",
    MISSING_PURCHASES: "No purchase report — COGS would be understated by a month of invoices",
    NO_DATA: "No stock or purchase data filed for this month",
};

function monthLabel(period: string): string {
    const [year, month] = period.split("-");
    return new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString("en-US", {month: "short", year: "2-digit"});
}

/**
 * Inventory-movement COGS: opening + purchases − ending.
 *
 * <p>This is <strong>not</strong> the P&L's COGS line, which is recipe-costed. The gap between the
 * two is the waste/yield variance, and keeping both visible is the point.
 *
 * <p>A month with a missing input shows an em dash and says which document is missing. It never
 * shows a zero: zero is a claim about the business, absence is a claim about the paperwork, and
 * printing the first when you mean the second turns unfiled invoices into a brilliant margin.
 */
export default function InventoryCogsCard({months}: Props): React.JSX.Element {
    const actionable = months.filter(m => m.movementCogs === null && !m.monthInProgress);

    return (
        <>
            <Typography variant="body2" sx={{color: '#8a807a', mb: 2}}>
                Opening + purchases − closing stock, across the whole business. Measured from
                stock counts, so it will not equal the recipe-costed COGS in the profit statement —
                that gap is waste, yield and miscounts.
            </Typography>

            {actionable.length > 0 && (
                <Alert severity="warning" sx={{mb: 2, borderRadius: 2}}>
                    {actionable.length} completed month{actionable.length === 1 ? "" : "s"} cannot
                    be computed. {actionable[0].missingReports.slice(0, 3).join("; ")}
                    {actionable[0].missingReports.length > 3 ? "; …" : ""}
                </Alert>
            )}

            <TableContainer sx={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{fontWeight: 'bold'}}>Metric</TableCell>
                            {months.map(m => (
                                <TableCell key={m.period} align="right"
                                           sx={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                                    {monthLabel(m.period)}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {([
                            ["Opening inventory", (m: InventoryCogs) => m.openingInventory],
                            ["Purchases", (m: InventoryCogs) => m.purchases],
                            ["Available", (m: InventoryCogs) => m.available],
                            ["Closing inventory", (m: InventoryCogs) => m.endingInventory],
                        ] as const).map(([label, pick]) => (
                            <TableRow key={label} hover>
                                <TableCell sx={{whiteSpace: 'nowrap'}}>{label}</TableCell>
                                {months.map(m => (
                                    <TableCell key={m.period} align="right" sx={{whiteSpace: 'nowrap'}}>
                                        {pick(m) === null ? "—" : formatBd(pick(m))}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}

                        <TableRow>
                            <TableCell sx={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>COGS (movement)</TableCell>
                            {months.map(m => (
                                <TableCell key={m.period} align="right"
                                           sx={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                                    {m.movementCogs === null ? (
                                        <Tooltip title={
                                            m.monthInProgress
                                                ? "Month still in progress — the closing count is not due yet."
                                                : STATE_MESSAGES[m.state] ?? ""
                                        }>
                                            <span data-testid={`cogs-missing-${m.period}`}>—</span>
                                        </Tooltip>
                                    ) : formatBd(m.movementCogs)}
                                </TableCell>
                            ))}
                        </TableRow>

                        <TableRow>
                            <TableCell sx={{whiteSpace: 'nowrap'}}>COGS % of gross revenue</TableCell>
                            {months.map(m => (
                                <TableCell key={m.period} align="right" sx={{whiteSpace: 'nowrap'}}>
                                    {m.cogsPercentOfGrossRevenue === null
                                        ? "—"
                                        : `${m.cogsPercentOfGrossRevenue.toFixed(2)}%`}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    );
}
