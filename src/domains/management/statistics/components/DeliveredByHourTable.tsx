import React, {useMemo} from "react";
import {Box} from "@mui/material";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {DAYS_OF_WEEK, buildDeliveryHourGrid, heatmapColor} from "../utils/deliveryHourGrid";
import type {DeliveryHourCell} from "../utils/deliveryHourGrid";
import type {DeliveryHourBucket} from "../types";

type Props = {
    buckets: DeliveryHourBucket[];
};

/**
 * What delivery actually sold, per weekday and hour.
 *
 * Every cell carries BOTH the money and the order count, never just the money. A cell holding
 * 200 BHD from four orders and one holding 200 BHD from twenty are opposite operational
 * situations — the first is fine, the second is the hour that needs another rider — and a
 * revenue-only heatmap cannot tell them apart.
 *
 * The hour is the hour the food ARRIVED (`delivered_at`), not the hour the order was placed:
 * the question this grid answers is when riders are under load.
 */
export function DeliveredByHourTable({buckets}: Props): JSX.Element {
    const {rows, maxTotal} = useMemo(() => buildDeliveryHourGrid(buckets), [buckets]);

    const columns: GridColDef[] = [
        {
            field: "label",
            headerName: "Hour",
            width: 80,
            type: "string",
            sortable: false,
            disableColumnMenu: true,
            align: "center",
            headerAlign: "center",
            cellClassName: "time-label-cell",
        },
        ...DAYS_OF_WEEK.map((day): GridColDef => ({
            field: day,
            headerName: day,
            width: 120,
            sortable: false,
            disableColumnMenu: true,
            align: "center",
            headerAlign: "center",
            // Deliberately not `type: 'number'`: the cell value is a {total, count} pair, and
            // declaring it numeric would have the grid try to sort and format an object.
            renderCell: (params) => {
                const cell = params.value as DeliveryHourCell | undefined;
                const total = cell?.total ?? 0;
                return (
                    <Box
                        sx={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: heatmapColor(total, maxTotal),
                            color: cell === undefined ? "#aaa" : "#000",
                            fontWeight: cell === undefined ? "normal" : "bold",
                            fontSize: "0.8rem",
                            lineHeight: 1.2,
                            border: "1px solid #eee",
                        }}
                    >
                        {cell !== undefined && (
                            <>
                                <span>BHD {cell.total.toFixed(2)}</span>
                                {/* The count is what stops the money being read on its own. */}
                                <span style={{fontWeight: 400, color: "#6b635b"}}>{cell.count} orders</span>
                            </>
                        )}
                    </Box>
                );
            },
        })),
    ];

    return (
        <Box sx={{borderRadius: 3, width: "100%", boxShadow: 3, mt: 2}}>
            <DataGrid
                rows={rows}
                columns={columns}
                getRowId={(row) => row.id}
                hideFooter
                disableRowSelectionOnClick
                rowHeight={56}
                sx={{
                    borderRadius: 3,
                    "& .MuiDataGrid-columnHeaders": {fontWeight: 700},
                    "& .MuiDataGrid-cell": {
                        padding: 0,
                        display: "flex",
                        alignItems: "stretch",
                        justifyContent: "stretch",
                    },
                    "& .time-label-cell": {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 500,
                    },
                    "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": {outline: "none"},
                    "& .MuiDataGrid-row:hover": {backgroundColor: "transparent"},
                }}
            />
        </Box>
    );
}
