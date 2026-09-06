import React, {useState} from 'react';
import {Box, Button, CircularProgress, ToggleButton, ToggleButtonGroup} from '@mui/material';
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";
import {ConsumptionStatistics} from "../../consumption/components/ConsumptionStatistics";
import {DoughUsageTable} from "./DoughUsageTable";
import {ProductsTable} from "./ProductsTable";
import {VatReportCard} from "./VatReportCard";
import {StaffRoles, hasCityAccess} from "../../../auth/types";
import {StaffSummaryContent} from "../../shift/components/StaffSummaryContent";
import PrepPlanTable from "./PrepPlanTable";
import BusinessTab from "./business/BusinessTab";
import MonthRangePickerPopover from "./business/MonthRangePickerPopover";
import {useBusinessStats} from "../hooks/useBusinessStats";
import {PerformanceTab} from "./tabs/PerformanceTab";
import {useStatistics} from "../hooks/useStatistics";
import {DateRangePickerPopover} from "./performance/DateRangePickerPopover";
import {formatStatDate} from "./performance/statsFormat";
import {BranchSelectorComponent} from "../../_shared/components/BranchSelectorComponent";
import {BranchMultiSelectComponent} from "../../_shared/components/BranchMultiSelectComponent";
import {useBranchScope, useMultiBranchScope} from "../../_shared/hooks/useBranchScope";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import type {IBranch} from "../../inventory/types";

const BRAND = "#E44B4C";

interface StatisticsComponentProps {
    onClose: () => void;
    branchId: string;
    role: StaffRoles | null;
}

type StatsMode = "Performance" | "Business" | "Consumption" | "Pricing" | "Reports" | "Shifts";

