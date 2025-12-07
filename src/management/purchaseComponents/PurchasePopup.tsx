import React, {useEffect, useState} from "react";
import {BasePurchaseResponse} from "../types/purchaseTypes";
import {fetchPurchaseReports, getBranchInfo, getUser} from "../api/api";
import {IBranch, IUser} from "../types/inventoryTypes";
import {Alert, Box, CircularProgress, Container, Dialog, Stack, Typography} from "@mui/material";
import {PurchaseCard} from "./PurchaseCard";
import {PurchaseTopBar} from "./PurchaseTopBar";
import {PurchaseTablePopup} from "./PurchaseTablePopup";

type Props = {
    open: boolean;
    onClose: () => void;
    adminId: number;
    branchNo: number;
};

export function PurchasePopup({open, onClose, adminId, branchNo}: Props) {
    const [purchaseReports, setPurchaseReports] = useState<BasePurchaseResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [admin, setAdmin] = useState<IUser>();
    const [branch, setBranch] = useState<IBranch>();
    const [purchasePopup, setPurchasePopup] = useState<{
        open: boolean;
        mode: "new" | "edit";
        purchaseId?: number;
    }>({open: false, mode: "new"});

    function upsertReport(list: BasePurchaseResponse[], next: BasePurchaseResponse): BasePurchaseResponse[] {
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
                const [baseManagementResponse, userResponse, branchResponse] = await Promise.all([
                    fetchPurchaseReports(),
                    getUser(adminId),
                    getBranchInfo(branchNo),
                ]);
                if (alive) {
                    setPurchaseReports(baseManagementResponse);
                    setAdmin(userResponse);
                    setBranch(branchResponse);
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Failed to load";
                if (alive) setError(msg);
                console.error(msg);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [adminId, branchNo])

    function handleCreatePurchaseClick() {
        setPurchasePopup({open: true, mode: "new"});
    }

    function handleEditClick(purchaseId: number) {
        setPurchasePopup({open: true, mode: "edit", purchaseId});
    }

    function handleCloseClick() {
        setPurchasePopup({open: false, mode: "new"});
    }

    if (loading) {
        return (
            <Box sx={{display: "grid", placeItems: "center", minHeight: 240}}>
                <CircularProgress/>
            </Box>
        );
    }

    return (
        <>
            {error && (
                <Box sx={{p: 2}}>
                    <Alert severity="error">{error}</Alert>
                </Box>
            )}
            <Dialog
                fullScreen
                open={open}
                onClose={onClose}
                PaperProps={{
                    sx: {
                        backgroundColor: "#fbfaf6",
                    }
                }}>
                <PurchaseTopBar
                    onClose={onClose}
                    onNewClick={handleCreatePurchaseClick}
                ></PurchaseTopBar>

                <Container
                    maxWidth="sm"
                    sx={{
                        pt: `${64 + 12}px`,
                        pb: 3,
                    }}
                >
                    {purchaseReports.length === 0 ? (
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
                            <Typography color="text.secondary">No purchase reports yet</Typography>
                        </Box>
                    ) : (
                        <Stack gap={1.5} sx={{pb: 2}}>
                            {purchaseReports.map((r) => (
                                <Box key={r.id}>
                                    <PurchaseCard
                                        report={r}
                                        onEditClick={() => {
                                            handleEditClick(r.id)
                                        }}
                                    />
                                </Box>
                            ))}
                        </Stack>
                    )}
                </Container>
            </Dialog>
            {purchasePopup.open && (
                <PurchaseTablePopup
                    open={purchasePopup.open}
                    mode={purchasePopup.mode}
                    purchaseId={purchasePopup?.purchaseId}
                    userId={admin ? admin.id : adminId}
                    branch={branch}
                    onClose={handleCloseClick}
                    onSaved={(report) => {
                        setPurchaseReports(prev => upsertReport(prev, report));
                    }}
                />
            )}

            {loading && (
                <Box sx={{position: 'fixed', top: 64, right: 16, zIndex: 1500}}>
                    <CircularProgress size={24}/>
                </Box>
            )}

            {error && (
                <Alert severity="error">{error}</Alert>
            )}
        </>
    );
}