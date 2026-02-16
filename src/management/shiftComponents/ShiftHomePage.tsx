import React, {useEffect, useState} from "react";
import {IBranch} from "../types/inventoryTypes";
import {BaseShiftResponse} from "../types/shiftTypes";
import {fetchShiftReports, getBranchInfo} from "../api/api";
import {Alert, Box, CircularProgress, Container, Dialog, Stack, Typography} from "@mui/material";
import {PurchaseTopBar} from "../purchaseComponents/PurchaseTopBar";
import {ShiftCard} from "./ShiftCard";
import {ShiftTablePopup} from "./ShiftTablePopup";
import {ShiftReportTopBar} from "./ShiftReportTopBar";

type Props = {
    open: boolean;
    onClose: () => void;
    branchId: string;
}

export function ShiftHomePage({ open, onClose, branchId }: Props) {
    const [branch, setBranch] = useState<IBranch>();
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
                const [baseShiftResponse, branchResponse] = await Promise.all([
                    fetchShiftReports(),
                    getBranchInfo(branchId)
                ]);
                if (alive) {
                    setShiftReports(baseShiftResponse);
                    setBranch(branchResponse)
                }
            }
            catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Failed to load";
                if (alive) setError(msg);
                console.error(msg);
            }
            finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {alive = false;};
    }, [branchId]);

    function handleCreateShiftReportClick() {
        setShiftTableOpen({open: true, mode: "new"});
    }

    function handleEditClick(id: number)  {
        setShiftTableOpen({open: true, mode: "edit", shiftReportId: id});
    }

    return (
        <>
            {loading &&
                <Box sx={{ display: "grid", placeItems: "center", minHeight: 240}}>
                    <CircularProgress />
                </Box>
            }

            {error &&
            <Box sx={{ p: 2 }}>
                <Alert severity="error">{error}</Alert>
            </Box>
            }

            <Dialog fullScreen
                    open={open}
                    onClose={onClose}
                    PaperProps={{
                        sx:
                            {
                                backgroundColor: "#fbfaf6",
                            }
                    }}>
                <ShiftReportTopBar
                    onClose={onClose}
                    onNewClick={handleCreateShiftReportClick}
                ></ShiftReportTopBar>

                <Container
                    maxWidth="sm"
                    sx={{
                        pt: `${64 + 12}px`,
                        pb: 3,
                    }}
                >
                    {shiftReports.length === 0 ? (
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
                    )}
                </Container>
            </Dialog>
            {shiftTableOpen.open===true &&
                <ShiftTablePopup
                    open={shiftTableOpen.open}
                    mode={shiftTableOpen.mode}
                    shiftReportId={shiftTableOpen?.shiftReportId}
                    branch={branch}
                    onClose={() => setShiftTableOpen({mode: "new", open: false})}
                    onSaved={(report) => {
                        setShiftReports(prev => upsertReport(prev, report))}
                    }
                />
            }
        </>
    )
}