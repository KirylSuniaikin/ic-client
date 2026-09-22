import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Box, Typography, Button } from '@mui/material';
import { KEETA_DEEP_LINK } from '../constants';
import type { DeliveryUnavailableReason } from '../types';

const brandRed = '#E44B4C';

/**
 * Shown when the §1.2 gate refuses: we cannot deliver, so send the customer to Keeta rather than
 * lose the order entirely.
 *
 * The copy differs by reason on purpose. `OUTSIDE_RADIUS` is a permanent "not to this address",
 * so offering "try again later" would be a lie; `NO_COURIER` is temporary and worth waiting out.
 * A customer told the wrong one either gives up on us for good or keeps retrying for nothing.
 *
 * Note this is only ever the PRE-payment path. Once an order is paid, an all-declined queue ends
 * in manager manual-assign (§2.3) — never here, because the customer has already been charged.
 */
export interface KeetaFallbackCardProps {
    open: boolean;
    reason: DeliveryUnavailableReason | null;
    onClose: () => void;
}

export function KeetaFallbackCard({ open, reason, onClose }: KeetaFallbackCardProps): JSX.Element {
    const { t } = useTranslation('checkout');

    const bodyKey =
        reason === 'OUTSIDE_RADIUS' ? 'delivery.keetaOutsideRadius' : 'delivery.keetaNoCourier';

    return (
        <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: 4, m: 2 } }}>
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 1 }}>{t('delivery.keetaTitle')}</Typography>
                <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>{t(bodyKey)}</Typography>

                <Button
                    variant="contained"
                    // noopener/noreferrer: the target is a third-party site and must not get a
                    // handle back on this window.
                    onClick={() => window.open(KEETA_DEEP_LINK, '_blank', 'noopener,noreferrer')}
                    sx={{ backgroundColor: brandRed, textTransform: 'none', borderRadius: 4,
                          width: '100%', py: 1.25, mb: 1, '&:hover': { backgroundColor: brandRed } }}
                >
                    {t('delivery.keetaCta')}
                </Button>
                <Button onClick={onClose} sx={{ textTransform: 'none', color: '#666' }}>
                    {t('delivery.keetaDismiss')}
                </Button>
            </Box>
        </Dialog>
    );
}
