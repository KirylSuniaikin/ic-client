import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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

const CLOSED_DAY = { isOpen: false, shifts: [] };
const CLOSED_WEEK = {
    Sunday: CLOSED_DAY, Monday: CLOSED_DAY, Tuesday: CLOSED_DAY, Wednesday: CLOSED_DAY,
    Thursday: CLOSED_DAY, Friday: CLOSED_DAY, Saturday: CLOSED_DAY,
};

const COLA = { name: "Cola", quantity: 1, amount: 0.49 } as unknown as CartItem;

function renderSheet(props: Partial<React.ComponentProps<typeof BranchDetailsSheet>> = {}) {
    const onConfirm = jest.fn<void, [IBranch]>();
    const onClose = jest.fn<void, []>();
    const sheet = (overrides: Partial<React.ComponentProps<typeof BranchDetailsSheet>>): JSX.Element => (
        <I18nextProvider i18n={i18n}>
            <BranchDetailsSheet branch={BRANCH} cartItems={[]} onConfirm={onConfirm} onClose={onClose} {...overrides} />
        </I18nextProvider>
    );
    const view = render(sheet(props));
    const rerender = (overrides: Partial<React.ComponentProps<typeof BranchDetailsSheet>>): void => {
        view.rerender(sheet({ ...props, ...overrides }));
    };
    return { onConfirm, onClose, rerender };
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

    // A closed week rather than `workingHours: null`: null now means "no schedule", which reads
    // as open, the same answer the header and the order gate give.
    it("says it is closed when no shift is running", async () => {
        mockFetch.mockResolvedValue(baseInfo({
            workingHours: CLOSED_WEEK as unknown as BaseAppInfoResponse["workingHours"],
        }));
        renderSheet();

        expect(await screen.findByText("Closed right now")).toBeTruthy();
        // No opening in the next seven days: there is no time to promise.
        expect(screen.queryByTestId("branch-details-reopens")).toBeNull();
    });

    // The old sheet said "Closed right now" until the answer came back.
    it("says it is checking the hours, never closed, while the fetch is pending", () => {
        mockFetch.mockReturnValue(new Promise<BaseAppInfoResponse>(() => undefined));
        renderSheet();

        expect(screen.getByTestId("branch-details-hours").textContent).toBe("Checking hours…");
        expect(screen.queryByText(/closed/i)).toBeNull();
    });

    it("shows no hours at all when the fetch fails, rather than calling the branch closed", async () => {
        mockFetch.mockRejectedValue(new Error("Network error"));
        renderSheet();

        await waitFor(() => expect(screen.queryByTestId("branch-details-hours")).toBeNull());
        expect(screen.queryByText("Closed right now")).toBeNull();
    });

    it("reads a branch with no schedule as open now", async () => {
        mockFetch.mockResolvedValue(baseInfo({ workingHours: null }));
        renderSheet();

        expect(await screen.findByText("Open now")).toBeTruthy();
    });

    // A closed branch says so in the pill and says when it reopens on a line of its own under the
    // pills, so the pill stays short enough to share one row with Route.
    describe("on a fixed clock (Sunday 11:00 in Bahrain)", () => {
        beforeEach(() => {
            // Jest 27's modern timers cannot leave setTimeout real ("doNotFake" arrived in Jest
            // 28). RTL's waitFor detects the fake clock and advances it itself, as
            // DeliveryBoardPanel.test.tsx relies on.
            jest.useFakeTimers();
            jest.setSystemTime(new Date("2026-07-12T08:00:00.000Z"));
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        function closedExcept(open: Record<string, { isOpen: boolean; shifts: string[][] }>): BaseAppInfoResponse["workingHours"] {
            return { ...CLOSED_WEEK, ...open } as unknown as BaseAppInfoResponse["workingHours"];
        }

        it("says a closed branch opens tomorrow, and at what time", async () => {
            mockFetch.mockResolvedValue(baseInfo({
                workingHours: closedExcept({ Monday: { isOpen: true, shifts: [["15:00", "23:59"]] } }),
            }));
            renderSheet();

            expect((await screen.findByTestId("branch-details-reopens")).textContent).toBe("Opens tomorrow at 15:00");
            expect(screen.getByTestId("branch-details-hours").textContent).toBe("Closed right now");
        });

        it("says a closed branch opens later today, and at what time", async () => {
            mockFetch.mockResolvedValue(baseInfo({
                workingHours: closedExcept({ Sunday: { isOpen: true, shifts: [["18:00", "23:59"]] } }),
            }));
            renderSheet();

            expect((await screen.findByTestId("branch-details-reopens")).textContent).toBe("Opens today at 18:00");
        });

        // The only label that reads its day name from another namespace (schedule:days.*): a
        // wrong key path would print "Opens days.Wednesday at 16:30".
        it("names the weekday a branch two or more days away reopens on", async () => {
            mockFetch.mockResolvedValue(baseInfo({
                workingHours: closedExcept({ Wednesday: { isOpen: true, shifts: [["16:30", "23:00"]] } }),
            }));
            renderSheet();

            expect((await screen.findByTestId("branch-details-reopens")).textContent).toBe("Opens Wednesday at 16:30");
        });

        // Read on a Sunday afternoon, "Opens Sunday at 10:00" sounds like later today.
        it("says next week when the only open day is today and today's shift is over", async () => {
            jest.setSystemTime(new Date("2026-07-12T11:00:00.000Z")); // Sunday 14:00 in Bahrain
            mockFetch.mockResolvedValue(baseInfo({
                workingHours: closedExcept({ Sunday: { isOpen: true, shifts: [["10:00", "13:00"]] } }),
            }));
            renderSheet();

            expect((await screen.findByTestId("branch-details-reopens")).textContent).toBe("Opens next Sunday at 10:00");
        });

        describe("in Arabic", () => {
            afterEach(async () => {
                await i18n.changeLanguage("en");
            });

            it("names the weekday", async () => {
                await i18n.changeLanguage("ar");
                mockFetch.mockResolvedValue(baseInfo({
                    workingHours: closedExcept({ Wednesday: { isOpen: true, shifts: [["16:30", "23:00"]] } }),
                }));
                renderSheet();

                expect((await screen.findByTestId("branch-details-reopens")).textContent).toBe("يفتح يوم الأربعاء الساعة 16:30");
                expect(screen.getByTestId("branch-details-hours").textContent).toBe("مغلق الآن");
            });

            it("says next week", async () => {
                await i18n.changeLanguage("ar");
                jest.setSystemTime(new Date("2026-07-12T11:00:00.000Z")); // Sunday 14:00 in Bahrain
                mockFetch.mockResolvedValue(baseInfo({
                    workingHours: closedExcept({ Sunday: { isOpen: true, shifts: [["10:00", "13:00"]] } }),
                }));
                renderSheet();

                expect((await screen.findByTestId("branch-details-reopens")).textContent).toBe("يفتح يوم الأحد القادم الساعة 10:00");
            });
        });
    });

    // Statement, not action: only the route next to it may look or behave pressable.
    it("renders the hours as a status, never as a link or a button", async () => {
        renderSheet();

        await screen.findByText(/Open until 00:00/);
        const pill = screen.getByTestId("branch-details-hours");
        expect(pill.getAttribute("role")).toBe("status");
        expect(within(pill).queryByRole("link")).toBeNull();
        expect(within(pill).queryByRole("button")).toBeNull();
    });

    it("prints how far away the branch is once a distance is known", () => {
        renderSheet({ distanceKm: 2.44 });

        expect(screen.getByText("2.4 km away")).toBeTruthy();
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

    // The Drawer keeps painting while it slides away; a blank title and "Address not specified"
    // flashing past read as a glitch.
    it("keeps describing the branch while the sheet is closing", () => {
        const { rerender } = renderSheet();

        rerender({ branch: null });

        expect(screen.getByText("Karlin")).toBeTruthy();
        expect(screen.getByText("Sokolovska 100")).toBeTruthy();
        expect(screen.queryByText("Address not specified")).toBeNull();
    });

    it("closes from its own close button", () => {
        const { onClose } = renderSheet();

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    describe("in Arabic", () => {
        afterEach(async () => {
            await i18n.changeLanguage("en");
        });

        it("names the branch in Arabic and calls the route link directions", async () => {
            await i18n.changeLanguage("ar");
            renderSheet({ branch: { ...BRANCH, branchNameAr: "فرع كارلين" } });

            expect(screen.getByText("فرع كارلين")).toBeTruthy();
            expect(screen.getByRole("link", { name: "الاتجاهات" })).toBeTruthy();
        });
    });

    it("asks nothing while it is shut", () => {
        renderSheet({ branch: null });

        expect(mockFetch).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: /order here/i })).toBeNull();
    });
});
