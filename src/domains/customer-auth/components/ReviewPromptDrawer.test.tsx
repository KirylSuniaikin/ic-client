import { jest, describe, it, expect, beforeEach, beforeAll, afterAll } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// The drawer renders its copy via useTranslation — initialize the real i18n
// instance so keys resolve to English under the default language.
import "../../../shared/i18n";

jest.mock("../../../shared/api/customerAuth");
jest.mock("../../../shared/api/socket");

import {
    refreshCustomerToken,
    fetchReviewPrompt,
    ackReviewPrompt,
} from "../../../shared/api/customerAuth";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../context/CustomerAuthProvider";
import { CustomerAuthUiProvider, useCustomerAuthUi } from "../context/CustomerAuthUiProvider";
import { CustomerAuthModals } from "./CustomerAuthModals";
import { ReviewPromptDrawer } from "./ReviewPromptDrawer";
import type { ReviewPrompt } from "../types";

const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);
const mockFetchReviewPrompt = jest.mocked(fetchReviewPrompt);
const mockAckReviewPrompt = jest.mocked(ackReviewPrompt);

const PROMPT: ReviewPrompt = {
    orderId: 42,
    branchName: "IC Pizza",
    reviewUrl: "https://search.google.com/local/writereview?placeid=PLACE",
};

const originalWindowOpen = window.open;
const mockWindowOpen = jest.fn();

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
    window.open = mockWindowOpen as unknown as typeof window.open;
});

afterAll(() => {
    window.open = originalWindowOpen;
});

beforeEach(() => {
    mockRefreshCustomerToken.mockReset();
    mockRefreshCustomerToken.mockResolvedValue({
        accessToken: "token-123",
        refreshToken: "refresh-123",
        isNewAccount: false,
    });
    mockFetchReviewPrompt.mockReset();
    mockFetchReviewPrompt.mockResolvedValue(PROMPT);
    mockAckReviewPrompt.mockReset();
    mockAckReviewPrompt.mockResolvedValue(undefined);
    mockWindowOpen.mockReset();
    __resetCustomerAuthStoreForTests();
});

describe("ReviewPromptDrawer", () => {
    function renderDrawer(prompt: ReviewPrompt | null = PROMPT) {
        const onShown = jest.fn();
        const onAnswer = jest.fn();
        render(<ReviewPromptDrawer prompt={prompt} onShown={onShown} onAnswer={onAnswer} />);
        return { onShown, onAnswer };
    }

    it("renders nothing when there is no prompt to show", () => {
        const { onShown } = renderDrawer(null);

        expect(screen.queryByText("How was your pizza last time?")).toBeNull();
        expect(onShown).not.toHaveBeenCalled();
    });

    it("reports SHOWN as soon as it is on screen, before any button is pressed", () => {
        const { onShown, onAnswer } = renderDrawer();

        expect(onShown).toHaveBeenCalled();
        expect(onAnswer).not.toHaveBeenCalled();
    });

    it("offers all three actions with no sentiment step in front of the Google link", () => {
        renderDrawer();

        expect(screen.getByText("How was your pizza last time?")).toBeTruthy();
        expect(screen.getByText("Yes, leave a review")).toBeTruthy();
        expect(screen.getByText("Not now")).toBeTruthy();
        expect(screen.getByText("Don't ask me again")).toBeTruthy();
    });

    it("opens the review URL and records OPENED when the customer taps through", () => {
        const { onAnswer } = renderDrawer();

        fireEvent.click(screen.getByText("Yes, leave a review"));

        expect(onAnswer).toHaveBeenCalledWith("OPENED");
        expect(mockWindowOpen).toHaveBeenCalledWith(PROMPT.reviewUrl, "_blank", "noopener,noreferrer");
    });

    it("records DISMISSED and opens nothing when the customer picks \"Not now\"", () => {
        const { onAnswer } = renderDrawer();

        fireEvent.click(screen.getByText("Not now"));

        expect(onAnswer).toHaveBeenCalledWith("DISMISSED");
        expect(mockWindowOpen).not.toHaveBeenCalled();
    });

    it("records OPTED_OUT when the customer picks \"Don't ask me again\"", () => {
        const { onAnswer } = renderDrawer();

        fireEvent.click(screen.getByText("Don't ask me again"));

        expect(onAnswer).toHaveBeenCalledWith("OPTED_OUT");
        expect(mockWindowOpen).not.toHaveBeenCalled();
    });
});

describe("ReviewPromptDrawer mounted in CustomerAuthModals", () => {
    // Drives the UI context from inside the tree, the same way
    // CustomerAuthModals.test.tsx does.
    function UiDriver({ onReady }: { onReady: (ui: ReturnType<typeof useCustomerAuthUi>) => void }) {
        const ui = useCustomerAuthUi();
        onReady(ui);
        return null;
    }

    function renderModals() {
        let ui: ReturnType<typeof useCustomerAuthUi> | null = null;
        const result = render(
            <CustomerAuthProvider>
                <CustomerAuthUiProvider>
                    <UiDriver onReady={(value) => { ui = value; }} />
                    <CustomerAuthModals />
                </CustomerAuthUiProvider>
            </CustomerAuthProvider>
        );
        return { ...result, getUi: () => ui as unknown as ReturnType<typeof useCustomerAuthUi> };
    }

    it("shows the ask and reports SHOWN once the backend returns a prompt", async () => {
        renderModals();

        await waitFor(() => expect(screen.getByText("How was your pizza last time?")).toBeTruthy());
        await waitFor(() => expect(mockAckReviewPrompt).toHaveBeenCalledWith("token-123", 42, "SHOWN"));
    });

    it("shows nothing when the backend has nothing to ask", async () => {
        mockFetchReviewPrompt.mockResolvedValue(null);

        renderModals();

        await waitFor(() => expect(mockFetchReviewPrompt).toHaveBeenCalled());
        expect(screen.queryByText("How was your pizza last time?")).toBeNull();
    });

    it("does not re-open the ask after the customer dismisses it", async () => {
        renderModals();
        await waitFor(() => expect(screen.getByText("How was your pizza last time?")).toBeTruthy());

        fireEvent.click(screen.getByText("Not now"));

        await waitFor(() => expect(screen.queryByText("How was your pizza last time?")).toBeNull());
        expect(mockAckReviewPrompt).toHaveBeenCalledWith("token-123", 42, "DISMISSED");
    });

    // The review ask must never stack on top of the login/profile sheets.
    it("hides the ask while another customer-auth popup is open", async () => {
        const { getUi } = renderModals();
        await waitFor(() => expect(screen.getByText("How was your pizza last time?")).toBeTruthy());

        await waitFor(() => expect(getUi()).not.toBeNull());
        await React.act(async () => {
            getUi().openProfile();
        });

        expect(screen.queryByText("How was your pizza last time?")).toBeNull();
    });

    it("does not ask at all when the customer is logged out", async () => {
        mockRefreshCustomerToken.mockRejectedValue(new Error("no session"));

        renderModals();

        await waitFor(() => expect(mockRefreshCustomerToken).toHaveBeenCalled());
        expect(mockFetchReviewPrompt).not.toHaveBeenCalled();
    });
});
