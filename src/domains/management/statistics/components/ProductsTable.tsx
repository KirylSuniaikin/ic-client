import React, {useMemo, useState} from "react";
import {DataGrid, GridColDef, GridFilterModel, GridRenderCellParams} from "@mui/x-data-grid";
import {ProductStatRow} from "../types";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    InputAdornment,
    MenuItem,
    Select,
    Switch,
    TextField,
    Typography
} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import {isManagerRole, StaffRoles} from "../../../auth/types";
import {findVendorName, hasUnknownTopVendor, useProductCatalog} from "../hooks/useProductCatalog";
import type {ProductSettingsPatch} from "../hooks/useProductCatalog";
import type {ProductTO} from "../../inventory/types";
import type {VendorTO} from "../../purchases/types";
import CreateProductSheet from "../../_shared/components/CreateProductSheet";
import {BRAND_SWITCH_SX, roundedMenuProps} from "../../_shared/components/roundedSelect";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import {formatUnit, MEASURE_UNITS} from "../../../../shared/utils/unitFormat";
import {BRAND_RED} from "../../../../shared/utils/theme";

type Props = {
    /** Create and the inline settings are MANAGER / SUPER_MANAGER / OWNER only, like the server. */
    role: StaffRoles | null;
    /** Called with exactly the fields that changed, after the server accepted an inline edit. */
    onSettingsSaved?: (changed: ProductSettingsPatch) => void;
};

// The per-row save lock rides on the row, not on the column definitions: a new columns array makes
// DataGrid re-apply every coded width, which would undo a column the user had resized on each save.
type GridProductRow = ProductStatRow & { saving: boolean };

type SettingsCellContext = {
    canEdit: boolean;
    vendors: VendorTO[];
    updateSettings: (id: number, patch: ProductSettingsPatch) => Promise<void>;
};

const cellSelectSx = {
    fontSize: "0.875rem",
    fontWeight: 600,
    "& .MuiSelect-select": {py: 0.5},
} as const;

const addButtonSx = {
    borderRadius: 999,
    textTransform: "none",
    fontWeight: 700,
    color: BRAND_RED,
    borderColor: BRAND_RED,
    whiteSpace: "nowrap",
    "&:hover": {borderColor: BRAND_RED, bgcolor: `${BRAND_RED}14`},
} as const;

/**
 * Keystrokes and clicks inside an inline control belong to the control. React events bubble out
 * of a Select's portalled menu through the component tree, so without this the grid's own cell
 * keyboard navigation also receives them -- an arrow key in an open menu would move the grid's
 * focus instead of the highlighted option.
 */
function CellControl({children}: { children: React.ReactNode }): React.JSX.Element {
    return (
        <Box
            onKeyDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            sx={{display: "flex", alignItems: "center", height: "100%", width: "100%"}}
        >
            {children}
        </Box>
    );
}

function unknownVendorLabel(name: string): string {
    return `${name} (unknown vendor)`;
}

function buildColumns({canEdit, vendors, updateSettings}: SettingsCellContext): GridColDef<GridProductRow>[] {
    const locked = (row: GridProductRow): boolean => !canEdit || row.saving;

    const switchColumn = (
        field: "isPurchasable" | "isInventory",
        headerName: string,
        width: number,
    ): GridColDef<GridProductRow> => ({
        field,
        headerName,
        width,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: 'left',
        headerAlign: 'left',
        renderCell: ({row}: GridRenderCellParams<GridProductRow>) => (
            <CellControl>
                <Switch
                    size="small"
                    checked={row[field]}
                    disabled={locked(row)}
                    onChange={(_, checked) => void updateSettings(row.id, {[field]: checked})}
                    slotProps={{input: {"aria-label": `${headerName}: ${row.name}`}}}
                    sx={BRAND_SWITCH_SX}
                />
            </CellControl>
        ),
    });

    return [
        {
            field: 'name',
            headerName: 'Product Name',
            width: 180,
            type: 'string',
            sortable: false,
            disableColumnMenu: true,
            align: 'left',
            headerAlign: 'left',
        },
        {
            field: 'price',
            headerName: 'Current Price',
            width: 120,
            type: 'number',
            sortable: false,
            disableColumnMenu: true,
            align: 'left',
            headerAlign: 'left',
        },
        {
            field: 'targetPrice',
            headerName: 'Target Price',
            width: 120,
            type: 'number',
            sortable: false,
            disableColumnMenu: true,
            align: 'left',
            headerAlign: 'left',
        },
        {
            field: 'unit',
            headerName: 'Unit',
            width: 90,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            align: 'left',
            headerAlign: 'left',
            renderCell: ({row}: GridRenderCellParams<GridProductRow>) => (
                <CellControl>
                    {/* A legacy row may have no unit yet; it shows a dash, and there is no option
                        to go back to none -- a unit can be set, never cleared from here. */}
                    <Select<string>
                        variant="standard"
                        disableUnderline
                        fullWidth
                        displayEmpty
                        value={row.unit ?? ""}
                        disabled={locked(row)}
                        onChange={(e) => {
                            const unit = MEASURE_UNITS.find(u => u === e.target.value);
                            if (unit) void updateSettings(row.id, {unit});
                        }}
                        renderValue={(value) => value === "" ? "—" : formatUnit(value)}
                        inputProps={{"aria-label": `Unit: ${row.name}`}}
                        MenuProps={roundedMenuProps()}
                        sx={cellSelectSx}
                    >
                        {MEASURE_UNITS.map(u => (
                            <MenuItem key={u} value={u}>{formatUnit(u)}</MenuItem>
                        ))}
                    </Select>
                </CellControl>
            ),
        },
        {
            field: 'topVendor',
            headerName: 'Top vendor',
            width: 170,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            align: 'left',
            headerAlign: 'left',
            renderCell: ({row}: GridRenderCellParams<GridProductRow>) => {
                const canonical = findVendorName(row.topVendor, vendors);
                // A hand-backfilled name that matches no vendor is still shown, rather than silently
                // reading as "None" -- but marked, and not offered as a choice: it is kept only
                // until someone picks a real vendor or None.
                const unmatched = !canonical && row.topVendor && row.topVendor.trim() !== "" ? row.topVendor : null;
                const unknown = hasUnknownTopVendor(row.topVendor, vendors);
                return (
                    <CellControl>
                        <Select<string>
                            variant="standard"
                            disableUnderline
                            fullWidth
                            displayEmpty
                            value={canonical ?? unmatched ?? ""}
                            disabled={locked(row)}
                            onChange={(e) => void updateSettings(row.id, {
                                topVendor: e.target.value === "" ? null : e.target.value,
                            })}
                            renderValue={(value) => {
                                if (value === "") return "—";
                                return unknown && value === unmatched ? unknownVendorLabel(value) : value;
                            }}
                            inputProps={{"aria-label": `Top vendor: ${row.name}`}}
                            MenuProps={roundedMenuProps()}
                            sx={unknown ? {...cellSelectSx, color: "error.main"} : cellSelectSx}
                        >
                            <MenuItem value="">None</MenuItem>
                            {unmatched && (
                                <MenuItem value={unmatched} disabled={unknown}>
                                    {unknown ? unknownVendorLabel(unmatched) : unmatched}
                                </MenuItem>
                            )}
                            {vendors.map(v => (
                                <MenuItem key={v.id} value={v.vendorName}>{v.vendorName}</MenuItem>
                            ))}
                        </Select>
                    </CellControl>
                );
            },
        },
        switchColumn('isPurchasable', 'Purchasable', 115),
        switchColumn('isInventory', 'Inventory', 105),
    ];
}

