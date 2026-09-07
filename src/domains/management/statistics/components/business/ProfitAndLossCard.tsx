import React from "react";
import {
    Box, Card, CardContent, Divider, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Tooltip, Typography
} from "@mui/material";
import type {ProfitAndLoss} from "../../types";
import {formatBd} from "./businessFormat";
import InfoHint from "./InfoHint";

type Props = {
    months: ProfitAndLoss[];
};

type Row = {
    label: string;
    pick: (m: ProfitAndLoss) => number | null;
    emphasis?: boolean;
    indent?: boolean;
    hint?: string;
};

function monthLabel(period: string): string {
    const [year, month] = period.split("-");
    return new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString("en-US", {month: "short", year: "2-digit"});
}

const STATEMENT: Row[] = [
    {label: "Gross revenue", pick: m => m.grossRevenue},
    {label: "App fees", pick: m => -m.appFees, indent: true},
    {label: "Net revenue", pick: m => m.netRevenue, emphasis: true},
    {
        label: "Cost of goods sold (recipe)", pick: m => -m.recipeCogs, indent: true,
        hint: "Recipe-costed, not cash. What the recipes say the month's sales should have consumed.",
    },
    {label: "Gross profit", pick: m => m.grossProfit, emphasis: true},
    {label: "Operating expenses", pick: m => -m.operatingExpenses, indent: true},
    {label: "Operating profit (EBITDA)", pick: m => m.operatingProfit, emphasis: true},
    {label: "Capital expenditure", pick: m => -m.capex, indent: true},
    {label: "Financing & interest", pick: m => -m.financing, indent: true},
    {label: "Owner withdrawals", pick: m => -m.ownerWithdrawals, indent: true},
    {label: "Adjustments", pick: m => m.adjustments, indent: true},
    {label: "Net profit", pick: m => m.netProfit, emphasis: true},
    {
        label: "Unclassified (in no total above)", pick: m => m.unclassified, indent: true,
        hint: "Spend whose category has no P&L class. Shown here so it cannot silently disappear.",
    },
];

const RECONCILIATION: Row[] = [
    {label: "Groceries & packaging in the ledger", pick: m => m.reconciliation.ledgerCogsPurchases},
    {label: "Purchases per invoices", pick: m => m.reconciliation.invoicePurchases},
    {
        label: "Ledger vs invoices", pick: m => m.reconciliation.ledgerVsInvoices, indent: true,
        hint: "Non-zero means one of the two systems is missing entries. This is the row that proves no grocery money left the report unaccounted for.",
    },
    {label: "Opening inventory", pick: m => m.reconciliation.openingInventory},
    {label: "Closing inventory", pick: m => m.reconciliation.endingInventory},
    {label: "COGS from stock movement", pick: m => m.reconciliation.movementCogs},
    {label: "COGS from recipes (in the statement above)", pick: m => m.reconciliation.recipeCogs},
    {
        label: "Unexplained variance (waste / yield / theft)",
        pick: m => m.reconciliation.unexplainedVariance, emphasis: true,
        hint: "Positive means more was consumed than the recipes predict.",
    },
    {
        label: "Net cash movement", pick: m => m.reconciliation.netCashMovement, emphasis: true,
        hint: "Net profit + recipe COGS − purchases. What the bank balance actually moved by, since COGS here is not cash.",
    },
];

/**
 * The profit statement, months across.
 *
 * <p>The reconciliation memo sits inside this card rather than beside it, below a divider. In its
 * own card it would be scrolled past; here it is structurally part of reading the statement — which
 * matters, because with recipe-costed COGS the Net Profit line above is no longer a cash figure.
 */
export default function ProfitAndLossCard({months}: Props): React.JSX.Element {
    const renderRow = (row: Row): React.JSX.Element => (
        <TableRow key={row.label} hover>
            <TableCell sx={{whiteSpace: 'nowrap', pl: row.indent ? 4 : 2, fontWeight: row.emphasis ? 'bold' : 400}}>
                {row.hint ? (
                    <Tooltip title={row.hint}>
                        <span style={{borderBottom: '1px dotted #8a807a'}}>{row.label}</span>
                    </Tooltip>
                ) : row.label}
            </TableCell>
            {months.map(m => {
                const value = row.pick(m);
                return (
                    <TableCell key={m.period} align="right"
                               sx={{whiteSpace: 'nowrap', fontWeight: row.emphasis ? 'bold' : 400}}>
                        {value === null ? "—" : formatBd(value)}
                    </TableCell>
                );
            })}
        </TableRow>
    );

    return (
        <>
            <TableContainer sx={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{fontWeight: 'bold'}}/>
                            {months.map(m => (
                                <TableCell key={m.period} align="right"
                                           sx={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                                    {monthLabel(m.period)}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>{STATEMENT.map(renderRow)}</TableBody>
                </Table>
            </TableContainer>

            <Divider sx={{my: 2}}/>

            <Typography variant="subtitle2" fontWeight="bold" sx={{mb: 1}}>
                COGS reconciliation — memo (does not affect net profit)
            </Typography>

            <TableContainer sx={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
                <Table size="small">
                    <TableBody>
                        {RECONCILIATION.map(renderRow)}
                        <TableRow>
                            <TableCell sx={{pl: 4}}>as % of net revenue</TableCell>
                            {months.map(m => (
                                <TableCell key={m.period} align="right" sx={{whiteSpace: 'nowrap'}}>
                                    {m.reconciliation.variancePercentOfNetRevenue === null
                                        ? "—"
                                        : `${m.reconciliation.variancePercentOfNetRevenue.toFixed(2)}%`}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Kept as an icon rather than dropped: an em dash with no explanation reads as a
                bug. It only appears when there IS an em dash to explain. */}
            {months.some(m => !m.reconciliation.complete) && (
                <Box sx={{mt: 1, display: 'flex', alignItems: 'center', gap: 0.5}}>
                    <InfoHint label="incomplete months" text="Months showing an em dash are missing a stock count or a purchase report. No variance is computed from an input that does not exist."/>
                    <Typography variant="caption" sx={{color: '#8a807a'}}>
                        Some months are incomplete
                    </Typography>
                </Box>
            )}
        </>
    );
}
