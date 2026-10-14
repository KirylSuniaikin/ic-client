import React, { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import { EntityPhotoViewer } from "../../../../shared/components/EntityPhotoViewer";
import { fetchViolationPhoto } from "../../../../shared/api/management";
import { BRAND_RED } from "../../../../shared/utils/theme";
import { shortStaffName, staffDisplayName } from "../../../../shared/utils/staffName";
import { StaffRoles, hasCityAccess } from "../../../auth/types";
import ResponsiveSheet from "../../_shared/components/ResponsiveSheet";
import type { StaffAdminTO } from "../../staff/types";
import { useStaffDiscipline } from "../hooks/useStaffDiscipline";
import type { IssueResult } from "../hooks/useIssueViolation";
import { partitionViolations } from "../violations";
import type { ViolationTO } from "../types";
import DisciplinaryDocumentActions from "./DisciplinaryDocumentActions";
import IssueViolationForm from "./IssueViolationForm";
import PendingReviewPanel from "./PendingReviewPanel";
import ScoreBadge from "./ScoreBadge";
import ViolationList from "./ViolationList";

export type DisciplineDrawerProps = {
    open: boolean;
    target: StaffAdminTO | null;
    callerRole: StaffRoles | null;
    roster: ReadonlyArray<StaffAdminTO>;
    onClose: () => void;
    onChanged: () => void;
};

type Tab = "current" | "history" | "new";

const TOGGLE_SX = {
    columnGap: 1,
    mb: 2,
    "& .MuiToggleButtonGroup-grouped": {
        border: "1px solid #efece4",
        borderRadius: 999,
        margin: 0,
        "&:not(:first-of-type)": { marginLeft: 0, borderLeft: "1px solid #efece4" },
    },
    "& .MuiToggleButton-root": {
        textTransform: "none",
        fontWeight: 600,
        px: 2,
        py: 0.6,
        color: "#6b7079",
        backgroundColor: "#fff",
        "&:hover": { backgroundColor: "#f4f2ed" },
    },
    "& .MuiToggleButton-root.Mui-selected": {
        backgroundColor: BRAND_RED,
        color: "#fff",
        borderColor: BRAND_RED,
        "&:hover": { backgroundColor: "#d23c3d", borderColor: "#d23c3d" },
    },
} as const;

function issuedMessage(result: IssueResult): string {
    if (result.photoError !== null) {
        return `Violation recorded, but the photo could not be uploaded: ${result.photoError}`;
    }
    return result.violation.status === "PENDING_EXPLANATION"
        ? "Violation recorded — awaiting the employee's explanation"
        : "Violation recorded";
}

export default function DisciplineDrawer({
    open,
    target,
    callerRole,
    roster,
    onClose,
    onChanged,
}: DisciplineDrawerProps): React.JSX.Element {
    const [tab, setTab] = useState<Tab>("current");
    const [photoViolation, setPhotoViolation] = useState<ViolationTO | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const { record, loading, error, refresh } = useStaffDiscipline(open && target !== null ? target.id : null);

    const targetId = target?.id ?? null;
    useEffect(() => {
        setTab("current");
    }, [targetId, open]);

    const canIssueClassD = callerRole === StaffRoles.SUPER_MANAGER || callerRole === StaffRoles.OWNER;

    const isReviewer = hasCityAccess(callerRole);

    const handleReviewed = (): void => {
        refresh();
        onChanged();
    };

    const handleIssued = (result: IssueResult): void => {
        refresh();
        onChanged();
        setTab("current");
        setToast(issuedMessage(result));
    };

    const renderCurrent = (): React.JSX.Element | null => {
        if (record === null) return null;
        const { active, pending } = partitionViolations(record.violations);
        return (
            <Box data-testid="discipline-current">
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Active violations</Typography>
                <ViolationList
                    violations={active}
                    emptyText="No active violations"
                    testIdPrefix="discipline-active"
                />
                {isReviewer && (
                    <PendingReviewPanel violations={record.violations} onChanged={handleReviewed} />
                )}
                {!isReviewer && pending.length > 0 && (
                    <>
                        <Typography sx={{ fontWeight: 700, mb: 1, mt: 2 }}>Awaiting explanation</Typography>
                        <ViolationList violations={pending} emptyText="" testIdPrefix="discipline-pending" />
                    </>
                )}
            </Box>
        );
    };

    const renderDocumentActions = (v: ViolationTO): React.ReactNode => {
        const action = record?.actions.find((a) => a.id === v.actionId);
        if (action === undefined || target === null) return null;
        return (
            <DisciplinaryDocumentActions
                action={action}
                employeeId={target.id}
                roster={roster}
                onChanged={handleReviewed}
            />
        );
    };

    const renderHistory = (): React.JSX.Element | null => {
        if (record === null) return null;
        return (
            <Box data-testid="discipline-history">
                <ViolationList
                    violations={record.violations}
                    emptyText="No violations on record"
                    testIdPrefix="discipline-history-item"
                    onViewPhoto={setPhotoViolation}
                    renderActions={isReviewer ? renderDocumentActions : undefined}
                />
            </Box>
        );
    };

    return (
        <>
            <ResponsiveSheet
                open={open}
                onClose={onClose}
                title="Discipline"
                subtitle={
                    target ? (
                        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                            {shortStaffName(staffDisplayName(target))}
                            {record !== null && (
                                <ScoreBadge score={record.score} zone={record.zone} size="md" testId="discipline-score-badge" />
                            )}
                        </Box>
                    ) : undefined
                }
                testId="discipline-drawer"
            >
                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={tab}
                    onChange={(_, v: Tab | null) => v && setTab(v)}
                    sx={TOGGLE_SX}
                >
                    <ToggleButton value="current" data-testid="discipline-tab-current">Current</ToggleButton>
                    <ToggleButton value="history" data-testid="discipline-tab-history">History</ToggleButton>
                    <ToggleButton value="new" data-testid="discipline-tab-new">Give new punishment</ToggleButton>
                </ToggleButtonGroup>

                {tab !== "new" && loading && record === null && (
                    <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
                        <CircularProgress data-testid="discipline-loading" />
                    </Box>
                )}
                {tab !== "new" && error !== null && (
                    <Alert severity="error" data-testid="discipline-error">{error}</Alert>
                )}
                {tab === "current" && renderCurrent()}
                {tab === "history" && renderHistory()}
                {/* Kept mounted (hidden) so a half-written violation survives a peek at another tab. */}
                {target !== null && (
                    <Box hidden={tab !== "new"}>
                        <IssueViolationForm
                            staffId={target.id}
                            canIssueClassD={canIssueClassD}
                            onIssued={handleIssued}
                        />
                    </Box>
                )}
            </ResponsiveSheet>

            <EntityPhotoViewer
                open={photoViolation !== null}
                onClose={(): void => setPhotoViolation(null)}
                blob={null}
                serverId={photoViolation?.id ?? null}
                fetchImage={fetchViolationPhoto}
                title="Evidence photo"
                testIdPrefix="violation-photo"
            />

            <ErrorSnackbar
                open={toast !== null}
                message={toast ?? ""}
                severity="success"
                handleClose={(): void => setToast(null)}
            />
        </>
    );
}
