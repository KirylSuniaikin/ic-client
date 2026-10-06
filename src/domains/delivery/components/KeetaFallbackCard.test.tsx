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

    it("says the order is bigger than the drivers on shift can carry for INSUFFICIENT_COURIERS", () => {
        renderCard("INSUFFICIENT_COURIERS");
        expect(screen.getByText(/bigger than the drivers on shift/i)).toBeTruthy();
        expect(screen.queryByText(/drivers are busy/i)).toBeNull();
    });

    it("falls back to the NO_COURIER copy for a reason this build does not know", () => {
        renderCard("SOMETHING_NEW" as unknown as DeliveryUnavailableReason);
        expect(screen.getByText(/drivers are busy/i)).toBeTruthy();
    });

    /** NO_BRANCH is an unseeded-config state the customer can do nothing about; the temporary
        wording is the less misleading of the two. */
    it("falls back to the temporary wording for an unknown reason", () => {
        renderCard(null);
        expect(screen.getByText(/drivers are busy/i)).toBeTruthy();
    });

    /**
     * NO_BRANCH itself, rather than `null` standing in for it. It is a real value the gate
     * returns, and it is the one a customer can do least about — telling them their address is
     * out of area would be a permanent refusal for a configuration problem on our side.
     */
    it("uses the temporary wording for NO_BRANCH, which the customer can do nothing about", () => {
        renderCard("NO_BRANCH");
        expect(screen.getByText(/drivers are busy/i)).toBeTruthy();
        expect(screen.queryByText(/outside our delivery area/i)).toBeNull();
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

    /**
     * The lost-demand count: recorded first, then Keeta opens in the same click — a popup opened
     * after anything asynchronous would be blocked by the browser.
     */
    it("records the Keeta choice and still opens Keeta, in that order", () => {
        const calls: string[] = [];
        const open = jest.fn<Window | null, [string?, string?, string?]>(() => {
            calls.push("open");
            return null;
        });
        window.open = open as unknown as typeof window.open;
        const onKeetaChosen = jest.fn<void, []>(() => { calls.push("chosen"); });
        render(
            <I18nextProvider i18n={i18n}>
                <KeetaFallbackCard open reason="OUTSIDE_RADIUS" onClose={jest.fn()} onKeetaChosen={onKeetaChosen} />
            </I18nextProvider>
        );

        fireEvent.click(screen.getByRole("button", { name: /order on keeta/i }));

        expect(onKeetaChosen).toHaveBeenCalledTimes(1);
        expect(open).toHaveBeenCalledWith(KEETA_DEEP_LINK, "_blank", "noopener,noreferrer");
        expect(calls).toEqual(["chosen", "open"]);
    });

    /** Going back to pickup is not choosing Keeta, and must not be counted as if it were. */
    it("records nothing when the customer goes back to pickup", () => {
        const onKeetaChosen = jest.fn<void, []>();
        render(
            <I18nextProvider i18n={i18n}>
                <KeetaFallbackCard open reason="NO_COURIER" onClose={jest.fn()} onKeetaChosen={onKeetaChosen} />
            </I18nextProvider>
        );

        fireEvent.click(screen.getByRole("button", { name: /back to pickup/i }));

        expect(onKeetaChosen).not.toHaveBeenCalled();
    });

    /** Our bookkeeping failing must never be what keeps a customer from Keeta. */
    it("still opens Keeta when recording the choice throws", () => {
        jest.spyOn(console, "warn").mockImplementation(() => undefined);
        const open = jest.fn<Window | null, [string?, string?, string?]>();
        window.open = open as unknown as typeof window.open;
        render(
            <I18nextProvider i18n={i18n}>
                <KeetaFallbackCard open reason="NO_COURIER" onClose={jest.fn()}
                                   onKeetaChosen={() => { throw new Error("boom"); }} />
            </I18nextProvider>
        );

        fireEvent.click(screen.getByRole("button", { name: /order on keeta/i }));

        expect(open).toHaveBeenCalledWith(KEETA_DEEP_LINK, "_blank", "noopener,noreferrer");
    });
});

