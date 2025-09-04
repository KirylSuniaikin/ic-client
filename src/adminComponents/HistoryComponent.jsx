import {useEffect, useState} from "react";
import {deleteOrder, getHistory} from "../api/api";
import PizzaLoader from "../components/loadingAnimations/PizzaLoader";
import OrderCard from "./OrderCard";
import {Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {Masonry} from "@mui/lab";



function HistoryComponent({isOpen, onClose}) {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [error, setError] = useState(null);
    const colorRed = '#E44B4C';
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);


    const handleRemoveItem = (orderIdToRemove) => {
        setOrders(prev => prev.filter(order => order.id !== orderIdToRemove));
    }

    const handleDeleteClick = (order) => {
        setOrderToDelete(order);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!orderToDelete) return;
        try {
            console.log(orderToDelete);
            await deleteOrder(String(orderToDelete.id));

            handleRemoveItem(orderToDelete.id);
        } catch (err) {
            console.error("Ошибка удаления заказа", err);
        } finally {
            setDeleteDialogOpen(false);
            setOrderToDelete(null);
        }
    };

    useEffect(() => {
        async function initialize() {
            try {
                setLoading(true);
                const response = await getHistory();
                setOrders(response.orders);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        initialize();
    }, []);

    if (loading) {
        return <PizzaLoader/>;
    }
    if (error) return <div>Error: {error}</div>;


    const sortedOrders = orders.sort(
        (a, b) => new Date(b.order_created) - new Date(a.order_created)
    );

    return (
        <div className="p-4 max-w-4xl mx-auto">
            {(
                    <Box sx={{
                        position: 'fixed',
                        top: 16,
                        right: 16,
                    }}
                    >
                        <IconButton
                            onClick={onClose}
                            sx={{
                                backgroundColor: colorRed,
                                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                                "&:hover": {
                                    backgroundColor: colorRed
                                }
                            }}
                        >
                            <CloseIcon sx={{fontSize: 30, color: "white"}}/>
                        </IconButton>
                    </Box>
                )}
            <Box sx={{ pt: 1, pl: 1 }}>
            <Masonry columns={{ xs: 1, sm: 2, md: 3, lg: 4 }} spacing={1} sequential>
                {sortedOrders.map((order) => (
                    <OrderCard key={order.id} order={order} handleRemoveItem={handleRemoveItem} isHistory={true} onDeleteClick={() => {handleDeleteClick(order)}}/>
                ))}
            </Masonry>
            </Box>

            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="xs"
                fullWidth={false}
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        p: 2,
                        width: 300,
                        maxWidth: "90vw"
                    }
                }}
            >
                <DialogTitle
                    sx={{
                        fontWeight: "bold",
                        textAlign: "center",
                        pb: 1
                    }}
                >
                    Delete Order
                </DialogTitle>

                <DialogContent>
                    <Typography align="center" sx={{ fontSize: 16 }}>
                        Delete order #{orderToDelete?.order_no}?
                    </Typography>
                </DialogContent>

                <DialogActions
                    sx={{
                        justifyContent: "center",
                        gap: 2,
                        pb: 2
                    }}
                >
                    <Button
                        variant="contained"
                        onClick={confirmDelete}
                        sx={{
                            backgroundColor: colorRed,
                            "&:hover": { backgroundColor: "#c73c3d" },
                            borderRadius: 3,
                            px: 3
                        }}
                    >
                        Yes
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => setDeleteDialogOpen(false)}
                        sx={{
                            borderColor: colorRed,
                            color: colorRed,
                            borderRadius: 3,
                            px: 3
                        }}
                    >
                        No
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    )
}

export default HistoryComponent;