import {IBranch} from "../../inventory/types";
import React, {useEffect, useMemo, useRef, useState} from "react";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import {BaseShiftResponse, ShiftRow, StaffOption} from "../types";
import {
    createShiftReport,
    editShiftReport,
    getShiftReport,
    getStaffByBranch,
} from "../../../../shared/api/management";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    IconButton,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {toShiftEntryPayload} from "../mappers/shiftMapper";
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";

dayjs.extend(customParseFormat);

type Props = {
    open: boolean;
    mode: "new" | "edit";
    shiftReportId?: number;
    branch: IBranch;
    onClose: () => void;
    onSaved?: (report: BaseShiftResponse) => void;
};

const noUnderlineSx = {
    "& .MuiInput-underline:before": {borderBottom: "none"},
    "& .MuiInput-underline:after": {borderBottom: "none"},
    "& .MuiInput-underline:hover:not(.Mui-disabled):before": {borderBottom: "none"},
    "&:before": {borderBottom: "none"},
    "&:after": {borderBottom: "none"},
    "&:hover:not(.Mui-disabled):before": {borderBottom: "none"},
};

const pillSx = {
    bg: "rgba(0,0,0,0.06)",
    text: "#333",
};

function newRow(): ShiftRow {
    return {
        id: `new-${Date.now()}-${Math.random()}`,
        shiftDate: dayjs().format("YYYY-MM-DD"),
        startTime: null,
        endTime: null,
        totalHours: null,
        staffId: null,
    };
}

function calculateTotalHours(row: ShiftRow): ShiftRow {
    if (!row.startTime || !row.endTime) return {...row, totalHours: null};
    const start = dayjs(row.startTime, "HH:mm");
    const end = dayjs(row.endTime, "HH:mm");
    if (!start.isValid() || !end.isValid()) return {...row, totalHours: null};
    let diff = end.diff(start, "minute");
    if (diff < 0) diff += 24 * 60;
    return {...row, totalHours: Number((diff / 60).toFixed(3))};
}

