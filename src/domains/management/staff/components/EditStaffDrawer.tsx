import * as React from "react";
import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    FormControl,
    FormControlLabel,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    Switch,
    TextField,
} from "@mui/material";
import ResponsiveSheet, { SHEET_Z_INDEX } from "../../_shared/components/ResponsiveSheet";
import { BRAND_BUTTON_SX, ROUNDED_FIELD_SX, roundedMenuProps } from "../../_shared/components/roundedSelect";
import { logger } from "../../../../shared/utils/logger";
import { fetchAllBranches } from "../../../../shared/api/management";
import { StaffRoles } from "../../../auth/types";
import type { IBranch } from "../../inventory/types";
import { getHireableRoles } from "../types";
import type { StaffAdminTO, UpdateStaffDetailsRequest, UpdateStaffPayrollRequest } from "../types";
import DeactivateStaffDialog from "./DeactivateStaffDialog";

export interface EditStaffDrawerProps {
    open: boolean;
    target: StaffAdminTO | null;
    callerRole: StaffRoles | null;
    onClose: () => void;
    updateDetails: (id: number, payload: UpdateStaffDetailsRequest) => Promise<StaffAdminTO>;
    changeBranch: (id: number, branchId: string) => Promise<StaffAdminTO>;
    updatePayroll: (id: number, payload: UpdateStaffPayrollRequest) => Promise<StaffAdminTO>;
    setEnabled: (id: number, enabled: boolean) => Promise<StaffAdminTO>;
}

// Copied verbatim from EditPayrollDrawer (which this block replaces) so the payroll section keeps
// identical round-trip semantics after relocating here -- null (never 0) means "not set".
function amountToField(value: number | null): string {
    return value === null ? "" : String(value);
}

function fieldToAmount(value: string): number | null {
    const trimmed = value.trim();
    return trimmed === "" ? null : Number(trimmed);
}

function amountError(label: string, value: string): string | null {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return `${label} must be a number`;
    if (parsed < 0) return `${label} must not be negative`;
    return null;
}

// Assumed: unlike the payroll amounts above, UpdateStaffDetailsRequest.pricePerHour is not
// nullable -- it is a sparse-patch field that is either a real number or omitted, so an emptied
// field cannot be submitted as a "clear". An empty Price/hour is therefore treated as "leave
// unchanged" rather than as a validation error or a value to send.
function priceError(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return "Price/hour must be a number";
    if (parsed < 0) return "Price/hour must not be negative";
    return null;
}

