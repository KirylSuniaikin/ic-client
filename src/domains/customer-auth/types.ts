// Frontend types for the customer (non-staff) OTP auth flow.
// Mirrors backend DTOs per task-spec.md §5.4/§5.7 — kept in sync manually
// since there is no shared codegen between backend and ic-client.

export type OtpRequestPayload = { phone: string };

export type OtpVerifyPayload = { phone: string; code: string; branchId?: string };

export type CustomerTokenResponse = { accessToken: string };

export type CustomerMeResponse = {
    id: string;
    phone: string;
    preferredBranchId: string | null;
    name: string | null;
    address: string | null;
    amountOfOrders: number | null;
    lastOrderDate: string | null;
};

export type CustomerOrderSummary = {
    id: number;
    orderNumber: number;
    status: string;
    orderType: string;
    amountPaid: number;
    createdAt: string;
};

export type CustomerOrdersPageResponse = {
    orders: CustomerOrderSummary[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    hasNext: boolean;
};

// GET /customer/orders/{orderId} — full order detail for CustomerOrderDetailPopup.
// Mirrors backend CustomerOrderDetailTO per task-spec.md §5.
export type CustomerOrderDetailComboItem = {
    name: string;
    size: string | null;
    quantity: number;
    description: string;
};

export type CustomerOrderDetailItem = {
    name: string;
    quantity: number;
    size: string | null;
    unitAmount: number;
    description: string;
    comboItems: CustomerOrderDetailComboItem[];
};

export type CustomerOrderDetailStatusHistoryEntry = {
    status: string;
    changedAt: string;
};

export type CustomerOrderDetail = {
    id: number;
    orderNumber: number;
    status: string;
    orderType: string;
    branchId: string;
    createdAt: string;
    paymentType: string;
    notes: string | null;
    amount: number;
    discount: number;
    amountPaid: number;
    isPaid: boolean;
    items: CustomerOrderDetailItem[];
    statusHistory: CustomerOrderDetailStatusHistoryEntry[];
};

// GET /customer/orders/active — active-order pill on the customer homepage.
// Mirrors backend CustomerActiveOrderTO per task-spec.md §4a/§5.
export type CustomerActiveOrder = {
    id: number;
    orderNumber: number;
    status: string;
    createdAt: string;
    estimation: number | null;
    branchId: string;
    branchName: string;
};

export type CustomerAuthContextType = {
    token: string | null;
    login: (phone: string, code: string, branchId?: string) => Promise<void>;
    logout: () => Promise<void>;
    isAuthLoading: boolean;
};

// Typed error for non-2xx responses from shared/api/customerAuth.ts wrappers,
// mirroring the ItemsUnavailableError pattern in domains/order/types.ts.
export class CustomerAuthApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'CustomerAuthApiError';
        this.status = status;
    }
}

// Thrown by useCustomerAuth() when called outside a CustomerAuthProvider.
export class CustomerAuthContextMissingError extends Error {
    constructor() {
        super('useCustomerAuth must be used within a CustomerAuthProvider');
        this.name = 'CustomerAuthContextMissingError';
    }
}

// Centralized open-state for the CustomerLoginPopup/CustomerProfilePopup pair
// (task-spec.md §5.1) — keeps exactly one instance of each mounted app-wide,
// driven by this context instead of component-local state.
export type CustomerAuthUiContextType = {
    isLoginOpen: boolean;
    isProfileOpen: boolean;
    loginPrefillPhone: string | null;
    selectedOrderId: number | null;
    openLogin: (prefillPhone?: string) => void;
    openProfile: () => void;
    openOrderDetail: (orderId: number) => void;
    closeOrderDetail: () => void;
    closeAll: () => void;
    isAnyCustomerAuthPopupOpen: boolean;
    // Bumped to signal the active-order island to refetch (e.g. right after a new
    // order is created, so the homepage widget appears without a page remount).
    activeOrderRefreshKey: number;
    refreshActiveOrder: () => void;
};

// Thrown by useCustomerAuthUi() when called outside a CustomerAuthUiProvider.
// Mirrors CustomerAuthContextMissingError above.
export class CustomerAuthUiContextMissingError extends Error {
    constructor() {
        super('useCustomerAuthUi must be used within a CustomerAuthUiProvider');
        this.name = 'CustomerAuthUiContextMissingError';
    }
}
