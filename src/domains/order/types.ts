import type {MenuItem, ExtraIngr, Topping, Customization} from '../menu/types';
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

/**
 * A status staff can SET from the board. Deliberately narrow: the delivery terminals are written
 * by the courier app and the dispatcher, never by a kitchen tablet, so keeping them out of this
 * union is what stops `updateOrderStatus` being called with one.
 */
export type OrderStatus =
    | 'Kitchen Phase'
    | 'Oven'
    | 'Ready'
    | 'Picked Up'
    | 'Cancelled'
    // Set when a manager accepts an incoming Jahez order. It lived here only as a cast at the
    // one call site that sends it, which made the union claim something untrue about itself.
    | 'Accepted';

/**
 * A status an order can ARRIVE with. Wider than {@link OrderStatus} because reading and writing
 * are not the same set: since branch history became fulfilment-aware it returns delivery
 * terminals too, and `Order.status` was typed as the write set — a type that denied values the
 * server really sends.
 */
export type ObservedOrderStatus =
    | OrderStatus
    | 'Out for delivery'
    | 'Delivered'
    | 'Returned Undelivered'
    | 'Pending Payment'
    | 'Payment Failed';

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

// The one cart option that means PAY NOW rather than "this is how I will pay at the counter".
// Kept as the wire value 'Benefit' — byte-identical to what the backend, the mobile app, the
// kitchen ticket and the admin dropdown already expect — while the customer-facing label says
// "(Online)". Changing the value instead would split historic stats and break the admin edit
// dropdown, for a wording change.
export const PAY_ONLINE_METHOD = 'Benefit';

// The wallet — a QR the customer scans, rather than a card typed on the gateway's page. Its own
// tender because it is its own rail: blurring it into a card would merge three different things
// (kiosk terminal, online card, wallet) into one line in the stats and the cash register.
export const WALLET_METHOD = 'BenefitPay';

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
    // Per-item free-text note, kept separate from `description` for the admin card/printer.
    note?: string;
    // DeepL-translated (English) note for the kitchen; falls back to `note` when absent.
    noteTranslated?: string;
    quantity: number;
    customizations?: Customization[];
};

export type OrderItem = {
    id?: number;
    name: string;
    category: string;
    size: string;
    quantity: number;
    amount: number;
    description: string;
    // Per-item free-text note, kept separate from `description` for the admin card/printer.
    note?: string;
    // DeepL-translated (English) note for the kitchen; falls back to `note` when absent.
    noteTranslated?: string;
    isThinDough?: boolean;
    isGarlicCrust?: boolean;
    discountAmount?: number;
    comboItemTO?: ComboItemTO[];
    photo?: string;
    customizations?: Customization[];
    // Courier-capacity Phase 5: 1-based, present only on a split order's items — which of the
    // order's delivery parts this item belongs to. Absent/undefined for every non-split order.
    partIndex?: number;
    // t6: present only on a split order, ordered by partIndex. A line cut across parts has several
    // entries (partIndex is then absent); mirrors backend ActiveOrdersTO.ActiveOrderItemTO.PartShareTO.
    partShares?: OrderItemPartShare[];
};

/** t6: mirrors backend ActiveOrdersTO.PartShareTO — the units of an item one delivery part carries. */
export type OrderItemPartShare = { partIndex: number; quantity: number };

/** Courier-capacity Phase 5: mirrors backend ActiveOrdersTO.KitchenPartTO. */
export type KitchenPartStatus = {
    partId: number;
    partIndex: number;
    handedOver: boolean;
    courierName?: string | null;
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
    order_created_formatted?: string;
    status: ObservedOrderStatus;
    isPaid: boolean;
    branch_id: string;
    estimation?: number;
    estimationTime?: number;
    jahezOrderId?: string | null;
    // Delivery only, and only on the live board's ActiveOrdersTO — history and the customer-side
    // order shapes carry neither, hence optional. They exist so the staff card can tell "ready to
    // hand over" from "still waiting for a rider" BEFORE anyone taps: `courier_assigned` mirrors
    // exactly the condition the hand-over endpoint answers 409 to, while `courier_at_kitchen` is
    // the stronger, advisory signal that the rider is physically at the pass.
    //
    // Both arrive LIVE on the branch's /delivery-alert topic — `courier_at_kitchen` as a
    // COURIER_AT_KITCHEN frame, `courier_assigned` as a COURIER_ASSIGNED one — and useAdminOrders
    // patches these same fields rather than holding a second copy of either fact.
    //
    // One asymmetry survives: a manager RELEASING an order sets `courier_assigned` back to false
    // server-side, and that event is published to the courier's own topic, not to this branch
    // channel. So the field is only ever pushed true, and comes back to false on a REST fetch or a
    // reconnect resync.
    courier_assigned?: boolean;
    courier_at_kitchen?: boolean;
    // Courier-capacity Phase 5: null/undefined for a non-delivery order, 1 for a normal delivery
    // order, N for a genuinely split one. `courier_assigned` above is REDEFINED once this is > 1:
    // it then means "every part has a courier", not just this order's single assignedCourier.
    partsTotal?: number;
    // Present only once partsTotal > 1 — one entry per delivery part, in part-index order.
    parts?: KitchenPartStatus[];
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

export class OrderPaymentError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'OrderPaymentError';
        this.status = status;
    }
}

export type OrderPaymentPayload = {
    orderId: string;
    amount: number;
    type: PaymentType;
    branchId: string;
    idempotency_key?: string;
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
    // Combo child's own free-text note, kept separate from `description` (was previously baked
    // into the parent combo's description string). Matches backend CreateOrderTO.ComboItemsTO.
    note?: string;
    customizations?: Customization[];
};

export type OrderItemRequest = {
    id?: number;
    name: string;
    quantity: number;
    amount: number;
    size: string;
    category: string;
    description: string;
    // Per-item free-text note, kept separate from `description` (was glued in as "+<note>").
    // Matches backend CreateOrderTO.OrderItemsTO.
    note?: string;
    isGarlicCrust: boolean;
    isThinDough: boolean;
    discountAmount: number;
    comboItems?: ComboItemRequest[];
    customizations?: Customization[];
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
    // Language the customer checked out in ("en" | "ar"); persisted on the Customer CRM row.
    language?: string;
    // Client-generated per-checkout key. The backend dedupes a double-submit / retried request on
    // it (matches CreateOrderTO.idempotency_key), so a slow response resent by the network can't
    // create a second order. Generated once per built order and carried through the reminder/OTP
    // detours via the spread in completeVerifiedCheckout.
    idempotency_key?: string;
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

// Inclusive calendar days as yyyy-MM-dd, sent as the stats endpoint's start_date/finish_date. The
// server turns each day into the stats' business day, 04:00 to 03:59:59 the next morning.
export type HistoryDateRange = {
    startDate: string;
    finishDate: string;
};

export type GetHistoryParams = {
    branchId: string;
    page: number;
    size?: number;
    filter?: OrderHistoryFilter;
    dateRange?: HistoryDateRange | null;
};

export type GetHistoryResponse = {
    orders: Order[];
    hasMore: boolean;
};
