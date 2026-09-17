import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { copyToClipboard } from "../utils/copyToClipboard";
import CredentialsRevealPanel from "./CredentialsRevealPanel";

jest.mock("../utils/copyToClipboard");
const mockCopyToClipboard = jest.mocked(copyToClipboard);

// HireStaffDrawer.test.tsx already covers this panel end to end through the hire flow. What it
// cannot cover is the part that only exists because the panel is now shared: that every testid
// is derived from testIdPrefix, so two hosts get distinct, stable selectors.
describe("CredentialsRevealPanel", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCopyToClipboard.mockResolvedValue(undefined);
    });

    function renderPanel(
        prefix = "reset-password",
        telegramLink: string | null | undefined = undefined,
    ): ReturnType<typeof jest.fn<void, []>> {
        const onDone = jest.fn<void, []>();
        render(
            <CredentialsRevealPanel
                title="Password reset"
                username="casey.cook"
                password="s3cretPW"
                onDone={onDone}
                testIdPrefix={prefix}
                telegramLink={telegramLink}
            />,
        );
        return onDone;
    }

    it("derives every testid from the prefix", () => {
        renderPanel("reset-password");

        expect(screen.getByTestId("reset-password-credentials")).toBeTruthy();
        expect(screen.getByTestId("reset-password-credentials-username")).toBeTruthy();
        expect(screen.getByTestId("reset-password-credentials-password")).toBeTruthy();
        expect(screen.getByTestId("reset-password-copy-button")).toBeTruthy();
    });

    it("warns that the password is shown only once", () => {
        renderPanel();
        expect(screen.getByText("This password will not be shown again.")).toBeTruthy();
    });

    it("copies login and password together", async () => {
        renderPanel();

        fireEvent.click(screen.getByTestId("reset-password-copy-button"));

        await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalledWith("casey.cook / s3cretPW"));
        expect(await screen.findByText("Copied!")).toBeTruthy();
    });

    // The invariant the whole panel exists for: this is the only time the password is ever
    // displayed, so reporting a copy that did not happen loses it irrecoverably.
    it("never claims success when the copy failed", async () => {
        mockCopyToClipboard.mockRejectedValue(new Error("Clipboard unavailable"));
        renderPanel();

        fireEvent.click(screen.getByTestId("reset-password-copy-button"));

        expect(await screen.findByTestId("reset-password-copy-error")).toBeTruthy();
        expect(screen.queryByText("Copied!")).toBeNull();
    });

    it("hands control back on Done", () => {
        const onDone = renderPanel();
        fireEvent.click(screen.getByText("Done"));
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    // The copy is what the manager opened this for, and the password is shown exactly once.
    describe("automatic copy", () => {
        it("copies on mount, with no click at all", async () => {
            renderPanel();

            await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalledWith("casey.cook / s3cretPW"));
            expect(await screen.findByTestId("reset-password-auto-copied")).toBeTruthy();
            expect(screen.getByText("Copied!")).toBeTruthy();
        });

        // Some WebViews reject a clipboard write outside a user gesture, and this one runs after
        // an await. A refusal is expected rather than exceptional, so it must not raise an error
        // the manager did not ask for -- but it must never look like it worked either.
        it("stays silent and claims nothing when the automatic copy is refused", async () => {
            mockCopyToClipboard.mockRejectedValue(new Error("Clipboard unavailable"));
            renderPanel();

            await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalled());
            expect(screen.queryByTestId("reset-password-auto-copied")).toBeNull();
            expect(screen.queryByTestId("reset-password-copy-error")).toBeNull();
            expect(screen.queryByText("Copied!")).toBeNull();
            expect(screen.getByText("Copy login + password")).toBeTruthy();
        });

        it("leaves the manual button working after a refused automatic copy", async () => {
            mockCopyToClipboard.mockRejectedValueOnce(new Error("Clipboard unavailable"));
            renderPanel();
            await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalledTimes(1));

            mockCopyToClipboard.mockResolvedValue(undefined);
            fireEvent.click(screen.getByTestId("reset-password-copy-button"));

            expect(await screen.findByText("Copied!")).toBeTruthy();
        });
    });

    describe("telegram link", () => {
        const TELEGRAM_LINK = "https://t.me/icpizza_bot?start=server-issued-token";
        const THREE_LINE_TEXT =
            "login: casey.cook\npassword: s3cretPW\ntelegram link to receive updates(mandatory to click): " +
            TELEGRAM_LINK;

        it("renders the third field with the correct testid and value when telegramLink is set", () => {
            renderPanel("reset-password", TELEGRAM_LINK);

            const field = screen.getByTestId("reset-password-credentials-telegram-link");
            const input = field.querySelector("input") as HTMLInputElement;
            expect(input.value).toBe(TELEGRAM_LINK);
        });

        it("does not render the third field when telegramLink is unset", () => {
            renderPanel();

            expect(screen.queryByTestId("reset-password-credentials-telegram-link")).toBeNull();
        });

        it("auto-copies the exact three-line string when telegramLink is set", async () => {
            renderPanel("reset-password", TELEGRAM_LINK);

            await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalledWith(THREE_LINE_TEXT));
        });

        it("manually copies the exact three-line string when telegramLink is set", async () => {
            renderPanel("reset-password", TELEGRAM_LINK);
            mockCopyToClipboard.mockClear();

            fireEvent.click(screen.getByTestId("reset-password-copy-button"));

            await waitFor(() => expect(mockCopyToClipboard).toHaveBeenCalledWith(THREE_LINE_TEXT));
        });

        it("shows the Telegram-aware idle label when telegramLink is set, flipping to Copied! once copied", async () => {
            renderPanel("reset-password", TELEGRAM_LINK);

            expect(screen.getByText("Copy login, password & Telegram link")).toBeTruthy();

            await waitFor(() => expect(screen.getByText("Copied!")).toBeTruthy());
        });
    });
});
