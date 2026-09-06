import React from "react";
import {
    Box, Card, CardContent, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography
} from "@mui/material";
import type {ExpenseBlock, ExpensePivot} from "../../types";
import {formatBd} from "./businessFormat";
import {BRAND_RED} from "../../../../../shared/utils/theme";

type Props = {
    pivot: ExpensePivot;
    onClassify: () => void;
};

function monthLabel(period: string): string {
    const [year, month] = period.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString("en-US", {month: "short", year: "2-digit"});
}

/**
 * Categories down, months across — the same shape as the sheet this replaces, because that is how
 * the owner already reads it.
 *
 * <p>Scrolls horizontally rather than wrapping: a P&L row that wraps stops being comparable across
 * months, which is the only reason to lay it out this way at all.
 */
export default function MonthlyExpensesPivotCard({pivot, onClassify}: Props): React.JSX.Element {
    const renderBlock = (block: ExpenseBlock): React.JSX.Element => {
        const unclassified = block.pnlClass === "UNCLASSIFIED";

        return (
            <React.Fragment key={block.pnlClass}>
                <TableRow>
                    <TableCell
                        colSpan={pivot.months.length + 2}
                        sx={{
                            backgroundColor: unclassified ? '#FCE9E9' : '#f1eae4',
                            fontWeight: 'bold',
                            color: '#3b352c',
                            borderBottom: 'none',
                        }}
                    >
                        {block.label}
                        {!block.includedInOperatingExpenses && !unclassified && (
                            <Typography component="span" variant="caption" sx={{color: '#8a807a', ml: 1}}>
                                — not in Operating Expenses
                            </Typography>
                        )}
                        {block.note && (
                            <Typography variant="caption" sx={{display: 'block', color: '#8a807a', fontWeight: 400}}>
                                {block.note}
                            </Typography>
                        )}
                    </TableCell>
                </TableRow>

                {block.rows.map(row => (
                    <TableRow key={row.categoryId} hover>
                        <TableCell sx={{whiteSpace: 'nowrap'}}>
                            {row.categoryName}
                            {row.kpiTag && (
                                <Chip size="small" label={row.kpiTag} sx={{ml: 1, backgroundColor: '#f1eae4'}}/>
                            )}
                        </TableCell>
                        {row.amounts.map((amount, i) => (
                            <TableCell key={i} align="right" sx={{whiteSpace: 'nowrap'}}>
                                {amount === 0 ? '—' : formatBd(amount)}
                            </TableCell>
                        ))}
                        <TableCell align="right" sx={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>
                            {formatBd(row.total)}
                        </TableCell>
                    </TableRow>
                ))}

                <TableRow>
                    <TableCell sx={{fontWeight: 'bold'}}>Total</TableCell>
                    {block.totals.map((total, i) => (
                        <TableCell key={i} align="right" sx={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                            {formatBd(total)}
                        </TableCell>
                    ))}
                    <TableCell align="right" sx={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                        {formatBd(block.grandTotal)}
                    </TableCell>
                </TableRow>
            </React.Fragment>
        );
    };

    return (
        <>
            {pivot.blocks.length === 0 ? (
                <Typography variant="body2" sx={{color: '#8a807a'}}>
                    No ledger entries in this range.
                </Typography>
            ) : (
                <TableContainer sx={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{fontWeight: 'bold'}}>Category</TableCell>
                                {pivot.months.map(m => (
                                    <TableCell key={m} align="right" sx={{fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                                        {monthLabel(m)}
                                    </TableCell>
                                ))}
                                <TableCell align="right" sx={{fontWeight: 'bold'}}>Total</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>{pivot.blocks.map(renderBlock)}</TableBody>
                    </Table>
                </TableContainer>
            )}
        </>
    );
}
