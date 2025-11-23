import {SellsByDay} from "../management/types/statTypes";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import React, {useMemo} from "react";
import {Box} from "@mui/material";

type Props = {
    rawData: SellsByDay[];
}

const DAYS_OF_WEEK = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const transformDataForDataGrid = (backendData: any) => {

    if (!Array.isArray(backendData) || backendData.length === 0) {
        return { flatRows: [], maxAmount: 0 };
    }

    const allAmounts = backendData.flatMap(item =>
        Object.values(item.sellsByDay)
    ) as number[];

    const maxAmount = Math.max(...allAmounts, 0);

    const flatRows = backendData.map(item => ({
        id: item.Hour,
        label: `${String(item.Hour).padStart(2, '0')}:00`,
        ...item.sellsByDay,
    }));

    return { flatRows, maxAmount };
};

const getHeatmapColor = (amount, maxAmount) => {
    if (amount === 0) {
        return '#FFFFFF';
    }

    const normalized = maxAmount > 0 ? amount / maxAmount : 0;


    const lightness = 95 - (normalized * 50);

    return `hsl(10, 80%, ${lightness}%)`;
};

export function RevenueByHourTable({rawData}: Props) {

    const { flatRows, maxAmount } = useMemo(() =>
            transformDataForDataGrid(rawData),
        [rawData]
    );

    const createDayColumn = (field: string, headerName: string): GridColDef => ({
        field,
        headerName,
        width: 120,
        sortable: false,
        disableColumnMenu: true,
        align: 'center',
        type: 'number',
        headerAlign: 'center',
        renderCell: (params) => {
            const amount = params.value || 0;
            const color = getHeatmapColor(amount, maxAmount);

            return (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: color,
                        color: amount === 0 ? '#aaa' : '#000',
                        fontWeight: amount > 0 ? 'bold' : 'normal',
                        fontSize: '0.85rem',
                        border: '1px solid #eee'
                    }}
                >
                    {amount > 0 ? `BHD ${amount.toFixed(2)}` : ''}
                </Box>
            );
        },
    });

    const columns: GridColDef[] = [
        {
            field: 'label',
            headerName: 'Hour',
            width: 80,
            type: 'string',
            sortable: false,
            disableColumnMenu: true,
            align: 'center',
            headerAlign: 'center',
            cellClassName: 'time-label-cell',
        },
        ...DAYS_OF_WEEK.map(day => createDayColumn(day, day)),
    ];

    return (
        <Box sx={{ borderRadius: 3, width: '100%', boxShadow: 3, mt: 2}}>
            <DataGrid
                rows={flatRows}
                columns={columns}
                getRowId={(row) => row.id}
                hideFooter
                disableRowSelectionOnClick
                rowHeight={48}
                sx={{
                    borderRadius: 3,
                    "& .MuiDataGrid-columnHeaders": {
                        fontWeight: 700,
                    },
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
                    "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": {
                        outline: "none",
                    },
                    "& .MuiDataGrid-row:hover": {
                        backgroundColor: "transparent",
                    },
                }}
            />
        </Box>
    );
}