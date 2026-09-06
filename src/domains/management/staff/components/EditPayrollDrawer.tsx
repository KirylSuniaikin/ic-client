import * as React from "react";
import { useEffect, useState } from "react";
import { Alert, Box, Button, InputAdornment, TextField } from "@mui/material";
import ResponsiveSheet from "../../_shared/components/ResponsiveSheet";
import { BRAND_BUTTON_SX, NEUTRAL_BUTTON_SX, ROUNDED_FIELD_SX } from "../../_shared/components/roundedSelect";
import { logger } from "../../../../shared/utils/logger";
import { shortStaffName, staffDisplayName } from "../../../../shared/utils/staffName";
import type { StaffAdminTO, UpdateStaffPayrollRequest } from "../types";

export interface EditPayrollDrawerProps {
    open: boolean;
    target: StaffAdminTO | null;
    onClose: () => void;
    updatePayroll: (id: number, payload: UpdateStaffPayrollRequest) => Promise<void>;
}

// null -- and never 0 -- means "not set"; an unset amount must round-trip as an empty field, not
// a literal zero the owner never entered.
function amountToField(value: number | null): string {
    return value === null ? "" : String(value);
}

// Empty means "not set" (null), matching the backend's full-replacement semantics -- the form
// always submits all four fields, so a blanked-out amount is a deliberate clear, not a no-op.
function fieldToAmount(value: string): number | null {
    const trimmed = value.trim();
    return trimmed === "" ? null : Number(trimmed);
}

// `min="0"` is a browser hint, not enforcement: a pasted or programmatically set "-50" reaches
// state unchanged. These amounts are printed on a document an employee signs, so a negative is
// rejected here as well as server-side.
//
// The non-numeric branch is defence only, and deliberately has no test: `type="number"` reports
// an empty string for unparseable content, so garbage arrives here as "" (a clear), never as NaN.
// It is kept because NaN would serialise to null and silently CLEAR the field, which is exactly
// what this guard must prevent if the input type is ever widened to text.
function amountError(label: string, value: string): string | null {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return `${label} must be a number`;
    if (parsed < 0) return `${label} must not be negative`;
    return null;
}

export default function EditPayrollDrawer({
    open,
    target,
    onClose,
    updatePayroll,
}: EditPayrollDrawerProps): React.JSX.Element {
    const [cprNumber, setCprNumber] = useState("");
    const [basicSalary, setBasicSalary] = useState("");
    const [housingAllowance, setHousingAllowance] = useState("");
    const [transportAllowance, setTransportAllowance] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Populate from the target's current payroll every time the sheet opens, and clear the form
    // state (including any stale error from a previous target) once it closes.
    useEffect(() => {
        if (!open) {
            setFormError(null);
            setSubmitting(false);
            return;
        }
        setCprNumber(target?.cprNumber ?? "");
        setBasicSalary(amountToField(target?.basicSalary ?? null));
        setHousingAllowance(amountToField(target?.housingAllowance ?? null));
        setTransportAllowance(amountToField(target?.transportAllowance ?? null));
    }, [open, target]);

    const handleSubmit = async (): Promise<void> => {
        if (!target) return;
        setSubmitting(true);
        setFormError(null);
        try {
            await updatePayroll(target.id, {
                cprNumber: cprNumber.trim() === "" ? null : cprNumber.trim(),
                basicSalary: fieldToAmount(basicSalary),
                housingAllowance: fieldToAmount(housingAllowance),
                transportAllowance: fieldToAmount(transportAllowance),
            });
            onClose();
        } catch (err) {
            logger.error("Failed to update the staff member's payroll:", err);
            setFormError(err instanceof Error ? err.message : "Failed to update payroll");
        } finally {
            setSubmitting(false);
        }
    };

    const validationError =
        amountError("Basic salary", basicSalary)
        ?? amountError("Housing allowance", housingAllowance)
        ?? amountError("Transport allowance", transportAllowance);

    const amountFieldProps = {
        fullWidth: true as const,
        type: "number" as const,
        inputProps: { step: "0.001", min: "0" },
        InputProps: { startAdornment: <InputAdornment position="start">BD</InputAdornment> },
        sx: { mb: 2, ...ROUNDED_FIELD_SX },
    };

    return (
        <ResponsiveSheet
            open={open}
            onClose={onClose}
            title="Edit payroll"
            subtitle={`${target ? shortStaffName(staffDisplayName(target)) : undefined} (${target?.username})`}
            testId="edit-payroll-drawer"
        >
            <Box>
                {(validationError ?? formError) !== null && (
                    <Alert severity="error" sx={{ mb: 2 }} data-testid="edit-payroll-error">
                        {validationError ?? formError}
                    </Alert>
                )}

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

                <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    disabled={submitting || validationError !== null}
                    onClick={() => { void handleSubmit(); }}
                    sx={{ ...BRAND_BUTTON_SX, mb: 1 }}
                    data-testid="edit-payroll-submit"
                >
                    Save
                </Button>
                <Button
                    fullWidth
                    variant="outlined"
                    onClick={onClose}
                    disabled={submitting}
                    sx={NEUTRAL_BUTTON_SX}
                >
                    Cancel
                </Button>
            </Box>
        </ResponsiveSheet>
    );
}
