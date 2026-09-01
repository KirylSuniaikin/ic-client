import React, {useEffect, useState} from "react";
import {
    Alert,
    Box,
    CircularProgress,
    IconButton,
    Paper,
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
// First `Capacitor` import anywhere in src/ — used only to hide the salary-slip download on the
// Android WebView build, where a <a download> on a blob: URL is a silent no-op (no
// DownloadListener on the host Activity) rather than a visible failure.
import {Capacitor} from "@capacitor/core";
import dayjs from "dayjs";
import {downloadSalarySlip, getMonthlyShiftReport, getSalarySlipPreview} from "../../../../shared/api/management";
import SalarySlipPopup from "./SalarySlipPopup";
import type {SalarySlipForm} from "../types";
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

export function StaffSummaryContent({branchId, role}: Props): JSX.Element {
    const [yearMonth, setYearMonth] = useState<string>(dayjs().format("YYYY-MM"));
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

    async function handleOpenSlip(staffId: number, label: string): Promise<void> {
        setSlipStaffId(staffId);
        setSlipLabel(label);
        setSlipForm(null);
        setSlipError(null);
        setSlipLoading(true);
        try {
            setSlipForm(await getSalarySlipPreview(staffId, yearMonth));
        } catch (e: unknown) {
            setSlipError(slipErrorMessage(e));
        } finally {
            setSlipLoading(false);
        }
    }

    function handleCloseSlip(): void {
        setSlipStaffId(null);
        setSlipForm(null);
        setSlipError(null);
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
            try {
                const data = await getMonthlyShiftReport(branchId, yearMonth);
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
    }, [branchId, yearMonth]);

    const rows = report?.summaries ?? [];

    return (
        <Box sx={{p: 2, backgroundColor: "#fff", minHeight: "100%"}}>
            <Box sx={{mb: 2}}>
                <TextField
                    type="month"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    size="small"
                    variant="outlined"
                    sx={{"& .MuiOutlinedInput-root": {borderRadius: 2}}}
                />
            </Box>

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
                                <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Total Cost</TableCell>
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

                                        {/* Total Cost */}
                                        <TableCell>
                                            <Box sx={{
                                                backgroundColor: s.totalCost != null ? costPillSx.bg : pillSx.bg,
                                                color: s.totalCost != null ? costPillSx.text : pillSx.text,
                                                py: 0.5,
                                                px: 1.5,
                                                borderRadius: 2,
                                                display: "inline-flex",
                                                fontWeight: "bold",
                                                fontSize: "0.9rem",
                                            }}>
                                                {s.totalCost != null ? s.totalCost.toFixed(3) : "—"}
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
