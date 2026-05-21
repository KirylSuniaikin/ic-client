import {useState} from "react";
import {Order} from "../types/orderTypes";
import {deleteOrder} from "../api/api";

export function useDeleteOrder(onDeleted:(id: String) => void) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

    const handleDeleteClick = (order: Order): void => {
        setOrderToDelete(order);
        setDeleteDialogOpen(true);
    }

    const confirmDelete = async (): Promise<void> => {
        if (!orderToDelete) return;
        try {
            await deleteOrder(String(orderToDelete.id));
            onDeleted(orderToDelete.id);
        } catch (err) {
            console.error("Failed to delete the order", err);
        } finally {
            setDeleteDialogOpen(false);
            setOrderToDelete(null);
        }
    };

    const cancelDelete = () => {
        setDeleteDialogOpen(false);
        setOrderToDelete(null);
    }

    return{ deleteDialogOpen, cancelDelete, orderToDelete, handleDeleteClick, confirmDelete };
}