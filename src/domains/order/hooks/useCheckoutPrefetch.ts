import { useEffect, useState } from "react";
import { logger } from "../../../shared/utils/logger";
import { fetchCustomerMe } from "../../../shared/api/customerAuth";
import { getAllBannedCstmrs } from "../../../shared/api/management";
import type { CustomerMeResponse } from "../../customer-auth/types";
import { describeError } from "../utils/checkoutFlow";

export type Prefetch = { eligible: boolean; profile: CustomerMeResponse; banned: boolean };
type StoredPrefetch = Prefetch & { forToken: string };

interface UseCheckoutPrefetchParams {
    active: boolean;
    token: string | null;
    fetchEligibility: (accessToken: string) => Promise<{ enabled: boolean }>;
    // Caller-specific log prefix, so each checkout keeps its own greppable warning.
    failureLabel: string;
}

// Prefetches everything a pay button's visibility depends on. Any failure leaves the result null
// (fail closed), and data fetched for a previous customer's token is never returned.
export function useCheckoutPrefetch({ active, token, fetchEligibility, failureLabel }:UseCheckoutPrefetchParams): Prefetch | null {
    const [stored, setStored] = useState<StoredPrefetch | null>(null);

    useEffect(() => {
        if (!active || !token) return;
        let cancelled = false;
        Promise.all([fetchEligibility(token), fetchCustomerMe(token), getAllBannedCstmrs()])
            .then(([eligibility, profile, banned]) => {
                if (cancelled) return;
                setStored({
                    forToken: token,
                    eligible: eligibility.enabled,
                    profile,
                    banned: banned.some(c => c.telephoneNo === profile.phone),
                });
            })
            .catch((e: unknown) => {
                logger.warn(failureLabel,describeError(e));
                if (!cancelled) setStored(null);
            });
        return () => { cancelled = true; };
    }, [active, token, fetchEligibility, failureLabel]);

    return stored?.forToken === token ? stored : null;
}
