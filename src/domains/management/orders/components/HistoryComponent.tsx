// Assumed: Actual props are {onClose, selectedBranch} — spec's simplified interface doesn't match the codebase.
import { logger } from "../../../../shared/utils/logger";
import React, {useEffect, useState} from "react";
import {deleteOrder, getHistory} from "../../../../shared/api/public";
import PizzaLoader from "../../../order-status/components/animations/PizzaLoader";
import OrderCard from "./OrderCard";
import {Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography} from "@mui/material";
import {Masonry} from "@mui/lab";
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";
import type { Order } from '../../../order/types';
import {useDeleteOrder} from "../hooks/useDeleteOrder";
import {DeleteOrderDialog} from "./DeleteOrderDialog";

interface SelectedBranch {
    id: string;
    [key: string]: unknown;
}

interface HistoryComponentProps {
    onClose: () => void;
    selectedBranch: SelectedBranch;
}

function HistoryComponent({onClose, selectedBranch}: HistoryComponentProps): JSX.Element {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [error, setError] = useState<string | null>(null);
    const colorRed = '#E44B4C';
    // const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    // const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);


    // const handleRemoveItem = (orderIdToRemove: string): void => {
    //     setOrders(prev => prev.filter(order => order.id !== orderIdToRemove));
    // }
    //
    // const handleDeleteClick = (order: Order): void => {
    //     setOrderToDelete(order);
    //     setDeleteDialogOpen(true);
    // };

    // const confirmDelete = async (): Promise<void> => {
    //     if (!orderToDelete) return;
    //     try {
    //         await deleteOrder(String(orderToDelete.id));
    //
    //         handleRemoveItem(orderToDelete.id);
    //     } catch (err) {
    //         logger.error("Failed to delete the order", err);
    //     } finally {
    //         setDeleteDialogOpen(false);
    //         setOrderToDelete(null);
    //     }
    // };

    const {deleteDialogOpen, orderToDelete, handleDeleteClick, confirmDelete, cancelDelete} =
        useDeleteOrder((id)=> setOrders(prev => prev.filter(order => order.id !== id)));

    useEffect(() => {
        async function initialize(): Promise<void> {
            try {
                setLoading(true);
                const response = await getHistory(selectedBranch.id);
                setOrders((response as unknown as { orders: Order[] }).orders);
            } catch (err) {
                setError((err as Error).message);
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


    const sortedOrders = [...orders].sort(
        (a, b) => new Date(b.order_created).getTime() - new Date(a.order_created).getTime()
    );

    return (
        <div
            className="p-4 max-w-4xl mx-auto"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100dvh',
                overflow: 'hidden'
            }}
        >
            <Box sx={{
                gap: 1,
                flexShrink: 0,
            }}>
                <ManagementTopBar
                    title="Order History"
                    onBack={onClose}
                />
            </Box>
            <Box sx={{
                pt: 1,
                pl: 1,
                backgroundColor: "#fbfaf6",
                flex: 1,
                overflowY: 'auto',
                overscrollBehaviorY: 'contain',
                width: '100%'
            }}>
            <Masonry columns={{ xs: 1, sm: 2, md: 3, lg: 4 }} spacing={1} sequential>
                {sortedOrders.map((order) => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        onReadyClick={() => setOrders(prevState => prevState.filter(prev => prev.id !== order.id))}
                        isHistory={true}
                        onDeleteClick={() => {handleDeleteClick(order)}}/>
                ))}
            </Masonry>
            </Box>

            <DeleteOrderDialog
                open={deleteDialogOpen}
                order={orderToDelete}
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
            />
        </div>
    )
}

export default HistoryComponent;
