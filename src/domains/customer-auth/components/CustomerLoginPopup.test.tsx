import { jest, describe, it, expect, beforeEach, beforeAll, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";

// CustomerLoginPopup renders its copy via useTranslation — initialize the real i18n
// instance (side-effect import) so keys resolve to English under the default language.
import "../../../shared/i18n";

// Manual mock at shared/api/__mocks__/customerAuth.ts, mirrors
// CustomerAuthProvider.test.tsx's pattern.
jest.mock("../../../shared/api/customerAuth");

import { requestOtp, verifyOtp, refreshCustomerToken, registerCustomerName } from "../../../shared/api/customerAuth";
import { CustomerAuthApiError } from "../types";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../context/CustomerAuthProvider";
import { CustomerLoginPopup } from "./CustomerLoginPopup";

const mockRequestOtp = jest.mocked(requestOtp);
const mockVerifyOtp = jest.mocked(verifyOtp);
const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockRegisterCustomerName = jest.mocked(registerCustomerName);

function renderPopup(onClose: () => void = jest.fn(), prefillPhone?: string, prefillName?: string, checkoutMode?: boolean) {
    return render(
        <CustomerAuthProvider>
            <CustomerLoginPopup open={true} onClose={onClose} prefillPhone={prefillPhone} prefillName={prefillName} checkoutMode={checkoutMode} />
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
    mockRegisterCustomerName.mockReset();
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
            mockVerifyOtp.mockResolvedValueOnce({ accessToken: "token-123", isNewAccount: false });
            renderPopup(onClose);
            await waitForAuthReady();
            await goToCodeStep();

            typeCode("4821");
            fireEvent.click(screen.getByRole("button", { name: "Submit" }));

            await waitFor(() =>
                expect(mockVerifyOtp).toHaveBeenCalledWith({ phone: "97333607710", code: "4821", branchId: undefined, name: undefined })
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

        // task-spec.md §5.5a/§9.5a — mandatory name capture for cold, brand-new registrations.
        describe("mandatory name prompt (task-spec.md §5.5a)", () => {
            it("shows the mandatory name field for a brand-new, cold (no prefill) customer and saves it on Continue", async () => {
                mockVerifyOtp.mockResolvedValueOnce({ accessToken: "new-token", isNewAccount: true });
                mockRegisterCustomerName.mockResolvedValueOnce(undefined);
                const onClose = jest.fn<void, []>();
                renderPopup(onClose);
                await waitForAuthReady();
                await goToCodeStep();

                typeCode("4821");
                fireEvent.click(screen.getByRole("button", { name: "Submit" }));

                const nameInput = await screen.findByLabelText("Full name");
                expect(onClose).not.toHaveBeenCalled();

                fireEvent.change(nameInput, { target: { value: "Ahmed" } });
                fireEvent.click(screen.getByRole("button", { name: "Continue" }));

                await waitFor(() => expect(mockRegisterCustomerName).toHaveBeenCalledWith("new-token", "Ahmed"));
                await waitFor(() => expect(onClose).toHaveBeenCalled());
            });

            it("shows an inline error and does not call registerCustomerName when Continue is tapped with a blank name", async () => {
                mockVerifyOtp.mockResolvedValueOnce({ accessToken: "new-token", isNewAccount: true });
                renderPopup();
                await waitForAuthReady();
                await goToCodeStep();

                typeCode("4821");
                fireEvent.click(screen.getByRole("button", { name: "Submit" }));
                await screen.findByLabelText("Full name");

                fireEvent.click(screen.getByRole("button", { name: "Continue" }));

                expect(await screen.findByText("Please enter your name.")).toBeTruthy();
                expect(mockRegisterCustomerName).not.toHaveBeenCalled();
            });

            it("never shows the name prompt for a returning customer (isNewAccount false)", async () => {
                mockVerifyOtp.mockResolvedValueOnce({ accessToken: "returning-token", isNewAccount: false });
                const onClose = jest.fn<void, []>();
                renderPopup(onClose);
                await waitForAuthReady();
                await goToCodeStep();

                typeCode("4821");
                fireEvent.click(screen.getByRole("button", { name: "Submit" }));

                await waitFor(() => expect(onClose).toHaveBeenCalled());
                expect(screen.queryByLabelText("Full name")).toBeNull();
            });

            it("sends the prefilled name on the first verify call and never shows the prompt", async () => {
                mockVerifyOtp.mockResolvedValueOnce({ accessToken: "new-token", isNewAccount: true });
                const onClose = jest.fn<void, []>();
                renderPopup(onClose, undefined, "Ahmed");
                await waitForAuthReady();
                await goToCodeStep();

                typeCode("4821");
                fireEvent.click(screen.getByRole("button", { name: "Submit" }));

                await waitFor(() =>
                    expect(mockVerifyOtp).toHaveBeenCalledWith({
                        phone: "97333607710",
                        code: "4821",
                        branchId: undefined,
                        name: "Ahmed",
                    })
                );
                await waitFor(() => expect(onClose).toHaveBeenCalled());
                expect(screen.queryByLabelText("Full name")).toBeNull();
            });
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

        // task-spec.md §4.4/§6.4/§7.4/§9.4/§11.4 — resend affordance + 45s countdown.
        // Aligned to a whole-second boundary (like usePreciseCountdown.test.ts) so the
        // 1s-stepped countdown ticks land on exact values instead of drifting by up to 999ms.
        describe("resend code", () => {
            beforeEach(() => {
                jest.useFakeTimers();
                jest.setSystemTime(0);
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            it("does not render a resend control while on the phone step", async () => {
                renderPopup();
                await waitForAuthReady();

                expect(screen.queryByText("Resend code")).toBeNull();
                expect(screen.queryByText(/Resend in/)).toBeNull();
            });

            it("renders the resend control disabled with a 0:45 countdown immediately after reaching the code step", async () => {
                renderPopup();
                await waitForAuthReady();
                await goToCodeStep();

                const resendButton = screen.getByRole("button", { name: "Resend in 0:45" });
                expect(resendButton.hasAttribute("disabled")).toBe(true);
            });

            it("enables the resend control with the plain label once 45 seconds have elapsed", async () => {
                renderPopup();
                await waitForAuthReady();
                await goToCodeStep();

                act(() => {
                    jest.advanceTimersByTime(45_000);
                });

                const resendButton = screen.getByRole("button", { name: "Resend code" });
                expect(resendButton.hasAttribute("disabled")).toBe(false);
            });

            it("tapping resend once enabled calls requestOtp again with the same phone, clears the digits, and restarts the 45s countdown", async () => {
                renderPopup();
                await waitForAuthReady();
                await goToCodeStep();
                typeCode("4821");
                // Queued after the initial send resolves, so this resolution is served to
                // the resend call specifically.
                mockRequestOtp.mockResolvedValueOnce(undefined);

                act(() => {
                    jest.advanceTimersByTime(45_000);
                });
                fireEvent.click(screen.getByRole("button", { name: "Resend code" }));

                await waitFor(() => expect(mockRequestOtp).toHaveBeenCalledTimes(2));
                expect(mockRequestOtp).toHaveBeenLastCalledWith({ phone: "97333607710" });

                // getByLabelText returns a generic HTMLElement; each OTP box is always an
                // <input>, so this narrows it to read .value. Wrapped in waitFor: the
                // resend's state updates land in a microtask outside any `act()` the
                // fake-timer test environment flushes synchronously, so a plain
                // synchronous read can observe stale values.
                await waitFor(() => {
                    for (let i = 1; i <= 4; i++) {
                        expect((screen.getByLabelText(`Digit ${i}`) as HTMLInputElement).value).toBe("");
                    }
                });

                const resendButton = screen.getByRole("button", { name: "Resend in 0:45" });
                expect(resendButton.hasAttribute("disabled")).toBe(true);
            });

            it("shows the rate-limit message when a resend is rejected with 429", async () => {
                renderPopup();
                await waitForAuthReady();
                await goToCodeStep();
                // Queued after the initial send resolves, so this rejection is served to
                // the resend call specifically (goToCodeStep already consumed the
                // once-resolved value queued for the initial "Get code" tap).
                mockRequestOtp.mockRejectedValueOnce(new CustomerAuthApiError("Too soon", 429));

                act(() => {
                    jest.advanceTimersByTime(45_000);
                });
                fireEvent.click(screen.getByRole("button", { name: "Resend code" }));

                expect(
                    await screen.findByText("Too many attempts — please wait a bit before trying again.")
                ).toBeTruthy();
            });

            it("keeps the digits and does not restart the countdown when a resend fails with a non-429 error", async () => {
                renderPopup();
                await waitForAuthReady();
                await goToCodeStep();
                typeCode("48");
                // Queued after the initial send resolves, so this rejection is served to
                // the resend call specifically (goToCodeStep already consumed the
                // once-resolved value queued for the initial "Get code" tap).
                mockRequestOtp.mockRejectedValueOnce(new Error("network failure"));

                act(() => {
                    jest.advanceTimersByTime(45_000);
                });
                fireEvent.click(screen.getByRole("button", { name: "Resend code" }));

                expect(await screen.findByText("Could not send the code. Please try again.")).toBeTruthy();
                // getByLabelText returns a generic HTMLElement; each OTP box is always an
                // <input>, so this narrows it to read .value.
                expect((screen.getByLabelText("Digit 1") as HTMLInputElement).value).toBe("4");
                expect((screen.getByLabelText("Digit 2") as HTMLInputElement).value).toBe("8");
                // A failed resend must not restart the 45s window — the control stays enabled.
                const resendButton = screen.getByRole("button", { name: "Resend code" });
                expect(resendButton.hasAttribute("disabled")).toBe(false);
            });
        });
    });

    // task-spec.md §5.4/§9.4 — new keys must exist, key-parallel, in both locales.
    describe("resend i18n keys (task-spec.md §5.4/§9.4)", () => {
        it("defines login.resend and login.resendIn in the English locale", () => {
            const enCustomerAuth: { login: Record<string, string> } = require("../../../shared/i18n/locales/en/customerAuth.json");
            expect(typeof enCustomerAuth.login.resend).toBe("string");
            expect(typeof enCustomerAuth.login.resendIn).toBe("string");
            expect(enCustomerAuth.login.resendIn).toContain("{{time}}");
        });

        it("defines login.resend and login.resendIn in the Arabic locale, key-parallel with English", () => {
            const arCustomerAuth: { login: Record<string, string> } = require("../../../shared/i18n/locales/ar/customerAuth.json");
            expect(typeof arCustomerAuth.login.resend).toBe("string");
            expect(typeof arCustomerAuth.login.resendIn).toBe("string");
            expect(arCustomerAuth.login.resendIn).toContain("{{time}}");
        });
    });

    // checkoutMode auto-sends the code and skips the phone step entirely, since
    // ClientInfoPopup already collected and validated the phone.
    describe("checkoutMode", () => {
        it("auto-calls requestOtp on open and renders the code step directly, with no phone field", async () => {
            mockRequestOtp.mockResolvedValueOnce(undefined);
            renderPopup(jest.fn(), "97333607710", undefined, true);
            await waitForAuthReady();

            await waitFor(() => expect(mockRequestOtp).toHaveBeenCalledWith({ phone: "97333607710" }));
            expect(await screen.findByLabelText("Digit 1")).toBeTruthy();
            expect(screen.queryByLabelText("Phone number")).toBeNull();
        });

        it("falls back to the phone step with the error when the auto-sent request is rejected", async () => {
            mockRequestOtp.mockRejectedValueOnce(new CustomerAuthApiError("Could not send", 400));
            renderPopup(jest.fn(), "97333607710", undefined, true);
            await waitForAuthReady();

            expect(await screen.findByText("Could not send")).toBeTruthy();
            expect(screen.getByLabelText("Phone number")).toBe(screen.getByDisplayValue("33607710"));
        });

        it("never auto-sends when the prefill does not match a known country's digit count", async () => {
            renderPopup(jest.fn(), "123", undefined, true);
            await waitForAuthReady();

            expect(mockRequestOtp).not.toHaveBeenCalled();
            expect(screen.getByLabelText("Phone number")).toBeTruthy();
        });

        it("does not auto-send when checkoutMode is false, even with a matching prefillPhone", async () => {
            renderPopup(jest.fn(), "97333607710", undefined, false);
            await waitForAuthReady();

            expect(mockRequestOtp).not.toHaveBeenCalled();
            expect(screen.getByLabelText("Phone number")).toBe(screen.getByDisplayValue("33607710"));
        });

        it("shows the checkout-specific title and submit copy on the code step", async () => {
            mockRequestOtp.mockResolvedValueOnce(undefined);
            renderPopup(jest.fn(), "97333607710", undefined, true);
            await waitForAuthReady();
            await screen.findByLabelText("Digit 1");

            expect(screen.getByText("Let's confirm your number")).toBeTruthy();
            expect(screen.getByRole("button", { name: "Confirm & continue" })).toBeTruthy();
        });
    });
});
