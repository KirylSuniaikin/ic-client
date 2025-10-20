import {useEffect, useState} from "react";
import {IBranch, IManagementResponse, IUser} from "./types.ts";
import {useNavigate, useSearchParams} from "react-router-dom";
import {getBaseManagementReports, getBranchInfo, getUser} from "./api.ts";
import {
    Box, Button,
    CircularProgress, Container, IconButton, Stack, Typography
} from "@mui/material";
import ReportCard from "./ReportCard.tsx";
import * as React from "react";
import ManagementTopBar from "./ManagementTopBar.tsx";
import InventoryPopup from "./InventoryPopup.tsx";
import CloseIcon from "@mui/icons-material/Close";

type Props = {branchNo : number}

export default function ManagementPage({branchNo}: Props) {
    const navigate = useNavigate();
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
    const [searchParams] = useSearchParams();

    const id: number  = Number(searchParams.get("user_id"));

    function handleCreateReportClick() {
        setInventoryPopup({open: true, mode: "new"});
    }

    function returnToAdminPage(){
        navigate("/admin");
    }


    function handleEditClick(reportId: number) {
        setInventoryPopup({ open: true, mode: "edit", reportId });
    }

    function handleCloseInventoryPopup() {
        setInventoryPopup(prev => ({ ...prev, open: false }));
        navigate(0);
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
                    getUser(id)
                ]);
                if (alive) {
                    setReports(baseManagementResponse);
                    setBranch(branchResponse);
                    setAdmin(userResponse);
                }
            }
            catch(e: any) {
                if (alive) setError(e?.message ?? "Failed to load");
            }
            finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {alive = false;};
    }, [branchNo]);

    if (loading) {
        return (
            <Box sx={{ display: "grid", placeItems: "center", minHeight: 240 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
        <Container maxWidth="lg" sx={{ py: 3 }}>
            <ManagementTopBar
                title={
                    <>
                        Reports For Branch #{branchNo}
                    </>
                }
                right={
                <>
                    <Button
                        variant="contained"
                        onClick={() => handleCreateReportClick()}
                        sx={{ bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e"}, borderRadius: 4 }}
                    >
                        New
                    </Button>
                    <IconButton edge="end" color="inherit" onClick={returnToAdminPage} aria-label="close">
                    <CloseIcon />
                    </IconButton>
                </>
                }
            />

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
            {inventoryPopup.open && (
                <InventoryPopup
                    open={inventoryPopup.open}
                    mode={inventoryPopup.mode}
                    reportId={inventoryPopup.reportId}
                    branch={branch}
                    author={admin}
                    onClose={handleCloseInventoryPopup}
                />
            )}
        </>
    );
}