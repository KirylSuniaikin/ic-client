import * as React from "react";
import { useState } from "react";
import { Alert, Box, Button, InputAdornment, MenuItem, Switch, TextField, Typography } from "@mui/material";
import ResponsiveSheet, { SHEET_Z_INDEX } from "./ResponsiveSheet";
import { BRAND_BUTTON_SX, BRAND_SWITCH_SX, ROUNDED_FIELD_SX, roundedMenuProps } from "./roundedSelect";
import { createProduct } from "../../../../shared/api/management";
import { logger } from "../../../../shared/utils/logger";
import { formatUnit, MEASURE_UNITS } from "../../../../shared/utils/unitFormat";
import type { MeasureUnit } from "../../../../shared/utils/unitFormat";
import { DUPLICATE_PRODUCT_NAME_MESSAGE, DuplicateProductNameError } from "../../inventory/types";
import type { CreateProductRequest, ProductTO } from "../../inventory/types";
import type { VendorTO } from "../../purchases/types";
import { cleanProductName, normalizeProductName } from "../utils/productName";

// Mirror the server's 400 limits (POST /api/products) so the button is simply unavailable rather
// than failing after the round trip.
const MAX_NAME_LENGTH = 255;
const MAX_TARGET_PRICE = 999999.999;
// Same input guard as every other BD amount field: digits, one point, at most three decimals --
// which also makes a negative price impossible to type.
const AMOUNT_PATTERN = /^\d*\.?\d{0,3}$/;

const HAIRLINE = "#f1eae4";

/** All the duplicate check needs from a product, so both ProductTO and a table row can be passed. */
export type ExistingProduct = Pick<ProductTO, "name" | "isPurchasable">;

export interface CreateProductSheetProps {
    open: boolean;
    /** Pre-fills Name, e.g. with what was typed into the purchase product dropdown. */
    initialName?: string;
    /**
     * Forces Purchasable on and locks it. The purchase dropdown lists purchasable products only, so
     * a product created from there with the switch off would vanish from the very list it was
     * created for.
     */
    lockPurchasable?: boolean;
    /** Pre-selects Top vendor; matched to `vendors` case-insensitively, ignored when nothing matches. */
    initialTopVendor?: string | null;
    vendors: VendorTO[];
    /** Every known product, for instant duplicate feedback. The server re-checks and answers 409. */
    existingProducts: ReadonlyArray<ExistingProduct>;
    onCreated: (product: ProductTO) => void;
    onClose: () => void;
}

type CreateProductFormProps = Omit<CreateProductSheetProps, "open" | "onClose">;

function vendorKey(name: string | null | undefined): string {
    return String(name ?? "").trim().toLowerCase();
}

/**
 * Creates a product with the handful of fields a person can know up front. Everything else starts
 * null/false on the server; in particular the current price is filled in by the first purchase.
 *
 * Bottom sheet on a phone, dialog on a wider screen (ResponsiveSheet).
 */
export default function CreateProductSheet({ open, onClose, ...formProps }: CreateProductSheetProps): React.JSX.Element {
    return (
        <ResponsiveSheet
            open={open}
            onClose={onClose}
            title="Add product"
            subtitle="Its current price fills in from its first purchase."
            testId="create-product-sheet"
        >
            {/* The sheet mounts its body only while open, so every opening starts again from the
                props -- no reset-on-close effect to keep in step with the fields below. */}
            <CreateProductForm {...formProps} />
        </ResponsiveSheet>
    );
}

