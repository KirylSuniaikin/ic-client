import React, {useState} from "react";
import {Box, CircularProgress, IconButton, TableCell, TableRow, Tooltip} from "@mui/material";
import {alpha} from "@mui/material/styles";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import type {ChannelField, ChannelPerformanceRow as ChannelRow} from "../../types";
import {DecimalCellInput} from "../../../../../shared/components/DecimalCellInput";
import {fmt3} from "../../../../../shared/utils/decimalUtils";
import {BRAND_RED} from "../../../../../shared/utils/theme";
import {CHANNEL_FIELD_LABELS, formatBd} from "./businessFormat";

type Props = {
    row: ChannelRow;
    savingOrders: boolean;
    savingGrossRevenue: boolean;
    savingAppFees: boolean;
    errorOrders: string | null;
    errorGrossRevenue: string | null;
    errorAppFees: string | null;
    onCommitCell: (row: ChannelRow, field: ChannelField, raw: string) => void;
    onRevert: (row: ChannelRow) => void;
};

/** An overridden cell is tinted so an edited figure never passes for a measured one. */
export const OVERRIDDEN_BG = alpha(BRAND_RED, 0.08);

// The admin's "you can type here" look, as on the inventory count's quantity pill.
const PILL_BG = "rgba(0,0,0,0.06)";

/**
 * The cell's right padding (8px) plus the pill's (6px): where a header or total must end to line up
 * with the figures typed in the pills above it.
 */
export const PILL_TEXT_INSET = "14px";

// The pill fills its fixed-width column and the gutter is always reserved, so a spinner or an
// error glyph appearing never moves a figure or resizes a column under the pointer.
const pillSx = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    width: "100%",
    boxSizing: "border-box",
    px: 0.75,
    py: 0.25,
    borderRadius: 2,
} as const;

// A box-shadow, not a border, so focus cannot change the pill's size either.
const FOCUS_RING = `0 0 0 2px ${alpha(BRAND_RED, 0.35)}`;

const gutterSx = {
    flex: "0 0 14px",
    height: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
} as const;

const inputSx = {
    flex: 1,
    minWidth: 0,
    "& .MuiInput-underline:before": {borderBottom: "none"},
    "& .MuiInput-underline:after": {borderBottom: "none"},
    "& .MuiInput-underline:hover:not(.Mui-disabled):before": {borderBottom: "none"},
    "& input": {
        textAlign: "right",
        fontSize: "0.875rem",
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        color: "#3b352c",
        padding: 0,
    },
} as const;

