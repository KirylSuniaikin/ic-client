import React, { useState } from "react";
import { Box, FormControlLabel, Switch, Typography } from "@mui/material";
import { BRAND_SWITCH_SX } from "../../_shared/components/roundedSelect";
import { formatDateTime } from "../../discipline/format";
import { usePayrollSettings } from "../hooks/usePayrollSettings";

const HELPER =
    "While on, the salary slip pays at most 1 hour of overtime per shift. " +
    "While off, every overtime hour is paid. Actual overtime in the Staff Summary is never capped.";

export default function PayrollView(): JSX.Element {
    const { settings, loadError, setCapPaidOvertime } = usePayrollSettings();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleToggle = async (): Promise<void> => {
        if (settings === null) return;
        setSaving(true);
        setError(null);
        try {
            await setCapPaidOvertime(!settings.capPaidOvertime);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update payroll settings");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ backgroundColor: "#fff", borderRadius: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", p: 2, mb: 2 }}>
            <FormControlLabel
                control={
                    <Switch
                        checked={settings?.capPaidOvertime ?? false}
                        onChange={() => void handleToggle()}
                        disabled={settings === null || saving}
                        sx={BRAND_SWITCH_SX}
                    />
                }
                label="Limit paid overtime to 1 hour per shift"
            />
            <Typography variant="body2" color="text.secondary">{HELPER}</Typography>
            {settings?.updatedAt != null && settings.updatedByName != null && (
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                    Last changed by {settings.updatedByName}, {formatDateTime(settings.updatedAt)}
                </Typography>
            )}
            {(error ?? loadError) !== null && (
                <Typography role="alert" variant="body2" color="error" sx={{ mt: 0.5 }}>
                    {error ?? loadError}
                </Typography>
            )}
        </Box>
    );
}
