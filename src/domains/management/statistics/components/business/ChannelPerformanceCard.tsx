import React, {useCallback, useState} from "react";
import {
    Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup,
    Typography
} from "@mui/material";
import type {ChannelField, ChannelPerformanceMonth, ChannelPerformanceRow as ChannelRow} from "../../types";
import {CHANNEL_FIELD_LABELS, formatBd, parseCellInput, shortMonthLabel} from "./businessFormat";
import {ChannelPerformanceRow, PILL_TEXT_INSET} from "./ChannelPerformanceRow";
import {channelCellKey} from "../../hooks/useBusinessStats";
import ErrorSnackbar from "../../../../../shared/components/ErrorSnackbar";

type Props = {
    months: ChannelPerformanceMonth[];
    /** channelCellKeys with a save queued or in flight. */
    saving: ReadonlySet<string>;
    /** channelCellKeys whose last save failed, with why. */
    errors: ReadonlyMap<string, string>;
    onSaveCell: (period: string, channelKey: string, field: ChannelField, value: number | null) => void;
    onRevertRow: (period: string, channelKey: string) => void;
};

// Fixed widths, so a cell's content can never resize its column, and the figures stay in reach
// of each other on a laptop instead of spreading across the whole card.
const COLUMN_WIDTHS: (number | undefined)[] = [undefined, 96, 136, 136, 128, 96, 48];
const TABLE_MAX_WIDTH = 960;

