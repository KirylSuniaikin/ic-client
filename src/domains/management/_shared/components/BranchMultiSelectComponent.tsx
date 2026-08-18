import * as React from "react";
import { Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { IBranch } from "../../inventory/types";

type Props = {
    branches: IBranch[];
    selected: IBranch[];
    onSelectedChange: (selected: IBranch[]) => void;
};

const colorRed = "#E44B4C";

function renderSelectedLabel(selected: IBranch[], totalBranchCount: number): string {
    if (selected.length === 1) return selected[0].branchName;
    if (selected.length === totalBranchCount) return "All branches";
    return `${selected.length} branches`;
}

// Sibling of BranchSelectorComponent (not a modification of it -- that one has a
// non-nullable single-IBranch in/out contract across 3 call sites). Never allows an
// empty selection: re-selecting the last remaining branch is a no-op.
export function BranchMultiSelectComponent({ branches, selected, onSelectedChange }: Props): React.JSX.Element {
    const handleChange = (e: SelectChangeEvent<string[]>): void => {
        const rawValue = e.target.value;
        const ids = typeof rawValue === "string" ? rawValue.split(",") : rawValue;
        const nextSelected = branches.filter(b => ids.includes(b.id));
        if (nextSelected.length === 0) return;
        onSelectedChange(nextSelected);
    };

    return (
        <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel sx={{ "&.Mui-focused": { color: colorRed } }}>Branch</InputLabel>
            <Select<string[]>
                multiple
                value={selected.map(b => b.id)}
                onChange={handleChange}
                label="Branch"
                renderValue={() => renderSelectedLabel(selected, branches.length)}
                MenuProps={{ PaperProps: { sx: { borderRadius: 3, mt: 0.5 } } }}
                sx={{
                    borderRadius: "9999px",
                    fontWeight: 600,
                    backgroundColor: "#fff",
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#e0e0e0" },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: colorRed },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: colorRed, borderWidth: 1 },
                }}
            >
                {branches.map((b) => (
                    <MenuItem key={b.id} value={b.id} sx={{ py: 0.25 }}>
                        <Checkbox
                            size="small"
                            checked={selected.some(s => s.id === b.id)}
                            sx={{ color: "#bdbdbd", "&.Mui-checked": { color: colorRed } }}
                        />
                        <ListItemText
                            primary={b.branchName}
                            primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: 500 }}
                        />
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
