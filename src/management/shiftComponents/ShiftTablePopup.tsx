import {IBranch} from "../types/inventoryTypes";
import React, {useEffect, useMemo, useState} from "react";
import dayjs from "dayjs";
import {BaseShiftResponse, ShiftInfoTO, ShiftRow} from "../types/shiftTypes";
import {
    createShiftReport,
    editShiftReport,
    getShiftReport
} from "../api/api";
import {Alert, Box, CircularProgress, Dialog, TextField} from "@mui/material";
import {TableTopBar} from "./TableTopBar";
import {toShiftInfoTO} from "../mappers/shiftMapper";
import {
    DataGrid,
    GridColDef, GridRenderEditCellParams
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
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                        api.setEditCellValue({
                            id,
                            field,
                            value: timeStr,
                        });
                    }}
                />
            </div>
        );
    }

    function buildInitialRowsForMonth() {
        const startOfMonth = dayjs(reportDate).startOf("month");
        const endOfMonth = dayjs(reportDate).endOf("month");

        const rows: ShiftRow[] = [];
        let d = startOfMonth;

        while (d.isBefore(endOfMonth) || d.isSame(endOfMonth, "day")) {
            if (d.day() !== 0) {
                const dateStr = d.format("YYYY-MM-DD");

                rows.push({
                    id: dateStr,
                    shiftDate: dateStr,
                    cookStartTime: null,
                    cookEndTime: null,
                    cookTotalHours: null,
                    managerStartTime: null,
                    managerEndTime: null,
                    managerTotalHours: null,
                });
            }
            d = d.add(1, "day");
        }
        return rows;
    }

    const cookTotal = useMemo(
        () =>
            rows.reduce((acc, r) => acc + (r.cookTotalHours ?? 0), 0),
        [rows]
    );

    const managerTotal = useMemo(
        () =>
            rows.reduce((acc, r) => acc + (r.managerTotalHours ?? 0), 0),
        [rows]
    );

    const formattedCookTotal = useMemo(
        () => cookTotal.toFixed(3),
        [cookTotal]
    );

    const formattedManagerTotal = useMemo(
        () => managerTotal.toFixed(3),
        [managerTotal]
    );

    useEffect(() => {
        let cancelled = false;

        if (!open) return;
        if (!branch) return;

        (async () => {
            try {
                setError(null);
                setLoading(true);

                if (mode === "new") {
                    const initialRows = buildInitialRowsForMonth();
                    if (!cancelled) {
                        setRows(initialRows);
                        setTitle(
                            `${dayjs(reportDate).format("MMM-YY")}-BH-${branch.branchName}`

                                .toLowerCase()
                        );
                    }
                } else {
                    if (shiftReportId === undefined) {
                        throw Error("Purchase ID is required");
                    }
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
                            }))
                        );
                    }
                }
            } catch (e: any) {
                if (!cancelled) {
                    console.error("[SHIFT REPORT] load error", e);
                    setError(e?.message ?? "Load failed");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, mode, shiftReportId, branch, reportDate]);

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            const rowsToSave: ShiftInfoTO[] = rows.map((row) => toShiftInfoTO(row))
            if (mode === "new") {
                const report: BaseShiftResponse = await createShiftReport({
                    title: title,
                    branchNo: branch.branchNo,
                    totalHours: Number(formattedCookTotal) + Number(formattedManagerTotal),
                    shifts: rowsToSave
                });
                console.log("[SHIFT REPORT] Created new shift report: {}", report);
                onSaved(report);
            } else {
                const report: BaseShiftResponse = await editShiftReport({
                    title: title,
                    id: shiftReportId!,
                    branchNo: branch.branchNo,
                    totalHours: Number(formattedCookTotal) + Number(formattedManagerTotal),
                    shifts: rowsToSave
                })
                console.log("[SHIFT REPORT] Edited shift report: {}", report);
                onSaved(report);
            }
            onClose();
        } catch (e: any) {
            setError(e?.message ?? "Save failed");
        } finally {
            setSaving(false);
        }
    }

    function calculateTotalHours(row: ShiftRow): ShiftRow {
        const calcDuration = (startStr: string | null | undefined, endStr: string | null | undefined): number | null => {
            if (!startStr || !endStr) return null;

            const start = dayjs(startStr, "HH:mm");
            const end = dayjs(endStr, "HH:mm");

            if (!start.isValid() || !end.isValid()) return null;

            let diffInMinutes = end.diff(start, "minute");

            if (diffInMinutes < 0) {
                diffInMinutes += 24 * 60;
            }

            return Number((diffInMinutes / 60).toFixed(3));
        };

        const cookTotalHours = calcDuration(row.cookStartTime, row.cookEndTime);
        const managerTotalHours = calcDuration(row.managerStartTime, row.managerEndTime);

        return {
            ...row,
            cookTotalHours: cookTotalHours,
            managerTotalHours: managerTotalHours,
        };
    }




    const columns: GridColDef<ShiftRow>[] = [
        {
            field: "shiftDate",
            headerName: "Shift Date",
            width: 150,
            renderCell: (params: any) => {
                const value = params.row.shiftDate;
                if (!value) return "";
                return dayjs(value).isValid()
                    ? dayjs(value).format("DD.MM.YYYY")
                    : String(value);
            },
        },
        {
            field: "cookStartTime",
            headerName: "Shift Start",
            width: 130,
            editable: true,
            renderCell: (params: any) => <span>{params.row.cookStartTime ?? ""}</span>,
            renderEditCell: (params) => <TimeEditCell {...params} />,
        },
        {
            field: "cookEndTime",
            headerName: "Shift End",
            width: 130,
            editable: true,
            renderCell: (params: any) => <span>{params.row.cookEndTime ?? ""}</span>,
            renderEditCell: (params) => <TimeEditCell {...params} />,
        },
        {
            field: "cookTotalHours",
            headerName: "Total Hours",
            width: 130,
            renderCell: (params: any) => {
                const value = params.row.cookTotalHours as number | null | undefined;
                return value != null ? Number(value).toFixed(2) : "";
            },
        },
        {
            field: "managerStartTime",
            headerName: "Manager Shift Start",
            width: 200,
            editable: true,
            cellClassName: 'manager-cell',
            headerClassName: 'manager-cell-header',
            renderCell: (params: any) => <span>{params.row.managerStartTime ?? ""}</span>,
            renderEditCell: (params) => <TimeEditCell {...params} />,
        },
        {
            field: "managerEndTime",
            headerName: "Manager Shift End",
            width: 200,
            cellClassName: 'manager-cell',
            headerClassName: 'manager-cell-header',
            editable: true,
            renderCell: (params: any) => <span>{params.row.managerEndTime ?? ""}</span>,
            renderEditCell: (params) => <TimeEditCell {...params} />,
        },
        {
            field: "managerTotalHours",
            headerName: "Manager Total Hours",
            cellClassName: 'manager-cell',
            headerClassName: 'manager-cell-header',
            width: 200,
            renderCell: (params: any) => {
                const value = params.row.managerTotalHours as number | null | undefined;
                return value != null ? Number(value).toFixed(2) : "";
            },
        },
    ];


    return (
        <>
            <Dialog fullScreen open={open} onClose={onClose}
                    PaperProps={{sx: {bgcolor: "background.default", display: 'flex', flexDirection: 'column'}}}>

                <TableTopBar onClose={onClose} title={title} handleSave={handleSave} total={Number(formattedCookTotal)}
                             saving={saving} managerTotal={managerTotal} />

                {loading ? (
                    <Box sx={{display: "grid", placeItems: "center", flexGrow: 1}}>
                        <CircularProgress/>
                    </Box>
                ) : error ? (
                    <Box sx={{p: 2, flexGrow: 1}}>
                        <Alert severity="error">{error}</Alert>
                    </Box>
                ) : (

                    <Box sx={{flexGrow: 1, p: 1, height: 'calc(100vh - 64px)'}}>
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
                            sx={{height: '100%',
                                width: '100%',
                                '& .manager-cell': {
                                    backgroundColor: "#fff5f5",
                                },
                                '& .manager-cell-header': {
                                    backgroundColor: "#fff5f5",
                                }
                            }}
                        />
                    </Box>
                )}
            </Dialog>
        </>
    )
}