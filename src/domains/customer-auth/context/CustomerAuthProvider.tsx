import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type React from 'react';
import { logger } from '../../../shared/utils/logger';
import { logoutCustomer, refreshCustomerToken, verifyOtp } from '../../../shared/api/customerAuth';
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
    }, []);

    const login = useCallback(async (phone: string, code: string, branchId?: string): Promise<void> => {
        const response = await verifyOtp({ phone, code, branchId });
        setAccessToken(response.accessToken);
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
