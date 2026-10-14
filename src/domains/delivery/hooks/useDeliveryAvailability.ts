// The §1.2 availability gate, checked at BOTH points (R1) because state changes in between:
// when Delivery is picked in the cart, and again on Place order.
import { useCallback, useRef, useState } from 'react';
import { getDeliveryAvailability } from '../../../shared/api/delivery';
import { logger } from '../../../shared/utils/logger';
import type { Coordinates, DeliveryAvailability, DeliveryBasketLine } from '../types';

export type UseDeliveryAvailabilityResult = {
    /** Last result, or null before the first check. */
    availability: DeliveryAvailability | null;
    checking: boolean;
    /**
     * Runs a gate pass. Omit the pin for the early cart check (§1.2 step 1). Pass the basket so
     * the server can also check there are enough couriers for it.
     */
    check: (pin?: Coordinates, basket?: DeliveryBasketLine[]) => Promise<DeliveryAvailability>;
    reset: () => void;
};

/**
 * A network failure resolves to "available" rather than propagating. The gate is a courtesy
 * check — it exists to spare the customer a wasted checkout, not to authorise the order. The
 * server re-checks radius and courier availability when the order is actually created, so
 * failing open costs at most one dead-end at Place order, while failing closed would push every
 * customer to a competitor's app the moment our own network hiccups.
 */
const FAIL_OPEN: DeliveryAvailability = {
    available: true,
    reason: null,
    branchId: null,
    etaMinutesMin: null,
    etaMinutesMax: null,
};

export function useDeliveryAvailability(): UseDeliveryAvailabilityResult {
    const [availability, setAvailability] = useState<DeliveryAvailability | null>(null);
    const [checking, setChecking] = useState(false);

    // Latest-wins: a slow earlier response must not overwrite the state a later call already set.
    // Every caller still gets its own result back; only the shared state is guarded.
    const latestCall = useRef(0);

    const check = useCallback(async (pin?: Coordinates, basket?: DeliveryBasketLine[]): Promise<DeliveryAvailability> => {
        const call = ++latestCall.current;
        setChecking(true);
        try {
            const result = basket === undefined || basket.length === 0
                ? await getDeliveryAvailability(pin)
                : await getDeliveryAvailability(pin, basket);
            if (call === latestCall.current) setAvailability(result);
            return result;
        } catch (error) {
            logger.error('Delivery availability check failed:', error);
            if (call === latestCall.current) setAvailability(FAIL_OPEN);
            return FAIL_OPEN;
        } finally {
            if (call === latestCall.current) setChecking(false);
        }
    }, []);

    const reset = useCallback((): void => setAvailability(null), []);

    return { availability, checking, check, reset };
}
