import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// The PC close button is labelled through useTranslation("customerAuth") — initialize the real
// i18n instance so the key resolves to English.
import "../../../../shared/i18n";

import { ItemPopupShell } from "./ItemPopupShell";
import type { ItemPopupShellProps } from "./ItemPopupShell";
import { DesktopLayoutAllowedContext } from "../../../../shared/hooks/useDesktopLayout";
import { clearMatchMedia, stubMatchMedia } from "../../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../../management/couriers/components/emotionRules.testutil";

type ShellOverrides = Partial<Omit<ItemPopupShellProps, "onClose" | "children">>;

const LEGACY: ItemPopupShellProps["legacy"] = {
    paperSx: { bgcolor: "#123456" },
    scrollSx: { overflowY: "scroll" },
    media: <img src="legacy.png" alt="Legacy media"/>,
};

function shellElement(overrides: ShellOverrides, onClose: () => void): JSX.Element {
    return (
        <ItemPopupShell
            open
            onClose={onClose}
            legacy={LEGACY}
            desktop={{ photo: { src: "pc.png", alt: "Margherita" } }}
            footer={<div data-testid="footer">Footer</div>}
            {...overrides}
        >
            <p>Options</p>
        </ItemPopupShell>
    );
}

function renderShell(overrides: ShellOverrides = {}, onClose: () => void = jest.fn<void, []>()): void {
    render(shellElement(overrides, onClose));
}

/** The legacy paper: the Box carrying LEGACY.paperSx. */
function legacyPaper(): HTMLElement {
    const footer = screen.getByTestId("footer");
    const paper = footer.parentElement;
    if (paper === null) throw new Error("footer has no parent");
    expect(emotionRulesFor(paper)).toContain("background-color:#123456");
    return paper;
}

function follows(first: Node, second: Node): boolean {
    return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

afterEach(() => {
    clearMatchMedia();
});

describe("ItemPopupShell — legacy path (phone, admin, kiosk)", () => {
    it("renders one unnamed close button that closes the popup", () => {
        const onClose = jest.fn<void, []>();
        renderShell({}, onClose);

        const buttons = screen.getAllByRole("button");
        expect(buttons).toHaveLength(1);
        expect(buttons[0].getAttribute("aria-label")).toBeNull();
        expect(screen.getByRole("button", { name: "" })).toBe(buttons[0]);

        fireEvent.click(buttons[0]);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("puts the media before the children inside the scroll container, with the footer after it", () => {
        renderShell();

        const media = screen.getByAltText("Legacy media");
        const scroll = media.parentElement;
        if (scroll === null) throw new Error("media has no parent");
        expect(emotionRulesFor(scroll)).toContain("overflow-y:scroll");

        const options = screen.getByText("Options");
        expect(options.parentElement).toBe(scroll);
        expect(follows(media, options)).toBe(true);

        expect(scroll.parentElement).toBe(legacyPaper());
        expect(scroll.nextElementSibling).toBe(screen.getByTestId("footer"));
    });

    it("renders media, children and footer straight into the paper when there is no scroll container", () => {
        renderShell({ legacy: { paperSx: LEGACY.paperSx, media: LEGACY.media } });

        const paper = legacyPaper();
        const media = screen.getByAltText("Legacy media");
        const options = screen.getByText("Options");
        const footer = screen.getByTestId("footer");

        expect(media.parentElement).toBe(paper);
        expect(options.parentElement).toBe(paper);
        expect(follows(media, options)).toBe(true);
        expect(follows(options, footer)).toBe(true);
    });

    it("renders no button when showClose is false", () => {
        renderShell({ showClose: false });

        expect(screen.queryByRole("button")).toBeNull();
    });

    it("never renders the PC photo", () => {
        renderShell();

        expect(screen.queryByAltText("Margherita")).toBeNull();
        expect(screen.queryByTestId("item-popup-photo")).toBeNull();
        expect(screen.queryByTestId("item-popup-dialog")).toBeNull();
    });
});

describe("ItemPopupShell — PC path", () => {
    it("shows the photo column and the options column, without the legacy media", () => {
        stubMatchMedia(true);
        renderShell();

        const dialog = screen.getByTestId("item-popup-dialog");
        const photo = within(dialog).getByTestId("item-popup-photo");
        expect(within(photo).getByAltText("Margherita")).toBeTruthy();
        expect(screen.queryByAltText("Legacy media")).toBeNull();
        expect(dialog.contains(screen.getByText("Options"))).toBe(true);
        expect(dialog.contains(screen.getByTestId("footer"))).toBe(true);
    });

    it("sizes the two-column dialog and gives the photo 45% of it", () => {
        stubMatchMedia(true);
        renderShell();

        const rules = emotionRulesFor(screen.getByTestId("item-popup-dialog"));
        expect(rules).toContain("width:min(960px, 92vw)");
        expect(rules).toContain("height:min(680px, 90vh)");
        expect(rules).toContain("border-radius:24px");
        expect(emotionRulesFor(screen.getByTestId("item-popup-photo"))).toContain("flex:0 0 45%");
    });

    it("labels the close button and closes the popup with it", () => {
        stubMatchMedia(true);
        const onClose = jest.fn<void, []>();
        renderShell({}, onClose);

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes on Escape", () => {
        stubMatchMedia(true);
        const onClose = jest.fn<void, []>();
        renderShell({}, onClose);

        fireEvent.keyDown(screen.getByTestId("item-popup-dialog"), { key: "Escape" });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("renders one centred column at the requested width when there is no photo", () => {
        stubMatchMedia(true);
        renderShell({ desktop: { width: 520 } });

        expect(screen.queryByTestId("item-popup-photo")).toBeNull();
        expect(emotionRulesFor(screen.getByTestId("item-popup-dialog"))).toContain("width:min(520px, 92vw)");
    });

    it("keeps the legacy path on a surface that does not allow the PC layout", () => {
        stubMatchMedia(true);

        render(
            <DesktopLayoutAllowedContext.Provider value={false}>
                {shellElement({}, jest.fn<void, []>())}
            </DesktopLayoutAllowedContext.Provider>
        );

        expect(screen.queryByTestId("item-popup-dialog")).toBeNull();
        expect(screen.getByAltText("Legacy media")).toBeTruthy();
    });

    it("puts the close button on the left in Arabic", () => {
        stubMatchMedia(true);
        // The app's RTL plugin chain (app/providers.tsx). The key starts with "css-" only so that
        // emotionRulesFor, which reads css-* classes, can see the flipped rules.
        const rtlCache = createCache({ key: "css-rtl", stylisPlugins: [prefixer, rtlPlugin] });

        render(
            <CacheProvider value={rtlCache}>
                <ThemeProvider theme={createTheme({ direction: "rtl" })}>
                    {shellElement({}, jest.fn<void, []>())}
                </ThemeProvider>
            </CacheProvider>
        );

        const rules = emotionRulesFor(screen.getByRole("button", { name: "Close" }));
        expect(rules).toContain("left:16px");
        expect(rules).not.toContain("right:16px");
    });
});
