import React from "react";
import {Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography} from "@mui/material";
import type {ExpensePivot} from "../../types";
import {asIncome, formatBd, isLedgerIncomeBlock, shortMonthLabel} from "./businessFormat";

type Props = {
    pivot: ExpensePivot;
};

/**
 * What the ledger says came in: the categories classed REVENUE, months across like the expense
 * pivot they used to sit at the top of.
 *
 * <p>Its own card because inside a table of costs a credit is a negative number, so income read as
 * "-3,000.500" above the rent. It feeds no total: the profit statement takes revenue from orders,
 * and these payouts arrive net of commission on the day the platform pays, so counting them as well
 * would count the same sales twice.
 */
export default function BusinessIncomeCard({pivot}: Props): React.JSX.Element {
    const income = pivot.blocks.find(isLedgerIncomeBlock);

    if (!income || income.rows.length === 0) {
        return (
            <Typography variant="body2" sx={{color: '#8a807a'}}>
                No business income recorded in this range.
            </Typography>
        );
    }

    return (
        <>
            <Typography variant="caption" component="p" sx={{color: '#8a807a', mb: 0.5}}>
                Payouts received from platforms and payment gateways, as recorded in the ledger. Shown
                for reference — not part of any total; the profit statement takes revenue from orders.
            </Typography>

            <TableContainer sx={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
                <Table size="small" aria-label="Business income">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{fontWeight: 'bold'}}>Category</TableCell>
                            {pivot.months.map(m => (
                                <TableCell key={m} align="right" sx={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                                    {shortMonthLabel(m)}
                                </TableCell>
                            ))}
                            <TableCell align="right" sx={{fontWeight: 'bold'}}>Total</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {income.rows.map(row => (
                            <TableRow key={row.categoryId} hover>
                                <TableCell sx={{whiteSpace: 'nowrap'}}>{row.categoryName}</TableCell>
                                {row.amounts.map((amount, i) => (
                                    <TableCell key={i} align="right" sx={{whiteSpace: 'nowrap'}}>
                                        {amount === 0 ? '—' : formatBd(asIncome(amount))}
                                    </TableCell>
                                ))}
                                <TableCell align="right" sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>
                                    {formatBd(asIncome(row.total))}
                                </TableCell>
                            </TableRow>
                        ))}

                        <TableRow>
                            <TableCell sx={{fontWeight: 'bold'}}>Total</TableCell>
                            {income.totals.map((total, i) => (
                                <TableCell key={i} align="right" sx={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                                    {formatBd(asIncome(total))}
                                </TableCell>
                            ))}
                            <TableCell align="right" sx={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                                {formatBd(asIncome(income.grandTotal))}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    );
}
