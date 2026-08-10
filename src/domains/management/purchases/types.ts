import type { ProductTO } from '../inventory/types';

export type BasePurchaseResponse = {
    id: number;
    title: string;
    finalPrice: number;
    createdAt: string;
    unpaidCount: number;
    unpaidAmount: number;
}

export type VendorTO = {
    id: number;
    vendorName: string;
}

// ── Wire types (backend read contract) ──────────────────────────────────────

export type PurchaseLineTO = {
    product: ProductTO;
    quantity: number;
    finalPrice: number;
    price: number;
}

export type PurchaseInvoiceTO = {
    // Null for the synthetic "unassigned" invoice the backend emits when a report still has lines
    // with no invoice_id (i.e. the one-shot backfill has not run against that database). Such an
    // invoice cannot be edited or hold a photo — it exists so the lines are never silently dropped.
    id: number | null;
    invoiceDate: string | null;
    vendorName: string | null;
    paid: boolean;
    finalPrice: number;
    hasImage: boolean;
    products: PurchaseLineTO[];
}

export type PurchaseTO = {
    id: number;
    title: string;
    finalPrice: number;
    userId: number;
    purchaseDate: string;
    invoices: PurchaseInvoiceTO[];
}

// ── Wire types (backend write contract) ─────────────────────────────────────

export type PurchaseLineRequest = {
    id: number; // PRODUCT id, as today
    quantity: number;
    price: number;
    finalPrice: number;
}

export type PurchaseInvoiceRequest = {
    id: number | null; // server invoice id; null = new invoice
    clientRef: string; // == PurchaseInvoiceRow.id; echoed back as InvoiceRefTO.clientRef
    invoiceDate: string;
    vendorName: string | null;
    paid: boolean;
    products: PurchaseLineRequest[];
}

export type CreatePurchasePayload = {
    title: string;
    finalPrice: number;
    userId: number;
    purchaseDate: string;
    branchNo: number;
    invoices: PurchaseInvoiceRequest[];
}

export type EditPurchasePayload = CreatePurchasePayload & { id: number };

// ── Save response ────────────────────────────────────────────────────────────

export type InvoiceRefTO = {
    clientRef: string;
    invoiceId: number;
}

export type SavePurchaseResponse = {
    report: BasePurchaseResponse;
    invoices: InvoiceRefTO[];
}

// ── Unpaid / image types — verified field-by-field against the Phase 2 backend records in
// backend/src/main/java/com/icpizza/backend/admin/dto/purchase/.

export type UnpaidInvoiceTO = {
    invoiceId: number;
    reportId: number;
    reportTitle: string;
    invoiceDate: string;
    vendorName: string | null;
    finalPrice: number;
    hasImage: boolean;
}

// `count` is sent alongside the list so the badge does not have to trust invoices.length.
export type UnpaidInvoicesResponse = {
    invoices: UnpaidInvoiceTO[];
    count: number;
    totalOwed: number;
}

// Metadata only — the bytes are served exclusively by GET /purchase_invoice_image. The backend
// does not return createdAt here.
export type InvoiceImageMetaTO = {
    invoiceId: number;
    contentType: string;
    sizeBytes: number;
}

export type SetPurchaseInvoicePaidPayload = {
    invoiceId: number;
    paid: boolean;
}

// ── UI state model ───────────────────────────────────────────────────────────

/** Columns whose header can be tapped to reorder the table. */
export type PurchaseSortKey = "invoiceDate" | "vendorName";

export type SortDir = "asc" | "desc";

export type PurchaseSort = {
    key: PurchaseSortKey;
    dir: SortDir;
};

export type PurchaseLineRow = {
    id: string;
    productId: number | null;
    quantity: number | null;
    finalPrice: number | null;
    price: number | null; // derived (unit price), read-only in the UI
};

export type PurchaseInvoiceRow = {
    id: string; // client uuid — sent as clientRef
    serverId: number | null; // null until first save
    invoiceDate: string;
    vendorName: string | null;
    paid: boolean;
    hasImage: boolean; // server has a stored photo
    pendingImage: Blob | null; // compressed, not uploaded yet — uploaded after the report saves
    // No preview objectURL is stored here on purpose: InvoiceImageField derives it from
    // pendingImage inside an effect, so it is revoked on unmount and on replace. An object URL
    // held in shared state outlives the component that created it and leaks.
    removeImage: boolean;
    lines: PurchaseLineRow[];
};
