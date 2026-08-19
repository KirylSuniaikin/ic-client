import { logger } from "../../../../shared/utils/logger";
import React, {useEffect, useState} from "react";
import {IBranch} from "../../inventory/types";
import {BaseShiftResponse} from "../types";
import {getReports} from "../../../../shared/api/management";
import {Alert, Box, Button, Container, Dialog, Stack, Typography} from "@mui/material";
import {LoadingIndicator} from "../../../../shared/components/LoadingIndicator";
import {ShiftCard} from "./ShiftCard";
import {ShiftTablePopup} from "./ShiftTablePopup";
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";
import {BranchSelectorComponent} from "../../_shared/components/BranchSelectorComponent";
import {useBranchScope} from "../../_shared/hooks/useBranchScope";

type Props = {
    open: boolean;
    onClose: () => void;
    branch: IBranch;
}

export function ShiftHomePage({ open, onClose, branch }: Props) {
    const {branches, branch: scopedBranch, setBranch: setScopedBranch, canSwitch} = useBranchScope(branch);
    const [shiftReports, setShiftReports] = useState<BaseShiftResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shiftTableOpen, setShiftTableOpen] = useState<{
        open: boolean,
        mode: "new" | "edit";
        shiftReportId?: number;
    }>({
        open: false,
        mode: "new",
    });

    function upsertReport(list: BaseShiftResponse[], next: BaseShiftResponse): BaseShiftResponse[] {
        const idx = list.findIndex(r => r.id === next.id);
        if (idx === -1) return [next, ...list];
        const copy = list.slice();
        copy[idx] = next;
        return copy;
    }

    useEffect(() => {
        let alive = true;
        (async () => {
            setLoading(true);
            setError(null);
            try{
                const [baseShiftResponse] = await Promise.all([
                    getReports({ branchId: scopedBranch.id.toString(), reportType: 'SHIFT_REPORT' }),
                ]);
                if (alive) {
                    setShiftReports(baseShiftResponse);
                }
            }
            catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Failed to load";
                if (alive) setError(msg);
                logger.error(msg);
            }
            finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {alive = false;};
    }, [scopedBranch]);

    function handleCreateShiftReportClick() {
        setShiftTableOpen({open: true, mode: "new"});
    }

    function handleEditClick(id: number)  {
        setShiftTableOpen({open: true, mode: "edit", shiftReportId: id});
    }

    return (
        <>
            <Dialog fullScreen
                    open={open}
                    onClose={onClose}
                    PaperProps={{
                        sx:
                            {
                                backgroundColor: "#fbfaf6",
                            }
                    }}>
                <ManagementTopBar
                    title="Shifts"
                    onBack={onClose}
                    branchSelector={canSwitch ? (
                        <BranchSelectorComponent
                            branches={branches}
                            selectedBranch={scopedBranch}
                            onBranchChange={setScopedBranch}
                        />
                    ) : undefined}
                    actions={
                        <Button
                            variant="contained"
                            onClick={handleCreateShiftReportClick}
                            sx={{ borderRadius: 4, textTransform: "none", fontWeight: 700, bgcolor: "#E44B4C" }}
                        >
                            New Report
                        </Button>
                    }
                />

                <Container maxWidth="sm" sx={{ mt: 2, pb: 3 }}>
                    {loading && <LoadingIndicator />}

                    {error && !loading && (
                        <Box sx={{ p: 2 }}>
                            <Alert severity="error">{error}</Alert>
                        </Box>
                    )}

                    {!loading && !error && (shiftReports.length === 0 ? (
                        <Box
                            sx={{
                                mt: 2,
                                p: 3,
                                border: "1px dashed",
                                borderColor: "divider",
                                borderRadius: 2,
                                textAlign: "center",
                            }}
                        >
                            <Typography color="text.secondary">No reports yet</Typography>
                        </Box>
                    ) : (
                        <Stack gap={1.5} sx={{ pb: 2 }}>
                            {shiftReports.map((r) => (
                                <Box key={r.id}>
                                    <ShiftCard
                                        report={r}
                                        onEditClick={() => {handleEditClick(r.id)}}
                                    />
                                </Box>
                            ))}
                        </Stack>
                    ))}
                </Container>
            </Dialog>
            {shiftTableOpen.open===true &&
                <ShiftTablePopup
                    open={shiftTableOpen.open}
                    mode={shiftTableOpen.mode}
                    shiftReportId={shiftTableOpen?.shiftReportId}
                    branch={scopedBranch}
                    onClose={() => setShiftTableOpen({mode: "new", open: false})}
                    onSaved={(report) => {
                        setShiftReports(prev => upsertReport(prev, report))}
                    }
                />
            }
        </>
    )
}
