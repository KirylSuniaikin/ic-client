import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "../../../shared/i18n";
import { UnavailablePopup } from "./UnavailablePopup";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

function renderPopup(standalone: boolean): { onClose: () => void } {
    const onClose = jest.fn<void, []>();
    render(<UnavailablePopup open standalone={standalone} unavailableItems={["Cola"]} onClose={onClose} />);
    return { onClose };
}

/** The message is a direct child of the notice's own box. */
function noticeBox(): Element {
    const element = screen.getByText("Some items are no longer available").parentElement;
    if (element === null) throw new Error("no box above the message");
    return element;
}

afterEach(() => {
    clearMatchMedia();
});

describe("UnavailablePopup", () => {
    it("is a fixed full-screen notice, not a Modal, when standalone on the phone", () => {
        renderPopup(true);

        expect(document.querySelector(".MuiModal-root")).toBeNull();
        expect(emotionRulesFor(noticeBox())).toContain("position:fixed");
        expect(screen.getByText("Cola")).toBeTruthy();
    });

    it("is a centred card in a Modal that Esc closes when standalone on PC", () => {
        stubMatchMedia(true);
        const { onClose } = renderPopup(true);

        expect(document.querySelector(".MuiModal-root")).toBeTruthy();
        const rules = emotionRulesFor(noticeBox());
        expect(rules).toContain("width:min(440px, 92vw)");
        expect(rules).not.toContain("position:fixed");
        expect(screen.getByText("Cola")).toBeTruthy();

        fireEvent.keyDown(noticeBox(), { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps the in-cart overlay unchanged on PC", () => {
        stubMatchMedia(true);
        renderPopup(false);

        expect(document.querySelector(".MuiModal-root")).toBeNull();
        expect(emotionRulesFor(noticeBox())).toContain("position:absolute");
    });
});
