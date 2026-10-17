import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { renderHook } from "@testing-library/react";
import { DesktopLayoutAllowedContext, useDesktopLayout } from "./useDesktopLayout";
import { clearMatchMedia, stubMatchMedia } from "./stubMatchMedia.testutil";

afterEach(() => {
    clearMatchMedia();
});

describe("useDesktopLayout", () => {
    it("stays on the phone path when the environment has no matchMedia (every existing suite)", () => {
        const { result } = renderHook(() => useDesktopLayout());

        expect(result.current).toBe(false);
    });

    it("switches to the PC layout on a wide viewport", () => {
        stubMatchMedia(true);

        const { result } = renderHook(() => useDesktopLayout());

        expect(result.current).toBe(true);
    });

    it("never switches on a surface that does not allow it, however wide", () => {
        stubMatchMedia(true);

        const { result } = renderHook(() => useDesktopLayout(), {
            wrapper: ({ children }: { children: React.ReactNode }): JSX.Element => (
                <DesktopLayoutAllowedContext.Provider value={false}>{children}</DesktopLayoutAllowedContext.Provider>
            ),
        });

        expect(result.current).toBe(false);
    });

    // An up("md") query: written as down("md") it would put every matchMedia-less suite on PC.
    it("asks for the md breakpoint and up", () => {
        stubMatchMedia(true);
        // spyOn cannot resolve a method name on the full Window type (its index signature makes
        // the name set `never`); the narrowed view is the same object.
        const media: Pick<Window, "matchMedia"> = window;
        const matchMedia = jest.spyOn(media, "matchMedia");

        renderHook(() => useDesktopLayout());

        expect(matchMedia).toHaveBeenCalled();
        expect(matchMedia.mock.calls.every(([query]) => query.includes("min-width:900px"))).toBe(true);
    });
});
