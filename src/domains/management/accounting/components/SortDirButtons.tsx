import * as React from "react";
import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { BRAND_RED } from "../../../../shared/utils/theme";
import type { SortDir } from "../entryView";

export interface PopoverSort {
    dir: SortDir | null;
    /** Picking the active direction again turns the sort off. */
    onSelect: (dir: SortDir) => void;
}

/** The sort half of a filter popover: a filterable column's header label opens the popover, so sorting lives here. */
export function SortDirButtons({ dir, onSelect }: PopoverSort): React.JSX.Element {
    return (
        <Box sx={{ mb: 1.5 }}>
            <ToggleButtonGroup exclusive size="small" fullWidth value={dir} aria-label="Sort">
                {(["asc", "desc"] as const).map((d) => (
                    <ToggleButton
                        key={d}
                        value={d}
                        data-testid={`sort-${d}`}
                        // onClick rather than the group's onChange: an exclusive group reports null on a re-click, and that re-click must turn the sort off.
                        onClick={() => onSelect(d)}
                        sx={{ textTransform: "none", "&.Mui-selected": { color: BRAND_RED } }}
                    >
                        {d === "asc" ? "A → Z" : "Z → A"}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>
        </Box>
    );
}
