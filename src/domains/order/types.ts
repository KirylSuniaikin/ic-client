import type {MenuItem, ExtraIngr, Topping} from '../menu/types';
import type { WorkingHoursSchedule } from '../../shared/api/management';

export class ItemsUnavailableError extends Error {
    readonly unavailableIds: number[];

    constructor(message: string, unavailableIds: number[]) {
        super(message);
        this.name = 'ItemsUnavailableError';
        this.unavailableIds = unavailableIds;
    }
}

export class BranchClosedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BranchClosedError';
    }
}

export type BranchClosedResponse = { message: string };

export type OrderStatus =
    | 'Kitchen Phase'
    | 'Oven'
    | 'Ready'
    | 'Picked Up'
    | 'Cancelled';

export type OrderType =
    | 'Dine In'
    | 'Pick Up'
    | 'Delivery'
    | 'Jahez'
    | 'Keeta'
    | 'Talabat';

export type PaymentType = 'Cash' | 'Online' | 'Card';

// Recorded on web Pick-Up orders that skip ClientInfoPopup (logged-in customers — see
// useCheckout's checkout gate). The customer profile carries no payment method, and every
// web order is paid at the counter on collection, so staff correct this via PaymentPopup if
// the customer pays another way. Kept as the single source of the string ClientInfoPopup
// also defaults to — a null payment_type would NPE the admin edit path server-side.
export const DEFAULT_PAYMENT_METHOD = 'Card (Through card machine)';

export type WorkloadLevel =
    | 'IDLE'
    | 'BUSY'
    | 'CROWDED'
    | 'RUSH'
    | 'HEAVY_RUSH'
    | 'SLAMMED'
    | 'OVERLOADED';

export type ComboItemTO = {
    name: string;
    size: string;
    category: string;
    isThinDough: boolean;
    isGarlicCrust: boolean;
    description: string;
    quantity: number;
};

export type OrderItem = {
    id?: number;
    name: string;
    category: string;
    size: string;
    quantity: number;
    amount: number;
    description: string;
    isThinDough?: boolean;
    isGarlicCrust?: boolean;
    discountAmount?: number;
    comboItemTO?: ComboItemTO[];
    photo?: string;
};

export type Order = {
    id: string;
    order_no: number;
    tel: string;
    customer_name: string;
    delivery_method: string;
    payment_type: PaymentType;
    address: string;
    notes: string;
    items: OrderItem[];
    amount_paid: number;
    order_type: OrderType;
    external_id: string | null;
    phone_number: string;
    order_created: string;
    status: OrderStatus;
    isPaid: boolean;
    branch_id: string;
    estimation?: number;
    estimationTime?: number;
    jahezOrderId?: string | null;
};

export type BaseAppInfoResponse = {

  menu: MenuItem[];
  extraIngr: ExtraIngr[];
  toppings: Topping[];
  isSDoughAvailable: boolean;
  userInfo: { name: string; phone: string } | null;
  workingHours?: WorkingHoursSchedule | null;
};

export type AdminBaseInfo = {
    branchId: string;
    workloadLevel: WorkloadLevel;
    [key: string]: unknown;
};

export type ShiftEventType =
    | 'OPEN_SHIFT_EVENT'
    | 'CLOSE_SHIFT_EVENT'
    | 'OPEN_SHIFT_CASH_CHECK'
    | 'CLOSE_SHIFT_CASH_CHECK';

export type ShiftEventPayload = {
    type: ShiftEventType;
    datetime: string;
    branch_id: string;
    cash_amount?: number | null;
    prep_plan?: unknown | null;
};

export type AvailabilityChange = {
    id: number;
    available: boolean;
};

export type OrderPaymentPayload = {
    orderId: string;
    amount: number;
    type: PaymentType;
    branchId: string;
};

export type UpdateOrderStatusPayload = {
    orderId: string;
    jahezOrderId: string | null;
    orderStatus: OrderStatus;
    reason: string | null;
};

export type Items409Response = {
    message: string;
    unavailableIds: number[];
};

export type ComboItemRequest = {
    id?: number;
    name: string;
    category: string;
    size: string;
    quantity: number;
    isGarlicCrust: boolean;
    isThinDough: boolean;
    description: string;
};

export type OrderItemRequest = {
    id?: number;
    name: string;
    quantity: number;
    amount: number;
    size: string;
    category: string;
    description: string;
    isGarlicCrust: boolean;
    isThinDough: boolean;
    discountAmount: number;
    comboItems?: ComboItemRequest[];
};

// Mirrors backend CreateOrderTO
export type CreateOrderRequest = {
    tel: string | null;
    customer_name: string | null;
    type: string;
    payment_type: string | null;
    branchId: string;
    notes: string;
    items: OrderItemRequest[];
    amount_paid: number;
    fbc?: string;
    fbp?: string;
};

// Mirrors backend EditOrderTO
export type EditOrderRequest = {
    id: string | number;
    order_no: number;
    tel: string;
    customer_name: string | null;
    delivery_method: string | null;
    payment_type: string | null;
    address: unknown;
    notes: string;
    items: OrderItemRequest[];
    amount_paid: number;
};

export type OrderHistoryFilter =
    | { type: 'orderId'; value: number }
    | { type: 'externalId'; value: number }
    | { type: 'customerName'; value: string }
    | { type: 'orderNo'; value: string }
    | { type: 'phone'; value: string }
    | { type: 'none' };

export type GetHistoryParams = {
    branchId: string;
    page: number;
    size?: number;
    filter?: OrderHistoryFilter;
};

export type GetHistoryResponse = {
    orders: Order[];
    hasMore: boolean;
};
