import * as React from "react";
import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Drawer,
    FormControl,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    TextField,
    Typography,
} from "@mui/material";
import { logger } from "../../../../shared/utils/logger";
import { useAuth } from "../../../auth/context/AuthProvider";
import { StaffRoles, hasCityAccess } from "../../../auth/types";
import { useManagementBranchScope } from "../../_shared/context/ManagementBranchScope";
import { BranchSelectorComponent } from "../../_shared/components/BranchSelectorComponent";
import type { IBranch } from "../../inventory/types";
import { generatePassword } from "../utils/generatePassword";
import CredentialsRevealPanel from "./CredentialsRevealPanel";
import { getHireableRoles } from "../types";
import type { HireStaffRequest, HiredStaffTO } from "../types";

export interface HireStaffDrawerProps {
    open: boolean;
    onClose: () => void;
    create: (request: HireStaffRequest) => Promise<HiredStaffTO>;
}

const colorRed = "#E44B4C";

export default function HireStaffDrawer({ open, onClose, create }: HireStaffDrawerProps): React.JSX.Element {
    const { role, branchId: ownBranchId } = useAuth();
    const { branches } = useManagementBranchScope();
    const cityAccess = hasCityAccess(role);
    const hireableRoles = getHireableRoles(role);

    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [selectedRole, setSelectedRole] = useState<StaffRoles | "">("");
    const [pricePerHourStr, setPricePerHourStr] = useState("");
    const [selectedBranch, setSelectedBranch] = useState<IBranch | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

    // Default the branch picker to the first branch a city-level caller sees, same as
    // useBranchSelection.ts does for its own selectedBranch seed.
    useEffect(() => {
        if (cityAccess && selectedBranch === null && branches.length > 0) {
            setSelectedBranch(branches[0]);
        }
    }, [cityAccess, branches, selectedBranch]);

    // One-time reveal: once the drawer is dismissed nothing here keeps the plaintext password.
    useEffect(() => {
        if (open) return;
        setFullName("");
        setUsername("");
        setPassword("");
        setSelectedRole("");
        setPricePerHourStr("");
        setSelectedBranch(null);
        setFormError(null);
        setCredentials(null);
        setSubmitting(false);
    }, [open]);

    const pricePerHour = Number(pricePerHourStr);
    const canSubmit =
        fullName.trim() !== "" &&
        username.trim() !== "" &&
        password.trim() !== "" &&
        selectedRole !== "" &&
        pricePerHourStr.trim() !== "" &&
        !Number.isNaN(pricePerHour) &&
        pricePerHour >= 0 &&
        (cityAccess ? selectedBranch !== null : ownBranchId !== null);

    const handleGeneratePassword = (): void => setPassword(generatePassword());

    const handleSubmit = async (): Promise<void> => {
        // canSubmit's own check already establishes selectedRole !== "" -- TS carries that
        // narrowing forward since selectedRole is never reassigned within this render.
        if (!canSubmit) return;

        // Narrow explicitly rather than asserting: canSubmit already guarantees one of these two
        // branches has a real id, but the compiler needs the check repeated here to prove it --
        // an unresolved branchId must never fall back to "" and round-trip as a backend 400.
        let branchId: string;
        if (cityAccess) {
            if (!selectedBranch) return;
            branchId = selectedBranch.id;
        } else {
            if (!ownBranchId) return;
            branchId = ownBranchId;
        }

        setSubmitting(true);
        setFormError(null);

        const request: HireStaffRequest = {
            username: username.trim(),
            password,
            fullName: fullName.trim(),
            role: selectedRole,
            pricePerHour,
            branchId,
        };

        try {
            const hired = await create(request);
            setCredentials({ username: hired.username, password });
        } catch (err) {
            logger.error("Failed to hire staff:", err);
            setFormError(err instanceof Error ? err.message : "Failed to hire staff");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{ zIndex: 1350 }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                    maxHeight: "90vh",
                    overflowY: "auto",
                },
            }}
        >
            <Box sx={{ p: 3, pb: 4 }} data-testid="hire-staff-drawer">
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />

                {credentials ? (
                    <CredentialsRevealPanel
                        title="Staff hired"
                        username={credentials.username}
                        password={credentials.password}
                        onDone={onClose}
                        testIdPrefix="hire-staff"
                    />
                ) : (
                    <Box>
                        <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, textAlign: "center" }}>
                            Hire staff
                        </Typography>

                        {formError && (
                            <Alert severity="error" sx={{ mb: 2 }} data-testid="hire-staff-error">
                                {formError}
                            </Alert>
                        )}

                        <TextField
                            label="Full name"
                            fullWidth
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            sx={{ mb: 2 }}
                        />

                        <TextField
                            label="Login"
                            fullWidth
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            sx={{ mb: 2 }}
                        />

                        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                            <TextField
                                label="Password"
                                fullWidth
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <Button variant="outlined" onClick={handleGeneratePassword} data-testid="hire-staff-generate-password">
                                Generate
                            </Button>
                        </Box>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Role</InputLabel>
                            <Select<StaffRoles | "">
                                label="Role"
                                value={selectedRole}
                                onChange={(e: SelectChangeEvent<StaffRoles | "">) => setSelectedRole(e.target.value)}
                                data-testid="hire-staff-role-select"
                            >
                                {hireableRoles.map(r => (
                                    <MenuItem key={r} value={r}>
                                        {r}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            label="Price/hour"
                            fullWidth
                            value={pricePerHourStr}
                            onChange={e => {
                                const val = e.target.value;
                                if (val === "" || /^\d*\.?\d{0,2}$/.test(val)) setPricePerHourStr(val);
                            }}
                            inputProps={{ inputMode: "decimal" }}
                            InputProps={{ startAdornment: <InputAdornment position="start">BD</InputAdornment> }}
                            sx={{ mb: 2 }}
                        />

                        {cityAccess && (
                            <Box sx={{ mb: 2 }}>
                                {selectedBranch ? (
                                    <BranchSelectorComponent
                                        branches={branches}
                                        selectedBranch={selectedBranch}
                                        onBranchChange={setSelectedBranch}
                                    />
                                ) : (
                                    <Alert severity="warning" data-testid="hire-staff-no-branches">
                                        No branches available to hire into.
                                    </Alert>
                                )}
                            </Box>
                        )}

                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={!canSubmit || submitting}
                            sx={{ borderRadius: 3, py: 1.5, bgcolor: colorRed, "&:hover": { bgcolor: "#c73c3d" } }}
                        >
                            Hire
                        </Button>
                    </Box>
                )}
            </Box>
        </Drawer>
    );
}
