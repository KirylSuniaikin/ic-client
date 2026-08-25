import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Radio } from '@mui/material';
import { formatAddressLine } from '../types';
import type { CustomerAddress } from '../types';
import { BRAND_RED } from './sheetStyles';

/**
 * One saved address, selectable (DELIVERY_SPEC.md §1.4.4 / §1.5 block 1).
 *
 * Shows the Bahrain parts rather than a single formatted line because that is what the courier
 * reads off it, and Google's reverse-geocode is unreliable at building level here (§1.4).
 */
export interface AddressCardProps {
    address: CustomerAddress;
    selected: boolean;
    onSelect: (address: CustomerAddress) => void;
}

export function AddressCard({ address, selected, onSelect }: AddressCardProps): JSX.Element {
    const { t } = useTranslation('checkout');
    const line = formatAddressLine(address);

    return (
        <Box
            role="radio"
            aria-checked={selected}
            tabIndex={0}
            onClick={() => onSelect(address)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(address);
                }
            }}
            sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1,
                p: 2, mb: 1, cursor: 'pointer',
                border: `1px solid ${selected ? BRAND_RED : '#f1eae4'}`,
                borderRadius: 4,
                backgroundColor: selected ? '#fff7f7' : '#fff',
                transition: 'border-color 120ms ease, background-color 120ms ease',
                '&:hover': { borderColor: selected ? BRAND_RED : '#e0d3ca' },
            }}
        >
            <Radio checked={selected} size="small" sx={{ p: 0, mt: '2px', color: '#ccc', '&.Mui-checked': { color: BRAND_RED } }} />
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {address.label ?? t('delivery.unlabelledAddress')}
                </Typography>
                {/* An address saved with only a pin has no parts to show; say so rather than
                    render an empty line that looks like a rendering bug. */}
                <Typography variant="body2" sx={{ color: '#8a807a' }}>
                    {line === '' ? t('delivery.pinOnlyAddress') : line}
                </Typography>
                {address.note !== null && address.note !== '' && (
                    <Typography variant="caption" sx={{ color: '#a49a92' }}>{address.note}</Typography>
                )}
            </Box>
        </Box>
    );
}