export default function EditStaffDrawer({
    open,
    target,
    callerRole,
    onClose,
    updateDetails,
    changeBranch,
    updatePayroll,
    setEnabled,
}: EditStaffDrawerProps): React.JSX.Element {
    const isOwner = callerRole === StaffRoles.OWNER;
    const roleOptions = getHireableRoles(callerRole);

    const [fullName, setFullName] = useState("");
    const [role, setRole] = useState<StaffRoles | "">("");
    const [branchId, setBranchId] = useState("");
    const [branches, setBranches] = useState<IBranch[]>([]);
    const [branchesLoading, setBranchesLoading] = useState(false);
    const [pricePerHourStr, setPricePerHourStr] = useState("");
    const [cprNumber, setCprNumber] = useState("");
    const [basicSalary, setBasicSalary] = useState("");
    const [housingAllowance, setHousingAllowance] = useState("");
    const [transportAllowance, setTransportAllowance] = useState("");
    const [enabled, setEnabledState] = useState(true);
    const [deactivateOpen, setDeactivateOpen] = useState(false);
    const [togglingEnabled, setTogglingEnabled] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Populate from the target's current values every time the sheet opens, and clear all form
    // state (including any stale error from a previous target) once it closes -- same idiom as
    // EditPayrollDrawer/ChangeBranchDrawer.
    useEffect(() => {
        if (!open) {
            setFormError(null);
            setSubmitting(false);
            setDeactivateOpen(false);
            setTogglingEnabled(false);
            return;
        }
        setFullName(target?.fullName ?? "");
        setRole(target?.role ?? "");
        setBranchId(target?.branchId ?? "");
        setPricePerHourStr(amountToField(target?.pricePerHour ?? null));
        setCprNumber(target?.cprNumber ?? "");
        setBasicSalary(amountToField(target?.basicSalary ?? null));
        setHousingAllowance(amountToField(target?.housingAllowance ?? null));
        setTransportAllowance(amountToField(target?.transportAllowance ?? null));
        setEnabledState(target?.enabled ?? true);
    }, [open, target]);

    // Fetched here rather than taken from ManagementBranchScope, same reason as ChangeBranchDrawer:
    // that context hands a MANAGER a one-element array (their own branch), which is exactly the
    // list a transfer must NOT be limited to. A manager may send their own staff anywhere -- this
    // is the same for every administrable target, regardless of the caller's own role.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setBranchesLoading(true);
        fetchAllBranches()
            .then(all => { if (!cancelled) setBranches(all); })
            .catch(err => {
                if (cancelled) return;
                logger.error("Failed to load branches for staff editing:", err);
                setFormError("Failed to load branches");
            })
            .finally(() => { if (!cancelled) setBranchesLoading(false); });
        return () => { cancelled = true; };
    }, [open]);

    const validationError =
        amountError("Basic salary", basicSalary)
        ?? amountError("Housing allowance", housingAllowance)
        ?? amountError("Transport allowance", transportAllowance)
        ?? (isOwner ? priceError(pricePerHourStr) : null);

    const handleSubmit = async (): Promise<void> => {
        if (!target || validationError !== null) return;
        setSubmitting(true);
        setFormError(null);
        try {
            const trimmedName = fullName.trim();
            // Same "leave unchanged" semantic as the empty-Price/hour rationale above: HireStaffDrawer
            // requires a non-empty full name at hire time, so this drawer must not be the one place
            // that can un-set it -- an emptied field is treated as no change, never sent as "".
            const nameChanged = trimmedName !== "" && trimmedName !== (target.fullName ?? "");
            // Narrowed within this one ternary (rather than a separately-named boolean plus a
            // second `role !== ""` check) so TS can prove `nextRole` is a real StaffRoles in the
            // branch below without a cast.
            const nextRole: StaffRoles | null = (role !== "" && role !== target.role) ? role : null;
            const priceTrimmed = pricePerHourStr.trim();
            const priceChanged = isOwner && priceTrimmed !== "" && Number(priceTrimmed) !== target.pricePerHour;

            // Combined into one updateDetails call rather than a second round-trip whenever more
            // than one of these three actually changed.
            if (nameChanged || nextRole !== null || priceChanged) {
                const payload: UpdateStaffDetailsRequest = {};
                if (nameChanged) payload.fullName = trimmedName;
                if (nextRole !== null) payload.role = nextRole;
                if (priceChanged) payload.pricePerHour = Number(priceTrimmed);
                await updateDetails(target.id, payload);
            }

            if (branchId !== "" && branchId !== target.branchId) {
                await changeBranch(target.id, branchId);
            }

            const payrollChanged =
                cprNumber.trim() !== (target.cprNumber ?? "")
                || fieldToAmount(basicSalary) !== target.basicSalary
                || fieldToAmount(housingAllowance) !== target.housingAllowance
                || fieldToAmount(transportAllowance) !== target.transportAllowance;

            // Full replacement, matching EditPayrollDrawer's existing behaviour exactly.
            if (isOwner && payrollChanged) {
                await updatePayroll(target.id, {
                    cprNumber: cprNumber.trim() === "" ? null : cprNumber.trim(),
                    basicSalary: fieldToAmount(basicSalary),
                    housingAllowance: fieldToAmount(housingAllowance),
                    transportAllowance: fieldToAmount(transportAllowance),
                });
            }

            onClose();
        } catch (err) {
            logger.error("Failed to update staff details:", err);
            setFormError(err instanceof Error ? err.message : "Failed to update the account");
        } finally {
            setSubmitting(false);
        }
    };

    // Reactivating is not destructive, so it fires directly; deactivating goes through the same
    // confirmation DeactivateStaffDialog offered on the row before this consolidation.
    const applyEnabled = async (nextEnabled: boolean): Promise<void> => {
        if (!target) return;
        setTogglingEnabled(true);
        try {
            await setEnabled(target.id, nextEnabled);
            setEnabledState(nextEnabled);
            setDeactivateOpen(false);
        } catch (err) {
            logger.error("Failed to change the staff account's enabled state:", err);
            setFormError(err instanceof Error ? err.message : "Failed to update the account");
        } finally {
            setTogglingEnabled(false);
        }
    };

    const amountFieldProps = {
        fullWidth: true as const,
        type: "number" as const,
        inputProps: { step: "0.001", min: "0" },
        InputProps: { startAdornment: <InputAdornment position="start">BD</InputAdornment> },
        sx: { mb: 2, ...ROUNDED_FIELD_SX },
    };

    return (
        <>
            <ResponsiveSheet
                open={open}
                onClose={onClose}
                title="Edit staff"
                subtitle={`${target?.fullName ?? target?.username} (${target?.username})`}
                testId="edit-staff-drawer"
            >
                <Box>
                    {(validationError ?? formError) !== null && (
                        <Alert severity="error" sx={{ mb: 2 }} data-testid="edit-staff-error">
                            {validationError ?? formError}
                        </Alert>
                    )}

                    <TextField
                        label="Full name"
                        fullWidth
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        sx={{ mb: 2, ...ROUNDED_FIELD_SX }}
                        data-testid="edit-staff-fullname"
                    />

                    <FormControl fullWidth sx={{ mb: 2, ...ROUNDED_FIELD_SX }}>
                        <InputLabel>Role</InputLabel>
                        <Select<StaffRoles | "">
                            label="Role"
                            value={role}
                            onChange={(e: SelectChangeEvent<StaffRoles | "">) => setRole(e.target.value)}
                            MenuProps={roundedMenuProps(SHEET_Z_INDEX + 10)}
                            data-testid="edit-staff-role"
                        >
                            {roleOptions.map(r => (
                                <MenuItem key={r} value={r}>{r}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Ungated for any administrable row, matching ChangeBranchDrawer's original
                        behaviour: a manager may send their own staff anywhere. The restriction is
                        only on which staff a MANAGER can reach as a target (resolveAdministrableTarget,
                        enforced server-side), never on which branch they can send them to. */}
                    <TextField
                        select
                        label="Branch"
                        fullWidth
                        // Falls back to "" until the fetched list actually contains this id --
                        // branchId is pre-filled from the target the instant the sheet opens,
                        // one tick before the branches themselves have loaded, and a Select
                        // whose value matches none of its current options logs an MUI warning.
                        value={branches.some(b => String(b.id) === branchId) ? branchId : ""}
                        onChange={e => setBranchId(e.target.value)}
                        disabled={branchesLoading}
                        SelectProps={{ MenuProps: roundedMenuProps(SHEET_Z_INDEX + 10) }}
                        sx={{ mb: 2, ...ROUNDED_FIELD_SX }}
                        data-testid="edit-staff-branch"
                    >
                        {branches.map(b => (
                            <MenuItem key={b.id} value={String(b.id)}>{b.branchName}</MenuItem>
                        ))}
                    </TextField>

                    {/* Payroll (including Price/hour) is redacted server-side for anyone below
                        OWNER, so a non-OWNER caller sees neither field -- there is nothing
                        meaningful to show or edit. */}
                    {isOwner && (
                        <TextField
                            {...amountFieldProps}
                            label="Price/hour"
                            value={pricePerHourStr}
                            onChange={e => setPricePerHourStr(e.target.value)}
                            data-testid="edit-staff-price"
                        />
                    )}

                    {isOwner && (
                        <>
                            <TextField
                                label="CPR No."
                                fullWidth
                                value={cprNumber}
                                onChange={e => setCprNumber(e.target.value)}
                                sx={{ mb: 2, ...ROUNDED_FIELD_SX }}
                                data-testid="edit-payroll-cpr"
                            />

                            <TextField
                                {...amountFieldProps}
                                label="Basic salary"
                                value={basicSalary}
                                onChange={e => setBasicSalary(e.target.value)}
                                data-testid="edit-payroll-basic"
                            />

                            <TextField
                                {...amountFieldProps}
                                label="Housing allowance"
                                value={housingAllowance}
                                onChange={e => setHousingAllowance(e.target.value)}
                                data-testid="edit-payroll-housing"
                            />

                            <TextField
                                {...amountFieldProps}
                                label="Transport allowance"
                                value={transportAllowance}
                                onChange={e => setTransportAllowance(e.target.value)}
                                data-testid="edit-payroll-transport"
                            />
                        </>
                    )}

                    <FormControlLabel
                        sx={{ mb: 2, ml: 0 }}
                        control={
                            <Switch
                                checked={enabled}
                                disabled={togglingEnabled}
                                onChange={(_, checked) => {
                                    if (checked) {
                                        void applyEnabled(true);
                                    } else {
                                        setDeactivateOpen(true);
                                    }
                                }}
                            />
                        }
                        label={enabled ? "Enabled" : "Disabled"}
                    />

                </Box>

                {/* Pinned to the bottom of the sheet's own scroll container (the Drawer/Dialog
                    Paper, not this Box) so Save is always reachable on a small phone without
                    scrolling past the payroll block. The negative horizontal margin cancels the
                    sheet's own side padding so the bar's background spans edge-to-edge; px puts
                    the button back at the same inset as every field above it. Cancel is gone --
                    the close (X) in the sheet's header already covers that, and a second "leave
                    without saving" affordance was redundant next to it. */}
                <Box
                    sx={{
                        position: "sticky",
                        bottom: 0,
                        // `sticky` alone doesn't establish a stacking context, so without an
                        // explicit z-index a scrolled-under field's label -- MUI floats/shrinks
                        // it with a CSS transform, which DOES create its own compositing layer --
                        // can paint above this bar's background instead of under it.
                        zIndex: 1,
                        mx: -3,
                        px: 3,
                        pt: 1.5,
                        pb: "calc(16px + env(safe-area-inset-bottom))",
                        mt: 1,
                        backgroundColor: "#fff",
                        borderTop: "1px solid #efece4",
                    }}
                >
                    <Button
                        fullWidth
                        variant="contained"
                        disableElevation
                        disabled={submitting || validationError !== null}
                        onClick={() => { void handleSubmit(); }}
                        sx={BRAND_BUTTON_SX}
                        data-testid="edit-staff-submit"
                    >
                        Save
                    </Button>
                </Box>
            </ResponsiveSheet>

            <DeactivateStaffDialog
                open={deactivateOpen}
                target={target}
                submitting={togglingEnabled}
                onConfirm={() => { void applyEnabled(false); }}
                onCancel={() => setDeactivateOpen(false)}
            />
        </>
    );
}
