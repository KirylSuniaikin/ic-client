import React, {useEffect, useRef, useState} from "react";
import {
    Alert,
    Box,
    CircularProgress,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
// First `Capacitor` import anywhere in src/ — used only to hide the salary-slip download on the
// Android WebView build, where a <a download> on a blob: URL is a silent no-op (no
// DownloadListener on the host Activity) rather than a visible failure.
import {Capacitor} from "@capacitor/core";
import dayjs from "dayjs";
import {downloadSalarySlip, getMonthlyShiftReport, getSalarySlipPreview} from "../../../../shared/api/management";
import SalarySlipPopup from "./SalarySlipPopup";
import ShiftDateRangeFields from "./ShiftDateRangeFields";
import type {SalarySlipForm, ShiftDateRange} from "../types";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import {shortStaffName, staffDisplayName} from "../../../../shared/utils/staffName";
import {StaffRoles} from "../../../auth/types";
import type {MonthlyShiftReport} from "../types";

type Props = {
    branchId: string;
    role: StaffRoles | null;
};

const pillSx = {
    bg: "rgba(0,0,0,0.06)",
    text: "#333",
};

const costPillSx = {
    bg: "rgba(52, 199, 89, 0.12)",
    text: "#008a00",
};

const overtimePillSx = {
    bg: "rgba(255, 59, 48, 0.12)",
    text: "#c41c00",
};

const DATE_RANGE_HINT = "Hours are summed by each shift's own date across all of this branch's shift reports, "
    + "so a single report card's total won't match. An overnight shift counts on the day it started. "
    + "Salary slips default to the pay cycle instead — their dates are shown in the slip.";

export function StaffSummaryContent({branchId, role}: Props): JSX.Element {
    const [yearMonth, setYearMonth] = useState<string>(dayjs().format("YYYY-MM"));
    // Null = let the backend pick its default window for the month; the one it used comes back on
    // the report, so the UI never has to compute it.
    const [range, setRange] = useState<ShiftDateRange | null>(null);
    const [report, setReport] = useState<MonthlyShiftReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Per-row pending state -- only the row whose slip is being generated disables its own button.
    const [downloadingStaffId, setDownloadingStaffId] = useState<number | null>(null);
    // The slip is confirmed before it downloads: open the popup on the previewed defaults, let the
    // owner check and correct them, then render exactly what they confirmed.
    const [slipStaffId, setSlipStaffId] = useState<number | null>(null);
    const [slipLabel, setSlipLabel] = useState("");
    const [slipForm, setSlipForm] = useState<SalarySlipForm | null>(null);
    const [slipLoading, setSlipLoading] = useState(false);
    const [slipError, setSlipError] = useState<string | null>(null);
    // Only the latest preview request may touch the popup: one still in flight when the popup
    // closes (or its dates change again) would otherwise land in whichever slip is open next.
    const slipRequestRef = useRef(0);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");

    // A non-OWNER's costs already arrive null from the backend, so the action would be
    // meaningless even before the 403 -- and on the Android WebView build (Capacitor) a blob
    // download silently does nothing, so the action is hidden there too rather than appearing
    // to work.
    const showSlipColumn = role === StaffRoles.OWNER && !Capacitor.isNativePlatform();

    function slipErrorMessage(e: unknown): string {
        return e instanceof Error && e.message.endsWith("409")
            ? "Set this employee's payroll in Account Manager first."
            : e instanceof Error ? e.message : "Failed to generate salary slip";
    }

    // No range = the backend's pay-cycle default, which is what a row click wants; the popup passes
    // one only when the owner re-picks the slip's dates.
    async function handleOpenSlip(staffId: number, label: string, slipRange?: ShiftDateRange): Promise<void> {
        const requestId = ++slipRequestRef.current;
        setSlipStaffId(staffId);
        setSlipLabel(label);
        // A date change keeps the current slip up while the new window loads: the sheet's buttons
        // stay under the pointer, and a rejected range leaves the date fields there to correct.
        if (slipRange === undefined) setSlipForm(null);
        setSlipError(null);
        setSlipLoading(true);
        try {
            const form = await getSalarySlipPreview(staffId, yearMonth, slipRange);
            if (requestId === slipRequestRef.current) setSlipForm(form);
        } catch (e: unknown) {
            if (requestId === slipRequestRef.current) setSlipError(slipErrorMessage(e));
        } finally {
            if (requestId === slipRequestRef.current) setSlipLoading(false);
        }
    }

    function handleCloseSlip(): void {
        slipRequestRef.current++;
        setSlipStaffId(null);
        setSlipForm(null);
        setSlipError(null);
        setSlipLoading(false);
    }

    async function handleDownloadSlip(staffId: number, form: SalarySlipForm): Promise<void> {
        setDownloadingStaffId(staffId);
        try {
            const {blob, filename} = await downloadSalarySlip(staffId, yearMonth, form);
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // Object URLs are heap that never frees itself; on an all-day tablet shift these add up.
            URL.revokeObjectURL(objectUrl);
            handleCloseSlip();
        } catch (e: unknown) {
            setSnackbarMessage(slipErrorMessage(e));
            setSnackbarOpen(true);
        } finally {
            setDownloadingStaffId(null);
        }
    }

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            setError(null);
            // Drop the previous report up front so its window never shows as this fetch's -- not
            // while loading, and not after a failure.
            setReport(null);
            try {
                const data = await getMonthlyShiftReport(branchId, yearMonth, range ?? undefined);
                if (alive) setReport(data);
            } catch (e: unknown) {
                if (alive) setError(e instanceof Error ? e.message : "Failed to load");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [branchId, yearMonth, range]);

    const rows = report?.summaries ?? [];
    // An older backend omits the window; show empty fields then rather than {from: undefined}.
    const reportWindow: ShiftDateRange | null = report?.periodStart && report?.periodEnd
        ? {from: report.periodStart, to: report.periodEnd}
        : null;

    return (
        <Box sx={{p: 2, backgroundColor: "#fff", minHeight: "100%"}}>
            <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center" sx={{mb: 2}}>
                <TextField
                    type="month"
                    value={yearMonth}
                    onChange={(e) => {
                        setYearMonth(e.target.value);
                        setRange(null);
                    }}
                    size="small"
                    variant="outlined"
                    sx={{"& .MuiOutlinedInput-root": {borderRadius: 2}}}
                />
                <ShiftDateRangeFields
                    value={range ?? reportWindow}
                    onChange={setRange}
                    disabled={loading}
                />
                <Tooltip
                    title={DATE_RANGE_HINT}
                    // Keeps the hint as a description, so the icon's accessible name stays its
                    // titleAccess instead of the whole paragraph (see InfoHint).
                    describeChild
                    arrow
                    enterTouchDelay={0}
                    leaveTouchDelay={6000}
                >
                    <InfoOutlinedIcon
                        titleAccess="About these dates"
                        tabIndex={0}
                        sx={{fontSize: 18, color: "text.disabled", cursor: "pointer"}}
                    />
                </Tooltip>
            </Stack>

            {error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}

            {loading ? (
                <Box sx={{display: "grid", placeItems: "center", minHeight: 200}}>
                    <CircularProgress/>
                </Box>
            ) : (
                <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{
                        borderRadius: 4,
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch",
                        border: "1px solid rgba(0,0,0,0.08)",
                    }}
                >
                    <Table size="small" aria-label="staff summary" sx={{minWidth: 480}}>
                        <TableHead sx={{bgcolor: "#fafafa"}}>
                            <TableRow>
                                <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Staff</TableCell>
                                <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Role</TableCell>
                                <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Total Hrs</TableCell>
                                <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Total(Basic Salary + Allowance + OT)</TableCell>
                                {showSlipColumn && (
                                    <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}/>
                                )}
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {rows.map((s, i) => {
                                const hasOvertime = (s.overtimeHours ?? 0) > 0;

                                return (
                                    <TableRow
                                        key={s.staffId ?? i}
                                        sx={{"&:last-child td, &:last-child th": {border: 0}}}
                                    >
                                        {/* Staff */}
                                        <TableCell sx={{color: "#333", fontSize: "0.9rem"}}>
                                            <Box>{shortStaffName(staffDisplayName(s))}</Box>
                                            <Typography variant="caption" sx={{color: "text.secondary"}}>
                                                {s.username}
                                            </Typography>
                                        </TableCell>

                                        {/* Role */}
                                        <TableCell>
                                            <Box sx={{
                                                backgroundColor: pillSx.bg,
                                                color: pillSx.text,
                                                py: 0.5,
                                                px: 1.5,
                                                borderRadius: 2,
                                                display: "inline-flex",
                                                fontWeight: "bold",
                                                fontSize: "0.85rem",
                                            }}>
                                                {s.role}
                                            </Box>
                                        </TableCell>

                                        {/* Total Hours */}
                                        <TableCell>
                                            <Box sx={{
                                                backgroundColor: pillSx.bg,
                                                color: pillSx.text,
                                                py: 0.5,
                                                px: 1.5,
                                                borderRadius: 2,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                                fontWeight: "bold",
                                                fontSize: "0.9rem",
                                            }}>
                                                {s.totalHours?.toFixed(2)}
                                                {hasOvertime && (
                                                    <Typography component="span" sx={{
                                                        fontSize: "0.78rem",
                                                        opacity: 0.75,
                                                        fontWeight: "normal"
                                                    }}>
                                                        ({s.regularHours?.toFixed(2)} + {s.overtimeHours?.toFixed(2)} OT)
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>

                                        {/* Total Salary */}
                                        <TableCell>
                                            <Box sx={{
                                                backgroundColor: s.totalSalary != null ? costPillSx.bg : pillSx.bg,
                                                color: s.totalSalary != null ? costPillSx.text : pillSx.text,
                                                py: 0.5,
                                                px: 1.5,
                                                borderRadius: 2,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                                fontWeight: "bold",
                                                fontSize: "0.9rem",
                                            }}>
                                                {s.totalSalary != null ? s.totalSalary.toFixed(3) : "—"}
                                                {/* basicSalary/allowance/totalSalary are backend-guaranteed all-or-nothing
                                                    (see backend "Null-payroll behavior": hasPayroll gates all three on
                                                    basicSalary != null), so `?.` on basicSalary/allowance here is safe,
                                                    not defensive. overtimeCost is NOT covered by that guarantee — it is
                                                    gated independently by pricePerHour != null, so a salaried staff member
                                                    without an hourly rate can have a non-null totalSalary but a null
                                                    overtimeCost. The backend folds that null into the total as zero via
                                                    nz(), so we mirror that with `?? 0` instead of `?.` for this term. */}
                                                {s.totalSalary != null && (
                                                    <Typography component="span" sx={{
                                                        fontSize: "0.78rem",
                                                        opacity: 0.75,
                                                        fontWeight: "normal"
                                                    }}>
                                                        ({s.basicSalary?.toFixed(3)} + {s.allowance?.toFixed(3)} + {(s.overtimeCost ?? 0).toFixed(3)} OT)
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>

                                        {/* Salary slip */}
                                        {showSlipColumn && (
                                            <TableCell sx={{width: 40, pr: 1}}>
                                                <Tooltip title="Check and download salary slip">
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            aria-label="Salary slip"
                                                            disabled={downloadingStaffId === s.staffId}
                                                            onClick={() => handleOpenSlip(s.staffId, shortStaffName(staffDisplayName(s)))}
                                                            sx={{color: "rgba(0,0,0,0.3)", "&:hover": {color: "#c41c00"}}}
                                                        >
                                                            <DescriptionOutlinedIcon fontSize="small"/>
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })}

                            {rows.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={showSlipColumn ? 5 : 4}
                                        align="center"
                                        sx={{py: 3, color: "text.secondary"}}
                                    >
                                        No data for this period
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <SalarySlipPopup
                open={slipStaffId !== null}
                form={slipForm}
                employeeLabel={slipLabel}
                loading={slipLoading}
                submitting={downloadingStaffId !== null}
                error={slipError}
                onConfirm={(form) => {
                    if (slipStaffId !== null) void handleDownloadSlip(slipStaffId, form);
                }}
                onPeriodChange={(r) => {
                    if (slipStaffId !== null) void handleOpenSlip(slipStaffId, slipLabel, r);
                }}
                onClose={handleCloseSlip}
            />

            <ErrorSnackbar
                open={snackbarOpen}
                message={snackbarMessage}
                severity="error"
                handleClose={() => setSnackbarOpen(false)}
            />
        </Box>
    );
}
