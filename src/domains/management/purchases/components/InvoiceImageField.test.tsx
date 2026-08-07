import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvoiceImageField } from "./InvoiceImageField";
import { downscaleImage } from "../../../../shared/utils/imageCompress";

jest.mock("../../../../shared/api/management");
jest.mock("../../../../shared/utils/imageCompress");

const mockDownscale = jest.mocked(downscaleImage);

// jsdom implements neither of these; the suite already stubs crypto.randomUUID the same way.
const createdUrls: string[] = [];
const revokedUrls: string[] = [];
let urlCounter = 0;
const originalCreate = (globalThis.URL as any).createObjectURL;
const originalRevoke = (globalThis.URL as any).revokeObjectURL;

beforeAll(() => {
    (globalThis.URL as any).createObjectURL = (_blob: Blob): string => {
        urlCounter += 1;
        const url = `blob:test-${urlCounter}`;
        createdUrls.push(url);
        return url;
    };
    (globalThis.URL as any).revokeObjectURL = (url: string): void => {
        revokedUrls.push(url);
    };
});

afterAll(() => {
    (globalThis.URL as any).createObjectURL = originalCreate;
    (globalThis.URL as any).revokeObjectURL = originalRevoke;
});

function renderField(overrides: Record<string, any> = {}) {
    const onUpdateInvoice = jest.fn();
    const props = {
        invoiceId: "inv-a",
        serverId: null as number | null,
        hasImage: false,
        pendingImage: null as Blob | null,
        removeImage: false,
        onUpdateInvoice,
        ...overrides,
    };
    const view = render(<InvoiceImageField {...(props as any)} />);
    return { ...view, onUpdateInvoice, props };
}

function pickFile(file: File) {
    const input = screen.getByTestId("invoice-image-input-inv-a");
    fireEvent.change(input, { target: { files: [file] } });
}

describe("InvoiceImageField", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createdUrls.length = 0;
        revokedUrls.length = 0;
        mockDownscale.mockResolvedValue(new Blob(["compressed"], { type: "image/jpeg" }));
    });

    it("compresses the picked file and hands the blob back to the invoice", async () => {
        const { onUpdateInvoice } = renderField();

        pickFile(new File(["raw"], "invoice.jpg", { type: "image/jpeg" }));

        await waitFor(() => expect(mockDownscale).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(onUpdateInvoice).toHaveBeenCalledTimes(1));
        const [invoiceId, patch] = onUpdateInvoice.mock.calls[0] as [string, any];
        expect(invoiceId).toBe("inv-a");
        expect(patch.pendingImage).toBeInstanceOf(Blob);
        expect(patch.removeImage).toBe(false);
    });

    it("shows a thumbnail once the invoice holds a pending image", () => {
        renderField({ pendingImage: new Blob(["x"], { type: "image/jpeg" }) });

        expect(screen.getByTestId("invoice-image-thumb-inv-a")).toBeTruthy();
    });

    it("revokes the preview object URL on unmount", () => {
        const { unmount } = renderField({ pendingImage: new Blob(["x"], { type: "image/jpeg" }) });

        expect(createdUrls).toHaveLength(1);
        expect(revokedUrls).toHaveLength(0);

        unmount();

        // Object URLs never free themselves; an all-day tablet shift would accumulate them.
        expect(revokedUrls).toEqual(createdUrls);
    });

    it("revokes the previous preview URL when the photo is replaced", () => {
        const { rerender } = renderField({ pendingImage: new Blob(["first"], { type: "image/jpeg" }) });
        const firstUrl = createdUrls[0];

        rerender(
            <InvoiceImageField
                invoiceId="inv-a"
                serverId={null}
                hasImage={false}
                pendingImage={new Blob(["second"], { type: "image/jpeg" })}
                removeImage={false}
                onUpdateInvoice={jest.fn()}
            />
        );

        expect(revokedUrls).toContain(firstUrl);
        expect(createdUrls).toHaveLength(2);
    });

    it("offers a view action instead of a camera when the server already holds a photo", () => {
        renderField({ hasImage: true, serverId: 42 });

        expect(screen.getByLabelText("view invoice photo")).toBeTruthy();
        expect(screen.queryByLabelText("add invoice photo")).toBeNull();
    });

    it("flags removeImage when clearing a photo that exists on the server", () => {
        const { onUpdateInvoice } = renderField({ hasImage: true, serverId: 42 });

        fireEvent.click(screen.getByLabelText("remove invoice photo"));

        expect(onUpdateInvoice).toHaveBeenCalledWith("inv-a", { pendingImage: null, removeImage: true });
    });

    it("does not flag removeImage when clearing a photo that was never uploaded", () => {
        const { onUpdateInvoice } = renderField({
            hasImage: false,
            pendingImage: new Blob(["x"], { type: "image/jpeg" }),
        });

        fireEvent.click(screen.getByLabelText("remove invoice photo"));

        expect(onUpdateInvoice).toHaveBeenCalledWith("inv-a", { pendingImage: null, removeImage: false });
    });

    it("surfaces a compression failure without updating the invoice", async () => {
        mockDownscale.mockRejectedValue(new Error("Image has unusable dimensions"));
        const { onUpdateInvoice } = renderField();

        pickFile(new File(["raw"], "invoice.jpg", { type: "image/jpeg" }));

        expect(await screen.findByTestId("invoice-image-error-inv-a")).toBeTruthy();
        expect(onUpdateInvoice).not.toHaveBeenCalled();
    });
});
