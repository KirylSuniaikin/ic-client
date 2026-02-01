import {IBranch} from "../management/types/inventoryTypes";
import {FormControl, InputLabel, MenuItem, Select} from "@mui/material";

type Props = {
    branches: IBranch[],
    selectedBranch: IBranch,
    onBranchChange: (selectedBranch: IBranch) => void,
}

const colorRed = '#E44B4C';

export function BranchSelectorComponent({branches, selectedBranch, onBranchChange}: Props) {
    return (
        <FormControl size="small" sx={{ minWidth: 100, borderColor: colorRed }}>
            <InputLabel>Branch</InputLabel>
            <Select
                value={selectedBranch?.id || ""}
                onChange={(e) => {
                    const newBranch = branches.find(b => b.id === e.target.value);
                    onBranchChange(newBranch);
                }}
                label="Branch"
                sx={{
                    borderRadius: "9999px",
                    fontWeight: 500,
                }}
            >
                {branches.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                        {b.branchName}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )

}