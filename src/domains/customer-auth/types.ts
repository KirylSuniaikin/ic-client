// Frontend types for the customer (non-staff) OTP auth flow.
// Mirrors backend DTOs per task-spec.md §5.4/§5.7 — kept in sync manually
// since there is no shared codegen between backend and ic-client.

import type { Customization, ExtraIngr, MenuItem, Topping } from '../menu/types';

export type OtpRequestPayload = { phone: string; language?: 'ar' | 'en' };

export type OtpVerifyPayload = { phone: string; code: string; branchId?: string; name?: string };

export type CustomerTokenResponse = { accessToken: string; refreshToken?: string; isNewAccount: boolean };

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
// Mirrors backend CustomerOrderDetailTO per task-spec.md §5. note/isThinDough/isGarlicCrust/
// customizations are optional here (rather than required, even though the backend record
// always serializes them) purely so pre-existing test fixtures that predate this field don't
// all need updating — buildDisplay/rendering treat a missing value as "nothing structural".
export type CustomerOrderDetailComboItem = {
    name: string;
    size: string | null;
    quantity: number;
    description: string;
    note?: string | null;
    isThinDough?: boolean;
    isGarlicCrust?: boolean;
    customizations?: Customization[];
};

export type CustomerOrderDetailItem = {
    name: string;
    quantity: number;
    size: string | null;
    unitAmount: number;
    description: string;
    note?: string | null;
    isThinDough?: boolean;
    isGarlicCrust?: boolean;
    customizations?: Customization[];
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

// GET /customer/orders/suggested — "Order it again" quick-order block on the profile
// popup. Mirrors backend SuggestedOrderResponse per task3-spec.md.
export type SuggestedOrderItem = {
    menuItemId: number;
    name: string;
    nameAr: string | null;
    size: string | null;
    category: string;
    quantity: number;
    price: number;
    photo: string | null;
    available: boolean;
};

export type SuggestedOrderResponse = {
    items: SuggestedOrderItem[];
    fallback: boolean;
};

export type CustomerAuthContextType = {
    token: string | null;
    login: (phone: string, code: string, branchId?: string, name?: string) => Promise<{ isNewAccount: boolean; accessToken: string }>;
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

// The raw menu catalog (task-spec T6 §Part A "Menu-data availability" note) needed to localize
// customer-facing description strings on the profile/order-detail popups. Those popups mount at
// the app root (CustomerAuthModals, in app/providers.tsx) — outside HomePage's own `useMenuData`
// call — so a fresh `useMenuData()` there would be a second network fetch. Instead HomePage (the
// only place that opens these popups, via CustomerIconButton) publishes its already-fetched
// catalog into this shared UI context once loaded; the popups read it back. Display-only: never
// re-derives a CartItem/order payload from this.
export type MenuLocalizationCatalog = {
    menuData: MenuItem[];
    toppings: Topping[];
    extraIngredients: ExtraIngr[];
};

// Centralized open-state for the CustomerLoginPopup/CustomerProfilePopup pair
// (task-spec.md §5.1) — keeps exactly one instance of each mounted app-wide,
// driven by this context instead of component-local state.
export type CustomerAuthUiContextType = {
    isLoginOpen: boolean;
    isProfileOpen: boolean;
    loginPrefillPhone: string | null;
    loginPrefillName: string | null;
    // True when this login sheet is part of a mandatory checkout verification (task-spec.md
    // §1) — drives CustomerLoginPopup's auto-send-and-skip-phone-step behaviour and its
    // checkout-specific copy on the code step.
    loginCheckoutMode: boolean;
    selectedOrderId: number | null;
    openLogin: (prefillPhone?: string, prefillName?: string, checkoutMode?: boolean) => void;
    openProfile: () => void;
    openOrderDetail: (orderId: number) => void;
    closeOrderDetail: () => void;
    closeAll: () => void;
    isAnyCustomerAuthPopupOpen: boolean;
    // Bumped to signal the active-order island to refetch (e.g. right after a new
    // order is created, so the homepage widget appears without a page remount).
    activeOrderRefreshKey: number;
    refreshActiveOrder: () => void;
    // See MenuLocalizationCatalog above. Empty arrays until HomePage's useMenuData resolves.
    menuLocalizationData: MenuLocalizationCatalog;
    setMenuLocalizationData: (data: MenuLocalizationCatalog) => void;
};

// Thrown by useCustomerAuthUi() when called outside a CustomerAuthUiProvider.
// Mirrors CustomerAuthContextMissingError above.
export class CustomerAuthUiContextMissingError extends Error {
    constructor() {
        super('useCustomerAuthUi must be used within a CustomerAuthUiProvider');
        this.name = 'CustomerAuthUiContextMissingError';
    }
}
