import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "../../../shared/i18n";
import ClosedPopup from "./ClosedPopup";
import type { WorkingHoursSchedule } from "../../../shared/api/management";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

// lottie-react needs a real <canvas> 2D context jsdom doesn't implement — same mock
// PizzaPopupContent.test.tsx uses.
jest.mock("lottie-react", () => ({
    __esModule: true,
    default: (): null => null,
}));

const DAY = { isOpen: true, shifts: [["11:00", "23:00"]] as [string, string][] };
const SCHEDULE: WorkingHoursSchedule = {
    Sunday: DAY, Monday: DAY, Tuesday: DAY, Wednesday: DAY, Thursday: DAY,
    Friday: { isOpen: true, shifts: [["13:00", "23:00"]] },
    Saturday: { isOpen: false, shifts: [] },
};

function renderPopup(): { onClose: () => void } {
    const onClose = jest.fn<void, []>();
    render(<ClosedPopup open onClose={onClose} workingHours={SCHEDULE} />);
    return { onClose };
}

/** The title is a direct child of the popup's paper Box. */
function paper(): Element {
    const element = screen.getByText("Unfortunately we are closed right now").parentElement;
    if (element === null) throw new Error("no paper above the title");
    return element;
}

afterEach(() => {
    clearMatchMedia();
});

describe("ClosedPopup", () => {
    it("fills the screen on the phone", () => {
        renderPopup();

        const rules = emotionRulesFor(paper());
        expect(rules).toContain("inset:0");
        expect(rules).not.toContain("translate(-50%, -50%)");
    });

    it("is a centred 440px card over the dimmed menu on PC", () => {
        stubMatchMedia(true);
        renderPopup();

        const rules = emotionRulesFor(paper());
        expect(rules).toContain("width:min(440px, 92vw)");
        expect(rules).toContain("translate(-50%, -50%)");
        expect(rules).not.toContain("inset:0");
    });

    it("closes from See you soon!", () => {
        stubMatchMedia(true);
        const { onClose } = renderPopup();

        fireEvent.click(screen.getByRole("button", { name: "See you soon!" }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("lists the weekly hours from the branch's schedule", () => {
        renderPopup();

        expect(screen.getByText("Mon, Tue, Wed, Thu, Sun — 11:00–23:00")).toBeTruthy();
        expect(screen.getByText("Fri — 13:00–23:00")).toBeTruthy();
        expect(screen.getByText("Sat — Closed")).toBeTruthy();
    });
});
