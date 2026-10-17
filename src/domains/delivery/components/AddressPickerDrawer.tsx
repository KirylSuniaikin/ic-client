import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, TextField, Button, CircularProgress } from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type {
    Coordinates, CreateCustomerAddressRequest, CustomerAddress, UpdateCustomerAddressRequest,
} from '../types';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import {
    FIELD_SX, OUTLINED_BUTTON_SX, PRIMARY_BUTTON_SX, SECTION_CARD_SX, SECTION_LABEL_SX,
    SHEET_DESKTOP, SHEET_PAPER_SX, SheetHandle, SheetNotice,
} from './sheetStyles';
import { CustomerSheet } from '../../../shared/components/CustomerSheet';

/**
 * Address entry + pin capture (DELIVERY_SPEC.md §1.4).
 *
 * The pin is mandatory and is the source of truth for nearest-branch routing, the radius check
 * and the ETA — the Bahrain text fields are what the courier reads. The backend rejects a save
 * with no pin rather than defaulting to 0,0, so this form does the same client-side.
 *
 * ── On the Google layer ──────────────────────────────────────────────────────────────────────
 * §1.4 specifies Places Autocomplete + a draggable Maps JS pin. Both need the Maps Platform key,
 * which is still an open external input (§10), so this ships with the browser's own Geolocation
 * API instead: free, keyless, and accurate enough to place a pin the customer then confirms.
 * When the key lands, autocomplete and the draggable map slot in above the manual fields —
 * `pin` is already the single value everything else depends on, so nothing downstream changes.
 *
 * ── Edit mode (the pencil) ───────────────────────────────────────────────────────────────────
 * Passing `editing` seeds the fields from a saved address and turns the sheet into a text edit.
 * **The pin block disappears rather than becoming editable.** Latitude and longitude drive
 * nearest-branch routing, the radius check and the ETA, and the row may already be attached to an
 * order a courier is running; letting the pencil move it could retarget a live delivery and could
 * turn an address that passed the availability gate into one that no longer does. Moving a pin is
 * "add a new address", which re-runs the gate — and the 20 m server-side dedupe folds it back onto
 * this row if it did not really move.
 */
export interface AddressPickerDrawerProps {
    open: boolean;
    onClose: () => void;
    onSave: (body: CreateCustomerAddressRequest) => void | Promise<void>;
    /**
     * Non-null puts the drawer in edit mode. The fields are seeded once, on mount, so the parent
     * must key this component on the address being edited.
     */
    editing?: CustomerAddress | null;
    /** Required in edit mode; unused otherwise. */
    onUpdate?: (addressId: string, body: UpdateCustomerAddressRequest) => void | Promise<void>;
    saving?: boolean;
    /** Surfaced inline; the drawer stays open so the customer can retry. */
    error?: string | null;
}

