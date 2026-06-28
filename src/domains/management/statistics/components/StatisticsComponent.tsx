import React, {useState} from 'react';
import {Box, CircularProgress, ToggleButton, ToggleButtonGroup} from '@mui/material';
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";
import {ConsumptionStatistics} from "../../consumption/components/ConsumptionStatistics";
import {DoughUsageTable} from "./DoughUsageTable";
import {ProductsTable} from "./ProductsTable";
import {VatReportCard} from "./VatReportCard";
import {StaffRoles} from "../../../auth/types";
import {StaffSummaryContent} from "../../shift/components/StaffSummaryContent";
import PrepPlanTable from "./PrepPlanTable";
import {PerformanceTab} from "./tabs/PerformanceTab";
import {useStatistics} from "../hooks/useStatistics";

interface StatisticsComponentProps {
    onClose: () => void;
    branchId: string;
    role: StaffRoles | null;
}

export default function StatisticsComponent({onClose, branchId, role}: StatisticsComponentProps): JSX.Element {
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
    } = useStatistics(branchId);

    const [mode, setMode] = useState(role === StaffRoles.SUPER_MANAGER ? "Performance" : "Consumption");

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
                        {role === StaffRoles.SUPER_MANAGER && (
                            <ToggleButton value="Performance">Performance</ToggleButton>
                        )}
                        <ToggleButton value="Consumption">Consumption</ToggleButton>
                        <ToggleButton value="Pricing">Pricing</ToggleButton>
                        <ToggleButton value="Reports">Reports</ToggleButton>
                        {(role === StaffRoles.MANAGER || role === StaffRoles.SUPER_MANAGER) && (
                            <ToggleButton value="Shifts">Shifts</ToggleButton>
                        )}
                    </ToggleButtonGroup>
                </Box>

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
                            dateRange={dateRange}
                            selectedDate={selectedDate}
                            onRangeChange={setDateRange}
                            onSelectedDateChange={setSelectedDate}
                            onRefresh={refresh}
                        />
                    )}
                    {mode === "Consumption" && (
                        <Box sx={{mt: 1}}>
                            <PrepPlanTable branchId={branchId}/>
                            <DoughUsageTable rows={doughUsage}/>
                            <Box sx={{mt: 1}}/>
                            <ConsumptionStatistics branchId={branchId.toString()}/>
                        </Box>
                    )}
                    {mode === "Reports" && <VatReportCard branchId={branchId}/>}
                    {mode === "Pricing" && <ProductsTable/>}
                    {mode === "Shifts" && <StaffSummaryContent branchId={branchId}/>}
                </Box>
            </Box>
        </Box>
    );
}
