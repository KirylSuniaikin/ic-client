import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { act, render, screen } from "@testing-library/react";
// i18n instance (side-effect import) so the orderStatus.* keys resolve under English.
import "../../../shared/i18n";

import { CourierStatusLines } from "./CourierStatusLines";
import type { TrackedCourier } from "../types";

function courier(overrides: Partial<TrackedCourier> = {}): TrackedCourier {
    return {
        name: "Ali",
        latitude: 26.2285,
        longitude: 50.586,
        positionAgeSeconds: 10,
        partIndex: 1,
        bearingDegrees: null,
        etaSeconds: null,
        ...overrides,
    };
}

function sara(overrides: Partial<TrackedCourier> = {}): TrackedCourier {
    return courier({ name: "Sara", partIndex: 2, ...overrides });
}

function caption(partIndex: number): string | null {
    return screen.getByTestId(`courier-caption-${partIndex}`).textContent;
}

function updated(partIndex: number): string | null {
    return screen.getByTestId(`courier-updated-${partIndex}`).textContent;
}

describe("CourierStatusLines", () => {
    describe("who is riding and how long until the door", () => {
        it("names the rider and the minutes left when the forecast is known", () => {
            render(<CourierStatusLines couriers={[courier({ etaSeconds: 300 })]} />);

            expect(caption(1)).toBe("Ali is on the way · ~5 min");
        });

        it("rounds part of a minute up, so it never promises the rider sooner than forecast", () => {
            render(<CourierStatusLines couriers={[courier({ etaSeconds: 301 })]} />);

            expect(caption(1)).toBe("Ali is on the way · ~6 min");
        });

        it('never says "~0 min" while the rider is still out', () => {
            render(<CourierStatusLines couriers={[courier({ etaSeconds: 0 })]} />);

            expect(caption(1)).toBe("Ali is on the way · ~1 min");
        });

        it("drops the minutes when the forecast is unknown", () => {
            render(<CourierStatusLines couriers={[courier({ etaSeconds: null })]} />);

            expect(caption(1)).toBe("Ali is on the way");
        });

        it("labels each part of a split order, with its own minutes when that part's forecast is known", () => {
            render(<CourierStatusLines couriers={[courier({ etaSeconds: 240 }), sara({ etaSeconds: null })]} />);

            expect(caption(1)).toBe("Part 1 · Ali · ~4 min");
            expect(caption(2)).toBe("Part 2 · Sara");
        });

        // Part 1 is out, part 2 is still in the kitchen: one rider, but their minutes are not the
        // whole order's.
        it.each([
            [360, "Part 1 · Ali · ~6 min"],
            [null, "Part 1 · Ali"],
        ])("labels a lone rider by part when the order is split (eta %p s)", (etaSeconds, expected) => {
            render(<CourierStatusLines couriers={[courier({ etaSeconds })]} split />);

            expect(caption(1)).toBe(expected);
        });
    });

    describe("how fresh the position is", () => {
        it.each([
            [0, "Updated 0 s ago"],
            [59, "Updated 59 s ago"],
            [60, "Updated 1 min ago"],
            [125, "Updated 2 min ago"],
        ])("reads a %i s old fix as %p", (age, expected) => {
            render(<CourierStatusLines couriers={[courier({ positionAgeSeconds: age })]} />);

            expect(updated(1)).toBe(expected);
        });

        describe("between polls", () => {
            beforeEach(() => {
                jest.useFakeTimers();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            it("ticks every second from the fix's age, and switches to minutes at 60 s", () => {
                render(<CourierStatusLines couriers={[courier({ positionAgeSeconds: 10 })]} />);
                expect(updated(1)).toBe("Updated 10 s ago");

                act(() => {
                    jest.advanceTimersByTime(1_000);
                });
                expect(updated(1)).toBe("Updated 11 s ago");

                act(() => {
                    jest.advanceTimersByTime(49_000);
                });
                expect(updated(1)).toBe("Updated 1 min ago");
            });

            it("starts again from the new fix's age when the next poll lands", () => {
                const { rerender } = render(<CourierStatusLines couriers={[courier({ positionAgeSeconds: 10 })]} />);
                act(() => {
                    jest.advanceTimersByTime(14_000);
                });
                expect(updated(1)).toBe("Updated 24 s ago");

                // A poll always hands over a fresh array, even when the fix is the same one.
                rerender(<CourierStatusLines couriers={[courier({ positionAgeSeconds: 3 })]} />);
                expect(updated(1)).toBe("Updated 3 s ago");

                act(() => {
                    jest.advanceTimersByTime(2_000);
                });
                expect(updated(1)).toBe("Updated 5 s ago");
            });

            it("does not restart the clock on a re-render that brings no new poll", () => {
                const couriers = [courier({ positionAgeSeconds: 10 })];
                const { rerender } = render(<CourierStatusLines couriers={couriers} />);
                act(() => {
                    jest.advanceTimersByTime(5_000);
                });

                rerender(<CourierStatusLines couriers={couriers} />);

                expect(updated(1)).toBe("Updated 15 s ago");
            });

            it("ticks every rider's line from one shared timer", () => {
                render(<CourierStatusLines couriers={[courier({ positionAgeSeconds: 10 }), sara({ positionAgeSeconds: 40 })]} />);

                expect(jest.getTimerCount()).toBe(1);
                act(() => {
                    jest.advanceTimersByTime(3_000);
                });
                expect(updated(1)).toBe("Updated 13 s ago");
                expect(updated(2)).toBe("Updated 43 s ago");
            });

            it("stops its timer on unmount", () => {
                const { unmount } = render(<CourierStatusLines couriers={[courier()]} />);

                unmount();

                expect(jest.getTimerCount()).toBe(0);
            });
        });
    });
});
