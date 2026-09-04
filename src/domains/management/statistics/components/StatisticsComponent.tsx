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
import {PerformanceTab} from "./tabs/PerformanceTab";
import {DeliveryTab} from "./tabs/DeliveryTab";
import {useStatistics} from "../hooks/useStatistics";
import {DateRangePickerPopover} from "./performance/DateRangePickerPopover";
import {formatStatDate, formatStatRange} from "./performance/statsFormat";
import {BranchSelectorComponent} from "../../_shared/components/BranchSelectorComponent";
import {BranchMultiSelectComponent, renderSelectedLabel} from "../../_shared/components/BranchMultiSelectComponent";
import {useBranchScope, useMultiBranchScope} from "../../_shared/hooks/useBranchScope";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import type {IBranch} from "../../inventory/types";

const BRAND = "#E44B4C";

interface StatisticsComponentProps {
    onClose: () => void;
    branchId: string;
    role: StaffRoles | null;
}

type StatsMode = "Performance" | "Delivery" | "Consumption" | "Pricing" | "Reports" | "Shifts";

export default function StatisticsComponent({onClose, branchId, role}: StatisticsComponentProps): JSX.Element {
    // StatisticsComponent only receives a raw branchId string (not the full IBranch the
    // other adapted screens get from AdminHomePage), so the scope fallback is built here --
    // display fields are never read off it, only .id, since it's used only when no
    // ManagementBranchScopeProvider is mounted (see useBranchScope's graceful fallback).
    const fallbackBranch: IBranch = {id: branchId, externalId: branchId, branchNo: 0, branchName: "", locale: "", latitude: null, longitude: null};

    // One multi-select scope shared by Performance + Consumption (both render the same
    // filter-row control and Consumption's DoughUsageTable is fed by this same useStatistics
    // call), and one single-select scope shared by Reports + Shifts.
    const multiScope = useMultiBranchScope(fallbackBranch);
    const singleScope = useBranchScope(fallbackBranch);

    // Computed BEFORE useStatistics: it also decides whether the delivery fetches are worth
    // making, and /api/management/delivery/** is MANAGER-and-up.
    // Performance, Delivery and Shifts share the same audience: a branch manager sees their own
    // branch's figures, a city-level role sees whichever branches they select.
    const canSeePerformance = role === StaffRoles.MANAGER || hasCityAccess(role);

    const {
        loading,
        globalStats,
        rangeStats,
        retentionStats,
        sellStats,
        doughUsage,
        deliveryAvailability,
        deliveryStatsScope,
        deliveryHourly,
        deliveryEstimateAccuracy,
        deliverySkipReasons,
        deliveryChainScope,
        dateRange,
        setDateRange,
        selectedDate,
        setSelectedDate,
        refresh,
    } = useStatistics(multiScope.selected.map(b => b.id), canSeePerformance);

    const [mode, setMode] = useState<StatsMode>(canSeePerformance ? "Performance" : "Consumption");
    const [dateRangeAnchorEl, setDateRangeAnchorEl] = useState<HTMLElement | null>(null);

    const joinedConsumptionBranchIds = multiScope.selected.map(b => b.id).join(",");

    /**
     * What the availability card pins in its header, so two readings of the same figure can be
     * told apart.
     *
     * The two halves come from different places on purpose. The DATES come from the hook, which
     * records the range it actually fetched with — the picker's own range runs ahead of the data
     * until Refresh is pressed. The BRANCHES come from the live selection, which cannot run ahead:
     * changing it refetches. `renderSelectedLabel` is the branch control's own wording, reused so
     * the header and the control above it cannot drift apart.
     */
    const availabilityScope = deliveryStatsScope === null ? null : {
        branches: renderSelectedLabel(multiScope.selected, multiScope.branches.length),
        range: formatStatRange(deliveryStatsScope.startDate, deliveryStatsScope.finishDate),
    };

    /**
     * The applied range behind the two chain-wide delivery cards.
     *
     * Same rule as `availabilityScope` and for the same reason — it comes from the range the hook
     * actually fetched with, never from the picker, which runs ahead of the data until Refresh is
     * pressed. It carries no branch half at all: those two endpoints are called without a branch
     * filter, so naming the selected branches beside their numbers would be a straight lie.
     */
    const deliveryChainRange = deliveryChainScope === null
        ? null
        : formatStatRange(deliveryChainScope.startDate, deliveryChainScope.finishDate);

    const showMultiBranchControl =
        (mode === "Performance" || mode === "Delivery" || mode === "Consumption") && multiScope.canSwitch;
    const showSingleBranchControl = (mode === "Reports" || mode === "Shifts") && singleScope.canSwitch;
    // Delivery reads the same range as Performance -- both grids are fetched by the same
    // refresh, so hiding the picker on one of them would leave a range nobody could change.
    const showDateRangeButton = mode === "Performance" || mode === "Delivery";
    const showFilterRow = showMultiBranchControl || showSingleBranchControl || showDateRangeButton;

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
                        {/* Same gate as Performance, and not a cosmetic one: every endpoint
                            behind this tab is /api/management/delivery/**, which is
                            MANAGER-and-up. */}
                        {canSeePerformance && (
                            <ToggleButton value="Delivery">Delivery</ToggleButton>
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
                            deliveryAvailability={deliveryAvailability}
                            deliveryAvailabilityScope={availabilityScope}
                            selectedDate={selectedDate}
                            onSelectedDateChange={setSelectedDate}
                            onRefresh={refresh}
                        />
                    )}
                    {mode === "Delivery" && (
                        <DeliveryTab
                            hourly={deliveryHourly}
                            availability={deliveryAvailability}
                            availabilityScope={availabilityScope}
                            estimateAccuracy={deliveryEstimateAccuracy}
                            skipReasons={deliverySkipReasons}
                            chainRange={deliveryChainRange}
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
                    {mode === "Shifts" && <StaffSummaryContent branchId={singleScope.branch.id}/>}
                </Box>
            </Box>
        </Box>
    );
}
