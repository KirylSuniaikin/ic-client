import * as React from "react";
import { useEffect, useState } from "react";
import {
    Box,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import { useAuth } from "../../../auth/context/AuthProvider";
import { StaffRoles, hasCityAccess } from "../../../auth/types";
import { useStaffRegister } from "../hooks/useStaffRegister";
import HireStaffDrawer from "./HireStaffDrawer";

export interface StaffRegisterScreenProps {
    role: StaffRoles | null;
}

export default function StaffRegisterScreen({ role }: StaffRegisterScreenProps): React.JSX.Element {
    const { branchId } = useAuth();
    // City-level callers (SUPER_MANAGER/OWNER) see every branch's staff; everyone else is
    // scoped to their own branch, mirroring getStaffByBranch's existing shape.
    const scopeBranchId = hasCityAccess(role) ? undefined : branchId ?? undefined;
    const { staff, loading, error, create } = useStaffRegister(scopeBranchId);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const isOwnerViewer = role === StaffRoles.OWNER;

    // Mirror the hook's error into local snackbar state, same pattern as TaskBoardScreen.tsx.
    useEffect(() => {
        if (error) setErrorMessage(error);
    }, [error]);

    return (
        <Box sx={{ p: 2, backgroundColor: "#fbfaf6", minHeight: "100vh" }} data-testid="staff-register-screen">
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">Staff</Typography>
                <Button
                    variant="contained"
                    onClick={() => setDrawerOpen(true)}
                    sx={{ borderRadius: 3, bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c73c3d" } }}
                    data-testid="staff-hire-button"
                >
                    Hire
                </Button>
            </Box>

            <TableContainer>
                <Table size="small" data-testid="staff-list">
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Login</TableCell>
                            <TableCell>Role</TableCell>
                            {isOwnerViewer && <TableCell>Price/hour</TableCell>}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {staff.map(s => (
                            <TableRow key={s.id} data-testid={`staff-row-${s.id}`}>
                                <TableCell>{s.fullName ?? s.username}</TableCell>
                                <TableCell>{s.username}</TableCell>
                                <TableCell>{s.role}</TableCell>
                                {isOwnerViewer && (
                                    <TableCell>{s.pricePerHour !== null ? s.pricePerHour : ""}</TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {loading && staff.length === 0 && (
                <Typography sx={{ mt: 2 }} color="text.secondary">Loading…</Typography>
            )}

            <HireStaffDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} create={create} />

            <ErrorSnackbar
                open={errorMessage !== null}
                message={errorMessage ?? ""}
                severity="error"
                handleClose={(): void => setErrorMessage(null)}
            />
        </Box>
    );
}