export function ShiftTablePopup({open, mode, shiftReportId, branch, onSaved, onClose}: Props) {
    const [title, setTitle] = useState("");
    const [rows, setRows] = useState<ShiftRow[]>([]);
    const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [creationTimeStamp, setCreationTimeStamp] = useState("");

    const isDataLoaded = useRef(false);

    const totalHours = useMemo(
        () => rows.reduce((acc, r) => acc + (r.totalHours ?? 0), 0),
        [rows]
    );

    useEffect(() => {
        let cancelled = false;
        if (!open) {
            isDataLoaded.current = false;
            return;
        }
        if (!branch || isDataLoaded.current) return;

        (async () => {
            try {
                setError(null);
                setLoading(true);
                const staff = await getStaffByBranch(branch.id.toString());
                if (!cancelled) setStaffOptions(staff);

                if (mode === "new") {
                    if (!cancelled) {
                        setRows([newRow()]);
                        setTitle(`${dayjs().format("MMM-YY")}-BH-${branch.branchName}`.toLowerCase());
                        isDataLoaded.current = true;
                    }
                } else {
                    if (shiftReportId === undefined) throw new Error("Shift report ID is required");
                    const resp = await getShiftReport({id: shiftReportId});
                    if (!cancelled) {
                        setTitle(resp.title);
                        setCreationTimeStamp(resp.creationTimeStamp);
                        setRows(
                            resp.shifts.map((entry, i) => ({
                                id: `r-${i}`,
                                shiftDate: entry.shiftDate,
                                startTime: entry.startTime ? entry.startTime.slice(0, 5) : null,
                                endTime: entry.endTime ? entry.endTime.slice(0, 5) : null,
                                totalHours: entry.totalHours,
                                staffId: entry.staffId,
                            }))
                        );
                        isDataLoaded.current = true;
                    }
                }
            } catch (e: unknown) {
                if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, mode, shiftReportId, branch]);

    function updateRow(id: string, patch: Partial<ShiftRow>) {
        setRows(prev =>
            prev.map(r => r.id !== id ? r : calculateTotalHours({...r, ...patch}))
        );
    }

    function deleteRow(id: string) {
        setRows(prev => prev.filter(r => r.id !== id));
    }

    const handleSave = async (): Promise<void> => {
        if (rows.some(r => r.staffId === null)) {
            setError("All rows must have a contributor selected.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const rowsToSave = rows.map(toShiftEntryPayload);
            let report: BaseShiftResponse;
            if (mode === "new") {
                report = await createShiftReport({title, branchNo: branch.branchNo, totalHours, shifts: rowsToSave});
            } else {
                report = await editShiftReport({id: shiftReportId!, title, branchNo: branch.branchNo, totalHours, creationTimeStamp, shifts: rowsToSave});
            }
            onSaved?.(report);
            onClose();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            sx={{"& .MuiDialog-paper": {backgroundColor: "#fff"}}}
        >
            <ManagementTopBar
                title={title}
                onBack={onClose}
                actions={
                    <>
                        <Button
                            variant="contained"
                            onClick={() => setRows(prev => [...prev, newRow()])}
                            sx={{ bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e" }, borderRadius: 4 }}
                        >
                            Add
                        </Button>
                        <Button
                            variant="contained"
                            sx={{ bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e" }, borderRadius: 4 }}
                            onClick={handleSave}
                        >
                            {saving ? "Saving..." : "Save"}
                        </Button>
                    </>
                }
            />

            <Box sx={{p: 2}}>
                {error && (
                    <Alert severity="error" sx={{mb: 2}} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{display: "grid", placeItems: "center", minHeight: 200}}>
                        <CircularProgress/>
                    </Box>
                ) : (
                    <TableContainer
                        component={Paper}
                        elevation={0}
                        sx={{borderRadius: 4, overflowX: "auto", WebkitOverflowScrolling: "touch"}}
                    >
                        <Table size="small" aria-label="shift entries" sx={{minWidth: 620}}>
                            <TableHead sx={{bgcolor: "#fff"}}>
                                <TableRow>
                                    <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Shift Date</TableCell>
                                    <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Name</TableCell>
                                    <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Start Time</TableCell>
                                    <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>End Time</TableCell>
                                    <TableCell sx={{fontWeight: "bold", color: "text.secondary"}}>Total Hrs</TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableHead>

                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        sx={{"&:last-child td, &:last-child th": {border: 0}}}
                                    >
                                        {/* Shift Date */}
                                        <TableCell sx={{minWidth: 150}}>
                                            <TextField
                                                type="date"
                                                value={row.shiftDate}
                                                onChange={(e) => updateRow(row.id, {shiftDate: e.target.value})}
                                                size="small"
                                                variant="standard"
                                                sx={{width: 140, ...noUnderlineSx}}
                                            />
                                        </TableCell>

                                        {/* Contributor */}
                                        <TableCell sx={{minWidth: 190}}>
                                            <Box sx={{
                                                backgroundColor: pillSx.bg,
                                                color: pillSx.text,
                                                py: 0.5,
                                                px: 1.5,
                                                borderRadius: 2,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                fontWeight: "bold",
                                                fontSize: "0.9rem",
                                            }}>
                                                <Select
                                                    displayEmpty
                                                    value={row.staffId ?? ""}
                                                    onChange={(e) => updateRow(row.id, {staffId: Number(e.target.value)})}
                                                    size="small"
                                                    variant="standard"
                                                    sx={{
                                                        fontSize: "0.9rem",
                                                        fontWeight: "bold",
                                                        color: pillSx.text,
                                                        minWidth: 150,
                                                        ...noUnderlineSx,
                                                    }}
                                                >
                                                    <MenuItem value="" disabled>
                                                        <Typography color="text.secondary" variant="body2">Select…</Typography>
                                                    </MenuItem>
                                                    {staffOptions.map((s) => (
                                                        <MenuItem key={s.id} value={s.id}>{s.username}</MenuItem>
                                                    ))}
                                                </Select>
                                            </Box>
                                        </TableCell>

                                        {/* Start Time */}
                                        <TableCell sx={{minWidth: 100}}>
                                            <TextField
                                                type="time"
                                                value={row.startTime ?? ""}
                                                onChange={(e) => updateRow(row.id, {startTime: e.target.value || null})}
                                                size="small"
                                                variant="standard"
                                                inputProps={{step: 300}}
                                                sx={{width: 120, ...noUnderlineSx}}
                                            />
                                        </TableCell>

                                        {/* End Time */}
                                        <TableCell sx={{minWidth: 100}}>
                                            <TextField
                                                type="time"
                                                value={row.endTime ?? ""}
                                                onChange={(e) => updateRow(row.id, {endTime: e.target.value || null})}
                                                size="small"
                                                variant="standard"
                                                inputProps={{step: 300}}
                                                sx={{width: 120, ...noUnderlineSx}}
                                            />
                                        </TableCell>

                                        {/* Total Hours */}
                                        <TableCell sx={{minWidth: 120}}>
                                            <Box sx={{
                                                backgroundColor: pillSx.bg,
                                                color: pillSx.text,
                                                py: 0.5,
                                                px: 1.5,
                                                borderRadius: 2,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                fontWeight: "bold",
                                                fontSize: "0.9rem",
                                                minWidth: 60,
                                            }}>
                                                {row.totalHours != null ? `${row.totalHours.toFixed(3)} h` : "—"}
                                            </Box>
                                        </TableCell>

                                        {/* Delete */}
                                        <TableCell sx={{width: 40, pr: 1}}>
                                            <IconButton
                                                size="small"
                                                onClick={() => deleteRow(row.id)}
                                                sx={{color: "rgba(0,0,0,0.3)", "&:hover": {color: "#c41c00"}}}
                                            >
                                                <DeleteOutlineRoundedIcon fontSize="small"/>
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {rows.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center" sx={{py: 3, color: "text.secondary"}}>
                                            No entries yet — click "Add" to create one
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </Dialog>
    );
}
