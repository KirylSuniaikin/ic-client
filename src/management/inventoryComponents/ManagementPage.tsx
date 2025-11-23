import {useEffect, useState} from "react";
import {IBranch, IManagementResponse, IUser} from "../types/inventoryTypes";
import {getBaseManagementReports, getBranchInfo, getUser} from "../api/api";
import {
    Alert,
    Box,
    CircularProgress, Container, Dialog, Stack, Typography
} from "@mui/material";
import ReportCard from "./ReportCard";
import * as React from "react";
import InventoryPopup from "./InventoryPopup";
import {ManagementTopBar} from "./ManagementTopBar";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    branchNo: number;
    userId: number;
};

export default function ManagementPage({isOpen, onClose, branchNo, userId}: Props) {
    const [reports, setReports] = useState<IManagementResponse[]>([]);
    const [branch, setBranch] = useState<IBranch>();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [inventoryPopup, setInventoryPopup] = useState<
        {open: boolean;
        mode: "new" | "edit";
        reportId?: number;
    }>
    ({ open: false, mode: "new" });
    const[admin, setAdmin] = useState<IUser>();

    function handleCreateReportClick() {
        setInventoryPopup({open: true, mode: "new"});
    }


    function handleEditClick(reportId: number) {
        setInventoryPopup({ open: true, mode: "edit", reportId });
    }

    function handleCloseInventoryPopup() {
        setInventoryPopup(prev => ({ ...prev, open: false }));
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
            try{
                const [baseManagementResponse, branchResponse, userResponse] = await Promise.all([
                    getBaseManagementReports(branchNo),
                    getBranchInfo(branchNo),
                    getUser(userId)
                ]);
                if (alive) {
                    setReports(baseManagementResponse);
                    setBranch(branchResponse);
                    console.log(branchResponse);
                    setAdmin(userResponse);
                }
            }
            catch(e: any) {
                if (alive) setError(e?.message ?? "Failed to load");
                console.error(error);
            }
            finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {alive = false;};
    }, [branchNo, userId]);


    if (loading) {
        return (
            <Box sx={{ display: "grid", placeItems: "center", minHeight: 240}}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            <Dialog fullScreen
                    open={isOpen}
                    onClose={onClose}
                    sx={{
                    backgroundColor: "#fbfaf6",
                }}>
            <ManagementTopBar
                title={<>Inventory</>}
                newButtonLabel="New"
                onClose={onClose}
                onNewClick={handleCreateReportClick}
            />
        <Container maxWidth="lg" sx={{ py: 3, backgroundColor: "#fbfaf6" }}>

            {reports.length === 0 ? (
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
                 <Stack gap={2}>
                     {reports.map((r) => (
                         <Box key={r.id}>
                             <ReportCard
                                  report={r}
                                 onEditClick={() => handleEditClick(r.id)}
                               />
                         </Box>
                        ))}
                    </Stack>
                    )}
                </Container>
            </Dialog>
            {inventoryPopup.open && (
                <InventoryPopup
                    open={inventoryPopup.open}
                    mode={inventoryPopup.mode}
                    reportId={inventoryPopup.reportId}
                    branch={branch}
                    author={admin}
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