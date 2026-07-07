import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// GuestAccountPromptPopup and the centralized CustomerLoginPopup render their copy via
// useTranslation, so initialize the real i18n instance the same way app/providers.tsx does.
import "../../../shared/i18n";

jest.mock("../../../shared/api/customerAuth");

import { requestOtp, verifyOtp, refreshCustomerToken } from "../../../shared/api/customerAuth";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../../customer-auth/context/CustomerAuthProvider";
import { CustomerAuthUiProvider } from "../../customer-auth/context/CustomerAuthUiProvider";
import { CustomerAuthModals } from "../../customer-auth/components/CustomerAuthModals";
import { GuestAccountPromptPopup } from "./GuestAccountPromptPopup";

const mockRequestOtp = jest.mocked(requestOtp);
const mockVerifyOtp = jest.mocked(verifyOtp);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);

// The CTA calls openLogin(phone) from useCustomerAuthUi(); rendering CustomerAuthModals
// alongside it makes that call observable via the single centralized login popup.
function renderPrompt(phone: string = "97333607710", onDismiss: () => void = jest.fn<void, []>()) {
    return render(
        <CustomerAuthProvider>
            <CustomerAuthUiProvider>
                <GuestAccountPromptPopup open={true} phone={phone} onDismiss={onDismiss} />
                <CustomerAuthModals />
            </CustomerAuthUiProvider>
        </CustomerAuthProvider>
    );
}

async function waitForAuthReady(): Promise<void> {
    await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());
}

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockRequestOtp.mockReset();
    mockVerifyOtp.mockReset();
    mockRefreshCustomerToken.mockReset();
    mockRefreshCustomerToken.mockRejectedValue(new Error("no session"));
    __resetCustomerAuthStoreForTests();
});

describe("GuestAccountPromptPopup", () => {
    it("renders the benefits list and the CTA", async () => {
        renderPrompt();
        await waitForAuthReady();

        expect(screen.getByText("No need to refill your personal details")).toBeTruthy();
        expect(screen.getByText("Order in 3 clicks")).toBeTruthy();
        expect(screen.getByText("Convenient order tracking in the app")).toBeTruthy();
        expect(screen.getByText("Full order history")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Get a code on WhatsApp" })).toBeTruthy();
    });

    it("renders a Drawer (not a Modal) as its root container", async () => {
        renderPrompt();
        await waitForAuthReady();

        expect(document.querySelector(".MuiDrawer-root")).toBeTruthy();
    });

    it("calls onDismiss when Continue as guest is clicked (proceeds to guest checkout unchanged)", async () => {
        const onDismiss = jest.fn<void, []>();
        renderPrompt("97333607710", onDismiss);
        await waitForAuthReady();

        fireEvent.click(screen.getByRole("button", { name: "Continue as guest" }));

        expect(onDismiss).toHaveBeenCalled();
    });

    it("calls onDismiss when the close icon is clicked", async () => {
        const onDismiss = jest.fn<void, []>();
        renderPrompt("97333607710", onDismiss);
        await waitForAuthReady();

        fireEvent.click(screen.getByLabelText("dismiss"));

        expect(onDismiss).toHaveBeenCalled();
    });

    it("CTA click opens the centralized login popup pre-filled with the given phone's national digits", async () => {
        renderPrompt("97333607710");
        await waitForAuthReady();

        expect(screen.queryByLabelText("Phone number")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Get a code on WhatsApp" }));

        const phoneInput = await screen.findByLabelText("Phone number");
        // getByLabelText returns a generic HTMLElement; the login popup's phone field is
        // always an <input>, so this narrows it to read .value.
        expect((phoneInput as HTMLInputElement).value).toBe("33607710");
    });

    it("completing the OTP flow calls onDismiss", async () => {
        const onDismiss = jest.fn<void, []>();
        mockRequestOtp.mockResolvedValueOnce(undefined);
        mockVerifyOtp.mockResolvedValueOnce({ accessToken: "token-123" });
        renderPrompt("97333607710", onDismiss);
        await waitForAuthReady();

        fireEvent.click(screen.getByRole("button", { name: "Get a code on WhatsApp" }));
        await screen.findByLabelText("Phone number");

        fireEvent.click(screen.getByRole("button", { name: "Get code" }));
        await screen.findByLabelText("Digit 1");

        "4821".split("").forEach((digit, i) => {
            fireEvent.change(screen.getByLabelText("Digit " + (i + 1)), { target: { value: digit } });
        });
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => expect(onDismiss).toHaveBeenCalled());
        await waitFor(() => expect(screen.queryByLabelText("Phone number")).toBeNull());
    });
});
