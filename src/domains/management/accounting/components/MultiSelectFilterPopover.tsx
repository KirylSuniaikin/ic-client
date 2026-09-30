import * as React from "react";
import { Box, Checkbox, FormControlLabel, Popover, TextField, Typography } from "@mui/material";
import { BRAND_RED } from "../../../../shared/utils/theme";
import { SortDirButtons } from "./SortDirButtons";
import type { PopoverSort } from "./SortDirButtons";

// Same chrome as statistics' DateRangePickerPopover so the two filter families read as one.
export const FILTER_POPOVER_PAPER_SX = { borderRadius: 3, mt: 0.5, boxShadow: 6 } as const;

export interface FilterOption<V extends string | number> {
    value: V;
    label: string;
}

interface Props<V extends string | number> {
    open: boolean;
    anchorEl: HTMLElement | null;
    onClose: () => void;
    options: FilterOption<V>[];
    selected: readonly V[];
    onToggle: (value: V) => void;
    searchable?: boolean;
    sort?: PopoverSort;
}

export function MultiSelectFilterPopover<V extends string | number>({
    open,
    anchorEl,
    onClose,
    options,
    selected,
    onToggle,
    searchable = false,
    sort,
}: Props<V>): React.JSX.Element {
    const [query, setQuery] = React.useState("");
    // Narrows what is LISTED only — a selected option that the search hides stays selected.
    const needle = query.trim().toLowerCase();
    const visible = needle === "" ? options : options.filter((o) => o.label.toLowerCase().includes(needle));

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            slotProps={{ paper: { sx: FILTER_POPOVER_PAPER_SX } }}
        >
            <Box sx={{ p: 2, minWidth: 220, maxHeight: 360, overflowY: "auto" }}>
                {sort && <SortDirButtons {...sort} />}
                {searchable && (
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Search…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        inputProps={{ "aria-label": "Search options" }}
                        sx={{ mb: 1 }}
                    />
                )}
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                    {visible.map((o) => (
                        <FormControlLabel
                            key={String(o.value)}
                            label={o.label}
                            control={
                                <Checkbox
                                    size="small"
                                    checked={selected.includes(o.value)}
                                    onChange={() => onToggle(o.value)}
                                    sx={{ "&.Mui-checked": { color: BRAND_RED } }}
                                />
                            }
                        />
                    ))}
                    {visible.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                            No matches
                        </Typography>
                    )}
                </Box>
            </Box>
        </Popover>
    );
}
