import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { BranchSwitchWarningDrawer } from "./BranchSwitchWarningDrawer";
import type { IBranch } from "../../management/inventory/types";

const TARGET_BRANCH: IBranch = {
    id: "b-2", externalId: "ext-2", branchNo: 2, branchName: "Seef", locale: "en",
    latitude: null, longitude: null,
};

function renderDrawer(overrides: Partial<React.ComponentProps<typeof BranchSwitchWarningDrawer>> = {}) {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
        <I18nextProvider i18n={i18n}>
            <BranchSwitchWarningDrawer
                open
                loading={false}
                targetBranch={TARGET_BRANCH}
                unavailableNames={[]}
                error={null}
                onConfirm={onConfirm}
                onCancel={onCancel}
                {...overrides}
            />
        </I18nextProvider>
    );
    return { onConfirm, onCancel };
}

describe("BranchSwitchWarningDrawer", () => {
    it("shows a loading state while checking the target branch (§6.4 step 3)", () => {
        renderDrawer({ loading: true });

        expect(screen.getByRole("progressbar")).toBeTruthy();
        // Neither list of names nor the confirm affordance should claim a result before it exists.
        expect(screen.queryByText(/removed from your cart/i)).toBeNull();
    });

    it("names the unavailable lines before switching (§6.4 step 4)", () => {
        renderDrawer({ unavailableNames: ["Pepperoni Pizza", "Garlic Bread"] });

        expect(screen.getByText("Pepperoni Pizza")).toBeTruthy();
        expect(screen.getByText("Garlic Bread")).toBeTruthy();
    });

    it("says nothing is lost when every cart item survives the switch", () => {
        renderDrawer({ unavailableNames: [] });

        expect(screen.getByText(/available at Seef/i)).toBeTruthy();
    });

    it("confirm and cancel call through to the handlers", () => {
        const { onConfirm, onCancel } = renderDrawer({ unavailableNames: ["Pepperoni Pizza"] });

        fireEvent.click(screen.getByRole("button", { name: /switch branch/i }));
        expect(onConfirm).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("on fetch failure, surfaces the error and offers only Cancel (§6.4 step 5)", () => {
        renderDrawer({ error: "Network error" });

        expect(screen.getByText(/Network error/)).toBeTruthy();
        expect(screen.queryByRole("button", { name: /switch branch/i })).toBeNull();
        expect(screen.getByRole("button", { name: /cancel/i })).toBeTruthy();
    });
});
