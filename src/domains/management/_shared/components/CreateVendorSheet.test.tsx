import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateVendorSheet from "./CreateVendorSheet";
import type { CreateVendorSheetProps } from "./CreateVendorSheet";
import { createVendor } from "../../../../shared/api/management";
import { DuplicateVendorNameError } from "../../purchases/types";
import type { VendorTO } from "../../purchases/types";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/management.ts
jest.mock("../../../../shared/api/management");

const mockCreateVendor = jest.mocked(createVendor);

const VENDORS: VendorTO[] = [
    { id: 1, vendorName: "Acme" },
    // Vendors were inserted by hand, so a stored name can carry padding.
    { id: 2, vendorName: " Bahrain  Foods " },
];

const DUPLICATE_MESSAGE = "A vendor with this name already exists";

function renderSheet(overrides: Partial<CreateVendorSheetProps> = {}) {
    const onCreated = jest.fn<void, [VendorTO]>();
    const onClose = jest.fn<void, []>();
    render(
        <CreateVendorSheet
            open
            vendors={VENDORS}
            onCreated={onCreated}
            onClose={onClose}
            {...overrides}
        />
    );
    return { onCreated, onClose };
}

function nameInput(): HTMLInputElement {
    const input = screen.getByLabelText("Name");
    if (!(input instanceof HTMLInputElement)) throw new Error("Name is not an input");
    return input;
}

function typeName(name: string): void {
    fireEvent.change(nameInput(), { target: { value: name } });
}

function submitButton(): HTMLButtonElement {
    // The testid lands on the <button> itself, whose `disabled` is what the tests read.
    const button = screen.getByTestId("create-vendor-submit");
    if (!(button instanceof HTMLButtonElement)) throw new Error("submit is not a button");
    return button;
}

describe("CreateVendorSheet", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateVendor.mockResolvedValue({ id: 9, vendorName: "Fresh Farms" });
    });

    it("opens titled New vendor, with the name pre-filled and editable", () => {
        renderSheet({ initialName: "Fresh Farms" });

        expect(screen.getByText("New vendor")).toBeTruthy();
        expect(nameInput().value).toBe("Fresh Farms");

        typeName("Fresh Farms Ltd");

        expect(nameInput().value).toBe("Fresh Farms Ltd");
    });

    describe("validation", () => {
        it("keeps Create disabled until a name is typed", () => {
            renderSheet();

            expect(submitButton().disabled).toBe(true);

            typeName("Fresh Farms");

            expect(submitButton().disabled).toBe(false);
        });

        it("treats a whitespace-only name as missing", () => {
            renderSheet();

            typeName("    ");

            expect(submitButton().disabled).toBe(true);
        });

        it("flags a name longer than 255 characters", () => {
            renderSheet();

            typeName("x".repeat(256));

            expect(screen.getByText("Up to 255 characters")).toBeTruthy();
            expect(submitButton().disabled).toBe(true);
        });

        // The limit applies to the stored, cleaned name, so padding does not count against it.
        it("measures the length after cleaning the name", () => {
            renderSheet();

            typeName(`  ${"x".repeat(255)}  `);

            expect(screen.queryByText("Up to 255 characters")).toBeNull();
            expect(submitButton().disabled).toBe(false);
        });
    });

    describe("duplicate names", () => {
        it("flags an existing name at once, ignoring case and extra spaces", () => {
            renderSheet();

            typeName("  aCME ");

            expect(screen.getByText(DUPLICATE_MESSAGE)).toBeTruthy();
            expect(submitButton().disabled).toBe(true);
        });

        it("normalizes the stored side as well, so a padded vendor name still counts", () => {
            renderSheet();

            typeName("bahrain foods");

            expect(screen.getByText(DUPLICATE_MESSAGE)).toBeTruthy();
            expect(submitButton().disabled).toBe(true);
        });

        it("shows the server's 409 on the name field and does not report a creation", async () => {
            mockCreateVendor.mockRejectedValueOnce(new DuplicateVendorNameError());
            const { onCreated } = renderSheet({ initialName: "Fresh Farms" });

            fireEvent.click(submitButton());

            expect(await screen.findByText(DUPLICATE_MESSAGE)).toBeTruthy();
            expect(nameInput().getAttribute("aria-invalid")).toBe("true");
            expect(submitButton().disabled).toBe(true);
            expect(onCreated).not.toHaveBeenCalled();
            expect(screen.queryByTestId("create-vendor-error")).toBeNull();
        });

        it("clears the server's 409 once the name is changed", async () => {
            mockCreateVendor.mockRejectedValueOnce(new DuplicateVendorNameError());
            renderSheet({ initialName: "Fresh Farms" });

            fireEvent.click(submitButton());
            await screen.findByText(DUPLICATE_MESSAGE);

            typeName("Fresh Farms Ltd");

            expect(screen.queryByText(DUPLICATE_MESSAGE)).toBeNull();
            expect(submitButton().disabled).toBe(false);
        });
    });

    describe("submit", () => {
        it("sends the cleaned name, then hands back the created vendor", async () => {
            const vendor: VendorTO = { id: 9, vendorName: "Fresh Farms" };
            mockCreateVendor.mockResolvedValueOnce(vendor);
            const { onCreated } = renderSheet();

            typeName("  Fresh   Farms ");
            fireEvent.click(submitButton());

            await waitFor(() => expect(onCreated).toHaveBeenCalledWith(vendor));
            expect(mockCreateVendor).toHaveBeenCalledTimes(1);
            expect(mockCreateVendor).toHaveBeenCalledWith("Fresh Farms");
        });

        it("disables Create while the request is in flight, so a double tap cannot send it twice", async () => {
            let resolve: (vendor: VendorTO) => void = () => undefined;
            mockCreateVendor.mockReturnValueOnce(new Promise<VendorTO>(r => { resolve = r; }));
            const { onCreated } = renderSheet({ initialName: "Fresh Farms" });

            fireEvent.click(submitButton());

            await waitFor(() => expect(submitButton().disabled).toBe(true));
            expect(submitButton().textContent).toBe("Creating…");
            fireEvent.click(submitButton());
            expect(mockCreateVendor).toHaveBeenCalledTimes(1);

            resolve({ id: 9, vendorName: "Fresh Farms" });
            await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
        });

        it("shows any other server error in a banner", async () => {
            mockCreateVendor.mockRejectedValueOnce(new Error("Vendor name must be at most 255 characters"));
            const { onCreated } = renderSheet({ initialName: "Fresh Farms" });

            fireEvent.click(submitButton());

            expect((await screen.findByTestId("create-vendor-error")).textContent)
                .toContain("Vendor name must be at most 255 characters");
            expect(onCreated).not.toHaveBeenCalled();
            // A failure that is not about the name leaves the name usable for a retry.
            expect(submitButton().disabled).toBe(false);
        });
    });

    it("closes from Cancel without creating anything", () => {
        const { onClose } = renderSheet({ initialName: "Fresh Farms" });

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(mockCreateVendor).not.toHaveBeenCalled();
    });

    it("renders nothing of the form while closed", () => {
        renderSheet({ open: false });

        expect(screen.queryByTestId("create-vendor-sheet")).toBeNull();
    });
});