function CreateProductForm({
    initialName,
    lockPurchasable = false,
    initialTopVendor,
    vendors,
    existingProducts,
    onCreated,
}: CreateProductFormProps): React.JSX.Element {
    const [name, setName] = useState<string>(initialName ?? "");
    const [targetPrice, setTargetPrice] = useState<string>("");
    const [unit, setUnit] = useState<MeasureUnit | "">("");
    // Held as typed/passed and resolved against `vendors` on every render, so a vendor list that
    // arrives after the sheet opened still picks up the initial vendor.
    const [topVendor, setTopVendor] = useState<string>(initialTopVendor ?? "");
    const [isInventory, setIsInventory] = useState<boolean>(false);
    const [isPurchasable, setIsPurchasable] = useState<boolean>(lockPurchasable);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [formError, setFormError] = useState<string | null>(null);
    // The normalized name the server refused with a 409, so the message stays on the field until
    // the name is changed instead of flashing once in a banner.
    const [serverDuplicateKey, setServerDuplicateKey] = useState<string | null>(null);

    const cleanedName = cleanProductName(name);
    const nameKey = normalizeProductName(name);
    const duplicate = nameKey === ""
        ? undefined
        : existingProducts.find(p => normalizeProductName(p.name) === nameKey);

    let nameError: string | null = null;
    if (duplicate) {
        // From the purchase dropdown the likely story is "it exists but is not purchasable", which
        // is why it did not show up in the list -- say so, or the person is simply stuck.
        nameError = lockPurchasable && !duplicate.isPurchasable
            ? `${DUPLICATE_PRODUCT_NAME_MESSAGE}, but it is not purchasable. Turn on Purchasable for it in Statistics → Pricing.`
            : DUPLICATE_PRODUCT_NAME_MESSAGE;
    } else if (nameKey !== "" && nameKey === serverDuplicateKey) {
        nameError = DUPLICATE_PRODUCT_NAME_MESSAGE;
    } else if (cleanedName.length > MAX_NAME_LENGTH) {
        nameError = `Up to ${MAX_NAME_LENGTH} characters`;
    }

    const parsedPrice = Number(targetPrice);
    const priceError = targetPrice !== "" && (!Number.isFinite(parsedPrice) || parsedPrice > MAX_TARGET_PRICE)
        ? `Between 0 and ${MAX_TARGET_PRICE}`
        : null;

    const selectedVendor = vendors.find(v => vendorKey(v.vendorName) === vendorKey(topVendor))?.vendorName ?? "";

    const canSubmit =
        cleanedName !== "" &&
        nameError === null &&
        targetPrice !== "" &&
        priceError === null &&
        unit !== "" &&
        !submitting;

    const handleSubmit = async (): Promise<void> => {
        // canSubmit includes `unit !== ""`, and TS carries that narrowing through the aliased
        // condition, so `unit` is a MeasureUnit below.
        if (!canSubmit) return;

        setSubmitting(true);
        setFormError(null);

        const request: CreateProductRequest = {
            name: cleanedName,
            targetPrice: parsedPrice,
            unit,
            topVendor: selectedVendor === "" ? null : selectedVendor,
            isInventory,
            isPurchasable: lockPurchasable || isPurchasable,
        };

        try {
            const created = await createProduct(request);
            onCreated(created);
        } catch (err) {
            logger.error("Failed to create product:", err);
            if (err instanceof DuplicateProductNameError) {
                setServerDuplicateKey(nameKey);
            } else {
                setFormError(err instanceof Error ? err.message : "Failed to add the product");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box>
            {formError && (
                <Alert severity="error" sx={{ mb: 2 }} data-testid="create-product-error">
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
                sx={{ mb: 2, ...ROUNDED_FIELD_SX }}
                inputProps={{ "data-testid": "create-product-name" }}
            />

            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                <TextField
                    label="Target price"
                    value={targetPrice}
                    onChange={e => {
                        const val = e.target.value;
                        if (val === "" || AMOUNT_PATTERN.test(val)) setTargetPrice(val);
                    }}
                    error={priceError !== null}
                    helperText={priceError ?? undefined}
                    inputProps={{ inputMode: "decimal", "data-testid": "create-product-target-price" }}
                    InputProps={{ startAdornment: <InputAdornment position="start">BD</InputAdornment> }}
                    sx={{ flex: 3, ...ROUNDED_FIELD_SX }}
                />
                <TextField
                    select
                    label="Unit"
                    value={unit}
                    onChange={e => setUnit(MEASURE_UNITS.find(u => u === e.target.value) ?? "")}
                    SelectProps={{ MenuProps: roundedMenuProps(SHEET_Z_INDEX + 10) }}
                    sx={{ flex: 2, ...ROUNDED_FIELD_SX }}
                    data-testid="create-product-unit"
                >
                    {MEASURE_UNITS.map(u => (
                        <MenuItem key={u} value={u}>{formatUnit(u)}</MenuItem>
                    ))}
                </TextField>
            </Box>

            <TextField
                select
                label="Top vendor"
                fullWidth
                value={selectedVendor}
                onChange={e => setTopVendor(e.target.value)}
                SelectProps={{ displayEmpty: true, MenuProps: roundedMenuProps(SHEET_Z_INDEX + 10) }}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2, ...ROUNDED_FIELD_SX }}
                data-testid="create-product-vendor"
            >
                <MenuItem value="">None</MenuItem>
                {vendors.map(v => (
                    <MenuItem key={v.id} value={v.vendorName}>{v.vendorName}</MenuItem>
                ))}
            </TextField>

            <Box sx={{ border: `1px solid ${HAIRLINE}`, borderRadius: 4, px: 2, py: 0.5, mb: 2.5 }}>
                <SwitchRow
                    label="Inventory item"
                    caption="Counted in inventory reports"
                    checked={isInventory}
                    onChange={setIsInventory}
                />
                <Box sx={{ borderTop: `1px solid ${HAIRLINE}` }} />
                <SwitchRow
                    label="Purchasable"
                    caption={lockPurchasable
                        ? "Always on here, so it can be added to this purchase"
                        : "Offered when entering purchases"}
                    checked={lockPurchasable || isPurchasable}
                    disabled={lockPurchasable}
                    onChange={setIsPurchasable}
                />
            </Box>

            <Button
                fullWidth
                variant="contained"
                disableElevation
                onClick={handleSubmit}
                disabled={!canSubmit}
                sx={BRAND_BUTTON_SX}
                data-testid="create-product-submit"
            >
                {submitting ? "Adding…" : "Add product"}
            </Button>
        </Box>
    );
}

function SwitchRow({ label, caption, checked, disabled = false, onChange }: {
    label: string;
    caption: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
}): React.JSX.Element {
    return (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 1 }}>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "#3b352c" }}>{label}</Typography>
                <Typography variant="caption" sx={{ color: "#8a807a" }}>{caption}</Typography>
            </Box>
            <Switch
                checked={checked}
                disabled={disabled}
                onChange={(_, value) => onChange(value)}
                slotProps={{ input: { "aria-label": label } }}
                sx={BRAND_SWITCH_SX}
            />
        </Box>
    );
}
