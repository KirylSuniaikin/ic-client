import * as React from "react";
import { Box, ButtonBase, IconButton } from "@mui/material";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import { BRAND_RED } from "../../../../shared/utils/theme";
import type { SortDir } from "../entryView";

export interface HeaderSortState {
    dir: SortDir | null;
    /** 1-based position among the active sorts. */
    priority: number | null;
    /** Only worth showing once two or more columns are sorted. */
    showBadge: boolean;
}

export interface PopoverControl {
    open: boolean;
    anchorEl: HTMLElement | null;
    onClose: () => void;
}

export interface HeaderFilterConfig {
    active: boolean;
    ariaLabel: string;
    testId: string;
    /** Renders the popover; the header owns only the open state and the anchor. */
    children: (popover: PopoverControl) => React.ReactNode;
}

interface Props {
    label: string;
    testId: string;
    sortState: HeaderSortState;
    onSort: () => void;
    filter?: HeaderFilterConfig;
}

/**
 * The content of one sortable/filterable `<th>`. Two separate click targets on purpose: the label
 * sorts, the funnel opens the filter — a single target could not do both without a hidden mode.
 */
export function ColumnHeaderFilter({ label, testId, sortState, onSort, filter }: Props): React.JSX.Element {
    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
    const sorted = sortState.dir !== null;

    return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
            <ButtonBase
                data-testid={testId}
                onClick={onSort}
                sx={{
                    fontWeight: "bold",
                    fontSize: "inherit",
                    fontFamily: "inherit",
                    color: sorted ? BRAND_RED : "text.secondary",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.25,
                    borderRadius: 1,
                    px: 0.5,
                }}
            >
                {label}
                {sortState.dir === "asc" && <ArrowUpwardRoundedIcon sx={{ fontSize: 16 }} />}
                {sortState.dir === "desc" && <ArrowDownwardRoundedIcon sx={{ fontSize: 16 }} />}
                {sortState.showBadge && sortState.priority !== null && (
                    <Box
                        component="span"
                        data-testid={`${testId}-badge`}
                        sx={{
                            minWidth: 16,
                            height: 16,
                            borderRadius: "9999px",
                            bgcolor: BRAND_RED,
                            color: "common.white",
                            fontSize: 10,
                            lineHeight: "16px",
                            textAlign: "center",
                        }}
                    >
                        {sortState.priority}
                    </Box>
                )}
            </ButtonBase>
            {filter && (
                <>
                    <IconButton
                        size="small"
                        data-testid={filter.testId}
                        aria-label={filter.ariaLabel}
                        data-active={filter.active ? "true" : "false"}
                        onClick={(e) => setAnchorEl(e.currentTarget)}
                        sx={{ color: filter.active ? BRAND_RED : "text.disabled", p: 0.25 }}
                    >
                        <FilterListRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    {filter.children({
                        open: anchorEl !== null,
                        anchorEl,
                        onClose: () => setAnchorEl(null),
                    })}
                </>
            )}
        </Box>
    );
}
