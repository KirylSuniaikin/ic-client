import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DateRangePickerPopover } from "./DateRangePickerPopover";
import { emotionRulesFor } from "../../../couriers/components/emotionRules.testutil";
import type { DateRangeState } from "../../types";

// Noon on 19 Oct 2026: every fast pick ends on this day.
const TODAY = new Date(2026, 9, 19, 12, 0);
const END_OF_TODAY = new Date(2026, 9, 19, 23, 59, 59, 999);

// Holds the range the way StatisticsComponent and the order history do, so the calendar redraws
// with each pick exactly as it does on screen.
function RangeHarness({ onRangeChange, onApply, rangeKey = "selection", initial }: {
    onRangeChange: (range: DateRangeState[]) => void;
    onApply: () => void;
    rangeKey?: string;
    initial?: { startDate: Date; endDate: Date };
}): JSX.Element {
    const [range, setRange] = React.useState<DateRangeState[]>([
        { startDate: new Date(2026, 9, 19), endDate: new Date(2026, 9, 19), ...initial, key: rangeKey },
    ]);
    return (
        <DateRangePickerPopover
            mode="range"
            open
            anchorEl={document.body}
            onClose={() => undefined}
            range={range}
            onRangeChange={(next) => { onRangeChange(next); setRange(next); }}
            applyLabel="Apply"
            onApply={onApply}
        />
    );
}

