import {TopFiveProducts} from "../types";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {Box} from "@mui/material";
import React from "react";
import {useTranslation} from "react-i18next";

type Props = {
    topProducts: TopFiveProducts[];
}

const ITEMS_PAGE_SIZE = 10;

function quantityColumn(field: keyof TopFiveProducts, headerName: string): GridColDef {
    return {
        field,
        headerName,
        width: 90,
        type: 'number',
        sortable: false,
        disableColumnMenu: true,
        align: 'left',
        headerAlign: 'left',
    };
}

// Every menu item, already sorted by total units descending server-side -- the grid only pages it.
export function TopProductsTable({ topProducts }: Props) {
    const {t} = useTranslation("statistics");

    const columns: GridColDef[] = [
        {
            field: 'name',
            headerName: t("items.name"),
            flex: 1,
            minWidth: 160,
            type: 'string',
            sortable: false,
            disableColumnMenu: true,
            align: 'left',
            headerAlign: 'left',
        },
        quantityColumn('singleQuantity', t("items.single")),
        quantityColumn('comboQuantity', t("items.combo")),
        quantityColumn('quantity', t("items.total")),
    ];

    return (
        <Box sx={{ borderRadius: 3, width: '100%', boxShadow: 3}}>
            <DataGrid
                rows={topProducts || []}
                getRowId={(row) => row.name}

                columns={columns}
                pageSizeOptions={[ITEMS_PAGE_SIZE]}
                initialState={{pagination: {paginationModel: {pageSize: ITEMS_PAGE_SIZE}}}}
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
