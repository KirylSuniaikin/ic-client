import {IBranch} from "../types/inventoryTypes";
import React, {useEffect, useMemo, useRef, useState} from "react";
import dayjs from "dayjs";
import {BaseShiftResponse, ShiftInfoTO, ShiftRow, StaffOption} from "../types/shiftTypes";
import {
    createShiftReport,
    editShiftReport,
    getShiftReport,
    getStaffByBranch,
} from "../api/api";
import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Dialog,
    MenuItem,
    Select,
    SelectChangeEvent,
    TextField,
} from "@mui/material";
import {TableTopBar} from "./TableTopBar";
import {toShiftInfoTO} from "../mappers/shiftMapper";
import {
    DataGrid,
    GridColDef,
    GridRenderEditCellParams,
} from "@mui/x-data-grid";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

type Props = {
    open: boolean;
    mode: "new" | "edit";
    shiftReportId?: number;
    branch: IBranch;
    onClose: () => void;
    onSaved?: (report: BaseShiftResponse) => void;
}

type TimeEditCellProps = GridRenderEditCellParams<ShiftRow, string | null>;

export function ShiftTablePopup({open, mode, shiftReportId, branch, onSaved, onClose}: Props) {
    const [title, setTitle] = useState<string>("");
    const [reportDate, setReportDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
    const [rows, setRows] = useState<ShiftRow[]>([]);
    const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isDataLoaded = useRef(false);

    const cookOptions = useMemo(
        () => staffOptions.filter(s => s.role === "COOK"),
        [staffOptions]
    );

    const managerOptions = useMemo(
        () => staffOptions.filter(s => s.role === "MANAGER" || s.role === "SUPER_MANAGER"),
        [staffOptions]
    );

    function TimeEditCell(props: TimeEditCellProps) {
        const { id, field, value, api, hasFocus } = props;
        const inputRef = React.useRef<HTMLInputElement | null>(null);

        React.useEffect(() => {
            if (hasFocus && inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select?.();
            }
        }, [hasFocus]);

        return (
            <div style={{ width: '100%', height: '100%' }} onClick={(e) => e.stopPropagation()}>
                <TextField
                    type="time"
                    size="small"
                    fullWidth
                    inputRef={inputRef}
                    value={value ?? ""}
                    inputProps={{ step: 300 }}
                    sx={{
                        '& fieldset': { border: 'none' },
                        height: '100%',
                    }}
                    onChange={(e) => {
                        const timeStr = e.target.value || null;
                        api.setEditCellValue({ id, field, value: timeStr });
                    }}
                />
            </div>
        );
    }

    function buildInitialRowsForMonth() {
        const startOfMonth = dayjs(reportDate).startOf("month");
        const endOfMonth = dayjs(reportDate).endOf("month");

        const initialRows: ShiftRow[] = [];
        let d = startOfMonth;

        while (d.isBefore(endOfMonth) || d.isSame(endOfMonth, "day")) {
            if (d.day() !== 0) {
                const dateStr = d.format("YYYY-MM-DD");
                initialRows.push({
                    id: dateStr,
                    shiftDate: dateStr,
                    cookStartTime: null,
                    cookEndTime: null,
                    cookTotalHours: null,
                    managerStartTime: null,
                    managerEndTime: null,
                    managerTotalHours: null,
                    cookStaffIds: [],
                    managerStaffIds: [],
                });
            }
            d = d.add(1, "day");
        }
        return initialRows;
    }

    const cookTotal = useMemo(
        () => rows.reduce((acc, r) => acc + (r.cookTotalHours ?? 0), 0),
        [rows]
    );

    const managerTotal = useMemo(
        () => rows.reduce((acc, r) => acc + (r.managerTotalHours ?? 0), 0),
        [rows]
    );

    const formattedCookTotal = useMemo(() => cookTotal.toFixed(3), [cookTotal]);
    const formattedManagerTotal = useMemo(() => managerTotal.toFixed(3), [managerTotal]);

    useEffect(() => {
        let cancelled = false;

        if (!open) {
            isDataLoaded.current = false;
            return;
        }
        if (!branch) return;
        if (isDataLoaded.current) return;

        (async () => {
            try {
                setError(null);
                setLoading(true);

                const staff = await getStaffByBranch(branch.id.toString());
                if (!cancelled) setStaffOptions(staff);

                if (mode === "new") {
                    const initialRows = buildInitialRowsForMonth();
                    if (!cancelled) {
                        setRows(initialRows);
                        setTitle(`${dayjs(reportDate).format("MMM-YY")}-BH-${branch.branchName}`.toLowerCase());
                        isDataLoaded.current = true;
                    }
                } else {
                    if (shiftReportId === undefined) throw Error("Shift report ID is required");
                    const resp = await getShiftReport({id: shiftReportId});
                    if (!cancelled) {
                        setTitle(resp.title);
                        setRows(
                            resp.shifts.map((x, i) => ({
                                id: `r-${i}`,
                                shiftDate: x.shiftDate,
                                cookStartTime: x.cookStartTime ? x.cookStartTime.slice(0, 5) : null,
                                cookEndTime: x.cookEndTime ? x.cookEndTime.slice(0, 5) : null,
                                cookTotalHours: x.cookTotal,
                                managerStartTime: x.managerStartTime ? x.managerStartTime.slice(0, 5) : null,
                                managerEndTime: x.managerEndTime ? x.managerEndTime.slice(0, 5) : null,
                                managerTotalHours: x.managerTotal,
                                cookStaffIds: x.cookStaffIds ?? [],
                                managerStaffIds: x.managerStaffIds ?? [],
                            }))
                        );
                        isDataLoaded.current = true;
                    }
                }
            } catch (e: unknown) {
                if (!cancelled) {
                    const msg = e instanceof Error ? e.message : "Load failed";
                    console.error("[SHIFT REPORT] load error", e);
                    setError(msg);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [open, mode, shiftReportId, branch, reportDate]);

    function updateStaffIds(rowId: string, field: "cookStaffIds" | "managerStaffIds", ids: number[]) {
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: ids } : r));
    }

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            const rowsToSave: ShiftInfoTO[] = rows.map((row) => toShiftInfoTO(row));
            if (mode === "new") {
                const report: BaseShiftResponse = await createShiftReport({
                    title,
                    branchNo: branch.branchNo,
                    totalHours: Number(formattedCookTotal) + Number(formattedManagerTotal),
                    shifts: rowsToSave,
                });
                onSaved(report);
            } else {
                const report: BaseShiftResponse = await editShiftReport({
                    title,
                    id: shiftReportId!,
                    branchNo: branch.branchNo,
                    totalHours: Number(formattedCookTotal) + Number(formattedManagerTotal),
                    shifts: rowsToSave,
                });
                onSaved(report);
            }
            onClose();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Save failed";
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    function calculateTotalHours(row: ShiftRow): ShiftRow {
        const calcDuration = (startStr: string | null | undefined, endStr: string | null | undefined): number | null => {
            if (!startStr || !endStr) return null;
            const start = dayjs(startStr, "HH:mm");
            const end = dayjs(endStr, "HH:mm");
            if (!start.isValid() || !end.isValid()) return null;
            let diffInMinutes = end.diff(start, "minute");
            if (diffInMinutes < 0) diffInMinutes += 24 * 60;
            return Number((diffInMinutes / 60).toFixed(3));
        };

        return {
            ...row,
            cookTotalHours: calcDuration(row.cookStartTime, row.cookEndTime),
            managerTotalHours: calcDuration(row.managerStartTime, row.managerEndTime),
        };
    }

    function makeStaffSelectCell(
        options: StaffOption[],
        field: "cookStaffIds" | "managerStaffIds",
        isMgr: boolean
    ): GridColDef<ShiftRow>["renderCell"] {
        return (params) => {
            const numericValue: number[] = params.row[field] ?? [];
            const stringValue = numericValue.map(String);

            const handleChange = (e: SelectChangeEvent<string[]>) => {
                const selected = (e.target.value as string[]).map(Number);
                updateStaffIds(String(params.row.id), field, selected);
            };

            return (
                <Select<string[]>
                    multiple
                    displayEmpty
                    value={stringValue}
                    onChange={handleChange}
                    renderValue={(selected) =>
                        selected.length === 0 ? (
                            <Box sx={{ color: "text.disabled", fontSize: "0.85rem" }}>
                                {isMgr ? "Managers…" : "Cooks…"}
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                {selected.map((sid) => {
                                    const staff = options.find((s) => String(s.id) === sid);
                                    return (
                                        <Chip
                                            key={sid}
                                            label={staff?.username ?? sid}
                                            size="small"
                                            sx={isMgr ? { bgcolor: "#ffe5e5" } : undefined}
                                        />
                                    );
                                })}
                            </Box>
                        )
                    }
                    onClick={(e) => e.stopPropagation()}
                    size="small"
                    sx={{ width: "100%", "& fieldset": { border: "none" } }}
                >
                    {options.map((s) => (
                        <MenuItem key={s.id} value={String(s.id)}>
                            {s.username}
                        </MenuItem>
                    ))}
                </Select>
            );
        };
    }

    const columns = useMemo<GridColDef<ShiftRow>[]>(() => [
        {
            field: "shiftDate",
            headerName: "Shift Date",
            width: 120,
            renderCell: (params) => {
                const value = params.row.shiftDate;
                if (!value) return "";
                return dayjs(value).isValid() ? dayjs(value).format("DD.MM.YYYY") : String(value);
            },
        },
        {
            field: "cookStartTime",
            headerName: "Cook Start",
            width: 110,
            editable: true,
            renderCell: (params) => <span>{params.row.cookStartTime ?? ""}</span>,
            renderEditCell: (params) => <TimeEditCell {...params} />,
        },
        {
            field: "cookEndTime",
            headerName: "Cook End",
            width: 110,
            editable: true,
            renderCell: (params) => <span>{params.row.cookEndTime ?? ""}</span>,
            renderEditCell: (params) => <TimeEditCell {...params} />,
        },
        {
            field: "cookTotalHours",
            headerName: "Cook Hrs",
            width: 100,
            renderCell: (params) => {
                const value = params.row.cookTotalHours;
                return value != null ? Number(value).toFixed(2) : "";
            },
        },
        {
            field: "cookStaffIds",
            headerName: "Cooks",
            width: 220,
            renderCell: makeStaffSelectCell(cookOptions, "cookStaffIds", false),
        },
        {
            field: "managerStartTime",
            headerName: "Mgr Start",
            width: 110,
            editable: true,
            cellClassName: "manager-cell",
            headerClassName: "manager-cell-header",
            renderCell: (params) => <span>{params.row.managerStartTime ?? ""}</span>,
            renderEditCell: (params) => <TimeEditCell {...params} />,
        },
        {
            field: "managerEndTime",
            headerName: "Mgr End",
            width: 110,
            cellClassName: "manager-cell",
            headerClassName: "manager-cell-header",
            editable: true,
            renderCell: (params) => <span>{params.row.managerEndTime ?? ""}</span>,
            renderEditCell: (params) => <TimeEditCell {...params} />,
        },
        {
            field: "managerTotalHours",
            headerName: "Mgr Hrs",
            cellClassName: "manager-cell",
            headerClassName: "manager-cell-header",
            width: 100,
            renderCell: (params) => {
                const value = params.row.managerTotalHours;
                return value != null ? Number(value).toFixed(2) : "";
            },
        },
        {
            field: "managerStaffIds",
            headerName: "Managers",
            width: 220,
            cellClassName: "manager-cell",
            headerClassName: "manager-cell-header",
            renderCell: makeStaffSelectCell(managerOptions, "managerStaffIds", true),
        },
    ], [cookOptions, managerOptions]);

    return (
        <>
            <Dialog fullScreen open={open} onClose={onClose}
                    PaperProps={{sx: {bgcolor: "background.default", display: "flex", flexDirection: "column"}}}>

                <TableTopBar onClose={onClose} title={title} handleSave={handleSave} total={Number(formattedCookTotal)}
                             saving={saving} managerTotal={Number(formattedManagerTotal)} />

                {loading ? (
                    <Box sx={{display: "grid", placeItems: "center", flexGrow: 1}}>
                        <CircularProgress/>
                    </Box>
                ) : error ? (
                    <Box sx={{p: 2, flexGrow: 1}}>
                        <Alert severity="error">{error}</Alert>
                    </Box>
                ) : (
                    <Box sx={{flexGrow: 1, p: 1, height: "calc(100vh - 64px)"}}>
                        <DataGrid
                            rows={rows}
                            columns={columns}
                            getRowId={(row) => row.id}
                            processRowUpdate={(newRow) => {
                                const updatedRow = calculateTotalHours(newRow);
                                setRows(prev => prev.map(r => r.id === updatedRow.id ? updatedRow : r));
                                return updatedRow;
                            }}
                            disableRowSelectionOnClick
                            sx={{
                                height: "100%",
                                width: "100%",
                                "& .manager-cell": { backgroundColor: "#fff5f5" },
                                "& .manager-cell-header": { backgroundColor: "#fff5f5" },
                            }}
                        />
                    </Box>
                )}
            </Dialog>
        </>
    );
}