describe("DateRangePickerPopover", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(TODAY);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe("fast picks in range mode", () => {
        it.each([
            { label: "Last 3 months", start: new Date(2026, 6, 19) },
            { label: "Last 6 months", start: new Date(2026, 3, 19) },
            { label: "Last year", start: new Date(2025, 9, 19) },
        ])("selects $label, ending today", ({ label, start }) => {
            const onRangeChange = jest.fn<void, [DateRangeState[]]>();
            render(<RangeHarness onRangeChange={onRangeChange} onApply={() => undefined} />);

            fireEvent.click(screen.getByRole("button", { name: label }));

            expect(onRangeChange).toHaveBeenCalledWith([{ startDate: start, endDate: END_OF_TODAY, key: "selection" }]);
        });

        it("shows the picked range as the calendar's selection", () => {
            render(<RangeHarness onRangeChange={() => undefined} onApply={() => undefined} />);

            fireEvent.click(screen.getByRole("button", { name: "Last 6 months" }));

            expect(screen.getByDisplayValue("Apr 19, 2026")).toBeTruthy();
            expect(screen.getByDisplayValue("Oct 19, 2026")).toBeTruthy();
        });

        it("keeps the caller's range key", () => {
            const onRangeChange = jest.fn<void, [DateRangeState[]]>();
            render(<RangeHarness onRangeChange={onRangeChange} onApply={() => undefined} rangeKey="courier" />);

            fireEvent.click(screen.getByRole("button", { name: "Last year" }));

            expect(onRangeChange).toHaveBeenCalledWith([expect.objectContaining({ key: "courier" })]);
        });

        it("leaves confirming the range to Apply", () => {
            const onApply = jest.fn<void, []>();
            render(<RangeHarness onRangeChange={() => undefined} onApply={onApply} />);

            fireEvent.click(screen.getByRole("button", { name: "Last 3 months" }));
            const appliedOnPick = onApply.mock.calls.length;
            fireEvent.click(screen.getByRole("button", { name: "Apply" }));

            expect(appliedOnPick).toBe(0);
            expect(onApply).toHaveBeenCalledTimes(1);
        });
    });

    describe("the fast pick the range matches", () => {
        const pressedLabels = (): string[] =>
            screen.queryAllByRole("button", { pressed: true }).map((button) => button.textContent ?? "");

        it("is none while the range is just today", () => {
            render(<RangeHarness onRangeChange={() => undefined} onApply={() => undefined} />);

            expect(pressedLabels()).toEqual([]);
            expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(3);
        });

        it("is the one just picked, filled in brand red", () => {
            render(<RangeHarness onRangeChange={() => undefined} onApply={() => undefined} />);

            fireEvent.click(screen.getByRole("button", { name: "Last 6 months" }));

            expect(pressedLabels()).toEqual(["Last 6 months"]);
            const picked = emotionRulesFor(screen.getByRole("button", { name: "Last 6 months" }));
            expect(picked).toContain("background-color:#E44B4C");
            expect(picked).toContain("color:#fff");
            expect(emotionRulesFor(screen.getByRole("button", { name: "Last year" }))).toContain("background-color:transparent");
        });

        it("is also shown for the same days picked by hand on the calendar", () => {
            // The calendar hands back midnight on both ends, not the fast pick's end of day.
            render(
                <RangeHarness
                    onRangeChange={() => undefined}
                    onApply={() => undefined}
                    initial={{ startDate: new Date(2026, 6, 19), endDate: new Date(2026, 9, 19) }}
                />
            );

            expect(pressedLabels()).toEqual(["Last 3 months"]);
        });

        it("is none for a look-back that does not end today", () => {
            render(
                <RangeHarness
                    onRangeChange={() => undefined}
                    onApply={() => undefined}
                    initial={{ startDate: new Date(2026, 6, 19), endDate: new Date(2026, 9, 18) }}
                />
            );

            expect(pressedLabels()).toEqual([]);
        });
    });

    describe("range-mode layout", () => {
        it("takes its width from the calendar, so Apply cannot widen the popover past it", () => {
            render(<RangeHarness onRangeChange={() => undefined} onApply={() => undefined} />);

            // In a plain block the inline-flex calendar and the inline-flex Apply button were sized
            // as one line, leaving a strip as wide as the button's label to the calendar's right.
            const body = emotionRulesFor(screen.getByTestId("date-range-picker-body"));
            expect(body).toContain("display:flex");
            expect(body).toContain("flex-direction:column");
        });

        it("spreads the fast picks over three equal columns that never ask for more width", () => {
            render(<RangeHarness onRangeChange={() => undefined} onApply={() => undefined} />);

            const row = emotionRulesFor(screen.getByTestId("date-range-fast-picks"));
            expect(row).toContain("grid-template-columns:repeat(3, 1fr)");
            expect(row).toContain("width:0");
            expect(row).toContain("min-width:100%");
        });

        it("tones the date strip to the management palette and marks only the active date in red", () => {
            render(<RangeHarness onRangeChange={() => undefined} onApply={() => undefined} />);

            const body = emotionRulesFor(screen.getByTestId("date-range-picker-body"));
            expect(body).toMatch(/\.rdrDateDisplayWrapper \{[^}]*background-color:#fbfaf6/);
            expect(body).toMatch(/\.rdrDateDisplayItem \{[^}]*border-color:#f1eae4/);
            expect(body).toMatch(/\.rdrDateDisplayItemActive \{[^}]*border-color:#E44B4C/);
            // Same specificity, so the active rule only wins by coming later.
            expect(body.indexOf(".rdrDateDisplayItemActive {")).toBeGreaterThan(body.indexOf(".rdrDateDisplayItem {"));
            expect(body).toMatch(/\.rdrDayToday \.rdrDayNumber span:after \{[^}]*background-color:#E44B4C/);
        });
    });

    describe("single-date mode", () => {
        it("keeps its plain block body", () => {
            render(
                <DateRangePickerPopover
                    mode="single"
                    open
                    anchorEl={document.body}
                    onClose={() => undefined}
                    date={TODAY}
                    onDateChange={() => undefined}
                    applyLabel="Apply"
                    onApply={() => undefined}
                />
            );

            const body = emotionRulesFor(screen.getByTestId("date-range-picker-body"));
            expect(body).toContain("padding:16px");
            expect(body).not.toContain("display:flex");
            expect(body).not.toContain("rdrDateDisplay");
        });

        it("offers no fast picks", () => {
            render(
                <DateRangePickerPopover
                    mode="single"
                    open
                    anchorEl={document.body}
                    onClose={() => undefined}
                    date={TODAY}
                    onDateChange={() => undefined}
                    applyLabel="Apply"
                    onApply={() => undefined}
                />
            );

            expect(screen.queryByRole("button", { name: "Last 3 months" })).toBeNull();
            expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
        });
    });
});
