import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Radio, IconButton } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
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
    /** The pencil. Omitted where the list is read-only (the §1.6 confirm sheet). */
    onEdit?: (address: CustomerAddress) => void;
}

export function AddressCard({ address, selected, onSelect, onEdit }: AddressCardProps): JSX.Element {
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
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
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
            {onEdit !== undefined && (
                // Stops the click from also selecting: reaching for the pencil is not a choice of
                // where to deliver, and silently re-selecting under the customer's finger would be
                // a surprise on a row they only meant to correct.
                <IconButton
                    aria-label={t('delivery.editAddress')}
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(address);
                    }}
                    sx={{ ml: 'auto', flexShrink: 0, color: '#a49a92', '&:hover': { color: BRAND_RED } }}
                >
                    <EditOutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            )}
        </Box>
    );
}
