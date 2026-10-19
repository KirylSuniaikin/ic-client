import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DateRangePickerPopover } from "./DateRangePickerPopover";
import type { DateRangeState } from "../../types";

// Noon on 19 Oct 2026: every fast pick ends on this day.
const TODAY = new Date(2026, 9, 19, 12, 0);
const END_OF_TODAY = new Date(2026, 9, 19, 23, 59, 59, 999);

// Holds the range the way StatisticsComponent and the order history do, so the calendar redraws
// with each pick exactly as it does on screen.
function RangeHarness({ onRangeChange, onApply, rangeKey = "selection" }: {
    onRangeChange: (range: DateRangeState[]) => void;
    onApply: () => void;
    rangeKey?: string;
}): JSX.Element {
    const [range, setRange] = React.useState<DateRangeState[]>([
        { startDate: new Date(2026, 9, 19), endDate: new Date(2026, 9, 19), key: rangeKey },
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

    describe("single-date mode", () => {
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
