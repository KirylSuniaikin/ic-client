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
};

const OTHER_BRANCH: IBranch = {
    id: "999",
    externalId: "ext-2",
    branchNo: 2,
    branchName: "Muharraq Branch",
    locale: "en",
};

function renderHero(branches: IBranch[]) {
    return render(
        <CustomerAuthProvider>
            <CustomerAuthUiProvider>
                <HeroSection isKiosk={false} branches={branches} workingHours={null} />
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
});
