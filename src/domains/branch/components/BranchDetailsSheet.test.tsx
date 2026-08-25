import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { BranchDetailsSheet } from "./BranchDetailsSheet";
import { fetchBaseAppInfo } from "../../../shared/api/public";
import type { BaseAppInfoResponse } from "../../order/types";
import type { CartItem } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";

jest.mock("../../../shared/api/public");

const mockFetch = jest.mocked(fetchBaseAppInfo);

const BRANCH: IBranch = {
    id: "b1", externalId: "ext-1", branchNo: 1, branchName: "Karlin",
    locale: "en", latitude: 50.0925, longitude: 14.4483, address: "Sokolovska 100",
};

// Open 00:00–23:59 every day, so the sheet always finds a shift in progress regardless of when
// the suite runs — this file is about what the sheet renders, not about clock arithmetic
// (getClosingTime has its own tests).
const OPEN_ALL_DAY = { isOpen: true, shifts: [["00:00", "23:59"]] };
const ALWAYS_OPEN = {
    Sunday: OPEN_ALL_DAY, Monday: OPEN_ALL_DAY, Tuesday: OPEN_ALL_DAY, Wednesday: OPEN_ALL_DAY,
    Thursday: OPEN_ALL_DAY, Friday: OPEN_ALL_DAY, Saturday: OPEN_ALL_DAY,
};

function baseInfo(overrides: Partial<BaseAppInfoResponse> = {}): BaseAppInfoResponse {
    return {
        menu: [{ name: "Cola", available: true }] as unknown as BaseAppInfoResponse["menu"],
        extraIngr: [], toppings: [], isSDoughAvailable: true, userInfo: null,
        workingHours: ALWAYS_OPEN as unknown as BaseAppInfoResponse["workingHours"],
        ...overrides,
    };
}

const COLA = { name: "Cola", quantity: 1, amount: 0.49 } as unknown as CartItem;

function renderSheet(props: Partial<React.ComponentProps<typeof BranchDetailsSheet>> = {}) {
    const onConfirm = jest.fn<void, [IBranch]>();
    const onClose = jest.fn<void, []>();
    render(
        <I18nextProvider i18n={i18n}>
            <BranchDetailsSheet branch={BRANCH} cartItems={[]} onConfirm={onConfirm} onClose={onClose} {...props} />
        </I18nextProvider>
    );
    return { onConfirm, onClose };
}

describe("BranchDetailsSheet", () => {
    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(baseInfo());
    });

    it("names the branch and prints its address", async () => {
        renderSheet();

        expect(screen.getByText("Karlin")).toBeTruthy();
        expect(screen.getByText("Sokolovska 100")).toBeTruthy();
    });

    // A branch row can exist before anyone fills its street address in; an empty line under the
    // name reads as a rendering fault rather than as missing data.
    it("says so rather than printing an empty line when the branch has no address", async () => {
        renderSheet({ branch: { ...BRANCH, address: null } });

        expect(screen.getByText("Address not specified")).toBeTruthy();
    });

    it("shows the closing time of the shift in progress", async () => {
        renderSheet();

        expect(await screen.findByText(/Open until 00:00/)).toBeTruthy();
    });

    it("says it is closed when no shift is running", async () => {
        mockFetch.mockResolvedValue(baseInfo({ workingHours: null }));
        renderSheet();

        expect(await screen.findByText("Closed right now")).toBeTruthy();
    });

    it("offers a route link pointing at the branch's own coordinates", () => {
        renderSheet();

        const route = screen.getByRole("link", { name: /route/i });
        expect(route.getAttribute("href")).toBe(
            "https://www.google.com/maps/dir/?api=1&destination=50.0925,14.4483"
        );
    });

    // Routing to 0,0 would be worse than offering nothing at all.
    it("hides the route link for a branch with no coordinates", () => {
        renderSheet({ branch: { ...BRANCH, latitude: null, longitude: null } });

        expect(screen.queryByRole("link", { name: /route/i })).toBeNull();
    });

    it("stays silent about availability when the cart is empty", async () => {
        renderSheet();

        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
        expect(screen.queryByText(/available at Karlin/)).toBeNull();
    });

    it("confirms the cart survives the move when every item is available", async () => {
        renderSheet({ cartItems: [COLA] });

        expect(await screen.findByText(/Everything in your cart is available at Karlin/)).toBeTruthy();
    });

    it("names the items this branch cannot make", async () => {
        mockFetch.mockResolvedValue(baseInfo({ menu: [] }));
        renderSheet({ cartItems: [COLA] });

        const items = await screen.findAllByTestId("branch-details-unavailable-item");
        expect(items.map((item) => item.textContent)).toEqual(["• Cola"]);
    });

    it("chooses the branch only when the customer taps the CTA", async () => {
        const { onConfirm } = renderSheet();

        expect(onConfirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /order here/i }));

        expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
    });

    it("asks nothing while it is shut", () => {
        renderSheet({ branch: null });

        expect(mockFetch).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: /order here/i })).toBeNull();
    });
});
