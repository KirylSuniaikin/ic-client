import { logger } from "../../../../shared/utils/logger";
import {useEffect, useMemo, useState} from "react";
import {IBranch, IManagementResponse, IUser} from "../types";
import {getReports, getBranchInfo, getUser} from "../../../../shared/api/management";
import {
    Alert,
    Box,
    Button,
    CircularProgress, Container, Dialog, Stack, Typography
} from "@mui/material";
import ReportCard from "./ReportCard";
import * as React from "react";
import InventoryPopup from "./InventoryPopup";
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";
import {useIncrementalList} from "../../../../shared/hooks/useIncrementalList";
import {InfiniteScrollSentinel} from "../../../../shared/components/InfiniteScrollSentinel";
import {BranchSelectorComponent} from "../../_shared/components/BranchSelectorComponent";
import {useBranchScope} from "../../_shared/hooks/useBranchScope";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    branch: IBranch;
    user: IUser;
};

export default function ManagementPage({isOpen, onClose, branch, user}: Props) {
    const {branches, branch: scopedBranch, setBranch: setScopedBranch, canSwitch} = useBranchScope(branch);
    const [reports, setReports] = useState<IManagementResponse[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [inventoryPopup, setInventoryPopup] = useState<
        {
            open: boolean;
            mode: "new" | "edit";
            reportId?: number;
        }>
    ({open: false, mode: "new"});

    // The endpoint already returns newest first, so the first page IS the latest reports.
    const {visible: visibleReports, hasMore, sentinelRef} = useIncrementalList(reports, {
        resetKey: scopedBranch.id.toString(),
    });

    function handleCreateReportClick() {
        setInventoryPopup({open: true, mode: "new"});
    }


    function handleEditClick(reportId: number) {
        setInventoryPopup({open: true, mode: "edit", reportId});
    }

    function handleCloseInventoryPopup() {
        setInventoryPopup(prev => ({...prev, open: false}));
    }

    function upsertReport(list: IManagementResponse[], next: IManagementResponse): IManagementResponse[] {
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
            try {
                const [baseManagementResponse] = await Promise.all([
                    getReports({ branchId: scopedBranch.id.toString(), reportType: 'INVENTORY' }),
                ]);
                if (alive) {
                    setReports(baseManagementResponse);
                }
            } catch (e: any) {
                if (alive) setError(e?.message ?? "Failed to load");
                logger.error(error);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [scopedBranch]);


    return (
        <>
            <Dialog fullScreen
                    open={isOpen}
                    onClose={onClose}
                    PaperProps={{
                        sx: {
                            backgroundColor: "#fbfaf6",
                        }
                    }}>
                <ManagementTopBar
                    title="Inventory"
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
                            onClick={handleCreateReportClick}
                            sx={{ borderRadius: 4, textTransform: "none", fontWeight: 700, bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e" } }}
                        >
                            New Report
                        </Button>
                    }
                />
                <Container maxWidth="lg" sx={{py: 3, backgroundColor: "#fbfaf6"}}>
                    {loading ? (
                        <Box sx={{display: "grid", placeItems: "center", minHeight: 240}}>
                            <CircularProgress/>
                        </Box>
                    ) : reports.length === 0 ? (
                        <Box
                            sx={{
                                p: 3,
                                border: "1px dashed",
                                borderColor: "divider",
                                borderRadius: 2,
                                textAlign: "center",
                            }}
                        >
                            <Typography color="text.secondary">There are no reports</Typography>
                        </Box>
                    ) : (
                        <>
                            <Stack gap={2}>
                                {visibleReports.map((r) => (
                                    <Box key={r.id}>
                                        <ReportCard
                                            report={r}
                                            onEditClick={() => handleEditClick(r.id)}
                                        />
                                    </Box>
                                ))}
                            </Stack>
                            {hasMore && <InfiniteScrollSentinel sentinelRef={sentinelRef} testId="inventory-scroll-sentinel" />}
                        </>
                    )}
                </Container>
            </Dialog>
            {inventoryPopup.open && (
                <InventoryPopup
                    open={inventoryPopup.open}
                    mode={inventoryPopup.mode}
                    reportId={inventoryPopup.reportId}
                    branch={scopedBranch}
                    author={user}
                    onClose={handleCloseInventoryPopup}
                    onSaved={(report) => {
                        setReports(prev => upsertReport(prev, report));
                    }}
                />
            )}

            {error && (
                <Alert severity="error">{error}</Alert>
            )}
        </>
    );
}