import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { jest, describe, it, expect, afterEach } from "@jest/globals";
import ResponsiveSheet from "./ResponsiveSheet";

// jsdom implements no `matchMedia` at all, so MUI's `useMediaQuery` falls back to false — i.e.
// desktop — unless a test installs one. Same convention as TaskCardDrawer.test.tsx.
function stubMatchMedia(matches: boolean): void {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches,
            media: query,
            onchange: null,
            addListener: (): void => {},
            removeListener: (): void => {},
            addEventListener: (): void => {},
            removeEventListener: (): void => {},
            dispatchEvent: (): boolean => false,
        }),
    });
}

afterEach(() => {
    // Leaving a stub installed would silently flip every later suite in this file to the other
    // breakpoint.
    Reflect.deleteProperty(window, "matchMedia");
});

describe("ResponsiveSheet", () => {
    describe("presentation", () => {
        it("renders a centred dialog on a wide screen", () => {
            stubMatchMedia(false);

            render(
                <ResponsiveSheet open onClose={jest.fn()} title="Hire staff" testId="sheet">
                    <div>body</div>
                </ResponsiveSheet>
            );

            expect(document.querySelector(".MuiDialog-root")).toBeTruthy();
            expect(document.querySelector(".MuiDrawer-root")).toBeNull();
        });

        it("renders a bottom sheet on a phone", () => {
            stubMatchMedia(true);

            render(
                <ResponsiveSheet open onClose={jest.fn()} title="Hire staff" testId="sheet">
                    <div>body</div>
                </ResponsiveSheet>
            );

            expect(document.querySelector(".MuiDrawer-root")).toBeTruthy();
            expect(document.querySelector(".MuiDialog-root")).toBeNull();
        });
    });

    describe("content", () => {
        it("renders the title, the subtitle and the children", () => {
            stubMatchMedia(false);

            render(
                <ResponsiveSheet open onClose={jest.fn()} title="Reset password" subtitle="Casey (casey)" testId="sheet">
                    <div>body content</div>
                </ResponsiveSheet>
            );

            expect(screen.getByText("Reset password")).toBeTruthy();
            expect(screen.getByText("Casey (casey)")).toBeTruthy();
            expect(screen.getByText("body content")).toBeTruthy();
            expect(screen.getByTestId("sheet")).toBeTruthy();
        });

        // The credentials reveal carries its own heading, so the shell must be able to stand down
        // rather than stack a second title above it.
        it("renders no heading when no title is given, but keeps the close button", () => {
            stubMatchMedia(false);

            render(
                <ResponsiveSheet open onClose={jest.fn()} testId="sheet">
                    <div>only this</div>
                </ResponsiveSheet>
            );

            expect(screen.getByText("only this")).toBeTruthy();
            expect(screen.getByLabelText("Close")).toBeTruthy();
        });
    });

    describe("dismissal", () => {
        it("calls onClose when the close button is pressed", () => {
            stubMatchMedia(false);
            const onClose = jest.fn();

            render(
                <ResponsiveSheet open onClose={onClose} title="Change branch" testId="sheet">
                    <div>body</div>
                </ResponsiveSheet>
            );

            fireEvent.click(screen.getByLabelText("Close"));

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it("renders nothing while closed", () => {
            stubMatchMedia(false);

            render(
                <ResponsiveSheet open={false} onClose={jest.fn()} title="Change branch" testId="sheet">
                    <div>body</div>
                </ResponsiveSheet>
            );

            expect(screen.queryByTestId("sheet")).toBeNull();
        });
    });
});
