import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button } from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import { formatAddressLine } from '../types';
import type { CustomerAddress } from '../types';
import type { CartItem } from '../../menu/types';
import {
    BRAND_RED, PRIMARY_BUTTON_SX, SECTION_CARD_SX, SECTION_LABEL_SX, SHEET_PAPER_SX, SUBTLE_BUTTON_SX,
    SHEET_DESKTOP, SheetHandle,
} from './sheetStyles';
import { CustomerSheet } from '../../../shared/components/CustomerSheet';

/**
 * "One last check" (DELIVERY_SPEC.md §1.6) — the confirm sheet between Place order and payment.
 *
 * Shows address, items and payment method, with a short escape back to the cart. Deliberately
 * read-only: it exists so a customer catches a wrong address before they are charged, and an
 * editable field here would just be a second, worse cart.
 */
export interface OneLastCheckDrawerProps {
    open: boolean;
    address: CustomerAddress | null;
    items: CartItem[];
    /** Rendered as-is. Delivery is online-only (§1.1), so this is whatever the provider will charge. */
    paymentLabel: string;
    onEdit: () => void;
    onConfirm: () => void;
    onClose: () => void;
}

export function OneLastCheckDrawer({
    open, address, items, paymentLabel, onEdit, onConfirm, onClose,
}: OneLastCheckDrawerProps): JSX.Element {
    const { t } = useTranslation('checkout');

    // Receipt shape (owner's call): the lines keep printing at full price and the saving gets its
    // own row above the total, so the lines visibly add up to the number underneath them AND the
    // customer can see what the discount took off. Recomputing the lines at the discounted price
    // would also add up, but it would hide the saving entirely.
    const fullTotal = items.reduce((acc, item) => acc + item.amount * item.quantity, 0);
    const payable = items.reduce((acc, item) => {
        const discount = item.discountAmount ?? 0;
        return acc + item.amount * (1 - discount / 100) * item.quantity;
    }, 0);
    const total = payable.toFixed(2);
    const discount = (fullTotal - payable).toFixed(2);
    // Compared after rounding, not before: a discount too small to print is not a discount, and a
    // "-0.00" row on an undiscounted cart is noise on the last screen before a charge.
    const hasDiscount = Number(discount) > 0;

    return (
        <CustomerSheet open={open} onClose={onClose} desktop={SHEET_DESKTOP} PaperProps={{ sx: SHEET_PAPER_SX }}>
            <Box sx={{ p: 3, pb: 4, overflowY: 'auto' }}>
                <SheetHandle />

                <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center', mb: 2 }}>
                    {t('delivery.lastCheckTitle')}
                </Typography>

                <Box sx={{ ...SECTION_CARD_SX, display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                    <PlaceRoundedIcon sx={{ fontSize: 20, color: BRAND_RED, mt: '2px', flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#3b352c' }}>
                            {t('delivery.deliverTo')}
                        </Typography>
                        {/* An address saved from "use my location" carries a pin and nothing else,
                            so formatAddressLine has no parts to join and returns "". Printing that
                            leaves the block blank, which reads as a broken screen rather than as a
                            location we do know. Same fallback AddressCard already uses. */}
                        <Typography variant="body2" sx={{ color: '#8a807a' }}>
                            {address === null
                                ? t('delivery.noAddressSelected')
                                : formatAddressLine(address) || t('delivery.pinOnlyAddress')}
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ ...SECTION_CARD_SX, mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={SECTION_LABEL_SX}>{t('delivery.yourOrder')}</Typography>
                    {items.map((item, index) => (
                        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.75 }}>
                            <Typography variant="body2" sx={{ color: '#3b352c' }}>
                                {item.quantity} × {item.name}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#3b352c', whiteSpace: 'nowrap' }}>
                                {(item.amount * item.quantity).toFixed(2)}
                            </Typography>
                        </Box>
                    ))}

                    {hasDiscount && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 1.5 }}>
                            <Typography variant="body2" sx={{ color: '#3b352c' }}>
                                {t('delivery.discount')}
                            </Typography>
                            <Typography variant="body2" sx={{ color: BRAND_RED, whiteSpace: 'nowrap' }}>
                                -{discount}
                            </Typography>
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, pt: 1.5,
                               borderTop: '1px dashed #ece3dd' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t('delivery.total')}</Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: BRAND_RED }}>{total}</Typography>
                    </Box>
                </Box>

                <Box sx={{ ...SECTION_CARD_SX, display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <CreditCardRoundedIcon sx={{ fontSize: 20, color: BRAND_RED, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#3b352c' }}>
                            {t('delivery.payingWith')}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#8a807a' }}>{paymentLabel}</Typography>
                    </Box>
                </Box>

                <Button
                    variant="contained"
                    onClick={onConfirm}
                    disabled={address === null}
                    sx={{ ...PRIMARY_BUTTON_SX, mb: 1 }}
                >
                    {t('delivery.looksGood')}
                </Button>
                <Button onClick={onEdit} sx={SUBTLE_BUTTON_SX}>
                    {t('delivery.editOrder')}
                </Button>
            </Box>
        </CustomerSheet>
    );
}