export default function StatisticsComponent({onClose, branchId, role}: StatisticsComponentProps): JSX.Element {
    // StatisticsComponent only receives a raw branchId string (not the full IBranch the
    // other adapted screens get from AdminHomePage), so the scope fallback is built here --
    // display fields are never read off it, only .id, since it's used only when no
    // ManagementBranchScopeProvider is mounted (see useBranchScope's graceful fallback).
    const fallbackBranch: IBranch = {id: branchId, externalId: branchId, branchNo: 0, branchName: "", locale: ""};

    // One multi-select scope shared by Performance + Consumption (both render the same
    // filter-row control and Consumption's DoughUsageTable is fed by this same useStatistics
    // call), and one single-select scope shared by Reports + Shifts.
    const multiScope = useMultiBranchScope(fallbackBranch);
    const singleScope = useBranchScope(fallbackBranch);

    const {
        loading,
        globalStats,
        rangeStats,
        retentionStats,
        sellStats,
        doughUsage,
        dateRange,
        setDateRange,
        selectedDate,
        setSelectedDate,
        refresh,
    } = useStatistics(multiScope.selected.map(b => b.id));

    // Performance and Shifts share the same audience: a branch manager sees their own branch's
    // figures, a city-level role sees whichever branches they select.
    const canSeePerformance = role === StaffRoles.MANAGER || hasCityAccess(role);

    // Business Stats is the consolidated company P&L, owner withdrawals included, and it has no
    // branch dimension to scope it by -- so there is no version of it a branch manager could see
    // that is not the owner's full picture. Mirrors the OWNER-only SecurityConfig matcher; the
    // server is the real gate, this only keeps a tab nobody can use off the strip.
    const canSeeBusiness = role === StaffRoles.OWNER;
    const [mode, setMode] = useState<StatsMode>(canSeePerformance ? "Performance" : "Consumption");
    const [dateRangeAnchorEl, setDateRangeAnchorEl] = useState<HTMLElement | null>(null);
    const [monthRangeAnchorEl, setMonthRangeAnchorEl] = useState<HTMLElement | null>(null);

    // Fetches on mount rather than on tab selection: the tab strip is cheap to switch and a
    // report that reloads every time the owner glances away is worse than one extra request.
    const businessStats = useBusinessStats();

    const joinedConsumptionBranchIds = multiScope.selected.map(b => b.id).join(",");

    const showMultiBranchControl = (mode === "Performance" || mode === "Consumption") && multiScope.canSwitch;
    const showSingleBranchControl = (mode === "Reports" || mode === "Shifts") && singleScope.canSwitch;
    const showDateRangeButton = mode === "Performance";
    // Business Stats deliberately opts into NO branch control: it is a business-level report, and a
    // branch selector on it would be a lie. It takes a MONTH range instead of the day-grained
    // picker, because the report has no day grain at all.
    const showMonthRangeButton = mode === "Business";
    const showFilterRow = showMultiBranchControl || showSingleBranchControl
        || showDateRangeButton || showMonthRangeButton;

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden'}}>
            {loading && (
                <Box sx={{position: 'fixed', top: 64, right: 16, zIndex: 1500}}>
                    <CircularProgress size={24}/>
                </Box>
            )}

            <Box sx={{flexShrink: 0}}>
                <ManagementTopBar title="Statistics" onBack={onClose}/>
            </Box>

            <Box sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                p: 1,
                backgroundColor: "#fbfaf6"
            }}>
                <Box sx={{
                    px: 1, pt: 2, pb: 1,
                    flexShrink: 0,
                    backgroundColor: "#fbfaf6",
                    overflowX: 'auto',
                    whiteSpace: 'nowrap'
                }}>
                    <ToggleButtonGroup
                        exclusive
                        value={mode}
                        onChange={(_, v) => v && setMode(v)}
                        size="small"
                        sx={{
                            columnGap: 1,
                            '& .MuiToggleButtonGroup-grouped': {
                                border: '1px solid #e0e0e0',
                                borderRadius: 999,
                                margin: 0,
                                '&:not(:first-of-type)': {
                                    marginLeft: 0,
                                    borderLeft: '1px solid #e0e0e0',
                                },
                            },
                            '& .MuiToggleButton-root': {
                                textTransform: 'none',
                                px: 2,
                            },
                            '& .MuiToggleButton-root.Mui-selected': {
                                backgroundColor: '#E44B4C',
                                color: '#fff',
                                borderColor: '#E44B4C',
                                '&:hover': {backgroundColor: '#d23c3d', borderColor: '#d23c3d'},
                            },
                        }}
                    >
                        {canSeePerformance && (
                            <ToggleButton value="Performance">Performance</ToggleButton>
                        )}
                        {canSeeBusiness && (
                            <ToggleButton value="Business">Business</ToggleButton>
                        )}
                        <ToggleButton value="Consumption">Consumption</ToggleButton>
                        <ToggleButton value="Pricing">Pricing</ToggleButton>
                        <ToggleButton value="Reports">Reports</ToggleButton>
                        {(role === StaffRoles.MANAGER || hasCityAccess(role)) && (
                            <ToggleButton value="Shifts">Shifts</ToggleButton>
                        )}
                    </ToggleButtonGroup>
                </Box>

                {showFilterRow && (
                    <Box sx={{
                        px: 1, pb: 1,
                        flexShrink: 0,
                        backgroundColor: "#fbfaf6",
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 1,
                    }}>
                        {showMultiBranchControl && (
                            <BranchMultiSelectComponent
                                branches={multiScope.branches}
                                selected={multiScope.selected}
                                onSelectedChange={multiScope.setSelected}
                            />
                        )}
                        {showSingleBranchControl && (
                            <BranchSelectorComponent
                                branches={singleScope.branches}
                                selectedBranch={singleScope.branch}
                                onBranchChange={singleScope.setBranch}
                            />
                        )}
                        {showDateRangeButton && (
                            <>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<CalendarTodayRoundedIcon sx={{fontSize: 16}}/>}
                                    onClick={(e) => setDateRangeAnchorEl(e.currentTarget)}
                                    sx={{
                                        borderRadius: "9999px",
                                        textTransform: "none",
                                        fontWeight: 600,
                                        px: 1.75,
                                        height: 40,
                                        color: "text.primary",
                                        backgroundColor: "#fff",
                                        borderColor: "#e0e0e0",
                                        "&:hover": {borderColor: BRAND, backgroundColor: "#fff"},
                                    }}
                                >
                                    {formatStatDate(dateRange[0].startDate)} — {formatStatDate(dateRange[0].endDate)}
                                </Button>
                                <DateRangePickerPopover
                                    mode="range"
                                    id="date-range-popover"
                                    open={Boolean(dateRangeAnchorEl)}
                                    anchorEl={dateRangeAnchorEl}
                                    onClose={() => setDateRangeAnchorEl(null)}
                                    range={dateRange}
                                    onRangeChange={setDateRange}
                                    applyLabel="🔁 Refresh"
                                    onApply={() => {
                                        refresh();
                                        setDateRangeAnchorEl(null);
                                    }}
                                />
                            </>
                        )}
                        {showMonthRangeButton && (
                            <>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<CalendarTodayRoundedIcon sx={{fontSize: 16}}/>}
                                    onClick={(e) => setMonthRangeAnchorEl(e.currentTarget)}
                                    sx={{
                                        borderRadius: "9999px",
                                        textTransform: "none",
                                        fontWeight: 600,
                                        px: 1.75,
                                        height: 40,
                                        color: "text.primary",
                                        backgroundColor: "#fff",
                                        borderColor: "#e0e0e0",
                                        "&:hover": {borderColor: BRAND, backgroundColor: "#fff"},
                                    }}
                                >
                                    {businessStats.rangeLabel}
                                </Button>
                                <MonthRangePickerPopover
                                    open={Boolean(monthRangeAnchorEl)}
                                    anchorEl={monthRangeAnchorEl}
                                    range={businessStats.range}
                                    onRangeChange={businessStats.setRange}
                                    onClose={() => setMonthRangeAnchorEl(null)}
                                    onApply={() => {
                                        // No explicit refresh call: the hook refetches when the
                                        // yyyy-MM keys change, so applying an unchanged range
                                        // correctly does nothing.
                                        setMonthRangeAnchorEl(null);
                                    }}
                                />
                            </>
                        )}
                    </Box>
                )}

                <Box sx={{
                    flex: 1,
                    overflowY: "auto",
                    overscrollBehaviorY: 'contain',
                    p: 1,
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": {display: "none"},
                }}>
                    {mode === "Performance" && (
                        <PerformanceTab
                            rangeStats={rangeStats}
                            globalStats={globalStats}
                            retentionStats={retentionStats}
                            sellStats={sellStats}
                            selectedDate={selectedDate}
                            onSelectedDateChange={setSelectedDate}
                            onRefresh={refresh}
                        />
                    )}
                    {mode === "Business" && canSeeBusiness && (
                        <BusinessTab
                            data={businessStats.data}
                            loading={businessStats.loading}
                            rangeLabel={businessStats.rangeLabel}
                            onRefresh={businessStats.refresh}
                            onPatchChannel={businessStats.patchChannel}
                            onRegenerateChannels={businessStats.regenerateChannels}
                        />
                    )}
                    {mode === "Consumption" && (
                        <Box sx={{mt: 1}}>
                            <PrepPlanTable branchIds={multiScope.selected.map(b => b.id)}/>
                            <DoughUsageTable rows={doughUsage}/>
                            <Box sx={{mt: 1}}/>
                            <ConsumptionStatistics branchId={joinedConsumptionBranchIds}/>
                        </Box>
                    )}
                    {mode === "Reports" && <VatReportCard branchId={singleScope.branch.id}/>}
                    {mode === "Pricing" && <ProductsTable/>}
                    {mode === "Shifts" && <StaffSummaryContent branchId={singleScope.branch.id} role={role}/>}
                </Box>
            </Box>
        </Box>
    );
}
