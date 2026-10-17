import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// ClientInfoPopup renders its copy via useTranslation("checkout") — initialize the real i18n
// instance (side-effect import) so keys resolve to English, mirroring PickUpReminderPopup.test.tsx.
import "../../../shared/i18n";

import ClientInfoPopup from "./ClientInfoPopup";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import { writeChosenBranch, clearChosenBranch } from "../../branch/utils/customerBranch";
import type { IBranch } from "../../management/inventory/types";
import { clearMatchMedia, stubMatchMedia } from "../../../shared/hooks/stubMatchMedia.testutil";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

const CHOSEN_BRANCH: IBranch = {
    id: "branch-chosen",
    externalId: "ext-chosen",
    branchNo: 2,
    branchName: "Seef Branch",
    locale: "en",
    latitude: 26.23,
    longitude: 50.53,
};

function fillAndSave(): void {
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "12345678" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Sara" } });
    fireEvent.click(screen.getByRole("button", { name: "Checkout (Take Out)" }));
}

describe("ClientInfoPopup", () => {
    const onSave = jest.fn<void, [string, string, string]>();
    const onClose = jest.fn<void, []>();

    beforeEach(() => {
        onSave.mockReset();
        onClose.mockReset();
        clearChosenBranch();
    });

    // Delivery routes through this popup too (phone + name, then DeliveryCheckoutDrawer collects
    // the address), so the confirm button must not promise Take Out.
    it("labels the confirm button for the selected order type", () => {
        const { rerender } = render(
            <ClientInfoPopup
                isPhonePopupOpen
                onClose={onClose}
                onSave={onSave}
                phoneNumber=""
                customerName=""
                branches={[]}
                orderType="Pick Up"
            />
        );
        expect(screen.getByRole("button", { name: "Checkout (Take Out)" })).toBeTruthy();

        rerender(
            <ClientInfoPopup
                isPhonePopupOpen
                onClose={onClose}
                onSave={onSave}
                phoneNumber=""
                customerName=""
                branches={[]}
                orderType="Delivery"
            />
        );
        expect(screen.getByRole("button", { name: "Checkout (Delivery)" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Checkout (Take Out)" })).toBeNull();
    });

    // ST5 (task-spec.md §11): onSave's third argument is the chosen branch id — not
    // DEFAULT_BRANCH_ID — when no in-popup branch is selected (the branch field is disabled,
    // IS_MULTI_BRANCH_ENABLED = false).
    it("saves with the stored chosen branch id when no in-popup branch is selected", () => {
        expect(CHOSEN_BRANCH.id).not.toBe(DEFAULT_BRANCH_ID);
        writeChosenBranch(CHOSEN_BRANCH);

        render(
            <ClientInfoPopup
                isPhonePopupOpen
                onClose={onClose}
                onSave={onSave}
                phoneNumber=""
                customerName=""
                branches={[]}
            />
        );

        fillAndSave();

        expect(onSave).toHaveBeenCalledWith("97312345678", "Sara", CHOSEN_BRANCH.id);
        expect(onSave).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), DEFAULT_BRANCH_ID);
    });

    // Existing-fallback case: with no branch stored, useBranchResolution falls back to
    // DEFAULT_BRANCH_ID (req. 13) — this keeps passing unchanged.
    it("falls back to DEFAULT_BRANCH_ID when no branch has been chosen", () => {
        render(
            <ClientInfoPopup
                isPhonePopupOpen
                onClose={onClose}
                onSave={onSave}
                phoneNumber=""
                customerName=""
                branches={[]}
            />
        );

        fillAndSave();

        expect(onSave).toHaveBeenCalledWith("97312345678", "Sara", DEFAULT_BRANCH_ID);
    });
});

describe("ClientInfoPopup on PC", () => {
    afterEach(() => {
        clearMatchMedia();
    });

    /** The popup's paper: title Typography → its padded Box → the paper Box. */
    function paper(): Element {
        const element = screen.getByText("Enter your phone number to complete your order").parentElement?.parentElement;
        if (element == null) throw new Error("no paper above the title");
        return element;
    }

    it("is a centred card, not a full-width bottom sheet", () => {
        stubMatchMedia(true);
        render(
            <ClientInfoPopup isPhonePopupOpen onClose={jest.fn()} onSave={jest.fn()} phoneNumber="" customerName="" branches={[]} orderType="Pick Up" />
        );

        const rules = emotionRulesFor(paper());
        expect(rules).toContain("width:min(480px, 92vw)");
        expect(rules).toContain("translate(-50%, -50%)");
        expect(rules).toContain("overflow-y:auto");
        expect(rules).not.toContain("bottom:0");
    });

    it("stays the bottom sheet on the phone", () => {
        render(
            <ClientInfoPopup isPhonePopupOpen onClose={jest.fn()} onSave={jest.fn()} phoneNumber="" customerName="" branches={[]} orderType="Pick Up" />
        );

        const rules = emotionRulesFor(paper());
        expect(rules).toContain("bottom:0");
        expect(rules).not.toContain("translate(-50%, -50%)");
    });
});
