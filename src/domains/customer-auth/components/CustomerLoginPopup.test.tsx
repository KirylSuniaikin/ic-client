import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

// CustomerLoginPopup renders its copy via useTranslation — initialize the real i18n
// instance (side-effect import) so keys resolve to English under the default language.
import "../../../shared/i18n";

// Manual mock at shared/api/__mocks__/customerAuth.ts, mirrors
// CustomerAuthProvider.test.tsx's pattern.
jest.mock("../../../shared/api/customerAuth");

import { requestOtp, verifyOtp, refreshCustomerToken } from "../../../shared/api/customerAuth";
import { CustomerAuthApiError } from "../types";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../context/CustomerAuthProvider";
import { CustomerLoginPopup } from "./CustomerLoginPopup";

const mockRequestOtp = jest.mocked(requestOtp);
const mockVerifyOtp = jest.mocked(verifyOtp);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);

function renderPopup(onClose: () => void = jest.fn(), prefillPhone?: string) {
    return render(
        <CustomerAuthProvider>
            <CustomerLoginPopup open={true} onClose={onClose} prefillPhone={prefillPhone} />
        </CustomerAuthProvider>
    );
}

async function waitForAuthReady(): Promise<void> {
    await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());
}

// The code step renders 4 segmented boxes (aria-labels "Digit 1".."Digit 4"),
// each driven by the same single `code` string. Typing a digit into a box
// updates code[index]; this mirrors real per-box entry.
function typeCode(value: string): void {
    value.split("").forEach((digit, i) => {
        fireEvent.change(screen.getByLabelText(`Digit ${i + 1}`), { target: { value: digit } });
    });
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

describe("CustomerLoginPopup", () => {
    describe("phone step", () => {
        it("requests a code and reveals the code input on success", async () => {
            mockRequestOtp.mockResolvedValueOnce(undefined);
            renderPopup();
            await waitForAuthReady();

            // Default country is Bahrain (code 973, 8 digits) — national digits only.
            fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "33607710" } });
            fireEvent.click(screen.getByRole("button", { name: "Get code" }));

            await waitFor(() => expect(mockRequestOtp).toHaveBeenCalledWith({ phone: "97333607710" }));
            expect(await screen.findByLabelText("Digit 1")).toBeTruthy();
        });

        it("shows an error message when the request is rejected with 400", async () => {
            mockRequestOtp.mockRejectedValueOnce(new CustomerAuthApiError("Invalid phone", 400));
            renderPopup();
            await waitForAuthReady();

            fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "33607710" } });
            fireEvent.click(screen.getByRole("button", { name: "Get code" }));

            expect(await screen.findByText("Invalid phone")).toBeTruthy();
        });

        it("shows a rate-limit message when the request is rejected with 429", async () => {
            mockRequestOtp.mockRejectedValueOnce(new CustomerAuthApiError("Too soon", 429));
            renderPopup();
            await waitForAuthReady();

            fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "33607710" } });
            fireEvent.click(screen.getByRole("button", { name: "Get code" }));

            expect(
                await screen.findByText("Too many attempts — please wait a bit before trying again.")
            ).toBeTruthy();
        });

        it("switches the required digit count when the country changes", async () => {
            mockRequestOtp.mockResolvedValueOnce(undefined);
            renderPopup();
            await waitForAuthReady();

            // Egypt requires 10 digits and code 20 — different from the default Bahrain.
            fireEvent.mouseDown(screen.getByRole("combobox"));
            fireEvent.click(within(screen.getByRole("listbox")).getByText("Egypt (20)"));

            fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "3360771099" } });
            fireEvent.click(screen.getByRole("button", { name: "Get code" }));

            await waitFor(() => expect(mockRequestOtp).toHaveBeenCalledWith({ phone: "203360771099" }));
        });

        it("keeps Get code disabled and does not call requestOtp when the digit count doesn't match the selected country", async () => {
            renderPopup();
            await waitForAuthReady();

            // Default country is Bahrain (8 digits) — 5 digits is too short.
            fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "12345" } });
            const getCodeButton = screen.getByRole("button", { name: "Get code" });
            expect(getCodeButton.hasAttribute("disabled")).toBe(true);

            fireEvent.click(getCodeButton);
            expect(mockRequestOtp).not.toHaveBeenCalled();
        });

        it("re-validates against the new country's digit count when the country changes after digits were typed", async () => {
            renderPopup();
            await waitForAuthReady();

            // 8 digits is valid for the default country (Bahrain) but not for Egypt (10 digits).
            fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "33607710" } });
            expect(screen.getByRole("button", { name: "Get code" }).hasAttribute("disabled")).toBe(false);

            fireEvent.mouseDown(screen.getByRole("combobox"));
            fireEvent.click(within(screen.getByRole("listbox")).getByText("Egypt (20)"));

            expect(screen.getByRole("button", { name: "Get code" }).hasAttribute("disabled")).toBe(true);

            fireEvent.click(screen.getByRole("button", { name: "Get code" }));
            expect(mockRequestOtp).not.toHaveBeenCalled();
        });

        it("clears a previous request error when the country is changed", async () => {
            mockRequestOtp.mockRejectedValueOnce(new CustomerAuthApiError("Invalid phone", 400));
            renderPopup();
            await waitForAuthReady();

            fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "33607710" } });
            fireEvent.click(screen.getByRole("button", { name: "Get code" }));
            expect(await screen.findByText("Invalid phone")).toBeTruthy();

            fireEvent.mouseDown(screen.getByRole("combobox"));
            fireEvent.click(within(screen.getByRole("listbox")).getByText("Egypt (20)"));

            expect(screen.queryByText("Invalid phone")).toBeNull();
        });

        it("pre-fills the phone field with the matching country and national digits when prefillPhone is given", async () => {
            renderPopup(jest.fn(), "97333607710");
            await waitForAuthReady();

            expect(screen.getByRole("combobox").textContent).toContain("+973");
            // Same element proves the "Phone number" field itself holds the prefilled digits.
            expect(screen.getByLabelText("Phone number")).toBe(screen.getByDisplayValue("33607710"));
        });

        it("falls back to the default country with a blank field when no prefillPhone is given", async () => {
            renderPopup();
            await waitForAuthReady();

            expect(screen.getByRole("combobox").textContent).toContain("+973");
            expect(screen.getByLabelText("Phone number")).toBe(screen.getByDisplayValue(""));
        });
    });

    describe("code step", () => {
        async function goToCodeStep(): Promise<void> {
            mockRequestOtp.mockResolvedValueOnce(undefined);
            fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "33607710" } });
            fireEvent.click(screen.getByRole("button", { name: "Get code" }));
            await screen.findByLabelText("Digit 1");
        }

        it("calls login and closes the popup on a successful verify", async () => {
            const onClose = jest.fn<void, []>();
            mockVerifyOtp.mockResolvedValueOnce({ accessToken: "token-123" });
            renderPopup(onClose);
            await waitForAuthReady();
            await goToCodeStep();

            typeCode("4821");
            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            await waitFor(() =>
                expect(mockVerifyOtp).toHaveBeenCalledWith({ phone: "97333607710", code: "4821", branchId: undefined })
            );
            await waitFor(() => expect(onClose).toHaveBeenCalled());
        });

        it("shows an error message when verify is rejected with 400", async () => {
            mockVerifyOtp.mockRejectedValueOnce(new CustomerAuthApiError("Invalid code", 400));
            renderPopup();
            await waitForAuthReady();
            await goToCodeStep();

            typeCode("0000");
            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            expect(await screen.findByText("Invalid code")).toBeTruthy();
        });

        it("shows a rate-limit message when verify is rejected with 429", async () => {
            mockVerifyOtp.mockRejectedValueOnce(new CustomerAuthApiError("Too many", 429));
            renderPopup();
            await waitForAuthReady();
            await goToCodeStep();

            typeCode("0000");
            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            expect(
                await screen.findByText("Too many attempts — please wait a bit before trying again.")
            ).toBeTruthy();
        });
    });
});
