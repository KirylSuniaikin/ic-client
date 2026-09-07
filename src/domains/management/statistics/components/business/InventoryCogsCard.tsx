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
    MISSING_PURCHASES: "Nothing booked to Groceries or Packaging in the ledger this month",
    NO_DATA: "No stock counts and no goods spend recorded for this month",
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
/**
 * One labelled row of the statement, one cell per month.
 *
 * <p>Extracted because the rows are no longer a fixed list — the purchases breakdown is whatever
 * categories the ledger has — so they cannot all come out of one array literal any more.
 */
function SimpleRow(
    {label, pick, months, indent = false}: {
        label: string;
        pick: (m: InventoryCogs) => number | null;
        months: InventoryCogs[];
        indent?: boolean;
    }
): React.JSX.Element {
    return (
        <TableRow hover>
            <TableCell sx={{
                whiteSpace: 'nowrap',
                pl: indent ? 4 : undefined,
                color: indent ? '#8a807a' : undefined,
            }}>{label}</TableCell>
            {months.map(m => (
                <TableCell key={m.period} align="right" sx={{whiteSpace: 'nowrap'}}>
                    {pick(m) === null ? "—" : formatBd(pick(m))}
                </TableCell>
            ))}
        </TableRow>
    );
}

export default function InventoryCogsCard({months}: Props): React.JSX.Element {
    // Every category that appears in any month on screen, so a category bought in June but not in
    // July still gets a row (showing an em dash) rather than the two months having different shapes.
    const breakdownCategories = Array.from(new Set(
        months.flatMap(m => m.purchaseBreakdown.map(l => l.categoryName))
    )).sort();

    const actionable = months.filter(m => m.movementCogs === null && !m.monthInProgress);

    return (
        <>
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
                        {/* The +/=/− prefixes carry the arithmetic, because without them the
                            indented breakdown reads as though Available were built from it.
                            Available is Opening + the WHOLE Purchases row; the indented lines are
                            a breakdown of that row and always add back up to it. */}
                        <SimpleRow label="Opening inventory" pick={m => m.openingInventory} months={months}/>
                        <SimpleRow label="+ Purchases" pick={m => m.purchases} months={months}/>

                        {/* Driven by the data, not a fixed Groceries/Packaging pair: these are
                            whatever accounting categories are classified COGS_PURCHASES. Classify a
                            new one that way and it appears here with no code change — and nothing
                            can fall between two hardcoded names and vanish. */}
                        {breakdownCategories.map(name => (
                            <SimpleRow
                                key={name}
                                label={name}
                                indent
                                months={months}
                                pick={m => m.purchaseBreakdown.find(l => l.categoryName === name)?.amount ?? null}
                            />
                        ))}

                        <SimpleRow label="= Available" pick={m => m.available} months={months}/>
                        <SimpleRow label="− Ending inventory" pick={m => m.endingInventory} months={months}/>

                        <TableRow>
                            <TableCell sx={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>COGS</TableCell>
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
                            <TableCell sx={{whiteSpace: 'nowrap'}}>COGS%</TableCell>
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
