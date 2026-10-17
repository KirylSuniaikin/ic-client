import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CustomerSheet, useSheetPresentation } from "./CustomerSheet";
import type { CustomerSheetDesktop, CustomerSheetProps, SheetPresentation } from "./CustomerSheet";
import { SheetHandle } from "../../domains/delivery/components/sheetStyles";
import { DesktopLayoutAllowedContext } from "../hooks/useDesktopLayout";
import { clearMatchMedia, stubMatchMedia } from "../hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../domains/management/couriers/components/emotionRules.testutil";
import { sheetHandleCount } from "./sheetHandle.testutil";

const CENTER: CustomerSheetDesktop = { placement: "center", width: 440 };
const SIDE: CustomerSheetDesktop = { placement: "side", width: 440 };

function renderSheet(props: Partial<CustomerSheetProps> = {}): ReturnType<typeof render> {
    return render(
        <CustomerSheet open onClose={jest.fn()} desktop={CENTER} {...props}>
            {props.children ?? <p>sheet body</p>}
        </CustomerSheet>
    );
}

function rootOf(selector: string): HTMLElement {
    const root = document.querySelector<HTMLElement>(selector);
    if (root === null) throw new Error(`no ${selector}`);
    return root;
}

function zIndexOf(root: HTMLElement): number {
    return Number(window.getComputedStyle(root).zIndex);
}

/** A matchMedia whose answer can change between renders, as a resized window's does. */
function stubMutableMatchMedia(): { setWide: (wide: boolean) => void } {
    let wide = false;
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            get matches(): boolean {
                return wide;
            },
            media: query,
            onchange: null,
            addListener: (): void => {},
            removeListener: (): void => {},
            addEventListener: (): void => {},
            removeEventListener: (): void => {},
            dispatchEvent: (): boolean => false,
        }),
    });
    return { setWide: (next: boolean): void => { wide = next; } };
}

afterEach(() => {
    clearMatchMedia();
});

describe("CustomerSheet on the phone", () => {
    it("renders a bottom Drawer whose paper carries the given PaperProps", () => {
        renderSheet({ PaperProps: { sx: { width: "77px" } } });

        expect(document.querySelector(".MuiDrawer-root")).toBeTruthy();
        expect(document.querySelector(".MuiDialog-root")).toBeNull();
        expect(emotionRulesFor(rootOf(".MuiDrawer-paper"))).toContain("width:77px");
        expect(screen.getByText("sheet body")).toBeTruthy();
    });

    it("stays a Drawer at PC width where the surface does not allow the PC layout", () => {
        stubMatchMedia(true);
        render(
            <DesktopLayoutAllowedContext.Provider value={false}>
                <CustomerSheet open onClose={jest.fn()} desktop={CENTER}>
                    <p>sheet body</p>
                </CustomerSheet>
            </DesktopLayoutAllowedContext.Provider>
        );

        expect(document.querySelector(".MuiDrawer-root")).toBeTruthy();
        expect(document.querySelector(".MuiDialog-root")).toBeNull();
    });
});

