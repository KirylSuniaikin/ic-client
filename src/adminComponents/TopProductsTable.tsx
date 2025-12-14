import {TopProduct} from "../management/types/statTypes";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {Box} from "@mui/material";
import React from "react";

type Props = {
    topProducts: TopProduct[];
}

export function TopProductsTable({ topProducts }: Props) {

    const columns: GridColDef[] = [
        {
            field: 'name',
            headerName: 'Item Name',
            width: 200,
            type: 'string',
            sortable: false,
            disableColumnMenu: true,
            align: 'left',
            headerAlign: 'left',
        },
        {
            field: 'quantity',
            headerName: 'Quantity',
            width: 150,
            type: 'number',
            sortable: false,
            disableColumnMenu: true,
            align: 'left',
            headerAlign: 'left',
        }
    ];

    return (
        <Box sx={{ borderRadius: 3, width: '100%', boxShadow: 3}}>
            <DataGrid
                rows={topProducts || []}
                getRowId={(row) => row.name}

                columns={columns}
                hideFooter
                disableRowSelectionOnClick
                sx={{
                    borderRadius: 3,
                    pt: 1,
                    "& .MuiDataGrid-columnHeaders": { fontWeight: 700 },
                    "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover" },
                }}
            />
        </Box>
    )
}