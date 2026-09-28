import {useCallback, useEffect, useRef, useState} from "react";
import {fetchProducts, fetchVendors, updateProductSettings} from "../../../../shared/api/management";
import {productTOConverter} from "../../inventory/mappers/inventoryMapper";
import type {ProductTO, UpdateProductSettingsRequest} from "../../inventory/types";
import type {VendorTO} from "../../purchases/types";
import type {ProductStatRow} from "../types";
import {logger} from "../../../../shared/utils/logger";

export type ProductSettingsPatch = Partial<UpdateProductSettingsRequest>;

type UseProductCatalogOptions = {
    /** Called with exactly the fields that changed, once the server has accepted them. */
    onSettingsSaved?: (changed: ProductSettingsPatch) => void;
};

type UseProductCatalog = {
    rows: ProductStatRow[];
    vendors: VendorTO[];
    loading: boolean;
    loadError: string | null;
    /** Rows with a settings save in flight; their controls stay disabled until it answers. */
    savingIds: ReadonlySet<number>;
    saveError: string | null;
    clearSaveError: () => void;
    updateSettings: (id: number, patch: ProductSettingsPatch) => Promise<void>;
    addProduct: (product: ProductTO) => void;
};

function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback;
}

/**
 * products.top_vendor is a plain varchar matched to vendors by name, case-insensitively (the same
 * rule PurchaseTablePopup uses to prefill an invoice's vendor). Returns that vendor's own spelling,
 * or null when the name is blank or matches no vendor.
 */
export function findVendorName(topVendor: string | null, vendors: VendorTO[]): string | null {
    if (topVendor === null || topVendor.trim() === "") return null;
    const key = topVendor.trim().toLowerCase();
    return vendors.find(v => String(v.vendorName ?? "").trim().toLowerCase() === key)?.vendorName ?? null;
}

// Legacy rows may carry a differently cased spelling; sending the vendor's own spelling keeps the
// server's vendor check from refusing a save that only toggled a switch. A hand-backfilled name
// matching no vendor is sent back unchanged rather than as null, because null means "clear it" and
// the person editing a switch did not ask to lose the vendor -- the server decides.
function canonicalVendor(topVendor: string | null, vendors: VendorTO[]): string | null {
    if (topVendor === null || topVendor.trim() === "") return null;
    return findVendorName(topVendor, vendors) ?? topVendor;
}

/**
 * True when the row's stored top vendor matches none of the loaded vendors. False while the vendor
 * list is empty (still loading, or failed to load): every name would look unknown then.
 */
export function hasUnknownTopVendor(topVendor: string | null, vendors: VendorTO[]): boolean {
    if (vendors.length === 0 || topVendor === null || topVendor.trim() === "") return false;
    return findVendorName(topVendor, vendors) === null;
}

// A save carrying an unknown stored vendor can be refused for that vendor alone, while the person was
// editing a different column; say which value is at fault and how to get past it.
function unknownVendorHint(row: ProductStatRow, patch: ProductSettingsPatch, vendors: VendorTO[]): string | null {
    if (patch.topVendor !== undefined || !hasUnknownTopVendor(row.topVendor, vendors)) return null;
    return `Its top vendor “${row.topVendor?.trim()}” matches no vendor — set Top vendor to a vendor or None first.`;
}

/**
 * The product list behind the Pricing table, with its four inline-editable settings.
 *
 * Saves are optimistic: the row changes at once, is replaced by the server's copy on success, and
 * is put back as it was on failure (with saveError set so the table can say why).
 */
export function useProductCatalog({onSettingsSaved}: UseProductCatalogOptions = {}): UseProductCatalog {
    const [rows, setRows] = useState<ProductStatRow[]>([]);
    const [vendors, setVendors] = useState<VendorTO[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [savingIds, setSavingIds] = useState<ReadonlySet<number>>(new Set());
    const [saveError, setSaveError] = useState<string | null>(null);

    // Read by updateSettings to build the full four-field body from the row as it is NOW, without
    // `rows`/`vendors` in its deps -- that would rebuild every grid column on every save.
    const rowsRef = useRef<ProductStatRow[]>(rows);
    rowsRef.current = rows;
    const vendorsRef = useRef<VendorTO[]>(vendors);
    vendorsRef.current = vendors;
    const savingRef = useRef<Set<number>>(new Set());
    // Same reason: a caller's inline callback must not change updateSettings' identity.
    const onSettingsSavedRef = useRef<UseProductCatalogOptions["onSettingsSaved"]>(onSettingsSaved);
    onSettingsSavedRef.current = onSettingsSaved;

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        fetchProducts()
            .then(products => {
                if (!cancelled) setRows(productTOConverter(products));
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                logger.error("Failed to load products:", err);
                setLoadError(errorMessage(err, "Failed to load products"));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        // Vendors only feed the Top vendor pickers, so a failure here must not take the price
        // table down with it.
        fetchVendors()
            .then(list => {
                if (!cancelled) setVendors(list);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                logger.error("Failed to load vendors:", err);
                setLoadError(prev => prev ?? "Failed to load vendors — the Top vendor list is empty");
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const markSaving = useCallback((id: number, saving: boolean): void => {
        if (saving) savingRef.current.add(id); else savingRef.current.delete(id);
        setSavingIds(new Set(savingRef.current));
    }, []);

    const updateSettings = useCallback(async (id: number, patch: ProductSettingsPatch): Promise<void> => {
        const current = rowsRef.current.find(r => r.id === id);
        // One save per row at a time: every body carries the row's WHOLE state, so a second save
        // sent before the first answers could be reverted to a state the server never held.
        if (!current || savingRef.current.has(id)) return;

        const next: ProductStatRow = {...current, ...patch};
        const request: UpdateProductSettingsRequest = {
            isInventory: next.isInventory,
            isPurchasable: next.isPurchasable,
            unit: next.unit,
            topVendor: canonicalVendor(next.topVendor, vendorsRef.current),
        };

        markSaving(id, true);
        setRows(prev => prev.map(r => r.id === id ? next : r));
        try {
            const saved = await updateProductSettings(id, request);
            const [savedRow] = productTOConverter([saved]);
            setRows(prev => prev.map(r => r.id === id ? savedRow : r));
        } catch (err) {
            logger.error("Failed to update product settings:", err);
            setRows(prev => prev.map(r => r.id === id ? current : r));
            const hint = unknownVendorHint(current, patch, vendorsRef.current);
            const reason = errorMessage(err, "unknown error");
            setSaveError(`Couldn't save “${current.name}”: ${hint ? `${reason}. ${hint}` : reason}`);
            return;
        } finally {
            markSaving(id, false);
        }
        // Outside the try: the save has succeeded, and nothing the caller does next may revert it.
        onSettingsSavedRef.current?.(patch);
    }, [markSaving]);

    // New products go on top: the grid pages at 25, and at the end of the list a product someone
    // just added would be on a page nobody is looking at.
    const addProduct = useCallback((product: ProductTO): void => {
        setRows(prev => [...productTOConverter([product]), ...prev]);
    }, []);

    const clearSaveError = useCallback((): void => setSaveError(null), []);

    return {rows, vendors, loading, loadError, savingIds, saveError, clearSaveError, updateSettings, addProduct};
}
