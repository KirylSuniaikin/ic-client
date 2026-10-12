import React, { useState } from "react";
import { Box, Button, Tooltip, Typography } from "@mui/material";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import { cancelViolation, confirmViolation, rejectDispute } from "../../../../shared/api/management";
import type { ViolationTO } from "../types";
import { canConfirmNow, hasOpenDispute } from "../violations";
import { BRAND_BUTTON_SX } from "../../_shared/components/roundedSelect";
import ReasonDrawer from "./ReasonDrawer";
import ViolationList from "./ViolationList";

export type PendingReviewPanelProps = {
    violations: ReadonlyArray<ViolationTO>;
    onChanged: () => void;
};

type ReasonTarget = { violationId: number; kind: "cancel" | "reject" };

const CONFIRM_HINT = "Confirm is available once the employee has explained or the 48 hours have passed";

const PendingReviewPanel: React.FC<PendingReviewPanelProps> = ({ violations, onChanged }) => {
    const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(new Set());
    const [reasonTarget, setReasonTarget] = useState<ReasonTarget | null>(null);
    // Kept after close so the drawer copy doesn't flip while it slides away.
    const [lastKind, setLastKind] = useState<ReasonTarget["kind"]>("cancel");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const pending = violations.filter((v) => v.status === "PENDING_EXPLANATION");
    const disputes = violations.filter(hasOpenDispute);

    const setBusy = (id: number, busy: boolean): void =>
        setBusyIds((prev) => {
            const next = new Set(prev);
            if (busy) next.add(id); else next.delete(id);
            return next;
        });

    const confirm = async (id: number): Promise<void> => {
        setBusy(id, true);
        try {
            await confirmViolation(id);
            onChanged();
        } catch (e: unknown) {
            setErrorMessage(e instanceof Error ? e.message : "Could not confirm the violation");
        } finally {
            setBusy(id, false);
        }
    };

    const submitReason = async (text: string): Promise<void> => {
        if (reasonTarget === null) return;
        const { violationId, kind } = reasonTarget;
        setBusy(violationId, true);
        try {
            if (kind === "cancel") await cancelViolation(violationId, { reason: text });
            else await rejectDispute(violationId, { note: text });
        } finally {
            setBusy(violationId, false);
        }
        onChanged();
    };

    const openReason = (violationId: number, kind: ReasonTarget["kind"]): void => {
        setLastKind(kind);
        setReasonTarget({ violationId, kind });
    };

    const cancelButton = (v: ViolationTO): React.JSX.Element => (
        <Button
            size="small"
            disabled={busyIds.has(v.id)}
            onClick={() => openReason(v.id, "cancel")}
        >
            Cancel violation
        </Button>
    );

    const pendingActions = (v: ViolationTO): React.ReactNode => {
        const allowed = canConfirmNow(v, Date.now());
        return (
            <Box sx={{ mt: 1 }}>
                {v.employeeExplanation === null && (
                    <Typography variant="body2" color="text.secondary">No explanation submitted yet</Typography>
                )}
                <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                    <Tooltip title={allowed ? "" : CONFIRM_HINT}>
                        <span>
                            <Button
                                size="small"
                                variant="contained"
                                sx={BRAND_BUTTON_SX}
                                disabled={!allowed || busyIds.has(v.id)}
                                onClick={() => void confirm(v.id)}
                            >
                                Confirm
                            </Button>
                        </span>
                    </Tooltip>
                    {cancelButton(v)}
                </Box>
            </Box>
        );
    };

    const disputeActions = (v: ViolationTO): React.ReactNode => (
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            {cancelButton(v)}
            <Button
                size="small"
                disabled={busyIds.has(v.id)}
                onClick={() => openReason(v.id, "reject")}
            >
                Reject dispute
            </Button>
        </Box>
    );

    const isCancel = lastKind === "cancel";

    return (
        <Box data-testid="pending-review-panel">
            {pending.length > 0 && (
                <>
                    <Typography sx={{ fontWeight: 700, mb: 1, mt: 2 }}>Awaiting review</Typography>
                    <ViolationList
                        violations={pending}
                        emptyText=""
                        testIdPrefix="discipline-pending"
                        renderActions={pendingActions}
                    />
                </>
            )}
            {disputes.length > 0 && (
                <>
                    <Typography sx={{ fontWeight: 700, mb: 1, mt: 2 }}>Open disputes</Typography>
                    <ViolationList
                        violations={disputes}
                        emptyText=""
                        testIdPrefix="discipline-dispute"
                        renderActions={disputeActions}
                    />
                </>
            )}
            <ReasonDrawer
                open={reasonTarget !== null}
                title={isCancel ? "Cancel violation" : "Reject dispute"}
                fieldLabel={isCancel ? "Reason" : "Note"}
                submitLabel={isCancel ? "Cancel violation" : "Reject dispute"}
                onSubmit={submitReason}
                onClose={() => setReasonTarget(null)}
            />
            <ErrorSnackbar
                open={errorMessage !== null}
                message={errorMessage ?? ""}
                severity="error"
                handleClose={() => setErrorMessage(null)}
            />
        </Box>
    );
};

export default PendingReviewPanel;
