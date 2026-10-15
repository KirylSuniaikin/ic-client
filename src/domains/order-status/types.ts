export type OrderStatusData = {
    id: number;
    orderStatus: string;
    orderNumber: number;
    orderCreated: string;
    estimationTime: number;
    error?: boolean;
    message?: string;
    branchId: string;
};
