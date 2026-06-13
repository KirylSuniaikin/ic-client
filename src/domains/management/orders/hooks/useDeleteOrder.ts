import { useState } from "react";
import type { Order } from "../../../order/types";
import { deleteOrder } from "../../../../shared/api/public";

export function useDeleteOrder(onDeleted: (id: string) => void): {
    deleteDialogOpen: boolean;
    orderToDelete: Order | null;
    handleDeleteClick: (order: Order) => void;
    confirmDelete: () => Promise<void>;
    cancelDelete: () => void;
} {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

    const handleDeleteClick = (order: Order): void => {
        setOrderToDelete(order);
        setDeleteDialogOpen(true);
    };

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

    const cancelDelete = (): void => {
        setDeleteDialogOpen(false);
        setOrderToDelete(null);
    };

    return { deleteDialogOpen, cancelDelete, orderToDelete, handleDeleteClick, confirmDelete };
}
