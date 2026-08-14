import React from "react";
import { EntityPhotoField, PhotoPatch } from "../../../../shared/components/EntityPhotoField";
import { fetchPurchaseInvoiceImage } from "../../../../shared/api/management";
import { PurchaseInvoiceRow } from "../types";

type Props = {
    invoiceId: string;
    serverId: number | null;
    hasImage: boolean;
    pendingImage: Blob | null;
    removeImage: boolean;
    onUpdateInvoice: (invoiceId: string, patch: Partial<PurchaseInvoiceRow>) => void;
};

/**
 * Binds the shared photo field to one purchase invoice: the purchase image endpoints, and the
 * invoice-shaped patch callback the purchase table already speaks. All behaviour lives in
 * EntityPhotoField — accounting entries bind the same component to their own endpoints.
 */
export function InvoiceImageField({
                                      invoiceId,
                                      serverId,
                                      hasImage,
                                      pendingImage,
                                      removeImage,
                                      onUpdateInvoice,
                                  }: Props) {
    return (
        <EntityPhotoField
            rowKey={invoiceId}
            serverId={serverId}
            hasImage={hasImage}
            pendingImage={pendingImage}
            removeImage={removeImage}
            onChange={(patch: PhotoPatch) => onUpdateInvoice(invoiceId, patch)}
            fetchImage={fetchPurchaseInvoiceImage}
            testIdPrefix="invoice-image"
            label="invoice photo"
            viewerTitle="Invoice photo"
        />
    );
}
