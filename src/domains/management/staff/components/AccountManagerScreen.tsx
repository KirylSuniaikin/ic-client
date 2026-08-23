import * as React from "react";
import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Chip,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import { logger } from "../../../../shared/utils/logger";
import { useAuth } from "../../../auth/context/AuthProvider";
import { StaffRoles } from "../../../auth/types";
import type { IBranch } from "../../inventory/types";
import { BranchSelectorComponent } from "../../_shared/components/BranchSelectorComponent";
import { useBranchScope } from "../../_shared/hooks/useBranchScope";
import { useStaffAccounts } from "../hooks/useStaffAccounts";
import { canAdministerStaff } from "../types";
import type { StaffAdminTO } from "../types";
import HireStaffDrawer from "./HireStaffDrawer";
import ResetPasswordDrawer from "./ResetPasswordDrawer";
import DeactivateStaffDialog from "./DeactivateStaffDialog";

const colorRed = "#E44B4C";

export interface AccountManagerScreenProps {
    role: StaffRoles | null;
    branch: IBranch;
}

export default function AccountManagerScreen({ role, branch }: AccountManagerScreenProps): React.JSX.Element {
    const { userId } = useAuth();
    // canSwitch is branches.length > 1, not a role check -- useAdminBranchInit already hands a
    // non-city role a one-element array, so this is the role gate for free. Same shape as
    // InventoryPage / CashRegisterPopup / HistoryComponent.
    const { branches, branch: scopedBranch, setBranch: setScopedBranch, canSwitch } = useBranchScope(branch);
    const { staff, loading, error, create, resetPassword, setEnabled } = useStaffAccounts(scopedBranch.id);

    const [hireOpen, setHireOpen] = useState(false);
    const [resetTarget, setResetTarget] = useState<StaffAdminTO | null>(null);
    const [deactivateTarget, setDeactivateTarget] = useState<StaffAdminTO | null>(null);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [showDeactivated, setShowDeactivated] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const isOwnerViewer = role === StaffRoles.OWNER;

    // Mirror the hook's error into local snackbar state, same pattern as TaskBoardScreen.tsx.
    useEffect(() => {
        if (error) setErrorMessage(error);
    }, [error]);

    // Filtered here rather than server-side: the roster is one branch's staff, the caller may
    // already see every row, and toggling the filter then costs no refetch that could race the
    // branch selector.
    const visibleStaff = showDeactivated ? staff : staff.filter(s => s.enabled);

    const applyEnabled = async (target: StaffAdminTO, enabled: boolean): Promise<void> => {
        setTogglingId(target.id);
        try {
            await setEnabled(target.id, enabled);
            setDeactivateTarget(null);
        } catch (err) {
            logger.error("Failed to change staff account state:", err);
            setErrorMessage(err instanceof Error ? err.message : "Failed to update the account");
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <Box sx={{ p: 2, backgroundColor: "#fbfaf6", minHeight: "100vh" }} data-testid="account-manager-screen">
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
                <Typography variant="h6" fontWeight="bold">Account Manager</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    {canSwitch && (
                        <BranchSelectorComponent
                            branches={branches}
                            selectedBranch={scopedBranch}
                            onBranchChange={setScopedBranch}
                        />
                    )}
                    <Button
                        variant="contained"
                        onClick={() => setHireOpen(true)}
                        sx={{ borderRadius: 3, bgcolor: colorRed, "&:hover": { bgcolor: "#c73c3d" } }}
                        data-testid="staff-hire-button"
                    >
                        Hire
                    </Button>
                </Stack>
            </Box>

            <ToggleButtonGroup
                exclusive
                size="small"
                value={showDeactivated ? "all" : "active"}
                onChange={(_, v: string | null) => v && setShowDeactivated(v === "all")}
                sx={{
                    mb: 2,
                    columnGap: 1,
                    "& .MuiToggleButtonGroup-grouped": {
                        border: "1px solid #e0e0e0",
                        borderRadius: 999,
                        margin: 0,
                        "&:not(:first-of-type)": { marginLeft: 0, borderLeft: "1px solid #e0e0e0" },
                    },
                    "& .MuiToggleButton-root": {
                        textTransform: "none",
                        px: 2,
                        backgroundColor: "#fff",
                        "&:hover": { backgroundColor: "#f4f2ed" },
                    },
                    "& .MuiToggleButton-root.Mui-selected": {
                        backgroundColor: colorRed,
                        color: "#fff",
                        borderColor: colorRed,
                        "&:hover": { backgroundColor: "#d23c3d", borderColor: "#d23c3d" },
                    },
                }}
            >
                <ToggleButton value="active" data-testid="staff-filter-active">Active</ToggleButton>
                <ToggleButton value="all" data-testid="staff-filter-all">All</ToggleButton>
            </ToggleButtonGroup>

            <TableContainer>
                <Table size="small" data-testid="staff-list">
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Login</TableCell>
                            <TableCell>Role</TableCell>
                            {isOwnerViewer && <TableCell>Price/hour</TableCell>}
                            <TableCell sx={{ width: 96 }} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleStaff.map(s => {
                            const administrable = canAdministerStaff(role, userId ?? null, s);
                            return (
                                <TableRow
                                    key={s.id}
                                    data-testid={`staff-row-${s.id}`}
                                    sx={{ opacity: s.enabled ? 1 : 0.55 }}
                                >
                                    <TableCell>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <span>{s.fullName ?? s.username}</span>
                                            {!s.enabled && (
                                                <Chip size="small" label="Deactivated" data-testid={`staff-deactivated-chip-${s.id}`} />
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell>{s.username}</TableCell>
                                    <TableCell>{s.role}</TableCell>
                                    {isOwnerViewer && (
                                        <TableCell>{s.pricePerHour !== null ? s.pricePerHour : ""}</TableCell>
                                    )}
                                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                                        {administrable && (
                                            <Stack direction="row" spacing={0.25}>
                                                <Tooltip title="Reset password">
                                                    <IconButton
                                                        size="small"
                                                        aria-label="Reset password"
                                                        onClick={() => setResetTarget(s)}
                                                        data-testid={`staff-reset-${s.id}`}
                                                    >
                                                        <LockResetIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                {s.enabled ? (
                                                    <Tooltip title="Deactivate account">
                                                        <IconButton
                                                            size="small"
                                                            aria-label="Deactivate account"
                                                            onClick={() => setDeactivateTarget(s)}
                                                            data-testid={`staff-deactivate-${s.id}`}
                                                        >
                                                            <BlockIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                ) : (
                                                    // Reactivation is not destructive, so it fires
                                                    // directly -- the dialog stays single-purpose.
                                                    <Tooltip title="Reactivate account">
                                                        <IconButton
                                                            size="small"
                                                            aria-label="Reactivate account"
                                                            disabled={togglingId === s.id}
                                                            onClick={() => { void applyEnabled(s, true); }}
                                                            data-testid={`staff-reactivate-${s.id}`}
                                                        >
                                                            <CheckCircleOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            {loading && staff.length === 0 && (
                <Typography sx={{ mt: 2 }} color="text.secondary">Loading…</Typography>
            )}

            <HireStaffDrawer open={hireOpen} onClose={() => setHireOpen(false)} create={create} />

            <ResetPasswordDrawer
                open={resetTarget !== null}
                target={resetTarget}
                onClose={() => setResetTarget(null)}
                resetPassword={resetPassword}
            />

            <DeactivateStaffDialog
                open={deactivateTarget !== null}
                target={deactivateTarget}
                submitting={deactivateTarget !== null && togglingId === deactivateTarget.id}
                onConfirm={() => { if (deactivateTarget) void applyEnabled(deactivateTarget, false); }}
                onCancel={() => setDeactivateTarget(null)}
            />

            <ErrorSnackbar
                open={errorMessage !== null}
                message={errorMessage ?? ""}
                severity="error"
                handleClose={(): void => setErrorMessage(null)}
            />
        </Box>
    );
}
