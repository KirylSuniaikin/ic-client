import * as React from "react";
import {useEffect, useState} from "react";
import {cashUpdate, getBranchBalance} from "../api/api";
import {BackTopBar} from "../consumptionComponents/BackTopBar";
import {Box, Button, Card, CardContent, CircularProgress, Dialog, Grid, Stack, Typography} from "@mui/material";
import {CashUpdateType} from "../types/branchBalanceTypes";
import CashInputDrawer from "./CashInputDrawer";
import ErrorSnackbar from "../../adminComponents/ErrorSnackbar";
import TransactionDetailsTable from "./TransactionDetailsTable";

type Props = {
    branchId: string;
    open: boolean;
    handleClose: () => void;
    branchName: string;
}

const cardBg = "#FFFFFF";
const buttonBg = "#F0F0F0";
const brandBlack = "#000000";

export default function CashRegisterPopup({branchId, open, handleClose, branchName}: Props) {
    const [balance, setBalance] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorSnackbarOpen, setErrorSnackbarOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>();
    const [historyOpen, setHistoryOpen] = useState(false);
    const [cashInputDrawerOpen, setCashInputDrawerOpen] = useState<{
        open: boolean;
        type: CashUpdateType
    }>({
        open: false,
        type: CashUpdateType.CASH_IN
    });

    useEffect(() => {
        if (!open) return;

        let isMounted = true;
        setLoading(true);

        const fetchBalance = async () => {
            try {
                const response = await getBranchBalance(branchId);
                if (isMounted) {
                    setBalance(response.branchBalance || 0);
                }
            } catch (error) {
                console.error("Failed to load balance", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchBalance();

        return () => {
            isMounted = false;
        };
    }, [branchId, open]);

    const formattedBalance = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(balance);

    const onCashUpdateClick = (type: CashUpdateType) => {
        setCashInputDrawerOpen({open: true, type: type});
    }

    const handleSubmit = async (amount: number, type: CashUpdateType, note: string) => {
        setLoading(true);
        const resp = await cashUpdate({amount: amount, branchId: branchId, cashUpdateType: type, note: note});
        const data = await resp.json();
        if (resp.ok) {
            setBalance(data.branchBalance)
        }
        if (!resp.ok) {
            const massage = data.message
            setErrorMessage(massage)
            setErrorSnackbarOpen(true)
        }

        setLoading(false);
    }

    return (
        <>
            <Dialog
                open={open}
                onClose={handleClose}
                fullScreen
                sx={{
                    "& .MuiDialog-paper": {
                        backgroundColor: "#fbfaf6",
                    }
                }}
            >
                <BackTopBar title="Cash Register" onClose={handleClose}/>

                <Box sx={{p: 2, mt: 1}}>
                    <Card
                        elevation={0}
                        sx={{
                            borderRadius: 4,
                            backgroundColor: cardBg,
                            boxShadow: 4,
                            p: 1
                        }}
                    >
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>
                                    Cash Balance ({branchName})
                                </Typography>

                                <Button
                                    onClick={() => setHistoryOpen(true)}
                                    sx={{
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        color: '#007AFF',
                                        minWidth: 'auto',
                                        padding: '4px 8px',
                                    }}
                                >
                                    Details &gt;
                                </Button>
                            </Stack>

                            {loading ? (
                                <Box sx={{height: 60, display: 'flex', alignItems: 'center'}}>
                                    <CircularProgress size={30}/>
                                </Box>
                            ) : (
                                <Typography variant="h3" sx={{fontWeight: "800", mb: 4}}>
                                    {formattedBalance} <Typography component="span" variant="h5" color="text.secondary"
                                                                   fontWeight="bold">BD</Typography>
                                </Typography>
                            )}

                            <Grid container spacing={2}>
                                <Grid size={{xs: 6}}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        disableElevation
                                        sx={{
                                            backgroundColor: buttonBg,
                                            color: brandBlack,
                                            borderRadius: 8,
                                            textTransform: "none",
                                            fontWeight: 700,
                                            fontSize: "1rem",
                                            py: 1.5,
                                            "&:hover": {
                                                backgroundColor: "#e0e0e0"
                                            }
                                        }}
                                        onClick={() => onCashUpdateClick(CashUpdateType.CASH_IN)}
                                    >
                                        Add Cash
                                    </Button>
                                </Grid>
                                <Grid size={{xs: 6}}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        disableElevation
                                        sx={{
                                            backgroundColor: buttonBg,
                                            color: brandBlack,
                                            borderRadius: 8,
                                            textTransform: "none",
                                            fontWeight: 700,
                                            fontSize: "1rem",
                                            py: 1.5,
                                            "&:hover": {
                                                backgroundColor: "#e0e0e0"
                                            }
                                        }}
                                        onClick={() => onCashUpdateClick(CashUpdateType.CASH_OUT)}
                                    >
                                        Cash Out
                                    </Button>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Box>
            </Dialog>

            <CashInputDrawer type={cashInputDrawerOpen.type} open={cashInputDrawerOpen.open} onSubmit={handleSubmit}
                             onClose={() => setCashInputDrawerOpen({open: false, type: cashInputDrawerOpen.type})}/>

            <ErrorSnackbar open={errorSnackbarOpen} message={errorMessage} severity="error"
                           handleClose={() => setErrorSnackbarOpen(false)}/>

            <TransactionDetailsTable branchId={branchId} open={historyOpen} onClose={() => setHistoryOpen(false)}
            />
        </>
    );
}