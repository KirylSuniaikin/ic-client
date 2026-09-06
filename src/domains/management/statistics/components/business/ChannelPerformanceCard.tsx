import React, {useState} from "react";
import {
    Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, IconButton, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography
} from "@mui/material";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import type {ChannelOverridePatch, ChannelPerformanceMonth, ChannelPerformanceRow} from "../../types";
import {formatBd} from "./businessFormat";
import {BRAND_RED} from "../../../../../shared/utils/theme";

type Props = {
    months: ChannelPerformanceMonth[];
    onPatch: (id: number, payload: ChannelOverridePatch) => Promise<void>;
    onRegenerate: () => Promise<void>;
    rangeLabel: string;
};

/** An overridden cell is tinted so an edited figure never passes for a measured one. */
const OVERRIDDEN_BG = "rgba(228, 75, 76, 0.08)";

function monthLabel(period: string): string {
    const [year, month] = period.split("-");
    return new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString("en-US", {month: "short", year: "2-digit"});
}

/**
 * Channel performance, one month at a time.
 *
 * <p>Orders, gross revenue and app fees are all editable, because the Keeta scraper and the Keeta
 * manager portal disagree and the human number has to win. App fees have no other source at all.
 *
 * <p>Every edited cell is tinted and carries what the generated figure was, and every override can
 * be reverted — an override that hides its own origin cannot be reviewed, and one that cannot be
 * removed is a trap.
 */
