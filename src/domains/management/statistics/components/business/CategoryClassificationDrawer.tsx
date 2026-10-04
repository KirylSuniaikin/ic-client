import React from "react";
import {
    Box, Chip, Drawer, FormControl, InputLabel, MenuItem, Select, Stack, Typography
} from "@mui/material";
import type {CategoryClassification, KpiTag, PnlClass} from "../../types";
import type {CategoryClassificationPatch} from "../../hooks/useBusinessCategories";
import {
    formatBd, KPI_TAG_LABELS, KPI_TAGS, PNL_CLASS_HINTS, PNL_CLASS_LABELS, PNL_CLASSES
} from "./businessFormat";
import {BRAND_RED} from "../../../../../shared/utils/theme";
import ErrorSnackbar from "../../../../../shared/components/ErrorSnackbar";

type Props = {
    open: boolean;
    /** The rows as last changed on this client: a pick shows here before the server answers. */
    categories: CategoryClassification[];
    savingIds: ReadonlySet<number>;
    saveError: string | null;
    onDismissSaveError: () => void;
    onClose: () => void;
    /** Only the field that was picked: the owner of the rows fills in the other from its latest copy. */
    onChange: (id: number, patch: CategoryClassificationPatch) => void;
};

/**
 * Assigns each accounting category its place in the P&L.
 *
 * <p>This is the gate for the whole report: until every category carries a class, that spend sits in
 * an "Unclassified" block and no P&L line below Gross Profit can be trusted. The server returns the
 * rows already ordered — unclassified first, then heaviest lifetime spend first — so the list is
 * rendered in received order and deliberately NOT re-sorted here; re-sorting on each edit would make
 * rows jump out from under the finger mid-triage.
 *
 * <p>Saves per row rather than in bulk, so one failure costs one row instead of the whole session.
 * A row's pickers are locked while its save is in flight, and a refused save puts the row back.
 */
export default function CategoryClassificationDrawer(
    {open, categories, savingIds, saveError, onDismissSaveError, onClose, onChange}: Props
): React.JSX.Element {
    const unclassified = categories.filter(c => c.pnlClass === null).length;

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{zIndex: 1350}}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: {sm: 720},
                    mx: {sm: 'auto'},
                    maxHeight: '85dvh',
                    overflowY: 'auto',
                }
            }}
        >
            <Box sx={{p: 3, pb: 4}}>
                <Box sx={{width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2, mx: 'auto', mb: 2}}/>

                <Typography variant="h6" fontWeight="bold" sx={{textAlign: 'center'}}>
                    🧾 Category classification
                </Typography>

                <Typography variant="body2" sx={{color: '#8a807a', textAlign: 'center', mt: 1, mb: 1}}>
                    {unclassified === 0
                        ? "Everything is classified."
                        : `${unclassified} still unclassified — their spend sits outside every P&L total.`}
                </Typography>

                {/* Said out loud because it is true and surprising: classification is read through a
                    join at query time, so one change here rewrites every month of the report. */}
                <Typography variant="caption" sx={{display: 'block', color: '#8a807a', textAlign: 'center', mb: 2}}>
                    Changing a class rewrites this category's history in every month of the report.
                </Typography>

                <Stack spacing={2}>
                    {categories.map(row => (
                        <Box
                            key={row.id}
                            data-testid={`category-row-${row.id}`}
                            aria-busy={savingIds.has(row.id)}
                            sx={{
                                border: '1px solid #f1eae4',
                                borderRadius: 3,
                                p: 2,
                                opacity: savingIds.has(row.id) ? 0.6 : 1,
                                backgroundColor: row.pnlClass === null ? '#FCE9E9' : '#fff',
                            }}
                        >
                            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5}}>
                                <Typography fontWeight="bold" sx={{color: '#3b352c'}}>{row.name}</Typography>
                                <Chip
                                    size="small"
                                    label={row.type}
                                    sx={{backgroundColor: '#f1eae4', color: '#8a807a'}}
                                />
                                {row.pnlClass === null && (
                                    <Chip
                                        size="small"
                                        label="Unclassified"
                                        sx={{backgroundColor: BRAND_RED, color: '#fff'}}
                                    />
                                )}
                                <Typography variant="caption" sx={{color: '#8a807a', ml: 'auto'}}>
                                    {formatBd(row.lifetimeTotal)} BHD · {row.entryCount} entries
                                </Typography>
                            </Box>

                            <Stack direction={{xs: 'column', sm: 'row'}} spacing={2}>
                                <FormControl size="small" fullWidth disabled={savingIds.has(row.id)}>
                                    <InputLabel id={`pnl-${row.id}`}>P&L class</InputLabel>
                                    <Select<PnlClass | "">
                                        labelId={`pnl-${row.id}`}
                                        label="P&L class"
                                        value={row.pnlClass ?? ""}
                                        onChange={e => {
                                            const v = e.target.value;
                                            onChange(row.id, {pnlClass: v === "" ? null : v});
                                        }}
                                    >
                                        <MenuItem value="">Unclassified</MenuItem>
                                        {PNL_CLASSES.map(c => (
                                            <MenuItem key={c} value={c}>{PNL_CLASS_LABELS[c]}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl size="small" fullWidth disabled={savingIds.has(row.id)}>
                                    <InputLabel id={`kpi-${row.id}`}>KPI tag</InputLabel>
                                    <Select<KpiTag | "">
                                        labelId={`kpi-${row.id}`}
                                        label="KPI tag"
                                        value={row.kpiTag ?? ""}
                                        onChange={e => {
                                            const v = e.target.value;
                                            onChange(row.id, {kpiTag: v === "" ? null : v});
                                        }}
                                    >
                                        <MenuItem value="">None</MenuItem>
                                        {KPI_TAGS.map(t => (
                                            <MenuItem key={t} value={t}>{KPI_TAG_LABELS[t]}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Stack>

                            {row.pnlClass !== null && (
                                <Typography variant="caption" sx={{display: 'block', color: '#8a807a', mt: 1}}>
                                    {PNL_CLASS_HINTS[row.pnlClass]}
                                </Typography>
                            )}
                        </Box>
                    ))}
                </Stack>
            </Box>

            {/* Inside the sheet rather than beside it: the open drawer hides everything outside
                its portal from assistive tech, and this is where the owner is looking. */}
            <ErrorSnackbar
                open={saveError !== null}
                severity="error"
                message={saveError ?? ""}
                handleClose={onDismissSaveError}
                duration={6000}
            />
        </Drawer>
    );
}
