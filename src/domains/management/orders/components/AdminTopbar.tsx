import { logger } from "../../../../shared/utils/logger";
import {
    Box,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    useMediaQuery, useTheme
} from "@mui/material";
import {useState} from "react";
import MenuIcon from "@mui/icons-material/Menu";
import {updateWorkload} from "../../../../shared/api/public";
import {BranchSelectorComponent} from "../../_shared/components/BranchSelectorComponent";
import {ShiftButton} from "../../shift/components/ShiftButton";
import AdminNavDrawer from "../../_shared/components/AdminNavDrawer";
import {StaffRoles, hasCityAccess} from "../../../auth/types";
import type { StaffRoles as StaffRolesType } from '../../../auth/types';
import type { WorkloadLevel } from '../../../order/types';
import type { IBranch } from '../../inventory/types';

interface AdminTopbarProps {
    onOpenHistory: () => void;
    onOpenStatistics: () => void;
    onOpenConfig: () => void;
    onGoToMenu: () => void;
    branchId: string;
    workloadLevel: WorkloadLevel | null;
    onWorkloadChange?: (level: WorkloadLevel) => void;
    adminId: number;
    onPurchaseOpen: () => void;
    onManagementPageOpen: () => void;
    cashStage: string;
    onShiftManagementPageOpen: () => void;
    shiftStage: string;
    // stage is optional because ShiftButton calls onClick() with no args;
    // mobile code calls it with a stage arg — using optional to satisfy both usages
    onCashClick: (stage?: string) => void;
    onShiftStageClick: (stage?: string) => void;
    branches?: IBranch[];
    onBranchChange: (selectedBranch: IBranch) => void;
    selectedBranch: IBranch | null;
    onBlacklistopen: () => void;
    onCashRegisterOpen: () => void;
    onAccountingOpen: () => void;
    role: StaffRolesType | null;
    logout: () => void;
    userName: string;
}

export default function AdminTopbar({
                                        onOpenHistory,
                                        onOpenStatistics,
                                        onOpenConfig,
                                        onGoToMenu,
                                        branchId,
                                        workloadLevel,
                                        onWorkloadChange,
                                        adminId,
                                        onPurchaseOpen,
                                        onManagementPageOpen,
                                        cashStage,
                                        onShiftManagementPageOpen,
                                        shiftStage,
                                        onCashClick,
                                        onShiftStageClick,
                                        branches = [],
                                        onBranchChange,
                                        selectedBranch,
                                        onBlacklistopen,
                                        onCashRegisterOpen,
                                        onAccountingOpen,
                                        role,
                                        logout,
                                        userName
                                    }: AdminTopbarProps): JSX.Element {
    const [navOpen, setNavOpen] = useState<boolean>(false);
    const theme = useTheme();
    const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'xl'));
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

    const colorRed = '#E44B4C';

    const getCashStage = (stage: string): string => {
        switch (stage) {
            case "OPEN_SHIFT_CASH_CHECK":
                return "Open Cash";
            case "CLOSE_SHIFT_CASH_CHECK":
                return "Close Cash";
            default:
                return "Error cash";
        }
    }

    const getShiftStage = (stage: string): string => {
        switch (stage) {
            case "OPEN_SHIFT_EVENT":
                return "Open Shift";
            case "CLOSE_SHIFT_EVENT":
                return "Close Shift";
            default:
                return "Error";
        }
    }

    const isReviewer = role === StaffRoles.REVIEWER;

    const levels: WorkloadLevel[] = ["IDLE", "BUSY", "CROWDED", "RUSH", "HEAVY_RUSH", "SLAMMED", "OVERLOADED"];

    const getWorkloadData = (workload: WorkloadLevel): string => {
        switch (workload) {
            case "IDLE":
                return "+0"
            case "BUSY":
                return "+10"
            case "CROWDED":
                return "+20"
            case "RUSH":
                return "+30"
            case "HEAVY_RUSH":
                return "+40"
            case "SLAMMED":
                return "+50"
            case "OVERLOADED":
                return "+60"
            default:
                return ""
        }
    }

    async function handleChangeWorkloadLevel(event: SelectChangeEvent): Promise<void> {
        const newLevel = event.target.value as WorkloadLevel;
        onWorkloadChange?.(newLevel);
        try {
            await updateWorkload({branchId, newLevel});
        } catch (err) {
            logger.error("Failed to update workload:", err);
        }
    }

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                backgroundColor: "#fbfaf6",
                gap: 1,
                px: 1,
                py: 1,
                borderBottom: "1px solid #ddd",
                position: "sticky",
                top: 0,
                zIndex: 10
            }}
        >
            <Box sx={{flexGrow: 1}}/>

            <Box sx={{display: "flex", gap: 1, alignItems: "center"}}>

                {hasCityAccess(role) && (
                    <BranchSelectorComponent
                        branches={branches}
                        onBranchChange={onBranchChange}
                        selectedBranch={selectedBranch}
                    ></BranchSelectorComponent>
                )}

                {/* Workload, Cash and Shift all mutate branch state, and the backend 403s a
                    REVIEWER on every one of them. Hide rather than let them fail on click. */}
                {!isReviewer && (
                    <FormControl size="small" sx={{minWidth: 80, borderColor: colorRed}}>
                        <InputLabel>Workload</InputLabel>
                        <Select
                            value={workloadLevel ?? "IDLE"}
                            onChange={handleChangeWorkloadLevel}
                            label="Workload"
                            sx={{
                                borderRadius: "9999px",
                                border: colorRed,
                                fontWeight: 500,
                                textTransform: "capitalize",
                            }}
                        >
                            {levels.map((lvl) => (
                                <MenuItem key={lvl} value={lvl}>
                                    {getWorkloadData(lvl)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}

                {!isMobile && !isReviewer && (
                    <>
                        <ShiftButton
                            onClick={onCashClick}
                            stage={cashStage}
                            getStage={(stage) => getCashStage(stage)}
                        ></ShiftButton>

                        <ShiftButton
                            onClick={onShiftStageClick}
                            stage={shiftStage}
                            getStage={getShiftStage}
                        ></ShiftButton>
                    </>
                )}

                <IconButton
                    onClick={() => setNavOpen(true)}
                    size="small"
                    sx={{
                        border: "1px solid #E44B4C",
                        borderRadius: "999px",
                        padding: "4px 10px",
                        color: colorRed,
                        height: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        '&:hover': {
                            backgroundColor: "#fff5f5",
                            borderColor: colorRed,
                        }
                    }}
                >
                    <MenuIcon sx={{fontSize: "16px"}}/>
                </IconButton>

                <AdminNavDrawer
                    open={navOpen}
                    onClose={() => setNavOpen(false)}
                    role={role}
                    userName={userName}
                    cashStage={cashStage}
                    shiftStage={shiftStage}
                    onCashClick={onCashClick}
                    onShiftStageClick={onShiftStageClick}
                    getCashStage={getCashStage}
                    getShiftStage={getShiftStage}
                    handlers={{
                        onGoToMenu,
                        onShiftManagementPageOpen,
                        onOpenHistory,
                        onOpenConfig,
                        onOpenStatistics,
                        onManagementPageOpen,
                        onPurchaseOpen,
                        onCashRegisterOpen,
                        onAccountingOpen,
                        onBlacklistopen,
                        logout,
                    }}
                />
            </Box>
        </Box>
    );
}