const headSx = {fontWeight: "bold", whiteSpace: "nowrap"} as const;
const editableHeadSx = {...headSx, pr: PILL_TEXT_INSET} as const;
const totalSx = {fontWeight: "bold", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", px: 1} as const;
const editableTotalSx = {...totalSx, pr: PILL_TEXT_INSET} as const;

/**
 * Channel performance, one month at a time.
 *
 * <p>Orders and gross revenue are live from our own order records; app fees have no source but
 * this table. All three can be overridden, because the Keeta scraper and the Keeta manager portal
 * disagree and the human number has to win.
 *
 * <p>Every cell is an input that is always there, so nothing on the row changes size between
 * reading and editing. Every edited cell is tinted and says what the live figure was, and a row's
 * edits can be reverted — an override that hides its own origin cannot be reviewed, and one that
 * cannot be removed is a trap.
 */
export default function ChannelPerformanceCard(
    {months, saving, errors, onSaveCell, onRevertRow}: Props
): React.JSX.Element {
    const [selected, setSelected] = useState<string>(
        months.length > 0 ? months[months.length - 1].period : "");
    const [inputError, setInputError] = useState<string | null>(null);

    const month = months.find(m => m.period === selected) ?? months[months.length - 1];

    const handleCommitCell = useCallback((row: ChannelRow, field: ChannelField, raw: string): void => {
        const parsed = parseCellInput(raw, field === "orders");
        if (parsed.kind === "invalid") {
            // The input then shows the saved figure again, so the snackbar is the only place
            // that says what happened to what was typed.
            setInputError(`${row.channelLabel} ${CHANNEL_FIELD_LABELS[field]} (${shortMonthLabel(row.period)}): `
                + `“${raw.trim()}” ${parsed.reason} — nothing was saved.`);
            return;
        }
        onSaveCell(row.period, row.channelKey, field, parsed.value);
    }, [onSaveCell]);

    const handleRevert = useCallback((row: ChannelRow): void => {
        onRevertRow(row.period, row.channelKey);
    }, [onRevertRow]);

    // Enter saves and moves down the same column, the spreadsheet habit for entering one fee per
    // channel. Only focus moves here: the blur that follows is the one place a save starts.
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>): void => {
        if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement)) return;
        const field = e.target.dataset.field;
        if (!field) return;
        e.preventDefault();
        const column = Array.from(
            e.currentTarget.querySelectorAll<HTMLInputElement>(`input[data-field="${field}"]`));
        const next = column[column.indexOf(e.target) + 1];
        if (next) next.focus();
        else e.target.blur();
    }, []);

    return (
        <>
            {months.length > 1 && (
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={month?.period}
                    onChange={(_, v) => v && setSelected(v)}
                    sx={{mb: 2, flexWrap: 'wrap', gap: 1}}
                >
                    {months.map(m => (
                        <ToggleButton key={m.period} value={m.period}
                                      sx={{textTransform: 'none', borderRadius: 999, px: 2}}>
                            {shortMonthLabel(m.period)}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            )}

            {!month || month.rows.length === 0 ? (
                <Typography variant="body2" sx={{color: '#8a807a'}}>
                    No orders in this month yet.
                </Typography>
            ) : (
                <>
                    <Typography variant="caption" component="p" sx={{color: '#8a807a', mb: 0.5}}>
                        Figures in the boxes are editable · Enter saves and moves down · Esc cancels
                    </Typography>

                    <TableContainer sx={{overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: TABLE_MAX_WIDTH}}>
                        <Table size="small" sx={{tableLayout: 'fixed', minWidth: 760}}>
                            <colgroup>
                                {COLUMN_WIDTHS.map((width, i) => <col key={i} style={{width}}/>)}
                            </colgroup>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={headSx}>Channel</TableCell>
                                    <TableCell align="right" sx={editableHeadSx}>Orders</TableCell>
                                    <TableCell align="right" sx={editableHeadSx}>Gross revenue</TableCell>
                                    <TableCell align="right" sx={editableHeadSx}>App fees</TableCell>
                                    <TableCell align="right" sx={{...headSx, px: 1}}>Net revenue</TableCell>
                                    <TableCell align="right" sx={{...headSx, px: 1}}>Commission</TableCell>
                                    <TableCell/>
                                </TableRow>
                            </TableHead>
                            <TableBody onKeyDown={handleKeyDown}>
                                {month.rows.map(row => (
                                    <ChannelPerformanceRow
                                        key={row.channelKey}
                                        row={row}
                                        savingOrders={saving.has(channelCellKey(row.period, row.channelKey, "orders"))}
                                        savingGrossRevenue={saving.has(channelCellKey(row.period, row.channelKey, "grossRevenue"))}
                                        savingAppFees={saving.has(channelCellKey(row.period, row.channelKey, "appFees"))}
                                        errorOrders={errors.get(channelCellKey(row.period, row.channelKey, "orders")) ?? null}
                                        errorGrossRevenue={errors.get(channelCellKey(row.period, row.channelKey, "grossRevenue")) ?? null}
                                        errorAppFees={errors.get(channelCellKey(row.period, row.channelKey, "appFees")) ?? null}
                                        onCommitCell={handleCommitCell}
                                        onRevert={handleRevert}
                                    />
                                ))}
                                <TableRow>
                                    <TableCell sx={{fontWeight: 'bold'}}>Total</TableCell>
                                    <TableCell align="right" sx={editableTotalSx}>{month.totalOrders}</TableCell>
                                    <TableCell align="right" sx={editableTotalSx}>{formatBd(month.totalGrossRevenue)}</TableCell>
                                    <TableCell align="right" sx={editableTotalSx}>{formatBd(month.totalAppFees)}</TableCell>
                                    <TableCell align="right" sx={totalSx}>{formatBd(month.totalNetRevenue)}</TableCell>
                                    <TableCell/>
                                    <TableCell/>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Below the table, not above it: it comes and goes as fees are typed in, and
                        above the rows it would move them under the pointer mid-entry. */}
                    {month.appFeesMissing && (
                        <Alert severity="warning" sx={{mt: 2, borderRadius: 2, maxWidth: TABLE_MAX_WIDTH}}>
                            A channel has revenue with no app fee entered, which overstates
                            profit. No channel is fee-free — even pick-up carries a card-gateway cut.
                        </Alert>
                    )}
                </>
            )}

            <ErrorSnackbar
                open={inputError !== null}
                severity="error"
                message={inputError ?? ""}
                handleClose={() => setInputError(null)}
                duration={6000}
            />
        </>
    );
}
