import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { BranchDetailsContent } from "./BranchDetailsContent";
import { fetchBaseAppInfo } from "../../../shared/api/public";
import { emotionRulesFor } from "../../management/couriers/components/emotionRules.testutil";
import type { BranchShowcaseView } from "../utils/branchShowcase";
import type { BaseAppInfoResponse } from "../../order/types";
import type { IBranch } from "../../management/inventory/types";

jest.mock("../../../shared/api/public");

// The real config ships empty, so every test says what this branch's showcase is. The `mock`
// prefix is what lets the hoisted factory close over it (as BranchMapView.test.tsx does).
let mockShowcase: BranchShowcaseView | null = null;
jest.mock("../utils/branchShowcase", () => ({ getBranchShowcase: () => mockShowcase }));

const mockFetch = jest.mocked(fetchBaseAppInfo);

const BRANCH: IBranch = {
    id: "b1", externalId: "ext-1", branchNo: 1, branchName: "Karlin",
    locale: "en", latitude: 50.0925, longitude: 14.4483, address: "Sokolovska 100",
};

function baseInfo(): BaseAppInfoResponse {
    return {
        menu: [] as unknown as BaseAppInfoResponse["menu"],
        extraIngr: [], toppings: [], isSDoughAvailable: true, userInfo: null, workingHours: null,
    };
}

function photos(count: number): BranchShowcaseView["photos"] {
    return Array.from({ length: count }, (_, index) => ({ src: `/branchImages/1/0${index + 1}.webp`, alt: null }));
}

function renderContent(props: Partial<React.ComponentProps<typeof BranchDetailsContent>> = {}) {
    const onConfirm = jest.fn<void, [IBranch]>();
    const view = render(
        <I18nextProvider i18n={i18n}>
            <BranchDetailsContent branch={BRANCH} cartItems={[]} layout="sheet" onConfirm={onConfirm} {...props} />
        </I18nextProvider>
    );
    return { onConfirm, ...view };
}

describe("BranchDetailsContent", () => {
    beforeEach(() => {
        mockShowcase = null;
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(baseInfo());
    });

    it("shows the photos in a labelled row instead of the roundel", () => {
        mockShowcase = { photos: photos(3), findUs: null };
        renderContent();

        const strip = screen.getByRole("region", { name: "Photos of Karlin" });
        const images = within(strip).getAllByRole("img");
        expect(images.map((image) => image.getAttribute("alt"))).toEqual([
            "Karlin, photo 1", "Karlin, photo 2", "Karlin, photo 3",
        ]);
        expect(screen.queryByTestId("branch-details-hero")).toBeNull();
    });

    it("drops a photo that fails to load, and falls back to the roundel when all of them do", () => {
        mockShowcase = { photos: photos(3), findUs: null };
        renderContent();

        fireEvent.error(screen.getByRole("img", { name: "Karlin, photo 2" }));

        expect(screen.queryByRole("img", { name: "Karlin, photo 2" })).toBeNull();
        expect(screen.getAllByRole("img")).toHaveLength(2);

        // One at a time: once a single photo is left it is re-rendered as the wide card, so a node
        // collected before that is no longer the one on screen.
        fireEvent.error(screen.getByRole("img", { name: "Karlin, photo 1" }));
        fireEvent.error(screen.getByRole("img", { name: "Karlin, photo 3" }));

        expect(screen.queryAllByRole("img")).toHaveLength(0);
        expect(screen.getByTestId("branch-details-hero")).toBeTruthy();
    });

    it("shows the storefront roundel for a branch with no photos", () => {
        renderContent();

        expect(screen.getByTestId("branch-details-hero")).toBeTruthy();
        expect(screen.queryAllByRole("img")).toHaveLength(0);
    });

    // A lone 4:5 card would leave most of the row empty.
    it("shows a single photo as one wide card", () => {
        mockShowcase = { photos: photos(1), findUs: null };
        renderContent();

        const images = screen.getAllByRole("img");
        expect(images).toHaveLength(1);
        const card = images[0].parentElement;
        if (card === null) throw new Error("the photo has no card around it");
        // jsdom's CSSOM may drop the spaces around the slash.
        expect(emotionRulesFor(card)).toMatch(/aspect-ratio:16 ?\/ ?9/);
    });

    describe("how to find us", () => {
        afterEach(async () => {
            await i18n.changeLanguage("en");
        });

        it("shows the note in English", () => {
            mockShowcase = { photos: [], findUs: "Next to the pharmacy, ground floor." };
            renderContent();

            const card = screen.getByTestId("branch-details-find-us");
            expect(within(card).getByText("How to find us")).toBeTruthy();
            expect(within(card).getByText("Next to the pharmacy, ground floor.")).toBeTruthy();
        });

        it("shows the note in Arabic", async () => {
            await i18n.changeLanguage("ar");
            mockShowcase = { photos: [], findUs: "بجانب الصيدلية، الطابق الأرضي." };
            renderContent();

            const card = screen.getByTestId("branch-details-find-us");
            expect(within(card).getByText("كيف تصل إلينا")).toBeTruthy();
            expect(within(card).getByText("بجانب الصيدلية، الطابق الأرضي.")).toBeTruthy();
        });

        it("is absent when the branch has no note", () => {
            renderContent();

            expect(screen.queryByTestId("branch-details-find-us")).toBeNull();
        });
    });

    // On PC the CTA must stay in reach however long the column gets.
    it("pins Order here under the scrolling body in the pane layout", () => {
        renderContent({ layout: "pane" });

        const scroll = screen.getByTestId("branch-details-scroll");
        expect(within(scroll).getByText("Karlin")).toBeTruthy();
        expect(within(scroll).queryByRole("button", { name: /order here/i })).toBeNull();
        expect(screen.getByRole("button", { name: /order here/i })).toBeTruthy();
    });

    it("scrolls as one piece in the sheet layout", () => {
        renderContent({ layout: "sheet" });

        expect(screen.queryByTestId("branch-details-scroll")).toBeNull();
    });

    it("moves focus to the branch name when asked to", () => {
        renderContent({ layout: "pane", autoFocusHeading: true });

        expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Karlin" }));
    });

    it("asks for the branch's details exactly once per mount", async () => {
        const { rerender } = renderContent();

        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
        rerender(
            <I18nextProvider i18n={i18n}>
                <BranchDetailsContent branch={BRANCH} cartItems={[]} layout="sheet" onConfirm={jest.fn<void, [IBranch]>()} />
            </I18nextProvider>
        );

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(null, "b1");
    });
});
