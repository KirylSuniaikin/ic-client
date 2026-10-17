import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import i18n from "../../../shared/i18n";
import { BranchListView } from "./BranchListView";
import type { IBranch } from "../../management/inventory/types";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";

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

    // A <button> row does not inherit the page font, and the badge is the one piece of plain text
    // in it: it rendered in the browser's own button font while the name beside it did not.
    it("lets the row inherit the page font, so the Nearest badge matches the name", () => {
        renderList({ nearestBranchId: "b1" });

        expect(emotionRulesFor(screen.getByTestId("branch-option-b1"))).toContain("font-family:inherit");
    });

    describe("in Arabic", () => {
        afterEach(async () => {
            await i18n.changeLanguage("en");
        });

        // In an RTL row a Latin address used to lose its start ("…g 123, Road 45, …"). dir="auto"
        // makes it truncate at its own end, and the alignment still follows the row: the RTL
        // stylis plugin turns "left" into "right".
        it("truncates a Latin address at its own end while keeping it on the row's start edge", async () => {
            await i18n.changeLanguage("ar");
            // The key starts with "css-" only so that emotionRulesFor, which reads css-* classes,
            // can see the flipped rules.
            const rtlCache = createCache({ key: "css-rtl", stylisPlugins: [prefixer, rtlPlugin] });
            render(
                <CacheProvider value={rtlCache}>
                    <ThemeProvider theme={createTheme({ direction: "rtl" })}>
                        <I18nextProvider i18n={i18n}>
                            <BranchListView
                                branches={[branch({ address: "Building 123, Road 45, Block 901, Riffa" })]}
                                distances={null}
                                nearestBranchId={null}
                                onSelectBranch={jest.fn<void, [IBranch]>()}
                                onUseNearestBranch={jest.fn<void, []>()}
                                locating={false}
                                locationError={null}
                            />
                        </I18nextProvider>
                    </ThemeProvider>
                </CacheProvider>
            );

            const address = screen.getByText("Building 123, Road 45, Block 901, Riffa");
            expect(address.getAttribute("dir")).toBe("auto");
            expect(emotionRulesFor(address)).toContain("text-align:right");
        });

        it("names each branch in Arabic", async () => {
            await i18n.changeLanguage("ar");
            renderList({ branches: [branch({ branchNameAr: "فرع سميخوف" })] });

            expect(screen.getByText("فرع سميخوف")).toBeTruthy();
            expect(screen.queryByText("Smichov")).toBeNull();
        });
    });
});
