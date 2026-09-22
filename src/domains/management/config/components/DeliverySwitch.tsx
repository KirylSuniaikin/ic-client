import React, { useEffect, useState } from "react";
import { Box, Typography, Switch, CircularProgress } from "@mui/material";

import { putDeliveryEnabled } from "../../../../shared/api/management";
import { logger } from "../../../../shared/utils/logger";

interface DeliverySwitchProps {
    branchId: string;
    /** Undefined when the branch object did not come from a branch fetch — see IBranch. */
    deliveryEnabled: boolean | undefined;
    /** Lets the parent keep its own branch copy in step, so switching tabs does not revert. */
    onChanged?: (branchId: string, deliveryEnabled: boolean) => void;
}

/**
 * The per-branch delivery switch (gap G2).
 *
 * Deliberately NOT the same thing as closing the branch: this leaves the kitchen taking pickup
 * orders and only stops delivery for it. The availability gate reads the same flag, so a customer
 * whose pin resolves to this branch is told delivery is unavailable instead of being routed to a
 * kitchen that cannot serve them.
 *
 * It sits beside the schedule because both answer "what is this one kitchen doing today", and
 * both are gated to the same roles.
 */
export default function DeliverySwitch({
    branchId,
    deliveryEnabled,
    onChanged,
}: DeliverySwitchProps): JSX.Element {
    const [enabled, setEnabled] = useState<boolean | undefined>(deliveryEnabled);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // The branch selector lives on the Menu tab; switching branches must re-seed this control
    // rather than leave the previous branch's answer on screen.
    useEffect(() => {
        setEnabled(deliveryEnabled);
        setError(null);
    }, [branchId, deliveryEnabled]);

    async function handleToggle(next: boolean): Promise<void> {
        setSaving(true);
        setError(null);
        // Optimistic, then reverted on failure: the switch is the only feedback the manager gets,
        // and leaving it in the old position while the request flies reads as a dead control.
        setEnabled(next);
        try {
            const response = await putDeliveryEnabled(branchId, next);
            setEnabled(response.deliveryEnabled);
            onChanged?.(branchId, response.deliveryEnabled);
        } catch (e) {
            setEnabled(!next);
            setError("Could not change delivery for this branch.");
            logger.error("putDeliveryEnabled failed:", e);
        } finally {
            setSaving(false);
        }
    }

    const unknown = enabled === undefined;

    return (
        <Box
            sx={{
                backgroundColor: "#fff",
                borderRadius: 2,
                boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                p: 2,
                mb: 2,
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box sx={{ pr: 2 }}>
                    <Typography variant="h6" fontWeight="bold">
                        Delivery
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {unknown
                            ? "Delivery state was not reported for this branch."
                            : "Off means this kitchen keeps taking pick-up orders but no deliveries."}
                    </Typography>
                </Box>
                {saving ? (
                    <CircularProgress size={20} />
                ) : (
                    <Switch
                        checked={enabled === true}
                        disabled={unknown}
                        onChange={(e) => { void handleToggle(e.target.checked); }}
                        // slotProps, not the deprecated inputProps: MUI v7 no longer forwards
                        // the latter, so the label silently never reaches the input.
                        slotProps={{ input: { "aria-label": "Delivery for this branch" } }}
                    />
                )}
            </Box>
            {error !== null && (
                <Typography variant="body2" sx={{ mt: 1, color: "#E44B4C" }}>
                    {error}
                </Typography>
            )}
        </Box>
    );
}
