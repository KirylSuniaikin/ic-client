import * as React from "react";
import { useEffect, useState } from "react";
import { Alert, Box, Button, MenuItem, TextField } from "@mui/material";
import ResponsiveSheet, { SHEET_Z_INDEX } from "../../_shared/components/ResponsiveSheet";
import { BRAND_BUTTON_SX, NEUTRAL_BUTTON_SX, ROUNDED_FIELD_SX, roundedMenuProps } from "../../_shared/components/roundedSelect";
import { logger } from "../../../../shared/utils/logger";
import { fetchAllBranches } from "../../../../shared/api/management";
import type { IBranch } from "../../inventory/types";
import type { StaffAdminTO } from "../types";


export interface ChangeBranchDrawerProps {
    open: boolean;
    target: StaffAdminTO | null;
    onClose: () => void;
    changeBranch: (id: number, branchId: string) => Promise<void>;
}

export default function ChangeBranchDrawer({
    open,
    target,
    onClose,
    changeBranch,
}: ChangeBranchDrawerProps): React.JSX.Element {
    const [branches, setBranches] = useState<IBranch[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Fetched here rather than taken from ManagementBranchScope: that context hands a MANAGER a
    // one-element array (their own branch), which is exactly the list a transfer must NOT be
    // limited to. A manager may send their own staff anywhere.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        fetchAllBranches()
            .then(all => { if (!cancelled) setBranches(all); })
            .catch(err => {
                if (cancelled) return;
                logger.error("Failed to load branches for a transfer:", err);
                setFormError("Failed to load branches");
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open]);

    useEffect(() => {
        if (open) return;
        setSelectedId("");
        setFormError(null);
        setSubmitting(false);
    }, [open]);

    // The branch they are already at is not a transfer.
    const destinations = branches.filter(b => String(b.id) !== target?.branchId);

    const handleSubmit = async (): Promise<void> => {
        if (!target || selectedId === "") return;
        setSubmitting(true);
        setFormError(null);
        try {
            await changeBranch(target.id, selectedId);
            onClose();
        } catch (err) {
            logger.error("Failed to change the staff member's branch:", err);
            setFormError(err instanceof Error ? err.message : "Failed to change the branch");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ResponsiveSheet
            open={open}
            onClose={onClose}
            title="Change branch"
            subtitle={`${target?.fullName ?? target?.username} (${target?.username})`}
            testId="change-branch-drawer"
        >
            <Box>
                {formError && (
                    <Alert severity="error" sx={{ mb: 2 }} data-testid="change-branch-error">
                        {formError}
                    </Alert>
                )}

                <TextField
                    select
                    label="New branch"
                    fullWidth
                    value={selectedId}
                    onChange={e => setSelectedId(e.target.value)}
                    disabled={loading}
                    SelectProps={{ MenuProps: roundedMenuProps(SHEET_Z_INDEX + 10) }}
                    sx={{ mb: 2, ...ROUNDED_FIELD_SX }}
                    data-testid="change-branch-select"
                >
                    {destinations.map(b => (
                        <MenuItem key={b.id} value={String(b.id)}>{b.branchName}</MenuItem>
                    ))}
                </TextField>

                {/* A manager can send their own staff away but cannot reach into another branch
                    to bring them back -- worth saying before they do it, not after. */}
                <Alert severity="info" sx={{ mb: 2.5 }}>
                    Once moved, this person appears on the new branch's roster. The new branch's
                    manager administers them from then on.
                </Alert>

                <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    disabled={submitting || selectedId === ""}
                    onClick={() => { void handleSubmit(); }}
                    sx={{ ...BRAND_BUTTON_SX, mb: 1 }}
                    data-testid="change-branch-submit"
                >
                    Move
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
