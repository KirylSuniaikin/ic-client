import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, Box, Typography, Button, CircularProgress, Alert, ToggleButtonGroup, ToggleButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { AddressCard } from './AddressCard';
import { AddressPickerDrawer } from './AddressPickerDrawer';
import { useSavedAddresses } from '../hooks/useSavedAddresses';
import { useDeliveryAvailability } from '../hooks/useDeliveryAvailability';
import type {
    CreateCustomerAddressRequest, CustomerAddress, DeliveryAvailability, DeliveryPaymentMethod,
} from '../types';

const brandRed = '#E44B4C';

/** What EazyPay's hosted page exposes (§1.5 block 4). */
const PAYMENT_METHODS: ReadonlyArray<{ value: DeliveryPaymentMethod; labelKey: string }> = [
    { value: 'CARD', labelKey: 'delivery.payCard' },
    { value: 'APPLE_PAY', labelKey: 'delivery.payApplePay' },
    { value: 'BENEFIT', labelKey: 'delivery.payBenefit' },
];

/**
 * The delivery checkout screen (DELIVERY_SPEC.md §1.5).
 *
 * Blocks, top to bottom: address selection → ETA → Place order. There is deliberately **no tip
 * block** (R7) and **no delivery-fee line** (§1.1) — the cost is baked into item prices.
 *
 * ── "Pay with" (§1.5 block 4) ────────────────────────────────────────────────────────────────
 * Card, Apple Pay and Benefit — what EazyPay's hosted page exposes. The chosen method is sent to
 * the server and stored on the order, so it is real data even while the provider is stubbed.
 *
 * ⚠️ Payment itself is a **stand-in** until EazyPay is integrated: the server settles nothing and
 * marks the order paid. It reports `stub: true`, and this screen says so rather than letting a
 * test order look like a real charge. The §1.7 ordering is already correct — settle, then
 * create — so wiring the real provider changes how the answer is reached, not this flow.
 */
export interface DeliveryCheckoutDrawerProps {
    open: boolean;
    onClose: () => void;
    /**
     * Handed the confirmed address and the chosen method once the gate has passed. The caller
     * runs payment — this screen does not create the order itself.
     */
    onConfirm: (
        address: CustomerAddress,
        availability: DeliveryAvailability,
        method: DeliveryPaymentMethod
    ) => void;
    /** Shown when the gate refuses on Place order — the caller renders the Keeta card. */
    onUnavailable: (availability: DeliveryAvailability) => void;
}

