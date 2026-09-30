import * as React from "react";
import { Box, ButtonBase } from "@mui/material";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
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
    /** Sorts on click. Ignored for a filterable column, whose click opens the filter instead. */
    onSort?: () => void;
    filter?: HeaderFilterConfig;
}

/**
 * The content of one `<th>` with ONE click target. A plain column sorts on click; a filterable
 * column opens its filter popover on click, and that popover carries the sort buttons too.
 */
export function ColumnHeaderFilter({ label, testId, sortState, onSort, filter }: Props): React.JSX.Element {
    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
    const sorted = sortState.dir !== null;
    const highlighted = sorted || (filter?.active ?? false);

    return (
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
            <ButtonBase
                data-testid={filter ? filter.testId : testId}
                aria-label={filter?.ariaLabel}
                data-active={filter ? (filter.active ? "true" : "false") : undefined}
                onClick={filter ? (e) => setAnchorEl(e.currentTarget) : onSort}
                sx={{
                    fontWeight: "bold",
                    fontSize: "inherit",
                    fontFamily: "inherit",
                    color: highlighted ? BRAND_RED : "text.secondary",
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
            {filter?.children({
                open: anchorEl !== null,
                anchorEl,
                onClose: () => setAnchorEl(null),
            })}
        </Box>
    );
}
