import React, { useState } from "react";
import { Box, FormControlLabel, Switch, Typography } from "@mui/material";
import { BRAND_SWITCH_SX } from "../../_shared/components/roundedSelect";
import type { DisciplineSettingsTO } from "../../discipline/types";
import { formatDateTime } from "../../discipline/format";

export type ShadowPilotSwitchProps = {
    settings: DisciplineSettingsTO | null;
    onChange: (value: boolean) => Promise<void>;
};

const HELPER =
    "While on, violations are recorded and scores are shown, but no penalty hours are applied and no documents are generated.";

const ShadowPilotSwitch: React.FC<ShadowPilotSwitchProps> = ({ settings, onChange }) => {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleToggle = async (): Promise<void> => {
        if (settings === null) return;
        setSaving(true);
        setError(null);
        try {
            await onChange(!settings.shadowPilot);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update shadow pilot");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ backgroundColor: "#fff", borderRadius: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", p: 2, mb: 2 }}>
            <FormControlLabel
                control={
                    <Switch
                        checked={settings?.shadowPilot ?? false}
                        onChange={() => void handleToggle()}
                        disabled={settings === null || saving}
                        sx={BRAND_SWITCH_SX}
                    />
                }
                label="Shadow pilot"
            />
            {settings?.shadowPilot === true && (
                <Typography data-testid="shadow-pilot-on" variant="body2" sx={{ fontWeight: 700 }}>
                    Pilot mode is ON
                </Typography>
            )}
            <Typography variant="body2" color="text.secondary">{HELPER}</Typography>
            {settings?.updatedAt != null && settings.updatedByName != null && (
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                    Last changed by {settings.updatedByName}, {formatDateTime(settings.updatedAt)}
                </Typography>
            )}
            {error !== null && (
                <Typography role="alert" variant="body2" color="error" sx={{ mt: 0.5 }}>
                    {error}
                </Typography>
            )}
        </Box>
    );
};

export default ShadowPilotSwitch;