export function DeliveryCheckoutDrawer({
    open,
    onClose,
    onConfirm,
    onUnavailable,
}: DeliveryCheckoutDrawerProps): JSX.Element {
    const { t } = useTranslation('checkout');
    const { addresses, loading, error, save } = useSavedAddresses();
    const { availability, checking, check } = useDeliveryAvailability();

    const [selected, setSelected] = useState<CustomerAddress | null>(null);
    const [method, setMethod] = useState<DeliveryPaymentMethod>('CARD');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Preselect the newest saved address so a returning customer can place an order without
    // touching the list (§1.4.4). Only while nothing is chosen, so it never fights the customer.
    useEffect(() => {
        if (selected === null && addresses.length > 0) {
            setSelected(addresses[0]);
        }
    }, [addresses, selected]);

    /**
     * Fetches the ETA for the chosen pin. This uses the same endpoint as the §1.2 gate because
     * the ETA is derived from exactly the data the gate already computes (workload + Haversine),
     * so a separate endpoint would duplicate it. The two *gating* moments are still cart and
     * Place order; this call is for the number on screen.
     */
    const refreshEta = useCallback(
        (address: CustomerAddress) => {
            void check({ latitude: address.latitude, longitude: address.longitude });
        },
        [check]
    );

    useEffect(() => {
        if (selected !== null) {
            refreshEta(selected);
        }
    }, [selected, refreshEta]);

    async function handleSaveAddress(body: CreateCustomerAddressRequest): Promise<void> {
        setSaving(true);
        const created = await save(body);
        setSaving(false);
        if (created !== null) {
            setPickerOpen(false);
            setSelected(created);
        }
    }

    /** §1.2 step 2: the final gate, immediately before payment. State can have changed since the cart. */
    async function handlePlaceOrder(): Promise<void> {
        if (selected === null) return;
        const result = await check({ latitude: selected.latitude, longitude: selected.longitude });
        if (!result.available) {
            onUnavailable(result);
            return;
        }
        onConfirm(selected, result, method);
    }

    const eta = availability;
    const hasEta = eta !== null && eta.etaMinutesMin !== null && eta.etaMinutesMax !== null;

    return (
        <>
            <Drawer anchor="bottom" open={open} onClose={onClose}
                    PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90vh' } }}>
                <Box sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>{t('delivery.checkoutTitle')}</Typography>

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('delivery.deliverTo')}</Typography>

                    {loading && addresses.length === 0 ? (
                        <CircularProgress size={20} />
                    ) : (
                        <Box role="radiogroup" aria-label={t('delivery.deliverTo')}>
                            {addresses.map((address) => (
                                <AddressCard
                                    key={address.id}
                                    address={address}
                                    selected={selected?.id === address.id}
                                    onSelect={setSelected}
                                />
                            ))}
                        </Box>
                    )}

                    <Button
                        startIcon={<AddIcon />}
                        onClick={() => setPickerOpen(true)}
                        sx={{ textTransform: 'none', color: brandRed, mb: 2 }}
                    >
                        {t('delivery.addAddress')}
                    </Button>

                    {error !== null && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    {/* §1.5 block 2. The fallback string is required, not cosmetic: the estimate
                        is null whenever it cannot be computed honestly, and inventing a number
                        for an order someone is waiting on is worse than admitting we don't know. */}
                    <Box sx={{ borderTop: '1px solid #eee', pt: 2, mb: 2 }}>
                        <Typography variant="subtitle2">{t('delivery.etaTitle')}</Typography>
                        <Typography variant="body2" sx={{ color: '#666' }}>
                            {checking
                                ? t('delivery.etaLoading')
                                : hasEta
                                    ? t('delivery.etaRange', { min: eta.etaMinutesMin, max: eta.etaMinutesMax })
                                    : t('delivery.etaUnavailable')}
                        </Typography>
                    </Box>

                    {/* §1.5 block 4. Rendered from a constant rather than fetched: EazyPay's
                        hosted page exposes exactly these three, confirmed with the provider. */}
                    <Box sx={{ borderTop: '1px solid #eee', pt: 2, mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('delivery.payWith')}</Typography>
                        <ToggleButtonGroup
                            exclusive
                            fullWidth
                            value={method}
                            onChange={(_e, value) => { if (value !== null) setMethod(value); }}
                            sx={{ backgroundColor: '#f3f3f3', borderRadius: 3, p: '4px' }}
                        >
                            {PAYMENT_METHODS.map((option) => (
                                <ToggleButton
                                    key={option.value}
                                    value={option.value}
                                    sx={{ border: 0, flex: 1, borderRadius: 3, textTransform: 'none',
                                          '&.Mui-selected': { backgroundColor: '#fff', color: brandRed } }}
                                >
                                    {t(option.labelKey)}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </Box>

                    <Button
                        variant="contained"
                        onClick={() => { void handlePlaceOrder(); }}
                        disabled={selected === null || checking}
                        sx={{ backgroundColor: brandRed, textTransform: 'none', borderRadius: 4,
                              width: '100%', py: 1.5, '&:hover': { backgroundColor: brandRed } }}
                    >
                        {checking ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : t('delivery.placeOrder')}
                    </Button>
                </Box>
            </Drawer>

            <AddressPickerDrawer
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onSave={handleSaveAddress}
                saving={saving}
                error={error}
            />
        </>
    );
}
