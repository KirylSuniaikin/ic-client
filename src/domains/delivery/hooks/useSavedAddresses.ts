// Saved delivery addresses (DELIVERY_SPEC.md §1.4.4). Logged-in customers only — the endpoint
// requires ROLE_CUSTOMER, and a guest has no address book until they verify.
import { useCallback, useEffect, useState } from 'react';
import { createAddress, listAddresses } from '../../../shared/api/delivery';
import { useCustomerAuth } from '../../customer-auth/context/CustomerAuthProvider';
import { logger } from '../../../shared/utils/logger';
import { DeliveryApiError } from '../types';
import type { CreateCustomerAddressRequest, CustomerAddress } from '../types';

export type UseSavedAddressesResult = {
    addresses: CustomerAddress[];
    loading: boolean;
    /** Last failure, for surfacing inline. Cleared on the next successful call. */
    error: string | null;
    reload: () => Promise<void>;
    /** Returns the created address so a caller can select it immediately. */
    save: (body: CreateCustomerAddressRequest) => Promise<CustomerAddress | null>;
};

export function useSavedAddresses(): UseSavedAddressesResult {
    const { token } = useCustomerAuth();
    const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async (): Promise<void> => {
        if (!token) {
            // A guest has no address book. Not an error — clear rather than leave a previous
            // customer's list on screen after a logout.
            setAddresses([]);
            return;
        }
        setLoading(true);
        try {
            setAddresses(await listAddresses(token));
            setError(null);
        } catch (err) {
            // A 401 here means the session lapsed mid-flow; treat it as "no saved addresses"
            // rather than an error, so checkout falls back to entering one by hand instead of
            // dead-ending.
            if (err instanceof DeliveryApiError && err.status === 401) {
                setAddresses([]);
                setError(null);
            } else {
                logger.error('Failed to load saved addresses:', err);
                setError(err instanceof Error ? err.message : String(err));
            }
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const save = useCallback(
        async (body: CreateCustomerAddressRequest): Promise<CustomerAddress | null> => {
            if (!token) return null;
            setLoading(true);
            try {
                const created = await createAddress(token, body);
                // Prepend rather than refetch: the list is ordered newest-first server-side, so
                // this matches what a reload would return without the extra round trip.
                setAddresses((current) => [created, ...current]);
                setError(null);
                return created;
            } catch (err) {
                logger.error('Failed to save address:', err);
                setError(err instanceof Error ? err.message : String(err));
                return null;
            } finally {
                setLoading(false);
            }
        },
        [token]
    );

    return { addresses, loading, error, reload, save };
}
