import {useEffect, useState} from "react";
import {addToBlackList, deleteFromBlackList, getAllBannedCstmrs} from "../api/api";
import {BlackListCstmr} from "../types/blacklistTypes";
import {Alert, Box, CircularProgress, Dialog, Snackbar} from "@mui/material";
import * as React from "react";
import {BackTopBar} from "../consumptionComponents/BackTopBar";
import BannedCstmrCard from "./BannedCstmrCard";
import BanCstmrDrawer from "./BanCstmrDrawer";

type Props = {
    handleClose: () => void;
    open: boolean;
}

export default function BlacklistHomepage({open, handleClose}: Props) {
    const [bannedCstmrs, setBannedCstmrs] = useState<BlackListCstmr[]>([]);
    const [loading, setLoading] = useState(false);
    const [banDrawerOpen, setBanDrawerOpen] = useState(false);
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error";
    }>({
        open: false,
        message: "",
        severity: "success",
    });

    const fetchBannedCstmrs = async () => {
        try {
            setLoading(true);
            const data = await getAllBannedCstmrs();
            setBannedCstmrs(data);
        } catch (error) {
            console.error("Error fetching Banned Cstmrs", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchBannedCstmrs();
    }, []);

    const onDeleteClick = async (telephoneNo: string) => {
        const response = await deleteFromBlackList({telephoneNo: telephoneNo});

        if (!response.ok) {
            let msg = "Failed to delete";
            try {
                const data = await response.json();
                if(data.message) msg = data.message;
            } catch {}

            setSnackbar({
                open: true,
                message: msg,
                severity: "error",
            })
        }
        else {
            setBannedCstmrs(prevList =>
                prevList.filter(item =>
                    item.telephoneNo !== telephoneNo));
        }
    }

    const handleSnackbarClose = () => {
        setSnackbar((prev) => ({...prev, open: false}));
    };

    const onAddClick = async (telephoneNo: string) => {
        const response = await addToBlackList({ telephoneNo: telephoneNo });

        setBanDrawerOpen(false);

        if (!response.ok) {
            let errorMsg = "Something went wrong";
            try {
                const errorData = await response.json();
                if (errorData.message) errorMsg = errorData.message;
            } catch (e) {
                console.error("Failed to parse error", e);
            }

            setSnackbar({
                open: true,
                message: errorMsg,
                severity: "error",
            });
        }
        else {
            const newCustomer: BlackListCstmr = await response.json();

            setBannedCstmrs(prevList => [...prevList, newCustomer]);

        }
    }

    return (
        <>
            <Dialog
                open={open}
                onClose={handleClose}
                fullScreen
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100dvh",
                    maxHeight: "100dvh",
                    overflow: "hidden",
                    backgroundColor: "#fbfaf6"
                }}
            >
                <BackTopBar title={"Black List"} onClose={handleClose} onAdd={() => setBanDrawerOpen(true)}/>

                {loading ? (
                    <Box sx={{display: "grid", placeItems: "center", minHeight: 240}}>
                        <CircularProgress/>
                    </Box>
                ) : (
                    <Box sx={{p: 1}}>
                        {bannedCstmrs.map((cstmr) => (
                            <BannedCstmrCard
                                key={cstmr.telephoneNo}
                                customer={cstmr}
                                onDeleteClick={() => onDeleteClick(cstmr.telephoneNo)}
                            />
                        ))}
                        {bannedCstmrs.length === 0 && !loading && (
                            <Box sx={{textAlign: 'center', mt: 4, color: 'text.secondary'}}>
                                List is empty
                            </Box>
                        )}
                    </Box>
                )}

            </Dialog>

            <BanCstmrDrawer open={banDrawerOpen} onClose={() => setBanDrawerOpen(false)} onSubmit={onAddClick}/>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={handleSnackbarClose}
                anchorOrigin={{vertical: 'top', horizontal: 'center'}}
                sx={{
                    top: { xs: '24px !important', sm: '32px !important' },
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: { xs: '90%', sm: 'auto' },
                    minWidth: { sm: '400px' },
                    zIndex: 2500,
                }}
            >
                <Alert
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{
                        width: '100%',
                        fontSize: '1rem',
                        borderRadius: 3,
                        boxShadow: 6,
                        fontWeight: 500,
                        py: 1.5,
                        px: 3
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    )
}