import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { clearMatchMedia, stubMatchMedia } from "../../../../shared/hooks/stubMatchMedia.testutil";
import { DesktopLayoutAllowedContext } from "../../../../shared/hooks/useDesktopLayout";
import AdminOrderDetailsPopUp from "./AdminOrderDetailsPopUp";

type OnSave = (phone: string | null, customerName: string, deliveryMethod: string, paymentMethod: string, note: string) => void;

function renderPopUp({ allowDesktop = true }: { allowDesktop?: boolean } = {}) {
    const onSave = jest.fn<void, Parameters<OnSave>>();
    const onClose = jest.fn<void, []>();
    render(
        <DesktopLayoutAllowedContext.Provider value={allowDesktop}>
            <AdminOrderDetailsPopUp
                isAdminOrderDetailsPopUpOpen
                onClose={onClose}
                onSave={onSave}
                cartItems={[]}
                setCartItems={jest.fn()}
            />
        </DesktopLayoutAllowedContext.Provider>
    );
    return { onSave, onClose };
}

afterEach(() => {
    clearMatchMedia();
    localStorage.clear();
});

describe("AdminOrderDetailsPopUp — tablet and PC", () => {
    it("opens as a centred dialog with a title and a close button", () => {
        stubMatchMedia(true);
        const { onClose } = renderPopUp();

        const dialog = screen.getByRole("dialog", { name: "User Data" });
        expect(dialog.className).not.toContain("MuiDrawer-paper");
        expect(within(dialog).getByRole("button", { name: "Checkout" })).toBeTruthy();
        fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("saves the same values as the phone sheet", () => {
        stubMatchMedia(true);
        const { onSave, onClose } = renderPopUp();

        fireEvent.change(screen.getByLabelText("Phone number (optional)"), { target: { value: "33334444" } });
        fireEvent.change(screen.getByLabelText("Customer Name (optional)"), { target: { value: "Ali" } });
        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

        expect(onSave).toHaveBeenCalledWith("97333334444", "Ali", "Take Out", "Card (Through card machine)", "");
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("still refuses a phone of the wrong length", () => {
        stubMatchMedia(true);
        const { onSave } = renderPopUp();

        fireEvent.change(screen.getByLabelText("Phone number (optional)"), { target: { value: "3333" } });
        fireEvent.click(screen.getByRole("button", { name: "Checkout" }));

        expect(screen.getByText("Phone number must be exactly 8 digits")).toBeTruthy();
        expect(onSave).not.toHaveBeenCalled();
    });
});

describe("AdminOrderDetailsPopUp — phone and kiosk", () => {
    it("keeps the bottom sheet on a phone", () => {
        renderPopUp();

        expect(screen.getByRole("dialog").className).toContain("MuiDrawer-paperAnchorBottom");
        expect(screen.getByText("User Data")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
    });

    it("keeps the bottom sheet where the PC layout is not allowed, even on a wide screen", () => {
        stubMatchMedia(true);
        renderPopUp({ allowDesktop: false });

        expect(screen.getByRole("dialog").className).toContain("MuiDrawer-paperAnchorBottom");
        expect(screen.getByRole("button", { name: "Checkout" })).toBeTruthy();
    });
});
