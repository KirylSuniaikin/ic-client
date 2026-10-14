import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";

// HeroSection renders CustomerIconButton, which needs CustomerAuthProvider + a
// mocked network layer — mirrors CustomerIconButton.test.tsx's setup. It also
// renders LanguageToggle, which reads i18n.language — initialize the real i18n
// instance (side effect import), the same way app/providers.tsx bootstraps it.
import "../shared/i18n";
jest.mock("../shared/api/customerAuth");

import { refreshCustomerToken } from "../shared/api/customerAuth";
import { CustomerAuthProvider, __resetCustomerAuthStoreForTests } from "../domains/customer-auth/context/CustomerAuthProvider";
import { CustomerAuthUiProvider } from "../domains/customer-auth/context/CustomerAuthUiProvider";
import { DEFAULT_BRANCH_ID } from "../shared/api/client";
import HeroSection from "./HeroSection";
import type { IBranch } from "../domains/management/inventory/types";

const mockRefreshCustomerToken = jest.mocked(refreshCustomerToken);

// IBranch.id is a UUID string; use the default branch id so resolveBranchName matches.
const MATCHING_BRANCH: IBranch = {
    id: DEFAULT_BRANCH_ID,
    externalId: "ext-1",
    branchNo: 1,
    branchName: "Manama Branch",
    locale: "en",
    latitude: null,
    longitude: null,
};

const OTHER_BRANCH: IBranch = {
    id: "999",
    externalId: "ext-2",
    branchNo: 2,
    branchName: "Muharraq Branch",
    locale: "en",
    latitude: null,
    longitude: null,
};

function renderHero(branches: IBranch[], isKiosk = false, onBranchClick?: () => void) {
    return render(
        <CustomerAuthProvider>
            <CustomerAuthUiProvider>
                <HeroSection isKiosk={isKiosk} branches={branches} workingHours={null} onBranchClick={onBranchClick} />
            </CustomerAuthUiProvider>
        </CustomerAuthProvider>
    );
}

beforeAll(() => {
    jest.spyOn(console, "debug").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockRefreshCustomerToken.mockReset();
    mockRefreshCustomerToken.mockRejectedValue(new Error("no session"));
    __resetCustomerAuthStoreForTests();
});

describe("HeroSection", () => {
    it("renders the branch name matching DEFAULT_BRANCH_ID", () => {
        renderHero([OTHER_BRANCH, MATCHING_BRANCH]);

        expect(screen.getByText("Manama Branch")).toBeTruthy();
    });

    it("falls back to 'IC Pizza' when no branch matches DEFAULT_BRANCH_ID", () => {
        renderHero([OTHER_BRANCH]);

        expect(screen.getByText("IC Pizza")).toBeTruthy();
    });

    it("still renders the existing top-right cluster controls", () => {
        renderHero([MATCHING_BRANCH]);

        expect(screen.getByRole("button", { name: "toggle language" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "log in" })).toBeTruthy();
    });

    it("hides the account button in kiosk mode but keeps the language toggle", () => {
        // Kiosk is a shared guest tablet — no personal account entry point.
        renderHero([MATCHING_BRANCH], true);

        expect(screen.getByRole("button", { name: "toggle language" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "log in" })).toBeNull();
    });

    // The hero video is several MB and mounts alongside the menu photos, so it must not buffer
    // eagerly; and the old poster path pointed at public/images/, a directory that does not exist.
    it("does not eagerly buffer the hero video and requests no poster", () => {
        const { container } = renderHero([MATCHING_BRANCH]);

        const video = container.querySelector("video");

        expect(video?.getAttribute("preload")).toBe("metadata");
        expect(video?.hasAttribute("poster")).toBe(false);
    });

    // The hero-scrolled-away check reads getBoundingClientRect().bottom; jsdom returns 0 for every
    // element, so a strict `< 0` keeps the header visible by default and only hides it once the hero
    // has genuinely scrolled above the viewport (negative bottom). Stub the rect to drive both paths.
    // getBoundingClientRect returns a DOMRect; this stub only needs `bottom`, hence the cast.
    const rectWithBottom = (bottom: number): DOMRect =>
        ({ top: 0, left: 0, right: 0, bottom, width: 0, height: 0, x: 0, y: 0, toJSON: () => undefined } as DOMRect);

    it("keeps the schedule header while the hero video is still on screen", () => {
        const rectSpy = jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(rectWithBottom(500));

        renderHero([MATCHING_BRANCH]);

        expect(screen.getByText("Manama Branch")).toBeTruthy();
        rectSpy.mockRestore();
    });

    it("hides the schedule header once the hero video has scrolled above the viewport", () => {
        const rectSpy = jest.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(rectWithBottom(-10));

        renderHero([MATCHING_BRANCH]);

        expect(screen.queryByText("Manama Branch")).toBeNull();
        rectSpy.mockRestore();
    });

    // Re-entry chip (task-spec.md §6.4).
    // The separate chip was removed: BranchScheduleHeader already prints the branch name, so the
    // chip showed the same branch a second time. The name itself is now the picker trigger, and
    // these tests assert that one label carries both jobs rather than that a chip exists.
    describe("branch name as the picker trigger", () => {
        it("is a plain label, not a button, when no handler is provided", () => {
            renderHero([MATCHING_BRANCH]);

            expect(screen.queryByRole("button", { name: /change branch/i })).toBeNull();
            // Still printed — losing the name entirely would be a regression, not a fix.
            expect(screen.getByText("Manama Branch")).toBeTruthy();
        });

        it("renders the resolved name once and calls the handler on tap", () => {
            const onBranchClick = jest.fn();
            renderHero([OTHER_BRANCH, MATCHING_BRANCH], false, onBranchClick);

            // Exactly one node carries the name — the duplication this change removed.
            expect(screen.getAllByText("Manama Branch")).toHaveLength(1);

            const trigger = screen.getByRole("button", { name: /change branch/i });
            trigger.click();
            expect(onBranchClick).toHaveBeenCalledTimes(1);
        });

        it("stays a plain label on kiosk, even with a handler provided", () => {
            renderHero([MATCHING_BRANCH], true, jest.fn());

            // The branch is not the customer's to change on a shared in-store tablet.
            expect(screen.queryByRole("button", { name: /change branch/i })).toBeNull();
        });
    });
});