describe("CustomerSheet on PC", () => {
    it("renders a centred dialog with the PC paper", () => {
        stubMatchMedia(true);
        renderSheet();

        expect(document.querySelector(".MuiDialog-root")).toBeTruthy();
        expect(document.querySelector(".MuiDrawer-root")).toBeNull();
        const rules = emotionRulesFor(rootOf(".MuiDialog-paper"));
        expect(rules).toContain("width:min(440px, 92vw)");
        expect(rules).toContain("border-radius:24px");
    });

    it("keeps the drawer layer by default and the popup's own z-index when it has one", () => {
        stubMatchMedia(true);
        const { unmount } = renderSheet();
        expect(zIndexOf(rootOf(".MuiDialog-root"))).toBe(1200);
        unmount();

        renderSheet({ sx: { zIndex: 1350 } });
        expect(zIndexOf(rootOf(".MuiDialog-root"))).toBe(1350);
    });

    it("names the dialog by its visible title", () => {
        stubMatchMedia(true);
        renderSheet({ labelledBy: "sheet-title", children: <h2 id="sheet-title">Pay by card</h2> });

        expect(screen.getByRole("dialog", { name: "Pay by card" })).toBeTruthy();
    });

    it("docks a side panel to the inline end", () => {
        stubMatchMedia(true);
        renderSheet({ desktop: SIDE });

        const rules = emotionRulesFor(screen.getByRole("dialog"));
        expect(rules).toContain("left:auto");
        expect(rules).toContain("width:440px");
        expect(document.querySelector(".MuiDialog-root")).toBeNull();
    });

    // The RTL stylis plugin flips `left: auto`, so the Arabic panel docks on the left.
    it("docks the side panel on the other side in Arabic", () => {
        stubMatchMedia(true);
        // The key starts with "css-" only so that emotionRulesFor, which reads css-* classes,
        // can see the flipped rules.
        const rtlCache = createCache({ key: "css-rtl", stylisPlugins: [prefixer, rtlPlugin] });
        render(
            <CacheProvider value={rtlCache}>
                <ThemeProvider theme={createTheme({ direction: "rtl" })}>
                    <CustomerSheet open onClose={jest.fn()} desktop={SIDE}>
                        <p>sheet body</p>
                    </CustomerSheet>
                </ThemeProvider>
            </CacheProvider>
        );

        const rules = emotionRulesFor(screen.getByRole("dialog"));
        expect(rules).toContain("right:auto");
        expect(rules).not.toContain("left:auto");
    });

    it("gives a stacked panel a transparent backdrop that still closes it", () => {
        stubMatchMedia(true);
        const onClose = jest.fn();
        renderSheet({ onClose, desktop: { placement: "side", width: 440, transparentBackdrop: true } });

        const backdrop = rootOf(".MuiBackdrop-root");
        expect(emotionRulesFor(backdrop)).toContain("background-color:transparent");

        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps the form it opened with until it closes", () => {
        const viewport = stubMutableMatchMedia();
        const ui = (open: boolean): React.ReactElement => (
            <CustomerSheet open={open} onClose={jest.fn()} desktop={CENTER}>
                <p>sheet body</p>
            </CustomerSheet>
        );
        const { rerender } = render(ui(true));
        expect(document.querySelector(".MuiDrawer-root")).toBeTruthy();

        viewport.setWide(true);
        rerender(ui(true));
        expect(document.querySelector(".MuiDrawer-root")).toBeTruthy();
        expect(document.querySelector(".MuiDialog-root")).toBeNull();

        rerender(ui(false));
        rerender(ui(true));
        expect(document.querySelector(".MuiDialog-root")).toBeTruthy();
    });
});

describe("presentation", () => {
    function Probe(): JSX.Element {
        return <span data-testid="presentation">{useSheetPresentation()}</span>;
    }

    const CASES: ReadonlyArray<[string, CustomerSheetDesktop | null, SheetPresentation]> = [
        ["the phone sheet", null, "sheet"],
        ["the PC dialog", CENTER, "dialog"],
        ["the PC panel", SIDE, "panel"],
    ];

    it.each(CASES)("is passed to the render-prop and the context in %s", (_label, desktop, expected) => {
        if (desktop !== null) stubMatchMedia(true);
        const received: SheetPresentation[] = [];
        render(
            <CustomerSheet open onClose={jest.fn()} desktop={desktop ?? CENTER}>
                {(presentation) => {
                    received.push(presentation);
                    return <Probe />;
                }}
            </CustomerSheet>
        );

        expect(received[received.length - 1]).toBe(expected);
        expect(screen.getByTestId("presentation").textContent).toBe(expected);
    });

    it("is the sheet outside any CustomerSheet", () => {
        render(<Probe />);
        expect(screen.getByTestId("presentation").textContent).toBe("sheet");
    });
});

describe("SheetHandle", () => {
    function handles(): number {
        return document.querySelectorAll("[data-testid='handle-host'] > div").length;
    }

    function hostedHandle(): React.ReactElement {
        return (
            <div data-testid="handle-host">
                <SheetHandle />
            </div>
        );
    }

    it("renders inside the phone sheet", () => {
        renderSheet({ children: hostedHandle() });
        expect(handles()).toBe(1);
        // The helper the popup suites use to prove the PC forms have no handle sees this one.
        expect(sheetHandleCount(document.body)).toBe(1);
    });

    it("renders nothing inside the PC dialog or panel", () => {
        stubMatchMedia(true);
        const { unmount } = renderSheet({ children: hostedHandle() });
        expect(handles()).toBe(0);
        unmount();

        renderSheet({ desktop: SIDE, children: hostedHandle() });
        expect(handles()).toBe(0);
    });

    it("renders outside any CustomerSheet", () => {
        stubMatchMedia(true);
        render(hostedHandle());
        expect(handles()).toBe(1);
    });
});
