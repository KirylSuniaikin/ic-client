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
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import AddIcon from "@mui/icons-material/Add";
import { format } from "date-fns";
import { BranchSelectorComponent } from "./BranchSelectorComponent";
import { fetchAllBranches, fetchCurrentPrepPlan, generatePrepPlan } from "../management/api/api";
import type { IBranch } from "../management/types/inventoryTypes";
import type { PrepPlanResponse, PrepPlanUnit } from "../management/types/prepPlanTypes";

type PrepPlanTableProps = { branchId: string };

export function formatPrepPlanUnit(unit: PrepPlanUnit | string): string {
    if (unit === "GRAMS") return "g";
    if (unit === "PIECES") return "pcs";
    if (unit === "ML") return "ml";
    return unit;
}

export default function PrepPlanTable({ branchId }: PrepPlanTableProps): JSX.Element {
    const [branches, setBranches] = useState<IBranch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<IBranch | null>(null);
    const [plan, setPlan] = useState<PrepPlanResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Used to discard stale in-flight results when the branch changes
    const currentBranchRef = useRef<number | null>(null);

    const roundNum = (num: number) => {
        if(num>=1000) return Math.round(num / 50) * 50;

        return num.toFixed(0);
    }

    const loadPlan = useCallback(async (branch: IBranch): Promise<void> => {
        const branchId = branch.id;
        currentBranchRef.current = branchId;

        setLoading(true);
        setError(null);
        try {
            const result = await fetchCurrentPrepPlan(branchId);
            // Discard if branch changed while request was in flight
            if (currentBranchRef.current !== branchId) return;
            setPlan(result);
        } catch (err) {
            if (currentBranchRef.current !== branchId) return;
            setPlan(null);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            if (currentBranchRef.current === branchId) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function init(): Promise<void> {
            try {
                const allBranches = await fetchAllBranches();
                if (cancelled) return;
                setBranches(allBranches);
                if (allBranches.length === 0) return;

                const matched = allBranches.find((b) => b.externalId === branchId) ?? allBranches[0];
                setSelectedBranch(matched);
                await loadPlan(matched);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : String(err));
            }
        }

        void init();
        return () => {
            cancelled = true;
        };
    }, [branchId, loadPlan]);

    const handleBranchChange = (newBranch: IBranch): void => {
        setSelectedBranch(newBranch);
        void loadPlan(newBranch);
    };

    const handleGenerate = async (): Promise<void> => {
        if (!selectedBranch) return;
        setGenerating(true);
        setError(null);
        try {
            await generatePrepPlan({ branchId: selectedBranch.id });
            await loadPlan(selectedBranch);
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
                {branches.length > 0 && selectedBranch !== null && (
                    <BranchSelectorComponent
                        branches={branches}
                        selectedBranch={selectedBranch}
                        onBranchChange={handleBranchChange}
                    />
                )}
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
            {!loading && plan === null && error === null && branches.length > 0 && (
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

                    <Table size="small">
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
                                    <TableCell>{row.name}</TableCell>
                                    <TableCell>{roundNum(row.amount*0.85)}</TableCell>
                                    <TableCell>{roundNum(row.amount*1.15)}</TableCell>
                                    <TableCell>{formatPrepPlanUnit(row.unit)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
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
