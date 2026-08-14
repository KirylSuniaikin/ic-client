import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { KeetaFallbackCard } from "./KeetaFallbackCard";
import { KEETA_DEEP_LINK } from "../constants";
import type { DeliveryUnavailableReason } from "../types";

let savedOpen: typeof window.open;

beforeEach(() => { savedOpen = window.open; });
afterEach(() => { window.open = savedOpen; });

function renderCard(reason: DeliveryUnavailableReason | null) {
    const onClose = jest.fn<void, []>();
    render(
        <I18nextProvider i18n={i18n}>
            <KeetaFallbackCard open reason={reason} onClose={onClose} />
        </I18nextProvider>
    );
    return { onClose };
}

describe("KeetaFallbackCard", () => {
    /**
     * The two reasons need different copy: outside-radius is permanent, so "try later" would be
     * a lie; no-courier is temporary and worth waiting out. Telling a customer the wrong one
     * either loses them for good or has them retry for nothing.
     */
    it("says the address is out of area for OUTSIDE_RADIUS", () => {
        renderCard("OUTSIDE_RADIUS");
        expect(screen.getByText(/outside our delivery area/i)).toBeTruthy();
    });

    it("says the drivers are busy for NO_COURIER", () => {
        renderCard("NO_COURIER");
        expect(screen.getByText(/drivers are busy/i)).toBeTruthy();
    });

    /** NO_BRANCH is an unseeded-config state the customer can do nothing about; the temporary
        wording is the less misleading of the two. */
    it("falls back to the temporary wording for an unknown reason", () => {
        renderCard(null);
        expect(screen.getByText(/drivers are busy/i)).toBeTruthy();
    });

    it("opens Keeta in a new tab without handing over a window reference", () => {
        const open = jest.fn<Window | null, [string?, string?, string?]>();
        window.open = open as unknown as typeof window.open;
        renderCard("NO_COURIER");

        fireEvent.click(screen.getByRole("button", { name: /order on keeta/i }));

        expect(open).toHaveBeenCalledWith(KEETA_DEEP_LINK, "_blank", "noopener,noreferrer");
    });

    it("dismisses back to pickup", () => {
        const { onClose } = renderCard("NO_COURIER");
        fireEvent.click(screen.getByRole("button", { name: /back to pickup/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
