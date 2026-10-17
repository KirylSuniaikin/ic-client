import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, Box, Typography, Button, CircularProgress, ToggleButtonGroup, ToggleButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import { AddressCard } from './AddressCard';
import { AddressPickerDrawer } from './AddressPickerDrawer';
import { OneLastCheckDrawer } from './OneLastCheckDrawer';
import {
    BRAND_RED, PRIMARY_BUTTON_SX, SECTION_CARD_SX, SECTION_LABEL_SX, SEGMENTED_BUTTON_SX,
    SEGMENTED_GROUP_SX, SHEET_PAPER_SX, SheetHandle, SheetNotice,
} from './sheetStyles';
import { useSavedAddresses } from '../hooks/useSavedAddresses';
import { useDeliveryAvailability } from '../hooks/useDeliveryAvailability';
import { toDeliveryBasket } from '../basket';
import type {
    CreateCustomerAddressRequest, CustomerAddress, DeliveryAvailability, DeliveryPaymentMethod,
    UpdateCustomerAddressRequest,
} from '../types';
import type { CartItem } from '../../menu/types';

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
    /** Listed read-only on the §1.6 confirm sheet, so a wrong cart is caught before the charge. */
    items: CartItem[];
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
    items,
    onConfirm,
    onUnavailable,
}: DeliveryCheckoutDrawerProps): JSX.Element {
    const { t } = useTranslation('checkout');
    const { addresses, loading, error, save, update, remove } = useSavedAddresses();
    const { availability, checking, check } = useDeliveryAvailability();

    const [selected, setSelected] = useState<CustomerAddress | null>(null);
    const [method, setMethod] = useState<DeliveryPaymentMethod>('CARD');
    const [pickerOpen, setPickerOpen] = useState(false);
    /** Non-null while the picker is being used as the pencil rather than as "add a new address". */
    const [editing, setEditing] = useState<CustomerAddress | null>(null);
    const [saving, setSaving] = useState(false);
    /** Non-null while the §1.6 confirm sheet is up, holding the gate result it was opened with. */
    const [confirming, setConfirming] =
        useState<{ address: CustomerAddress; availability: DeliveryAvailability } | null>(null);

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
    // The basket rides on every pin check so the server can also refuse an order too big for the
    // couriers on shift; the gate on Place order is the strict one.
    const basket = useMemo(() => toDeliveryBasket(items), [items]);

    const refreshEta = useCallback(
        (address: CustomerAddress) => {
            void check({ latitude: address.latitude, longitude: address.longitude }, basket);
        },
        [check, basket]
    );

    useEffect(() => {
        if (selected !== null) {
            refreshEta(selected);
        }
    }, [selected, refreshEta]);

    /**
     * The server folds a re-save of an address the customer already has onto the existing row and
     * returns it with a 200, so what comes back is not necessarily new. Selecting it is right
     * either way — and it is exactly the behaviour the duplicate case wants: the customer ends up
     * on their existing address instead of looking at an error they cannot act on.
     */
    async function handleSaveAddress(body: CreateCustomerAddressRequest): Promise<void> {
        setSaving(true);
        const saved = await save(body);
        setSaving(false);
        if (saved !== null) {
            setPickerOpen(false);
            setSelected(saved);
        }
    }

    async function handleUpdateAddress(addressId: string, body: UpdateCustomerAddressRequest): Promise<void> {
        setSaving(true);
        const edited = await update(addressId, body);
        setSaving(false);
        if (edited === null) return;
        setPickerOpen(false);
        setEditing(null);
        // Re-point the selection at the edited object, or the §1.6 confirm sheet would still show
        // the text the customer just corrected. The pin cannot have moved, so the ETA stands.
        setSelected((current) => (current?.id === edited.id ? edited : current));
    }

    /**
     * Deleting the address the order is currently pointed at has to clear the selection, or the
     * sheet would go on quoting an ETA — and eventually take a payment — for a destination the
     * customer just removed. Nothing is re-selected in its place: choosing where the food goes is
     * the customer's decision, and picking one for them is exactly the surprise the pencil's own
     * `stopPropagation` exists to avoid.
     */
    async function deleteAddress(address: CustomerAddress): Promise<void> {
        const deleted = await remove(address.id);
        if (deleted) {
            setSelected((current) => (current?.id === address.id ? null : current));
        }
    }

    function openEditor(address: CustomerAddress): void {
        setEditing(address);
        setPickerOpen(true);
    }

    function closePicker(): void {
        setPickerOpen(false);
        setEditing(null);
    }

    /**
     * §1.2 step 2: the final gate, immediately before payment. State can have changed since the
     * cart.
     *
     * Passing the gate opens the §1.6 confirm sheet rather than charging straight away. The
     * availability result is carried on that state, not re-fetched on confirm: re-running the
     * gate would quote the customer one ETA and file the order against another.
     */
    async function handlePlaceOrder(): Promise<void> {
        if (selected === null) return;
        const result = await check({ latitude: selected.latitude, longitude: selected.longitude }, basket);
        if (!result.available) {
            onUnavailable(result);
            return;
        }
        setConfirming({ address: selected, availability: result });
    }

    const eta = availability;
    const hasEta = eta !== null && eta.etaMinutesMin !== null && eta.etaMinutesMax !== null;

    return (
        <>
            {/* Steps, not a stack: this slides away while the address picker or the §1.6 confirm
                sheet is up, so the customer sees one screen advance rather than sheets piling on
                top of each other. The component stays mounted throughout, so the address and
                payment method they already picked are still here when Edit order brings it back. */}
            <Drawer
                anchor="bottom"
                open={open && !pickerOpen && confirming === null}
                onClose={onClose}
                PaperProps={{ sx: SHEET_PAPER_SX }}
            >
                <Box sx={{ p: 3, pb: 4, overflowY: 'auto' }}>
                    <SheetHandle />

                    <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center', mb: 2 }}>
                        {t('delivery.checkoutTitle')}
                    </Typography>

                    <Typography variant="subtitle2" sx={SECTION_LABEL_SX}>{t('delivery.deliverTo')}</Typography>

                    {loading && addresses.length === 0 ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <CircularProgress size={20} sx={{ color: BRAND_RED }} />
                        </Box>
                    ) : (
                        <Box role="radiogroup" aria-label={t('delivery.deliverTo')}>
                            {addresses.map((address) => (
                                <AddressCard
                                    key={address.id}
                                    address={address}
                                    selected={selected?.id === address.id}
                                    onSelect={setSelected}
                                    onEdit={openEditor}
                                    onDelete={(target) => { void deleteAddress(target); }}
                                />
                            ))}
                        </Box>
                    )}

                    <Button
                        startIcon={<AddIcon />}
                        onClick={() => { setEditing(null); setPickerOpen(true); }}
                        sx={{ textTransform: 'none', fontWeight: 600, color: BRAND_RED, borderRadius: 999, mb: 2 }}
                    >
                        {t('delivery.addAddress')}
                    </Button>

                    {error !== null && <Box sx={{ mb: 2 }}><SheetNotice tone="error">{error}</SheetNotice></Box>}

                    {/* §1.5 block 2. The fallback string is required, not cosmetic: the estimate
                        is null whenever it cannot be computed honestly, and inventing a number
                        for an order someone is waiting on is worse than admitting we don't know. */}
                    <Box sx={{ ...SECTION_CARD_SX, display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                                   width: 40, height: 40, borderRadius: '50%', backgroundColor: '#fff2f2', flexShrink: 0 }}>
                            <AccessTimeRoundedIcon sx={{ fontSize: 20, color: BRAND_RED }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#3b352c' }}>
                                {t('delivery.etaTitle')}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#8a807a' }}>
                                {checking
                                    ? t('delivery.etaLoading')
                                    : hasEta
                                        ? t('delivery.etaRange', { min: eta.etaMinutesMin, max: eta.etaMinutesMax })
                                        : t('delivery.etaUnavailable')}
                            </Typography>
                        </Box>
                    </Box>

                    {/* §1.5 block 4. Rendered from a constant rather than fetched: EazyPay's
                        hosted page exposes exactly these three, confirmed with the provider. */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={SECTION_LABEL_SX}>{t('delivery.payWith')}</Typography>
                        <ToggleButtonGroup
                            exclusive
                            fullWidth
                            value={method}
                            onChange={(_e, value) => { if (value !== null) setMethod(value); }}
                            sx={SEGMENTED_GROUP_SX}
                        >
                            {PAYMENT_METHODS.map((option) => (
                                <ToggleButton key={option.value} value={option.value} sx={SEGMENTED_BUTTON_SX}>
                                    {t(option.labelKey)}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </Box>

                    <Button
                        variant="contained"
                        onClick={() => { void handlePlaceOrder(); }}
                        disabled={selected === null || checking}
                        sx={PRIMARY_BUTTON_SX}
                    >
                        {checking ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : t('delivery.placeOrder')}
                    </Button>
                </Box>
            </Drawer>

            {/* Keyed on what is being edited: the drawer seeds its fields once, on mount, so the
                key is what makes the pencil show this address rather than the last one. */}
            <AddressPickerDrawer
                key={editing?.id ?? 'new'}
                open={pickerOpen}
                onClose={closePicker}
                onSave={handleSaveAddress}
                editing={editing}
                onUpdate={handleUpdateAddress}
                saving={saving}
                error={error}
            />

            {/* §1.6 — the last thing between the customer and a charge. Closing it (Edit order or
                dismiss) drops back to this screen, which is where the address and the payment
                method it lists are actually editable. */}
            <OneLastCheckDrawer
                open={confirming !== null}
                address={confirming?.address ?? null}
                items={items}
                paymentLabel={t(
                    PAYMENT_METHODS.find((option) => option.value === method)?.labelKey ?? 'delivery.payCard'
                )}
                onEdit={() => setConfirming(null)}
                onClose={() => setConfirming(null)}
                onConfirm={() => {
                    if (confirming === null) return;
                    setConfirming(null);
                    onConfirm(confirming.address, confirming.availability, method);
                }}
            />
        </>
    );
}
