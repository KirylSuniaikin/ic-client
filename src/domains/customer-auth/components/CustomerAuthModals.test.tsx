import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";

// CustomerAuthModals renders CustomerLoginPopup/CustomerProfilePopup, which use
// useTranslation - initialize the real i18n instance (side-effect import) so
// keys resolve to English under the default language.
import "../../../shared/i18n";

jest.mock("../../../shared/api/customerAuth");

import { fetchReviewPrompt, refreshCustomerToken } from "../../../shared/api/customerAuth";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../context/CustomerAuthProvider";
import { CustomerAuthUiProvider, useCustomerAuthUi } from "../context/CustomerAuthUiProvider";
import { CustomerAuthModals } from "./CustomerAuthModals";

const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockFetchReviewPrompt = jest.mocked(fetchReviewPrompt);

function renderModals() {
    return render(
        <CustomerAuthProvider>
            <CustomerAuthUiProvider>
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
    mockRefreshCustomerToken.mockReset();
    mockRefreshCustomerToken.mockRejectedValue(new Error("no session"));
    __resetCustomerAuthStoreForTests();
});

describe("CustomerAuthModals", () => {
    it("renders both popups closed by default", async () => {
        renderModals();
        await waitForAuthReady();

        expect(screen.queryByLabelText("Phone number")).toBeNull();
        expect(screen.queryByText("My Account")).toBeNull();
    });

    it("shows the login popup phone field once the shared context opens it", async () => {
        let uiContext: ReturnType<typeof useCustomerAuthUi> | undefined;
        function Capture(): null {
            uiContext = useCustomerAuthUi();
            return null;
        }

        render(
            <CustomerAuthProvider>
                <CustomerAuthUiProvider>
                    <Capture />
                    <CustomerAuthModals />
                </CustomerAuthUiProvider>
            </CustomerAuthProvider>
        );
        await waitForAuthReady();

        act(() => {
            uiContext?.openLogin();
        });

        expect(await screen.findByLabelText("Phone number")).toBeTruthy();
    });

    it("only ever renders a single phone-input field at a time (singleton proof)", async () => {
        let uiContext: ReturnType<typeof useCustomerAuthUi> | undefined;
        function Capture(): null {
            uiContext = useCustomerAuthUi();
            return null;
        }

        render(
            <CustomerAuthProvider>
                <CustomerAuthUiProvider>
                    <Capture />
                    <CustomerAuthModals />
                </CustomerAuthUiProvider>
            </CustomerAuthProvider>
        );
        await waitForAuthReady();

        act(() => {
            uiContext?.openLogin();
        });
        await screen.findByLabelText("Phone number");

        expect(screen.getAllByLabelText("Phone number")).toHaveLength(1);
    });

    // HomePage holds its stale-bundle reload on this flag: a reload would wipe an ask the backend
    // has already counted.
    it("publishes whether the review prompt is on screen, including while a sheet hides it", async () => {
        mockRefreshCustomerToken.mockResolvedValue({ accessToken: "tok-1", isNewAccount: false });
        mockFetchReviewPrompt.mockResolvedValue({ orderId: 7, branchName: "Seef", reviewUrl: "https://review.test/7" });
        let uiContext: ReturnType<typeof useCustomerAuthUi> | undefined;
        function Capture(): null {
            uiContext = useCustomerAuthUi();
            return null;
        }

        render(
            <CustomerAuthProvider>
                <CustomerAuthUiProvider>
                    <Capture />
                    <CustomerAuthModals />
                </CustomerAuthUiProvider>
            </CustomerAuthProvider>
        );

        await screen.findByText("How was your pizza last time?");
        expect(uiContext?.isReviewPromptOpen).toBe(true);

        act(() => {
            uiContext?.openLogin();
        });
        await screen.findByLabelText("Phone number");
        expect(uiContext?.isReviewPromptOpen).toBe(false);

        act(() => {
            uiContext?.closeAll();
        });
        await waitFor(() => expect(uiContext?.isReviewPromptOpen).toBe(true));

        fireEvent.click(screen.getByRole("button", { name: "Not now" }));
        await waitFor(() => expect(uiContext?.isReviewPromptOpen).toBe(false));
    });
});
