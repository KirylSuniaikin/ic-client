import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import LastMonthWorkCard from "./LastMonthWorkCard";
import type { MyWorkSummaryTO } from "../types";

const base: MyWorkSummaryTO = {
    periodStart: "2026-09-25", periodEnd: "2026-10-24", totalHours: 120.5, totalCost: null, totalSalary: null,
};

describe("LastMonthWorkCard", () => {
    it("shows the title, the date range and hours with two decimals", () => {
        render(<LastMonthWorkCard summary={base} />);

        expect(screen.getByText("Last full pay cycle")).toBeTruthy();
        expect(screen.getByText("25 Sep 2026 – 24 Oct 2026")).toBeTruthy();
        expect(screen.getByText("Hours worked: 120.50")).toBeTruthy();
    });

    it("shows hours only when salary and cost are null", () => {
        render(<LastMonthWorkCard summary={base} />);

        expect(screen.queryByText(/Total salary/)).toBeNull();
        expect(screen.queryByText(/Total cost/)).toBeNull();
    });

    it("shows salary and cost with three decimals when both are present", () => {
        render(<LastMonthWorkCard summary={{ ...base, totalSalary: 300.5, totalCost: 410 }} />);

        expect(screen.getByText("Total salary: BD 300.500")).toBeTruthy();
        expect(screen.getByText("Total cost: BD 410.000")).toBeTruthy();
    });

    it("renders a zero salary (not null) rather than hiding it", () => {
        render(<LastMonthWorkCard summary={{ ...base, totalSalary: 0, totalCost: null }} />);

        expect(screen.getByText("Total salary: BD 0.000")).toBeTruthy();
        expect(screen.queryByText(/Total cost/)).toBeNull();
    });
});
