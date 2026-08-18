import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import AddIcon from "@mui/icons-material/Add";
import { format } from "date-fns";
import { fetchCurrentPrepPlan, generatePrepPlan } from "../../../../shared/api/management";
import { formatUnit } from "../../../../shared/utils/unitFormat";
import type { PrepPlanResponse } from "../../prep-plan/types";

type PrepPlanTableProps = { branchIds: string[] };

// Branch selection now lives in StatisticsComponent's shared multi-select scope
// (MULTIBRANCH_SPEC.md Part 4) — this table just renders whatever ids it's given.
export default function PrepPlanTable({ branchIds }: PrepPlanTableProps): JSX.Element {
    const [plan, setPlan] = useState<PrepPlanResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Used to discard stale in-flight results when the branch selection changes
    const currentBranchRef = useRef<string | null>(null);

    const joinedBranchIds = branchIds.join(",");

    const roundNum = (num: number) => {
        if(num>=1000) return Math.round(num / 50) * 50;

        return num.toFixed(0);
    }

    // Backend merges rows server-side when more than one branch is joined — never
    // merge client-side here.
    const loadPlan = useCallback(async (joinedIds: string): Promise<void> => {
        currentBranchRef.current = joinedIds;

        setLoading(true);
        setError(null);
        try {
            const result = await fetchCurrentPrepPlan(joinedIds);
            // Discard if the selection changed while the request was in flight
            if (currentBranchRef.current !== joinedIds) return;
            setPlan(result);
        } catch (err) {
            if (currentBranchRef.current !== joinedIds) return;
            setPlan(null);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            if (currentBranchRef.current === joinedIds) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (joinedBranchIds === "") return;
        void loadPlan(joinedBranchIds);
    }, [joinedBranchIds, loadPlan]);

    // Fans out the existing single-branch generate endpoint once per selected branch
    // (no new endpoint) with allSettled, so one branch's failure doesn't hide the others'
    // success — same posture as PurchaseTablePopup's invoice-photo sync.
    const handleGenerate = async (): Promise<void> => {
        if (branchIds.length === 0) return;
        setGenerating(true);
        try {
            const results = await Promise.allSettled(
                branchIds.map((id) => generatePrepPlan({ branchId: id }))
            );
            const failedBranchIds = results
                .map((result, idx) => (result.status === "rejected" ? branchIds[idx] : null))
                .filter((id): id is string => id !== null);

            await loadPlan(joinedBranchIds);

            if (failedBranchIds.length > 0) {
                const label = failedBranchIds.length > 1 ? "branches" : "branch";
                setError(`Failed to generate plan for ${label}: ${failedBranchIds.join(", ")}`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setGenerating(false);
        }
    };

    const handleConfirmRegenerate = async (): Promise<void> => {
        setConfirmOpen(false);
        await handleGenerate();
    };

    return (
        <Box
            sx={{
                mb: 2,
                mt: 1,
                p: 2,
                borderRadius: 3,
                backgroundColor: "#fff",
                boxShadow: 3,
            }}
        >
            {/* Header row */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                    Prep Plan
                </Typography>
            </Box>

            {/* Error */}
            {error !== null && (
                <Typography color="error" fontSize="13px" sx={{ mb: 1 }}>
                    {error}
                </Typography>
            )}

            {/* Loading */}
            {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                    <CircularProgress size={32} />
                </Box>
            )}

            {/* Empty state — no plan generated */}
            {!loading && plan === null && error === null && branchIds.length > 0 && (
                <Box sx={{ textAlign: "center", py: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        No plan generated yet
                    </Typography>
                    <Button
                        variant="contained"
                        disabled={generating}
                        startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
                        onClick={() => void handleGenerate()}
                        sx={{
                            backgroundColor: "#E44B4C",
                            color: "#fff",
                            textTransform: "none",
                            fontWeight: "bold",
                            borderRadius: 2,
                            boxShadow: "none",
                            "&:hover": { backgroundColor: "#c73c3d" },
                        }}
                    >
                        Generate
                    </Button>
                </Box>
            )}

            {/* Plan loaded */}
            {!loading && plan !== null && (
                <>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            mb: 1,
                            flexWrap: "wrap",
                            gap: 1,
                        }}
                    >
                        <Typography variant="caption" color="text.secondary">
                            Last updated: {format(new Date(plan.createdAt), "EEEE, MMM d, HH:mm")}
                        </Typography>
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={generating}
                            startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AutorenewIcon />}
                            onClick={() => setConfirmOpen(true)}
                            sx={{
                                textTransform: "none",
                                borderColor: "#E44B4C",
                                color: "#E44B4C",
                                borderRadius: 2,
                                "&:hover": { borderColor: "#c73c3d", color: "#c73c3d" },
                            }}
                        >
                            Regenerate
                        </Button>
                    </Box>

                    <TableContainer sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                        <Table size="small" sx={{ minWidth: 360, "& .MuiTableCell-root": { whiteSpace: "nowrap" } }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600 }}>Component</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Workday Amount</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Weekend Amount</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Unit</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {plan.rows.map((row) => (
                                    <TableRow key={row.componentId}>
                                        <TableCell>{row.name}({(row.yieldMultiplier*100).toFixed(0)}%)</TableCell>
                                        <TableCell>{roundNum(row.amount*0.85)}</TableCell>
                                        <TableCell>{roundNum(row.amount*1.15)}</TableCell>
                                        <TableCell>{formatUnit(row.unit)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </>
            )}

            {/* Confirmation dialog for regenerate */}
            <Dialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: "14px",
                        width: 270,
                        m: 2,
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        fontSize: "13px",
                        fontWeight: 600,
                        textAlign: "center",
                        pb: 0.5,
                        pt: 2.5,
                    }}
                >
                    Regenerate Plan
                </DialogTitle>
                <DialogContent sx={{ textAlign: "center", pb: 1.5 }}>
                    <Typography fontSize="13px" color="text.secondary">
                        This will replace the current prep plan. Continue?
                    </Typography>
                </DialogContent>
                <Divider />
                <DialogActions sx={{ p: 0 }}>
                    <Button
                        fullWidth
                        onClick={() => setConfirmOpen(false)}
                        sx={{
                            borderRadius: 0,
                            py: 1.4,
                            fontSize: "13px",
                            color: "text.secondary",
                            fontWeight: 400,
                            borderRight: "0.5px solid",
                            borderColor: "divider",
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        fullWidth
                        onClick={() => void handleConfirmRegenerate()}
                        sx={{
                            borderRadius: 0,
                            py: 1.4,
                            fontSize: "13px",
                            color: "#E44B4C",
                            fontWeight: 600,
                        }}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
