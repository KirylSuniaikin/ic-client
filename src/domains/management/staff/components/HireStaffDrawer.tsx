import * as React from "react";
import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
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
import { fetchAllBranches } from "../../../../shared/api/management";
import { useAuth } from "../../../auth/context/AuthProvider";
import { StaffRoles, hasCityAccess } from "../../../auth/types";
import ResponsiveSheet, { SHEET_Z_INDEX } from "../../_shared/components/ResponsiveSheet";
import { BRAND_BUTTON_SX, ROUNDED_FIELD_SX, roundedMenuProps } from "../../_shared/components/roundedSelect";
import type { IBranch } from "../../inventory/types";
import { generatePassword } from "../utils/generatePassword";
import CredentialsRevealPanel from "./CredentialsRevealPanel";
import { getHireableRoles } from "../types";
import type { HireStaffRequest, HiredStaffTO } from "../types";

export interface HireStaffDrawerProps {
    open: boolean;
    onClose: () => void;
    create: (request: HireStaffRequest) => Promise<HiredStaffTO>;
    /** Branch the roster is scoped to, pre-selected for a city-level hirer. */
    defaultBranchId?: string;
}


export default function HireStaffDrawer({ open, onClose, create, defaultBranchId }: HireStaffDrawerProps): React.JSX.Element {
    const { role, branchId: ownBranchId } = useAuth();
    const cityAccess = hasCityAccess(role);
    const hireableRoles = getHireableRoles(role);
    const isOwner = role === StaffRoles.OWNER;

    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [selectedRole, setSelectedRole] = useState<StaffRoles | "">("");
    const [pricePerHourStr, setPricePerHourStr] = useState("");
    const [basicSalaryStr, setBasicSalaryStr] = useState("");
    const [hoursStr, setHoursStr] = useState("208");
    const [cprNumber, setCprNumber] = useState("");
    const [branches, setBranches] = useState<IBranch[]>([]);
    const [branchesLoaded, setBranchesLoaded] = useState(false);
    const [selectedBranchId, setSelectedBranchId] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

    // Fetched here rather than read from ManagementBranchScope, for the same reason
    // ChangeBranchDrawer does it: that context is seeded from the caller's own scope, so it is
    // empty or one-element exactly when a city-level hirer needs the full list -- and an empty
    // ambient list gives no clue that anything failed. A real failure now says so.
    useEffect(() => {
        if (!open || !cityAccess) return;
        let cancelled = false;
        fetchAllBranches()
            .then(all => { if (!cancelled) setBranches(all); })
            .catch(err => {
                if (cancelled) return;
                logger.error("Failed to load branches to hire into:", err);
                setFormError("Failed to load branches");
            })
            // Loaded, not "succeeded": a failed fetch has also stopped being in-flight, and the
              // caller needs the empty-list warning either way.
            .finally(() => { if (!cancelled) setBranchesLoaded(true); });
        return () => { cancelled = true; };
    }, [open, cityAccess]);

    // Default to the branch whose roster the manager opened this from, falling back to the first.
    useEffect(() => {
        if (!cityAccess || selectedBranchId !== "" || branches.length === 0) return;
        const seed = branches.find(b => String(b.id) === defaultBranchId) ?? branches[0];
        setSelectedBranchId(String(seed.id));
    }, [cityAccess, branches, selectedBranchId, defaultBranchId]);

    // One-time reveal: once the drawer is dismissed nothing here keeps the plaintext password.
    useEffect(() => {
        if (open) return;
        setFullName("");
        setUsername("");
        setPassword("");
        setSelectedRole("");
        setPricePerHourStr("");
        setBasicSalaryStr("");
        setHoursStr("208");
        setCprNumber("");
        setSelectedBranchId("");
        setBranchesLoaded(false);
        setFormError(null);
        setCredentials(null);
        setSubmitting(false);
    }, [open]);

    const basicSalary = Number(basicSalaryStr);
    const hours = Number(hoursStr);
    const suggestedRate =
        basicSalaryStr.trim() !== "" && hoursStr.trim() !== "" &&
        !Number.isNaN(basicSalary) && !Number.isNaN(hours) && hours > 0
            ? basicSalary / hours
            : null;

    // Only fills an empty field; never fights the admin's own typing once Price/hour has a value,
    // whether that value came from them or from this same auto-fill on a previous keystroke.
    useEffect(() => {
        if (suggestedRate === null || pricePerHourStr !== "") return;
        setPricePerHourStr(suggestedRate.toFixed(3));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [basicSalaryStr, hoursStr]);

    const pricePerHour = Number(pricePerHourStr);
    const canSubmit =
        fullName.trim() !== "" &&
        username.trim() !== "" &&
        password.trim() !== "" &&
        selectedRole !== "" &&
        pricePerHourStr.trim() !== "" &&
        !Number.isNaN(pricePerHour) &&
        pricePerHour >= 0 &&
        (cityAccess ? selectedBranchId !== "" : ownBranchId !== null);

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
            if (selectedBranchId === "") return;
            branchId = selectedBranchId;
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
            cprNumber: cprNumber.trim() === "" ? null : cprNumber.trim(),
            branchId,
            basicSalary: isOwner && basicSalaryStr.trim() !== "" && !Number.isNaN(basicSalary) && basicSalary >= 0
                ? basicSalary
                : undefined,
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
        // The reveal panel carries its own heading, so the shell's is dropped for that step
        // rather than stacking two titles.
        <ResponsiveSheet
            open={open}
            onClose={onClose}
            title={credentials ? undefined : "Add staff"}
            testId="hire-staff-drawer"
        >
            {credentials ? (
                <CredentialsRevealPanel
                    title="Successfully added 🎉"
                    username={credentials.username}
                    password={credentials.password}
                    onDone={onClose}
                    testIdPrefix="hire-staff"
                />
            ) : (
                <Box>
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
                        <Button
                            variant="outlined"
                            onClick={handleGeneratePassword}
                            data-testid="hire-staff-generate-password"
                            sx={{ borderRadius: "12px", whiteSpace: "nowrap", borderColor: "#d9d6cd", color: "#4a4f57" }}
                        >
                            Generate
                        </Button>
                    </Box>

                    <FormControl fullWidth sx={{ mb: 2, ...ROUNDED_FIELD_SX }}>
                        <InputLabel>Role</InputLabel>
                        <Select<StaffRoles | "">
                            label="Role"
                            value={selectedRole}
                            onChange={(e: SelectChangeEvent<StaffRoles | "">) => setSelectedRole(e.target.value)}
                            data-testid="hire-staff-role-select"
                            MenuProps={roundedMenuProps(SHEET_Z_INDEX + 10)}
                        >
                            {hireableRoles.map(r => (
                                <MenuItem key={r} value={r}>
                                    {r}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {isOwner && (
                        <TextField
                            label="Basic Salary"
                            fullWidth
                            value={basicSalaryStr}
                            onChange={e => {
                                const val = e.target.value;
                                if (val === "" || /^\d*\.?\d{0,3}$/.test(val)) setBasicSalaryStr(val);
                            }}
                            inputProps={{ inputMode: "decimal" }}
                            InputProps={{ startAdornment: <InputAdornment position="start">BD</InputAdornment> }}
                            sx={{ mb: 2 }}
                            data-testid="hire-staff-basic-salary"
                        />
                    )}

                    <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                        <TextField
                            label="Hours"
                            value={hoursStr}
                            onChange={e => {
                                const val = e.target.value;
                                if (val === "" || /^\d*$/.test(val)) setHoursStr(val);
                            }}
                            inputProps={{ inputMode: "numeric" }}
                            sx={{ flex: 1 }}
                            data-testid="hire-staff-hours"
                        />
                        <TextField
                            label="Price/hour"
                            value={pricePerHourStr}
                            onChange={e => {
                                const val = e.target.value;
                                if (val === "" || /^\d*\.?\d{0,3}$/.test(val)) setPricePerHourStr(val);
                            }}
                            inputProps={{ inputMode: "decimal" }}
                            InputProps={{ startAdornment: <InputAdornment position="start">BD</InputAdornment> }}
                            helperText={
                                suggestedRate !== null && pricePerHourStr !== "" ? (
                                    <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>
                                        {`Suggested from salary: ${suggestedRate.toFixed(3)} BD/hr`}
                                    </Typography>
                                ) : undefined
                            }
                            sx={{ flex: 2 }}
                        />
                    </Box>

                    <TextField
                        label="CPR No. (optional)"
                        fullWidth
                        value={cprNumber}
                        onChange={e => setCprNumber(e.target.value)}
                        inputProps={{ inputMode: "numeric" }}
                        sx={{ mb: 2 }}
                        data-testid="hire-staff-cpr"
                    />

                    {cityAccess && (
                        !branchesLoaded || branches.length > 0 ? (
                            <TextField
                                select
                                label="Branch"
                                fullWidth
                                value={selectedBranchId}
                                onChange={e => setSelectedBranchId(e.target.value)}
                                disabled={!branchesLoaded}
                                SelectProps={{ MenuProps: roundedMenuProps(SHEET_Z_INDEX + 10) }}
                                sx={{ mb: 2, ...ROUNDED_FIELD_SX }}
                                data-testid="hire-staff-branch-select"
                            >
                                {branches.map(b => (
                                    <MenuItem key={b.id} value={String(b.id)}>{b.branchName}</MenuItem>
                                ))}
                            </TextField>
                        ) : (
                            <Alert severity="warning" sx={{ mb: 2 }} data-testid="hire-staff-no-branches">
                                No branches available to hire into.
                            </Alert>
                        )
                    )}

                    <Button
                        fullWidth
                        variant="contained"
                        disableElevation
                        onClick={handleSubmit}
                        disabled={!canSubmit || submitting}
                        sx={BRAND_BUTTON_SX}
                    >
                        Add
                    </Button>
                </Box>
            )}
        </ResponsiveSheet>
    );
}
