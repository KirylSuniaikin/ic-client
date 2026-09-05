// Saved delivery addresses (DELIVERY_SPEC.md §1.4.4). Logged-in customers only — the endpoint
// requires ROLE_CUSTOMER, and a guest has no address book until they verify.
import { useCallback, useEffect, useState } from 'react';
import { createAddress, deleteAddress, listAddresses, updateAddress } from '../../../shared/api/delivery';
import { useCustomerAuth } from '../../customer-auth/context/CustomerAuthProvider';
import { logger } from '../../../shared/utils/logger';
import { DeliveryApiError } from '../types';
import type {
    CreateCustomerAddressRequest, CustomerAddress, UpdateCustomerAddressRequest,
} from '../types';

export type UseSavedAddressesResult = {
    addresses: CustomerAddress[];
    loading: boolean;
    /** Last failure, for surfacing inline. Cleared on the next successful call. */
    error: string | null;
    reload: () => Promise<void>;
    /**
     * Returns the saved address so a caller can select it immediately. That may be an address the
     * customer already had: the server folds a re-save of the same doorstep onto the existing row.
     */
    save: (body: CreateCustomerAddressRequest) => Promise<CustomerAddress | null>;
    /** Returns the edited address, or null when the edit failed (the reason is in `error`). */
    update: (addressId: string, body: UpdateCustomerAddressRequest) => Promise<CustomerAddress | null>;
    /** Removes a saved address; resolves to whether the server accepted it. */
    remove: (addressId: string) => Promise<boolean>;
};

/**
 * Replaces an address in the list if it is already there, otherwise puts it at the front.
 *
 * Both callers need this. `save` needs it because the server dedupes — a re-save returns an
 * address that is already in the list, and prepending it unconditionally would show the customer
 * the duplicate row the dedupe exists to prevent. `update` needs it because an edited address must
 * keep its place rather than jump to the top. Replacing in place also matches the server ordering,
 * which is by `created_at` and is not disturbed by an edit.
 */
function upsertById(current: CustomerAddress[], saved: CustomerAddress): CustomerAddress[] {
    const index = current.findIndex((address) => address.id === saved.id);
    if (index === -1) return [saved, ...current];
    const next = [...current];
    next[index] = saved;
    return next;
}

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
                const saved = await createAddress(token, body);
                // Upsert rather than refetch: the list is ordered newest-first server-side, so
                // this matches what a reload would return without the extra round trip — and it
                // is what keeps a deduplicated re-save from appearing twice.
                setAddresses((current) => upsertById(current, saved));
                setError(null);
                return saved;
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

    const update = useCallback(
        async (addressId: string, body: UpdateCustomerAddressRequest): Promise<CustomerAddress | null> => {
            if (!token) return null;
            setLoading(true);
            try {
                const edited = await updateAddress(token, addressId, body);
                setAddresses((current) => upsertById(current, edited));
                setError(null);
                return edited;
            } catch (err) {
                logger.error('Failed to update address:', err);
                setError(err instanceof Error ? err.message : String(err));
                return null;
            } finally {
                setLoading(false);
            }
        },
        [token]
    );

    /**
     * The bin.
     *
     * Removes the row locally the moment the server confirms, rather than reloading the list: the
     * customer is standing in a checkout sheet with a selection under their finger, and a list
     * that blinks out and back would move everything they were looking at.
     *
     * Returns whether it worked, because the caller has a selection to clear — deleting the
     * address the order is currently pointed at has to leave the sheet in a state the customer can
     * still act on.
     */
    const remove = useCallback(
        async (addressId: string): Promise<boolean> => {
            if (!token) return false;
            setLoading(true);
            try {
                await deleteAddress(token, addressId);
                setAddresses((current) => current.filter((address) => address.id !== addressId));
                setError(null);
                return true;
            } catch (err) {
                logger.error('Failed to delete address:', err);
                setError(err instanceof Error ? err.message : String(err));
                return false;
            } finally {
                setLoading(false);
            }
        },
        [token]
    );

    return { addresses, loading, error, reload, save, update, remove };
}
