import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type React from 'react';
import { logger } from '../../../shared/utils/logger';
import { logoutCustomer, refreshCustomerToken, verifyOtp } from '../../../shared/api/customerAuth';
import { isKioskSearch } from '../../../shared/utils/kioskMode';
import { CustomerAuthContextMissingError } from '../types';
import type { CustomerAuthContextType } from '../types';

// In-memory-only token store, kept at module scope (outside React state) so
// `customerAuthFetch` can read/update it from plain async code, not just from
// within the provider's component tree. NEVER persisted to localStorage/
// sessionStorage — this is the deliberate difference from the staff auth flow.
type TokenListener = (token: string | null) => void;

let currentAccessToken: string | null = null;
const tokenListeners = new Set<TokenListener>();

function setAccessToken(token: string | null): void {
    currentAccessToken = token;
    tokenListeners.forEach((listener) => listener(token));
}

function getAccessToken(): string | null {
    return currentAccessToken;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const [token, setToken] = useState<string | null>(getAccessToken());
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

    // Latched at mount, deliberately not re-read on navigation: a kiosk tab is a kiosk for
    // its whole (months-long) life, and re-reading would let any navigation that drops the
    // ?mode=kiosk param silently switch customer sessions back on.
    const [isKiosk] = useState<boolean>(() => isKioskSearch(new URLSearchParams(window.location.search)));

    // Mirror the module-level store into this provider's render state so
    // updates from customerAuthFetch (which may run outside this component)
    // are reflected in context consumers too.
    useEffect(() => {
        tokenListeners.add(setToken);
        return () => {
            tokenListeners.delete(setToken);
        };
    }, []);

    // Silent refresh on mount: if there's no in-memory token yet, try the
    // cookie-driven refresh once. Failure is ambient — guest, no visible error.
    useEffect(() => {
        let cancelled = false;

        async function silentRefresh(): Promise<void> {
            // The kiosk is a shared walk-up device and has no login entry point at all, so a
            // session restored here can only belong to SOMEONE ELSE — and it leaks: checkout
            // reads the profile whenever a token exists (useCheckout's `if (token)` branch) and
            // would put a stranger's phone and name on the order, while the active-order island
            // would show a stranger's order. Don't merely skip the refresh: clear the store, so
            // a token an in-tab session left behind can't survive into kiosk mode either.
            // A refresh cookie really can be sitting on the device — the storefront opened once
            // on it without ?mode=kiosk leaves one for months — so never trust its absence.
            if (isKiosk) {
                setAccessToken(null);
                setIsAuthLoading(false);
                return;
            }

            if (getAccessToken() !== null) {
                setIsAuthLoading(false);
                return;
            }

            try {
                const response = await refreshCustomerToken();
                if (!cancelled) {
                    setAccessToken(response.accessToken);
                }
            } catch (error) {
                logger.debug('Customer silent refresh: no active session', error);
            } finally {
                if (!cancelled) {
                    setIsAuthLoading(false);
                }
            }
        }

        void silentRefresh();

        return () => {
            cancelled = true;
        };
    }, [isKiosk]);

    const login = useCallback(async (
        phone: string,
        code: string,
        branchId?: string,
        name?: string
    ): Promise<{ isNewAccount: boolean; accessToken: string }> => {
        const response = await verifyOtp({ phone, code, branchId, name });
        setAccessToken(response.accessToken);
        return { isNewAccount: response.isNewAccount, accessToken: response.accessToken };
    }, []);

    const logout = useCallback(async (): Promise<void> => {
        try {
            await logoutCustomer();
        } finally {
            setAccessToken(null);
        }
    }, []);

    return (
        <CustomerAuthContext.Provider value={{ token, login, logout, isAuthLoading }}>
            {children}
        </CustomerAuthContext.Provider>
    );
}

export function useCustomerAuth(): CustomerAuthContextType {
    const context = useContext(CustomerAuthContext);
    if (!context) {
        throw new CustomerAuthContextMissingError();
    }
    return context;
}

// Interceptor-style wrapper: attaches the in-memory bearer token, and on a
// 401 calls /auth/refresh exactly once before retrying. If the refresh also
// fails, the in-memory token is cleared and the original error is rethrown —
// callers decide the UX (customer auth is ambient/optional, no redirect here).
export async function customerAuthFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const buildInit = (token: string | null): RequestInit => {
        const headers = new Headers(init.headers);
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
        return { ...init, headers, credentials: 'include' };
    };

    const response = await fetch(url, buildInit(getAccessToken()));

    if (response.status !== 401) {
        return response;
    }

    try {
        const refreshed = await refreshCustomerToken();
        setAccessToken(refreshed.accessToken);
        return await fetch(url, buildInit(refreshed.accessToken));
    } catch (error) {
        setAccessToken(null);
        throw error;
    }
}

// Test-only: clears the module-level token store between test cases.
// Resetting via jest.resetModules() instead would desync the React instance
// this module sees from the one @testing-library/react already imported.
export function __resetCustomerAuthStoreForTests(): void {
    currentAccessToken = null;
    tokenListeners.clear();
}
