import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// ClientInfoPopup renders its copy via useTranslation("checkout") — initialize the real i18n
// instance (side-effect import) so keys resolve to English, mirroring PickUpReminderPopup.test.tsx.
import "../../../shared/i18n";

import ClientInfoPopup from "./ClientInfoPopup";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import { writeChosenBranch, clearChosenBranch } from "../../branch/utils/customerBranch";
import type { IBranch } from "../../management/inventory/types";

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