export function AddressPickerDrawer({
    open,
    onClose,
    onSave,
    editing = null,
    onUpdate,
    saving = false,
    error = null,
}: AddressPickerDrawerProps): JSX.Element {
    const { t } = useTranslation('checkout');

    const [label, setLabel] = useState(editing?.label ?? '');
    const [block, setBlock] = useState(editing?.block ?? '');
    const [road, setRoad] = useState(editing?.road ?? '');
    const [building, setBuilding] = useState(editing?.building ?? '');
    const [flat, setFlat] = useState(editing?.flat ?? '');
    const [note, setNote] = useState(editing?.note ?? '');
    const [pin, setPin] = useState<Coordinates | null>(null);
    const reverseGeocode = useReverseGeocode();
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    function requestLocation(): void {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setLocationError(t('delivery.locationUnsupported'));
            return;
        }
        setLocating(true);
        setLocationError(null);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coordinates = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                setPin(coordinates);
                setLocating(false);
                // Prefill only, and only what is still empty: a pin on its own leaves the courier
                // with "No address" on their card, but whatever the customer typed is the truth
                // about their own door and must never be overwritten by a guess.
                void reverseGeocode(coordinates.latitude, coordinates.longitude).then((guess) => {
                    if (guess === null) return;
                    setBlock((current) => (current.trim() === '' ? guess.block ?? '' : current));
                    setRoad((current) => (current.trim() === '' ? guess.road ?? '' : current));
                    setBuilding((current) => (current.trim() === '' ? guess.building ?? '' : current));
                });
            },
            () => {
                // Denied, unavailable or timed out — all read the same to the customer, and the
                // only useful next step is the same: allow access and try again.
                setLocationError(t('delivery.locationDenied'));
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    const isEditing = editing !== null;

    function handleSave(): void {
        // Empty optional fields go as null, not "", so the DB never holds a blank string — and so
        // clearing a field on an edit actually clears the column.
        const text: UpdateCustomerAddressRequest = {
            label: label.trim() || null,
            block: block.trim() || null,
            road: road.trim() || null,
            building: building.trim() || null,
            flat: flat.trim() || null,
            note: note.trim() || null,
        };

        if (editing !== null) {
            if (onUpdate === undefined) return;
            void onUpdate(editing.id, text);
            return;
        }

        if (pin === null) return;
        void onSave({ ...text, latitude: pin.latitude, longitude: pin.longitude });
    }

    return (
        <CustomerSheet open={open} onClose={onClose} desktop={SHEET_DESKTOP} PaperProps={{ sx: SHEET_PAPER_SX }}>
            <Box sx={{ p: 3, pb: 4, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
                <SheetHandle />

                <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center', mb: 0.5 }}>
                    {isEditing ? t('delivery.editAddressTitle') : t('delivery.addressTitle')}
                </Typography>

                <Box sx={{ ...SECTION_CARD_SX, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <TextField label={t('delivery.block')} value={block} onChange={(e) => setBlock(e.target.value)} fullWidth size="small" sx={FIELD_SX} />
                        <TextField label={t('delivery.road')} value={road} onChange={(e) => setRoad(e.target.value)} fullWidth size="small" sx={FIELD_SX} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <TextField label={t('delivery.building')} value={building} onChange={(e) => setBuilding(e.target.value)} fullWidth size="small" sx={FIELD_SX} />
                        <TextField label={t('delivery.flat')} value={flat} onChange={(e) => setFlat(e.target.value)} fullWidth size="small" sx={FIELD_SX} />
                    </Box>
                    <TextField label={t('delivery.label')} value={label} onChange={(e) => setLabel(e.target.value)} fullWidth size="small" sx={FIELD_SX} />
                    <TextField label={t('delivery.note')} value={note} onChange={(e) => setNote(e.target.value)} fullWidth size="small" multiline minRows={2} sx={FIELD_SX} />
                </Box>

                {/* The pin block. Deliberately prominent and blocking: an address with no pin
                    cannot be routed, and §1.4's copy asks the customer to place it precisely.
                    In edit mode it says the pin is fixed instead of offering to move it — see the
                    component doc for why the pencil must not move a pin. */}
                {isEditing ? (
                    <Box sx={SECTION_CARD_SX}>
                        <Typography variant="subtitle2" sx={SECTION_LABEL_SX}>{t('delivery.pinTitle')}</Typography>
                        <Typography variant="body2" sx={{ color: '#8a807a' }}>{t('delivery.pinLocked')}</Typography>
                    </Box>
                ) : (
                    <Box sx={SECTION_CARD_SX}>
                        <Typography variant="subtitle2" sx={SECTION_LABEL_SX}>{t('delivery.pinTitle')}</Typography>
                        <Typography variant="body2" sx={{ color: '#8a807a', mb: 1.5 }}>{t('delivery.pinHint')}</Typography>

                        <Button
                            variant="outlined"
                            fullWidth
                            startIcon={locating ? <CircularProgress size={16}  /> : <MyLocationIcon />}
                            onClick={requestLocation}
                            disabled={locating}
                            sx={{ ...OUTLINED_BUTTON_SX, py: 1.25 }}
                        >
                            {pin === null ? t('delivery.useMyLocation') : t('delivery.updateLocation')}
                        </Button>

                        {pin !== null && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5 }}>
                                <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#2e7d32' }} />
                                <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                                    {t('delivery.pinSet')}
                                </Typography>
                            </Box>
                        )}
                        {locationError !== null && (
                            <Box sx={{ mt: 1.5 }}><SheetNotice tone="warning">{locationError}</SheetNotice></Box>
                        )}
                    </Box>
                )}

                {error !== null && <SheetNotice tone="error">{error}</SheetNotice>}

                <Button
                    variant="contained"
                    onClick={handleSave}
                    // Guards the same rule the server enforces: no pin, no address. An edit already
                    // has one and cannot change it, so only the in-flight request gates it there.
                    disabled={saving || (!isEditing && pin === null)}
                    sx={PRIMARY_BUTTON_SX}
                >
                    {saving
                        ? <CircularProgress size={20} sx={{ color: '#fff' }} />
                        : isEditing ? t('delivery.saveChanges') : t('delivery.saveAddress')}
                </Button>
            </Box>
        </CustomerSheet>
    );
}
