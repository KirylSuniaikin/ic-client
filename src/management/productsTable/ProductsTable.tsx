import React, {useEffect, useState} from "react";
import {DataGrid, GridColDef, GridFilterModel} from "@mui/x-data-grid";
import {fetchProducts} from "../api/api";
import {ProductStatRow} from "../types/productStatRow";
import {productTOConverter} from "../mappers/mapper";
import {Alert, Box, Card, CardContent, CircularProgress, TextField, Typography} from "@mui/material";

export function ProductsTable() {
    const [rows, setRows] = useState<ProductStatRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filterModel, setFilterModel] = useState<GridFilterModel>({items: []})

    const columns: GridColDef[] = [
        {
            field: 'name',
            headerName: 'Product Name',
            width: 200,
            type: 'string',
            sortable: false,
            disableColumnMenu: true,
            align: 'left',
            headerAlign: 'left',
        },
        {
            field: 'price',
            headerName: 'Current Price',
            width: 150,
            type: 'number',
            sortable: false,
            disableColumnMenu: true,
            align: 'left',
            headerAlign: 'left',
        },
        {
            field: 'targetPrice',
            headerName: 'Target Price',
            width: 150,
            type: 'number',
            sortable: false,
            disableColumnMenu: true,
            align: 'left',
            headerAlign: 'left',
        }
    ];

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const productsResponse = await fetchProducts();
                setRows(productTOConverter(productsResponse));
            } catch (error: any) {
                setError(error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const handleFilterParamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFilterModel({
            items: value ? [{
                id: 0,
                field: "name",
                operator: "contains",
                value: value
            }] : []
        });
    };


    return (
        <>
            {error && (
                <Alert severity="error">{error}</Alert>
            )}

            {loading && (
                <Box sx={{position: 'fixed', top: 64, right: 16, zIndex: 1500}}>
                    <CircularProgress size={24}/>
                </Box>
            )}
            <Box sx={{display: "flex", flexDirection: "column", gap: 1}}>
                <Card sx={{borderRadius: 3, boxShadow: 3}}>
                    <Box
                        sx={{
                            p: 2
                        }}
                    >
                        <TextField
                            variant="outlined"
                            size="small"
                            label="Filter by product name"
                            placeholder="Type to filter"
                            onChange={handleFilterParamChange}
                            fullWidth
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 3,
                                    borderColor: '#a5a5a5',

                                    '& fieldset': {borderColor: '#a5a5a5'},
                                    '&:hover fieldset': {borderColor: '#a5a5a5'},
                                    '&.Mui-focused fieldset': {
                                        borderColor: '#a5a5a5'
                                    },
                                    '&.Mui-disabled fieldset': {borderColor: '#a5a5a5'}
                                },
                                '& .MuiInputLabel-root': {
                                    color: '#6b7280',
                                },

                                '& .MuiInputBase-input': {py: 1, px: 1.5},
                            }}
                        />
                    </Box>
                    <CardContent>

                        <Typography variant="h6" sx={{mb: 1}}>
                            Products
                        </Typography>

                        <Box sx={{flex: 1, minHeight: 0}}>
                            <DataGrid rows={rows.map((r) => ({id: r.id, ...r}))}
                                      columns={columns}
                                      disableRowSelectionOnClick
                                      editMode="row"
                                      onRowEditStop={() => setRows((r) => [...r])}
                                      onProcessRowUpdateError={(err) => setError(String(err))}
                                      filterModel={filterModel}
                                      onFilterModelChange={setFilterModel}
                                      initialState={{pagination: {paginationModel: {pageSize: 25}}}}
                            />
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        </>
    )
}