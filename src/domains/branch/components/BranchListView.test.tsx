import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { BranchListView } from "./BranchListView";
import type { IBranch } from "../../management/inventory/types";

function branch(overrides: Partial<IBranch> = {}): IBranch {
    return {
        id: "b1",
        externalId: "ext-1",
        branchNo: 1,
        branchName: "Smichov",
        locale: "en",
        latitude: 50.07,
        longitude: 14.4,
        ...overrides,
    };
}

function renderList(props: Partial<React.ComponentProps<typeof BranchListView>> = {}) {
    const onSelectBranch = jest.fn<void, [IBranch]>();
    const onUseNearestBranch = jest.fn<void, []>();
    const defaultBranches = [branch(), branch({ id: "b2", branchName: "Karlin", latitude: null, longitude: null })];
    render(
        <I18nextProvider i18n={i18n}>
            <BranchListView
                branches={defaultBranches}
                distances={null}
                nearestBranchId={null}
                onSelectBranch={onSelectBranch}
                onUseNearestBranch={onUseNearestBranch}
                locating={false}
                locationError={null}
                {...props}
            />
        </I18nextProvider>
    );
    return { onSelectBranch, onUseNearestBranch };
}

describe("BranchListView", () => {
    it("renders every branch by name", () => {
        renderList();

        expect(screen.getByText("Smichov")).toBeTruthy();
        expect(screen.getByText("Karlin")).toBeTruthy();
    });

    it("shows no distance text for a branch whose distance is null", () => {
        renderList({
            distances: { b1: 3.4, b2: null },
            nearestBranchId: "b1",
        });

        expect(screen.getByText(/3\.4 km away/i)).toBeTruthy();
        // Karlin (b2) has a null distance — its row must not render a distance line.
        const karlinRow = screen.getByText("Karlin").closest("button");
        expect(karlinRow?.textContent).not.toMatch(/km away/i);
    });

    it("fires onUseNearestBranch when the nearest button is clicked", () => {
        const { onUseNearestBranch } = renderList();

        fireEvent.click(screen.getByRole("button", { name: /use nearest branch/i }));

        expect(onUseNearestBranch).toHaveBeenCalledTimes(1);
    });

    it("fires onSelectBranch with the tapped branch", () => {
        const { onSelectBranch } = renderList();

        fireEvent.click(screen.getByText("Smichov"));

        expect(onSelectBranch).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
    });

    it("renders locating state on the nearest-branch button", () => {
        renderList({ locating: true });

        expect(screen.getByRole("button", { name: /use nearest branch/i }).hasAttribute("disabled")).toBe(true);
    });

    it("renders a location error inline", () => {
        renderList({ locationError: "Allow location access and try again." });

        expect(screen.getByText(/allow location access/i)).toBeTruthy();
    });

    it("prints a branch's address under its name, and nothing for a branch without one", () => {
        renderList({
            branches: [
                branch({ address: "Plzenska 8" }),
                branch({ id: "b2", branchName: "Karlin", address: null }),
            ],
        });

        expect(screen.getByText("Plzenska 8")).toBeTruthy();
        const karlinRow = screen.getByTestId("branch-option-b2");
        expect(karlinRow.textContent).toBe("Karlin");
        expect(screen.queryByText("Address not specified")).toBeNull();
    });

    // The badge used to be glued onto the name ("Smichov · Nearest"), so the name alone matched
    // nothing.
    it("shows the nearest badge as its own label beside the name", () => {
        renderList({ nearestBranchId: "b1" });

        expect(screen.getByText("Nearest")).toBeTruthy();
        expect(screen.getByText("Smichov")).toBeTruthy();
    });

    describe("in Arabic", () => {
        afterEach(async () => {
            await i18n.changeLanguage("en");
        });

        it("names each branch in Arabic", async () => {
            await i18n.changeLanguage("ar");
            renderList({ branches: [branch({ branchNameAr: "فرع سميخوف" })] });

            expect(screen.getByText("فرع سميخوف")).toBeTruthy();
            expect(screen.queryByText("Smichov")).toBeNull();
        });
    });
});
