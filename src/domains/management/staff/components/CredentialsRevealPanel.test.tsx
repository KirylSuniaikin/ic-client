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

    function renderPanel(prefix = "reset-password"): ReturnType<typeof jest.fn<void, []>> {
        const onDone = jest.fn<void, []>();
        render(
            <CredentialsRevealPanel
                title="Password reset"
                username="casey.cook"
                password="s3cretPW"
                onDone={onDone}
                testIdPrefix={prefix}
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
});