const numberCellSx = {px: 1, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums"} as const;

// The whole pill reads as the input, so a click on its padding or status gutter must not be a dead
// spot. preventDefault keeps that mousedown from blurring the input it is about to focus.
function focusPillInput(e: React.MouseEvent<HTMLElement>): void {
    if (e.target instanceof HTMLInputElement) return;
    e.preventDefault();
    e.currentTarget.querySelector("input")?.focus();
}

function liveFigure(row: ChannelRow, field: ChannelField): string | null {
    if (field === "orders") return row.generatedOrders === null ? "—" : String(row.generatedOrders);
    if (field === "grossRevenue") return formatBd(row.generatedGrossRevenue);
    // App fees have no source but this table, so there is no "from orders" figure to show.
    return null;
}

type EditableCellProps = {
    row: ChannelRow;
    field: ChannelField;
    value: number | null;
    overridden: boolean;
    saving: boolean;
    error: string | null;
    onCommitCell: Props["onCommitCell"];
};

function EditableCell(
    {row, field, value, overridden, saving, error, onCommitCell}: EditableCellProps
): React.JSX.Element {
    // Shown exactly as it is edited: no thousands separators, because the parser reads a comma as
    // the decimal point, so they would have to be stripped on focus and the figure would slide
    // sideways under the caret the moment editing starts.
    const shown = value === null ? "" : field === "orders" ? String(value) : fmt3(value);
    const live = liveFigure(row, field);
    const editedBy = `Edited${row.updatedByName ? ` by ${row.updatedByName}` : ""}`;
    // Held in state rather than styled with :focus-within, which jsdom's selector engine throws on
    // — and a thrown stylesheet match breaks every later test that reads a computed style.
    const [focused, setFocused] = useState<boolean>(false);

    return (
        <TableCell align="right" data-testid={`cell-${field}-${row.channelKey}`} sx={{px: 1, py: 0.5}}>
            <Box
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onMouseDown={focusPillInput}
                sx={{
                    ...pillSx,
                    backgroundColor: overridden ? OVERRIDDEN_BG : PILL_BG,
                    boxShadow: focused ? FOCUS_RING : "none",
                }}
            >
                <Box sx={gutterSx}>
                    {saving ? (
                        <CircularProgress size={10} aria-label={`Saving ${CHANNEL_FIELD_LABELS[field]}`}/>
                    ) : error ? (
                        <Tooltip title={error} describeChild disableInteractive>
                            <ErrorOutlineRoundedIcon
                                titleAccess={`Not saved: ${CHANNEL_FIELD_LABELS[field]}`}
                                sx={{fontSize: 14, color: BRAND_RED}}
                            />
                        </Tooltip>
                    ) : null}
                </Box>
                {/* Not on focus: while typing, a tooltip would sit over the cell below — the one
                    Enter is about to move to. */}
                <Tooltip
                    title={overridden ? (live === null ? editedBy : `${editedBy} · from orders: ${live}`) : ""}
                    describeChild
                    disableFocusListener
                    disableInteractive
                >
                    <Box sx={{flex: 1, minWidth: 0, display: "flex"}}>
                        <DecimalCellInput
                            value={shown}
                            placeholder="—"
                            selectOnFocus
                            cancelOnEscape
                            commitOnlyIfEdited
                            onCommit={raw => onCommitCell(row, field, raw)}
                            inputProps={{
                                "aria-label": `${CHANNEL_FIELD_LABELS[field]} ${row.channelLabel}`,
                                "data-field": field,
                            }}
                            sx={inputSx}
                        />
                    </Box>
                </Tooltip>
            </Box>
        </TableCell>
    );
}

/**
 * One channel's month. Memoized on its own props, so a save on another row — or the PATCH answer
 * replacing the month — leaves it alone. Requires `onCommitCell` and `onRevert` to be stable.
 */
function ChannelPerformanceRowInner({
                                        row, savingOrders, savingGrossRevenue, savingAppFees,
                                        errorOrders, errorGrossRevenue, errorAppFees, onCommitCell, onRevert,
                                    }: Props): React.JSX.Element {
    return (
        <TableRow hover>
            <TableCell sx={{whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
                {row.channelLabel}
            </TableCell>
            <EditableCell row={row} field="orders" value={row.effectiveOrders}
                          overridden={row.overrideOrders !== null}
                          saving={savingOrders} error={errorOrders} onCommitCell={onCommitCell}/>
            <EditableCell row={row} field="grossRevenue" value={row.effectiveGrossRevenue}
                          overridden={row.overrideGrossRevenue !== null}
                          saving={savingGrossRevenue} error={errorGrossRevenue} onCommitCell={onCommitCell}/>
            <EditableCell row={row} field="appFees" value={row.effectiveAppFees}
                          overridden={row.overrideAppFees !== null}
                          saving={savingAppFees} error={errorAppFees} onCommitCell={onCommitCell}/>
            <TableCell align="right" sx={numberCellSx}>{formatBd(row.netRevenue)}</TableCell>
            <TableCell align="right" sx={numberCellSx}>
                {row.appCommissionPercent === null ? "—" : `${row.appCommissionPercent.toFixed(1)}%`}
            </TableCell>
            <TableCell align="right" sx={{px: 0.5}}>
                <Tooltip title="Revert orders and gross revenue to the figures from orders. The app fee is kept.">
                    <span>
                        <IconButton
                            size="small"
                            aria-label={`Revert ${row.channelLabel}`}
                            // The app fee is not part of a revert, so a fee alone leaves nothing to revert.
                            disabled={row.overrideOrders === null && row.overrideGrossRevenue === null}
                            onClick={() => onRevert(row)}
                        >
                            <RestartAltRoundedIcon fontSize="small"/>
                        </IconButton>
                    </span>
                </Tooltip>
            </TableCell>
        </TableRow>
    );
}

export const ChannelPerformanceRow = React.memo(ChannelPerformanceRowInner);
