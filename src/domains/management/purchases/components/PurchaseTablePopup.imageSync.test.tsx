import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PurchaseTablePopup } from "./PurchaseTablePopup";
import {
    deletePurchaseInvoiceImage,
    editPurchaseReport,
    fetchProducts,
    fetchVendors,
    getPurchaseReport,
    getUser,
    uploadPurchaseInvoiceImage,
} from "../../../../shared/api/management";
import { downscaleImage } from "../../../../shared/utils/imageCompress";
import type { IBranch, ProductTO } from "../../inventory/types";
import type { PurchaseTO } from "../types";

jest.mock("../../../../shared/api/management");
jest.mock("../../../../shared/utils/imageCompress");

const originalCreate = (globalThis.URL as any).createObjectURL;
const originalRevoke = (globalThis.URL as any).revokeObjectURL;
beforeAll(() => {
    (globalThis.URL as any).createObjectURL = () => "blob:test";
    (globalThis.URL as any).revokeObjectURL = () => {};
});
afterAll(() => {
    (globalThis.URL as any).createObjectURL = originalCreate;
    (globalThis.URL as any).revokeObjectURL = originalRevoke;
});

const branch: IBranch = {
    id: "branch-uuid",
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Main",
    locale: "en",
};

const flour: ProductTO = {
    id: 1, name: "Flour", targetPrice: 7, price: 7,
    isInventory: true, isPurchasable: true, isBundle: false, topVendor: "Acme",
};

const report: PurchaseTO = {
    id: 7,
    title: "jul-25-bh-admin",
    finalPrice: 10,
    userId: 1,
    purchaseDate: "2026-07-14",
    invoices: [{
        id: 11,
        invoiceDate: "2026-07-10",
        vendorName: "Acme",
        paid: false,
        finalPrice: 10,
        hasImage: false,
        products: [{ product: flour, quantity: 1, finalPrice: 10, price: 10 }],
    }],
};

const savedResponse = {
    report: { id: 7, title: "jul-25-bh-admin", finalPrice: 10, createdAt: "", unpaidCount: 1, unpaidAmount: 10 },
    invoices: [{ clientRef: "inv-0", invoiceId: 11 }],
};

function renderPopup(onSaved = jest.fn(), onClose = jest.fn()) {
    render(
        <PurchaseTablePopup
            open={true}
            mode="edit"
            purchaseId={7}
            userId={1}
            branch={branch}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
    return { onSaved, onClose };
}

async function attachPhoto() {
    const input = await screen.findByTestId("invoice-image-input-inv-0");
    fireEvent.change(input, { target: { files: [new File(["raw"], "inv.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(screen.getByTestId("invoice-image-thumb-inv-0")).toBeTruthy());
}

describe("PurchaseTablePopup invoice photo sync", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(fetchProducts).mockResolvedValue([flour]);
        jest.mocked(fetchVendors).mockResolvedValue([{ id: 1, vendorName: "Acme" }]);
        jest.mocked(getUser).mockResolvedValue({ id: 1, userName: "admin" });
        jest.mocked(getPurchaseReport).mockResolvedValue(report);
        jest.mocked(editPurchaseReport).mockResolvedValue(savedResponse);
        jest.mocked(downscaleImage).mockResolvedValue(new Blob(["small"], { type: "image/jpeg" }));
        jest.mocked(uploadPurchaseInvoiceImage).mockResolvedValue({
            invoiceId: 11, contentType: "image/jpeg", sizeBytes: 5,
        });
        jest.mocked(deletePurchaseInvoiceImage).mockResolvedValue(undefined);
    });

    it("uploads a pending photo only after the report saves, using the server id from the response", async () => {
        renderPopup();
        await attachPhoto();

        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(editPurchaseReport).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(uploadPurchaseInvoiceImage).toHaveBeenCalledTimes(1));

        // 11 comes from SavePurchaseResponse.invoices[clientRef "inv-0"], not from the client.
        const [invoiceId, blob] = jest.mocked(uploadPurchaseInvoiceImage).mock.calls[0];
        expect(invoiceId).toBe(11);
        expect(blob).toBeInstanceOf(Blob);

        // Ordering matters: the report must be persisted before a photo can reference its invoice.
        const saveOrder = jest.mocked(editPurchaseReport).mock.invocationCallOrder[0];
        const uploadOrder = jest.mocked(uploadPurchaseInvoiceImage).mock.invocationCallOrder[0];
        expect(saveOrder).toBeLessThan(uploadOrder);
    });

    it("still reports the report as saved when the photo upload fails", async () => {
        // Rejects both the first attempt and the single retry.
        jest.mocked(uploadPurchaseInvoiceImage).mockRejectedValue(new Error("Response: 500"));

        const { onSaved, onClose } = renderPopup();
        await attachPhoto();

        fireEvent.click(screen.getByText("Save"));

        // The report data is already safe — a failed photo must never present itself as a
        // failed save.
        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));

        // ...but the dialog stays open with a warning, so the failure is not silent either.
        expect(await screen.findByText(/could not be uploaded/i)).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("retries a failed upload once before giving up", async () => {
        jest.mocked(uploadPurchaseInvoiceImage)
            .mockRejectedValueOnce(new Error("Response: 502"))
            .mockResolvedValueOnce({ invoiceId: 11, contentType: "image/jpeg", sizeBytes: 5 });

        const { onClose } = renderPopup();
        await attachPhoto();

        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(uploadPurchaseInvoiceImage).toHaveBeenCalledTimes(2));
        // The retry succeeded, so this counts as a clean save and the dialog closes.
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("deletes a stored photo when it was cleared, and uploads nothing", async () => {
        jest.mocked(getPurchaseReport).mockResolvedValue({
            ...report,
            invoices: [{ ...report.invoices[0], hasImage: true }],
        });

        renderPopup();
        await screen.findByLabelText("view invoice photo");

        fireEvent.click(screen.getByLabelText("remove invoice photo"));
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(deletePurchaseInvoiceImage).toHaveBeenCalledWith(11));
        expect(uploadPurchaseInvoiceImage).not.toHaveBeenCalled();
    });

    it("makes no photo requests at all when nothing was attached or cleared", async () => {
        renderPopup();
        await screen.findByTestId("invoice-group-inv-0");

        // Toggling paid is enough to dirty the form without touching any line.
        fireEvent.click(screen.getByLabelText("invoice paid"));
        fireEvent.click(screen.getByText("Save"));

        await waitFor(() => expect(editPurchaseReport).toHaveBeenCalledTimes(1));
        expect(uploadPurchaseInvoiceImage).not.toHaveBeenCalled();
        expect(deletePurchaseInvoiceImage).not.toHaveBeenCalled();
    });
});
