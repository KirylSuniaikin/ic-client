import React from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, Box, Typography, Button, Divider } from '@mui/material';
import { formatAddressLine } from '../types';
import type { CustomerAddress } from '../types';
import type { CartItem } from '../../menu/types';

const brandRed = '#E44B4C';

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

    const total = items
        .reduce((acc, item) => {
            const discount = item.discountAmount ?? 0;
            return acc + item.amount * (1 - discount / 100) * item.quantity;
        }, 0)
        .toFixed(2);

    return (
        <Drawer anchor="bottom" open={open} onClose={onClose}
                PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85vh' } }}>
            <Box sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>{t('delivery.lastCheckTitle')}</Typography>

                <Typography variant="subtitle2">{t('delivery.deliverTo')}</Typography>
                <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                    {address === null ? t('delivery.noAddressSelected') : formatAddressLine(address)}
                </Typography>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('delivery.yourOrder')}</Typography>
                {items.map((item, index) => (
                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">{item.quantity} × {item.name}</Typography>
                        <Typography variant="body2">{(item.amount * item.quantity).toFixed(2)}</Typography>
                    </Box>
                ))}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, mb: 2 }}>
                    <Typography variant="subtitle2">{t('delivery.total')}</Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{total}</Typography>
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="subtitle2">{t('delivery.payingWith')}</Typography>
                <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>{paymentLabel}</Typography>

                <Button
                    variant="contained"
                    onClick={onConfirm}
                    disabled={address === null}
                    sx={{ backgroundColor: brandRed, textTransform: 'none', borderRadius: 4,
                          width: '100%', py: 1.5, mb: 1, '&:hover': { backgroundColor: brandRed } }}
                >
                    {t('delivery.looksGood')}
                </Button>
                <Button onClick={onEdit} sx={{ textTransform: 'none', color: '#666', width: '100%' }}>
                    {t('delivery.editOrder')}
                </Button>
            </Box>
        </Drawer>
    );
}
