import * as React from "react";
import { useState } from "react";
import { Alert, Box, Button, TextField } from "@mui/material";
import ResponsiveSheet from "./ResponsiveSheet";
import { BRAND_BUTTON_SX, NEUTRAL_BUTTON_SX, ROUNDED_FIELD_SX } from "./roundedSelect";
import { createVendor } from "../../../../shared/api/management";
import { logger } from "../../../../shared/utils/logger";
import { DUPLICATE_VENDOR_NAME_MESSAGE, DuplicateVendorNameError } from "../../purchases/types";
import type { VendorTO } from "../../purchases/types";
import { cleanVendorName, normalizeVendorName } from "../utils/productName";

// Mirrors the server's 400 limit (POST /api/vendors) so the button is simply unavailable rather
// than failing after the round trip.
const MAX_NAME_LENGTH = 255;

export interface CreateVendorSheetProps {
    open: boolean;
    /** Pre-fills Name, e.g. with what was typed into the purchase invoice's vendor dropdown. */
    initialName?: string;
    /** Every known vendor, for instant duplicate feedback. The server re-checks and answers 409. */
    vendors: ReadonlyArray<VendorTO>;
    onCreated: (vendor: VendorTO) => void;
    onClose: () => void;
}

type CreateVendorFormProps = Omit<CreateVendorSheetProps, "open">;

/**
 * Creates a vendor from its name alone, which is all a vendor is.
 *
 * Bottom sheet on a phone, dialog on a wider screen (ResponsiveSheet).
 */
export default function CreateVendorSheet({ open, onClose, ...formProps }: CreateVendorSheetProps): React.JSX.Element {
    return (
        <ResponsiveSheet open={open} onClose={onClose} title="New vendor" testId="create-vendor-sheet">
            {/* The sheet mounts its body only while open, so every opening starts again from the
                props -- no reset-on-close effect to keep in step with the field below. */}
            <CreateVendorForm onClose={onClose} {...formProps} />
        </ResponsiveSheet>
    );
}

function CreateVendorForm({ initialName, vendors, onCreated, onClose }: CreateVendorFormProps): React.JSX.Element {
    const [name, setName] = useState<string>(initialName ?? "");
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [formError, setFormError] = useState<string | null>(null);
    // The normalized name the server refused with a 409, so the message stays on the field until
    // the name is changed instead of flashing once in a banner.
    const [serverDuplicateKey, setServerDuplicateKey] = useState<string | null>(null);

    const cleanedName = cleanVendorName(name);
    const nameKey = normalizeVendorName(name);
    // Normalizing the stored side too: vendors were inserted by hand, and some names carry padding.
    const isDuplicate = nameKey !== "" && (
        nameKey === serverDuplicateKey || vendors.some(v => normalizeVendorName(v.vendorName) === nameKey)
    );

    let nameError: string | null = null;
    if (isDuplicate) {
        nameError = DUPLICATE_VENDOR_NAME_MESSAGE;
    } else if (cleanedName.length > MAX_NAME_LENGTH) {
        nameError = `Up to ${MAX_NAME_LENGTH} characters`;
    }

    const canSubmit = cleanedName !== "" && nameError === null && !submitting;

    const handleSubmit = async (): Promise<void> => {
        if (!canSubmit) return;

        setSubmitting(true);
        setFormError(null);

        try {
            const created = await createVendor(cleanedName);
            onCreated(created);
        } catch (err) {
            logger.error("Failed to create vendor:", err);
            if (err instanceof DuplicateVendorNameError) {
                setServerDuplicateKey(nameKey);
            } else {
                setFormError(err instanceof Error ? err.message : "Failed to add the vendor");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box>
            {formError && (
                <Alert severity="error" sx={{ mb: 2 }} data-testid="create-vendor-error">
                    {formError}
                </Alert>
            )}

            <TextField
                label="Name"
                fullWidth
                value={name}
                onChange={e => setName(e.target.value)}
                error={nameError !== null}
                helperText={nameError ?? undefined}
                sx={{ mb: 2.5, ...ROUNDED_FIELD_SX }}
                inputProps={{ "data-testid": "create-vendor-name" }}
            />

            <Button
                fullWidth
                variant="contained"
                disableElevation
                onClick={() => { void handleSubmit(); }}
                disabled={!canSubmit}
                sx={{ ...BRAND_BUTTON_SX, mb: 1 }}
                data-testid="create-vendor-submit"
            >
                {submitting ? "Creating…" : "Create"}
            </Button>
            <Button
                fullWidth
                variant="outlined"
                onClick={onClose}
                disabled={submitting}
                sx={NEUTRAL_BUTTON_SX}
                data-testid="create-vendor-cancel"
            >
                Cancel
            </Button>
        </Box>
    );
}
