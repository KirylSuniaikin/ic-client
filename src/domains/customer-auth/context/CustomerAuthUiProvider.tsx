import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { CustomerAuthUiContextMissingError } from '../types';
import type { CustomerAuthUiContextType } from '../types';

// Dedicated UI-only context for the CustomerLoginPopup/CustomerProfilePopup
// open-state (task-spec.md §5.2). Deliberately independent of
// CustomerAuthProvider/token — this only tracks which popup (if any) is open.
const CustomerAuthUiContext = createContext<CustomerAuthUiContextType | undefined>(undefined);

export function CustomerAuthUiProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [loginPrefillPhone, setLoginPrefillPhone] = useState<string | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [activeOrderRefreshKey, setActiveOrderRefreshKey] = useState(0);

    // True when the detail popup was opened WITHOUT the profile already being open
    // (i.e. from the homepage island / post-checkout), so closing the detail should
    // dismiss the profile too — one tap returns to the page. When the detail is opened
    // from an already-open profile (order-history row), closing it keeps the profile.
    const detailOpenedStandaloneRef = useRef(false);

    const openLogin = useCallback((prefillPhone?: string): void => {
        detailOpenedStandaloneRef.current = false;
        setIsLoginOpen(true);
        setIsProfileOpen(false);
        setLoginPrefillPhone(prefillPhone ?? null);
        setSelectedOrderId(null);
    }, []);

    const openProfile = useCallback((): void => {
        detailOpenedStandaloneRef.current = false;
        setIsProfileOpen(true);
        setIsLoginOpen(false);
        setLoginPrefillPhone(null);
        setSelectedOrderId(null);
    }, []);

    const closeAll = useCallback((): void => {
        detailOpenedStandaloneRef.current = false;
        setIsLoginOpen(false);
        setIsProfileOpen(false);
        setLoginPrefillPhone(null);
        setSelectedOrderId(null);
    }, []);

    // Opens the profile popup with a specific order's detail popup nested inside it
    // (task-spec.md §4.11/§4.12) — used both by CustomerProfilePopup's order-row taps
    // and by post-checkout navigation (useCheckout) for a logged-in customer.
    const openOrderDetail = useCallback((orderId: number): void => {
        detailOpenedStandaloneRef.current = !isProfileOpen;
        setIsProfileOpen(true);
        setIsLoginOpen(false);
        setLoginPrefillPhone(null);
        setSelectedOrderId(orderId);
    }, [isProfileOpen]);

    // Closes the nested detail popup. If it was opened standalone (island/checkout),
    // also close the profile so a single tap dismisses everything.
    const closeOrderDetail = useCallback((): void => {
        setSelectedOrderId(null);
        if (detailOpenedStandaloneRef.current) {
            setIsProfileOpen(false);
            detailOpenedStandaloneRef.current = false;
        }
    }, []);

    // Signals useActiveOrderIsland to refetch the active order (e.g. after a new order
    // is created) so the homepage widget appears without waiting for a page remount.
    const refreshActiveOrder = useCallback((): void => {
        setActiveOrderRefreshKey((key) => key + 1);
    }, []);

    const isAnyCustomerAuthPopupOpen = isLoginOpen || isProfileOpen;

    const value = useMemo<CustomerAuthUiContextType>(
        () => ({
            isLoginOpen,
            isProfileOpen,
            loginPrefillPhone,
            selectedOrderId,
            openLogin,
            openProfile,
            openOrderDetail,
            closeOrderDetail,
            closeAll,
            isAnyCustomerAuthPopupOpen,
            activeOrderRefreshKey,
            refreshActiveOrder,
        }),
        [
            isLoginOpen,
            isProfileOpen,
            loginPrefillPhone,
            selectedOrderId,
            openLogin,
            openProfile,
            openOrderDetail,
            closeOrderDetail,
            closeAll,
            isAnyCustomerAuthPopupOpen,
            activeOrderRefreshKey,
            refreshActiveOrder,
        ]
    );

    return <CustomerAuthUiContext.Provider value={value}>{children}</CustomerAuthUiContext.Provider>;
}

export function useCustomerAuthUi(): CustomerAuthUiContextType {
    const context = useContext(CustomerAuthUiContext);
    if (!context) {
        throw new CustomerAuthUiContextMissingError();
    }
    return context;
}