export default function ChannelPerformanceCard(
    {months, onPatch, onRegenerate, rangeLabel}: Props
): React.JSX.Element {
    const [selected, setSelected] = useState<string>(
        months.length > 0 ? months[months.length - 1].period : "");
    const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
    const [regenerating, setRegenerating] = useState<boolean>(false);
    const [editing, setEditing] = useState<{ id: number; field: EditableField } | null>(null);
    const [draft, setDraft] = useState<string>("");

    const month = months.find(m => m.period === selected) ?? months[months.length - 1];

    const handleConfirmRegenerate = async (): Promise<void> => {
        setRegenerating(true);
        try {
            await onRegenerate();
        } finally {
            setRegenerating(false);
            setConfirmOpen(false);
        }
    };

    const commit = async (row: ChannelPerformanceRow, field: EditableField): Promise<void> => {
        setEditing(null);
        const trimmed = draft.trim();
        const parsed = trimmed === "" ? null : Number(trimmed);
        if (parsed !== null && Number.isNaN(parsed)) return;

        await onPatch(row.id, {
            version: row.version,
            ...(field === "orders"
                ? {orders: parsed, clearOrders: parsed === null}
                : field === "grossRevenue"
                    ? {grossRevenue: parsed, clearGrossRevenue: parsed === null}
                    : {appFees: parsed, clearAppFees: parsed === null}),
        });
    };

    const revert = async (row: ChannelPerformanceRow): Promise<void> => {
        await onPatch(row.id, {
            version: row.version,
            clearOrders: true,
            clearGrossRevenue: true,
            clearAppFees: true,
        });
    };

    const editableCell = (
        row: ChannelPerformanceRow,
        field: EditableField,
        value: number | null,
        generated: number | null,
        decimals: boolean
    ): React.JSX.Element => {
        const overridden = field === "orders" ? row.overrideOrders !== null
            : field === "grossRevenue" ? row.overrideGrossRevenue !== null
                : row.overrideAppFees !== null;
        const isEditing = editing?.id === row.id && editing.field === field;

        return (
            <TableCell
                align="right"
                data-testid={`cell-${field}-${row.id}`}
                onClick={() => {
                    setEditing({id: row.id, field});
                    setDraft(value === null ? "" : String(value));
                }}
                sx={{
                    whiteSpace: 'nowrap',
                    cursor: 'text',
                    backgroundColor: overridden ? OVERRIDDEN_BG : undefined,
                    // Nothing else on the row is editable, so the cells that are have to say so.
                    // Without this an empty app-fee cell is an em dash that looks like a dead end.
                    '&:hover': {backgroundColor: overridden ? OVERRIDDEN_BG : '#fbfaf6'},
                }}
            >
                {isEditing ? (
                    <TextField
                        autoFocus
                        size="small"
                        variant="standard"
                        value={draft}
                        inputProps={{style: {textAlign: 'right'}, 'aria-label': `${field} ${row.channelLabel}`}}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={() => void commit(row, field)}
                        onKeyDown={e => {
                            if (e.key === "Enter") void commit(row, field);
                            if (e.key === "Escape") setEditing(null);
                        }}
                    />
                ) : (
                    <Tooltip
                        title={overridden
                            ? `Overridden — generated was ${generated === null ? "—" : (decimals ? formatBd(generated) : generated)}`
                            : ""}
                    >
                        <span style={{borderBottom: '1px dashed #c9bfb6', paddingBottom: 1}}>
                            {value === null ? "—" : (decimals ? formatBd(value) : value)}
                        </span>
                    </Tooltip>
                )}
            </TableCell>
        );
    };

    return (
        <>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1}}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={regenerating ? <CircularProgress size={14}/> : <AutorenewIcon/>}
                        disabled={regenerating}
                        onClick={() => setConfirmOpen(true)}
                        sx={{
                            ml: 'auto',
                            textTransform: 'none',
                            borderRadius: 999,
                            borderColor: '#e0e0e0',
                            color: '#3b352c',
                            '&:hover': {borderColor: BRAND_RED, color: BRAND_RED},
                        }}
                    >
                        Refresh channel data
                    </Button>
                </Box>

                <Typography variant="body2" sx={{color: '#8a807a', mb: 2}}>
                    Orders and revenue come from our own order records. App fees have no other
                    source — they are whatever you enter here.
                </Typography>

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
                                {monthLabel(m.period)}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                )}

                {!month || month.rows.length === 0 ? (
                    <Typography variant="body2" sx={{color: '#8a807a'}}>
                        No channel data for this month yet — use Refresh channel data.
                    </Typography>
                ) : (
                    <>
                        {month.appFeesMissing && (
                            <Alert severity="warning" sx={{mb: 2, borderRadius: 2}}>
                                A channel has revenue with no app fee entered, which overstates
                                profit. No channel is fee-free — even pick-up carries a card-gateway cut.
                            </Alert>
                        )}

                        <TableContainer sx={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{fontWeight: 'bold'}}>Channel</TableCell>
                                        <TableCell align="right" sx={{fontWeight: 'bold'}}>Orders</TableCell>
                                        <TableCell align="right" sx={{fontWeight: 'bold'}}>Gross revenue</TableCell>
                                        <TableCell align="right" sx={{fontWeight: 'bold'}}>
                                            App fees
                                            <Typography component="span" variant="caption"
                                                        sx={{display: 'block', color: '#8a807a', fontWeight: 400}}>
                                                click to edit
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right" sx={{fontWeight: 'bold'}}>Net revenue</TableCell>
                                        <TableCell align="right" sx={{fontWeight: 'bold'}}>Commission</TableCell>
                                        <TableCell/>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {month.rows.map(row => (
                                        <TableRow key={row.id} hover>
                                            <TableCell sx={{whiteSpace: 'nowrap'}}>{row.channelLabel}</TableCell>
                                            {editableCell(row, "orders", row.effectiveOrders, row.generatedOrders, false)}
                                            {editableCell(row, "grossRevenue", row.effectiveGrossRevenue, row.generatedGrossRevenue, true)}
                                            {editableCell(row, "appFees", row.effectiveAppFees, null, true)}
                                            <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                {formatBd(row.netRevenue)}
                                            </TableCell>
                                            <TableCell align="right" sx={{whiteSpace: 'nowrap'}}>
                                                {row.appCommissionPercent === null
                                                    ? "—" : `${row.appCommissionPercent.toFixed(1)}%`}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Revert to the generated figures">
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            aria-label={`Revert ${row.channelLabel}`}
                                                            disabled={row.overrideOrders === null
                                                                && row.overrideGrossRevenue === null
                                                                && row.overrideAppFees === null}
                                                            onClick={() => void revert(row)}
                                                        >
                                                            <RestartAltIcon fontSize="small"/>
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow>
                                        <TableCell sx={{fontWeight: 'bold'}}>Total</TableCell>
                                        <TableCell align="right" sx={{fontWeight: 'bold'}}>{month.totalOrders}</TableCell>
                                        <TableCell align="right" sx={{fontWeight: 'bold'}}>{formatBd(month.totalGrossRevenue)}</TableCell>
                                        <TableCell align="right" sx={{fontWeight: 'bold'}}>{formatBd(month.totalAppFees)}</TableCell>
                                        <TableCell align="right" sx={{fontWeight: 'bold'}}>{formatBd(month.totalNetRevenue)}</TableCell>
                                        <TableCell/>
                                        <TableCell/>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            <Dialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                PaperProps={{sx: {borderRadius: "14px", width: 270, m: 2}}}
            >
                <DialogTitle sx={{fontSize: "13px", fontWeight: 600, textAlign: "center", pb: 0.5, pt: 2.5}}>
                    Refresh channel data
                </DialogTitle>
                <DialogContent sx={{textAlign: "center", pb: 1.5}}>
                    {/* Deliberately NOT prep-plan's "this will replace the current plan": that would
                        be a lie about this data model, and would make the owner afraid to press it. */}
                    <Typography fontSize="13px" color="text.secondary">
                        Refreshes orders and gross revenue from our own order records for {rangeLabel}.
                        Your manual edits are kept.
                    </Typography>
                </DialogContent>
                <Divider/>
                <DialogActions sx={{p: 0}}>
                    <Button
                        fullWidth
                        onClick={() => setConfirmOpen(false)}
                        sx={{
                            borderRadius: 0, py: 1.4, fontSize: "13px", color: "text.secondary",
                            fontWeight: 400, borderRight: "0.5px solid", borderColor: "divider",
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        fullWidth
                        onClick={() => void handleConfirmRegenerate()}
                        sx={{borderRadius: 0, py: 1.4, fontSize: "13px", color: BRAND_RED, fontWeight: 600}}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

type EditableField = "orders" | "grossRevenue" | "appFees";
