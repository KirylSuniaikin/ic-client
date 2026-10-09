import React from "react";
import { Box, CircularProgress, Drawer, Typography } from "@mui/material";
import type { StaffRoles } from "../../../auth/types";
import { useMyDiscipline } from "../hooks/useMyDiscipline";
import { useMyWorkSummary } from "../hooks/useMyWorkSummary";
import { canDispute, isExplanationWindowOpen, partitionViolations } from "../violations";
import ScoreBadge from "./ScoreBadge";
import ZoneChip from "./ZoneChip";
import ViolationList from "./ViolationList";
import LastMonthWorkCard from "./LastMonthWorkCard";
import ExplanationForm from "./ExplanationForm";
import DisputeButton from "./DisputeButton";

export type MyProfileDrawerProps = {
    open: boolean;
    onClose: () => void;
    userName: string;
    role: StaffRoles | null;
};

const SectionTitle: React.FC<{ children: string }> = ({ children }) => (
    <Typography sx={{ fontWeight: 700, fontSize: 15, mt: 2, mb: 1 }}>{children}</Typography>
);

const ErrorText: React.FC<{ message: string }> = ({ message }) => (
    <Typography role="alert" variant="body2" color="error" sx={{ mb: 1 }}>{message}</Typography>
);

const MyProfileDrawer: React.FC<MyProfileDrawerProps> = ({ open, onClose, userName }) => {
    const discipline = useMyDiscipline(open);
    const work = useMyWorkSummary(open);
    const { record } = discipline;
    const { active, pending } = partitionViolations(record?.violations ?? []);

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxHeight: "90vh",
                    overflowY: "auto",
                    maxWidth: { sm: 500 },
                    mx: { sm: "auto" },
                },
            }}
        >
            <Box sx={{ p: 3, pb: 4 }} data-testid="my-profile-drawer">
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 18 }}>My profile</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{userName}</Typography>

                {discipline.error !== null && <ErrorText message={discipline.error} />}
                {work.error !== null && <ErrorText message={work.error} />}
                {(discipline.loading || work.loading) && <CircularProgress size={20} />}

                {record !== null && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                        <ScoreBadge score={record.score} zone={record.zone} size="lg" testId="my-profile-score" />
                        <ZoneChip zone={record.zone} />
                        <Typography>{`Score ${record.score}`}</Typography>
                    </Box>
                )}

                {work.summary !== null && <LastMonthWorkCard summary={work.summary} />}

                {record !== null && (
                    <>
                        <SectionTitle>Active violations</SectionTitle>
                        <ViolationList
                            violations={active}
                            emptyText="No active violations"
                            testIdPrefix="my-active-violation"
                            renderActions={(v) =>
                                canDispute(v) ? (
                                    <DisputeButton violationId={v.id} onDone={discipline.refresh} />
                                ) : null
                            }
                        />

                        {pending.length > 0 && (
                            <>
                                <SectionTitle>Awaiting your explanation</SectionTitle>
                                <ViolationList
                                    violations={pending}
                                    emptyText=""
                                    testIdPrefix="my-pending-violation"
                                    renderActions={(v) =>
                                        v.explainedAt === null && isExplanationWindowOpen(v, Date.now()) ? (
                                            <ExplanationForm violationId={v.id} onDone={discipline.refresh} />
                                        ) : null
                                    }
                                />
                            </>
                        )}

                        <SectionTitle>History</SectionTitle>
                        <ViolationList
                            violations={record.violations}
                            emptyText="No violations on record"
                            testIdPrefix="my-history-violation"
                        />
                    </>
                )}
            </Box>
        </Drawer>
    );
};

export default MyProfileDrawer;