export function ProductsTable({role, onSettingsSaved}: Props) {
    const canEdit = isManagerRole(role);
    const {
        rows,
        vendors,
        loading,
        loadError,
        savingIds,
        saveError,
        clearSaveError,
        updateSettings,
        addProduct,
    } = useProductCatalog({onSettingsSaved});
    const [filterModel, setFilterModel] = useState<GridFilterModel>({items: []})
    const [createOpen, setCreateOpen] = useState<boolean>(false);
    const [createdName, setCreatedName] = useState<string | null>(null);

    const columns = useMemo(
        () => buildColumns({canEdit, vendors, updateSettings}),
        [canEdit, vendors, updateSettings],
    );
    const gridRows = useMemo<GridProductRow[]>(
        () => rows.map(r => ({...r, saving: savingIds.has(r.id)})),
        [rows, savingIds],
    );

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

    const handleCreated = (product: ProductTO): void => {
        addProduct(product);
        setCreateOpen(false);
        setCreatedName(product.name);
    };

    return (
        <>
            {loadError && (
                <Alert severity="error">{loadError}</Alert>
            )}

            {loading && (
                <Box sx={{position: 'fixed', top: 64, right: 16, zIndex: 1500}}>
                    <CircularProgress size={24}/>
                </Box>
            )}
            <Box sx={{display: "flex", flexDirection: "column", gap: 1, mt: 1}}>
                <Card sx={{borderRadius: 3, boxShadow: 3}}>
                    <Box
                        sx={{
                            p: 2
                        }}
                    >
                        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1}}>
                            <Typography variant="h6">
                                <b>Products</b>
                            </Typography>
                            {canEdit && (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<AddRoundedIcon/>}
                                    onClick={() => setCreateOpen(true)}
                                    data-testid="add-product"
                                    sx={addButtonSx}
                                >
                                    Add product
                                </Button>
                            )}
                        </Box>
                        <TextField
                            variant="outlined"
                            size="small"
                            placeholder="Type to filter"
                            onChange={handleFilterParamChange}
                            fullWidth
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: '#a5a5a5' }} />
                                    </InputAdornment>
                                ),
                            }}
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
                        <Box sx={{flex: 1, minHeight: 0}}>
                            <DataGrid rows={gridRows}
                                      columns={columns}
                                      disableRowSelectionOnClick
                                      filterModel={filterModel}
                                      onFilterModelChange={setFilterModel}
                                      initialState={{pagination: {paginationModel: {pageSize: 25}}}}
                            />
                        </Box>
                    </CardContent>
                </Card>
            </Box>

            {canEdit && (
                <CreateProductSheet
                    open={createOpen}
                    vendors={vendors}
                    existingProducts={rows}
                    onCreated={handleCreated}
                    onClose={() => setCreateOpen(false)}
                />
            )}

            <ErrorSnackbar
                open={saveError !== null}
                severity="error"
                message={saveError ?? ""}
                handleClose={clearSaveError}
                duration={6000}
            />
            <ErrorSnackbar
                open={createdName !== null}
                severity="success"
                message={`Added “${createdName ?? ""}”`}
                handleClose={() => setCreatedName(null)}
            />
        </>
    )
}
