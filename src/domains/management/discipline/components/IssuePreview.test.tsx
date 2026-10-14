import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import IssuePreview from "./IssuePreview";
import type { IssuePreviewTO } from "../types";

function makePreview(overrides: Partial<IssuePreviewTO> = {}): IssuePreviewTO {
    return {
        violationTypeId: 3,
        code: "4.2",
        title: "Late arrival",
        violationClass: "B",
        points: 5,
        penaltyHours: 2,
        scoreBefore: 90,
        scoreAfter: 85,
        zoneBefore: "GREEN",
        zoneAfter: "YELLOW",
        formalAction: null,
        outcomeStatus: "ACTIVE",
        expiresAt: null,
        shadowPilot: false,
        payCycle: { start: "2026-09-25", end: "2026-10-24" },
        penaltyHoursInCycle: 1,
        capHours: null,
        maxDeductibleHours: null,
        ...overrides,
    };
}

describe("IssuePreview", () => {
    it("shows the score move", () => {
        render(<IssuePreview preview={makePreview()} />);

        expect(screen.getByTestId("issue-preview-score").textContent).toBe("Score 90 → 85");
    });

    it("colours each score by its zone instead of showing zone chips", () => {
        const { container } = render(
            <IssuePreview preview={makePreview({ scoreBefore: 90, zoneBefore: "GREEN", scoreAfter: 80, zoneAfter: "YELLOW" })} />,
        );

        expect(container.querySelector('[data-zone="GREEN"]')?.textContent).toBe("90");
        expect(container.querySelector('[data-zone="YELLOW"]')?.textContent).toBe("80");
        expect(screen.queryByText("Green zone")).toBeNull();
    });

    it("shows penalty hours and the pay-cycle total when not in the shadow pilot", () => {
        render(<IssuePreview preview={makePreview({ penaltyHours: 2, penaltyHoursInCycle: 1 })} />);

        expect(screen.getByText("Penalty hours: 2 h")).toBeTruthy();
        expect(screen.getByText(/This pay cycle \(.+ – .+\): 1 h already/)).toBeTruthy();
        expect(screen.queryByTestId("issue-preview-pilot")).toBeNull();
    });

    it("shows the pilot note and no penalty hours during the shadow pilot", () => {
        render(<IssuePreview preview={makePreview({ shadowPilot: true, penaltyHours: 2 })} />);

        expect(screen.getByTestId("issue-preview-pilot").textContent).toBe(
            "Shadow pilot is on: this violation is recorded and counts toward the score, but no penalty hours or documents are applied."
        );
        expect(screen.queryByText(/^Penalty hours/)).toBeNull();
        expect(screen.queryByTestId("issue-preview-hours")).toBeNull();
    });

    it("shows no penalty hours when the count is zero", () => {
        render(<IssuePreview preview={makePreview({ penaltyHours: 0 })} />);

        expect(screen.queryByTestId("issue-preview-hours")).toBeNull();
    });

    it("explains the 48-hour explanation window for a pending outcome", () => {
        render(<IssuePreview preview={makePreview({ outcomeStatus: "PENDING_EXPLANATION" })} />);

        expect(screen.getByTestId("issue-preview-outcome").textContent).toContain("48 hours");
        expect(screen.queryByText("Applies immediately.")).toBeNull();
    });

    it("says 'Applies immediately.' for an active outcome", () => {
        render(<IssuePreview preview={makePreview({ outcomeStatus: "ACTIVE" })} />);

        expect(screen.getByText("Applies immediately.")).toBeTruthy();
    });

    it("shows the formal action label only when one is set", () => {
        const { rerender } = render(<IssuePreview preview={makePreview({ formalAction: "WRITTEN" })} />);
        expect(screen.getByText("Formal action: Written Warning")).toBeTruthy();

        rerender(<IssuePreview preview={makePreview({ formalAction: null })} />);
        expect(screen.queryByTestId("issue-preview-action")).toBeNull();
    });

    it("hides the score move for class D and shows the class D note", () => {
        render(<IssuePreview preview={makePreview({ violationClass: "D", points: 0, penaltyHours: 0 })} />);

        expect(screen.queryByTestId("issue-preview-score")).toBeNull();
        expect(screen.getByTestId("issue-preview-class-d").textContent).toBe(
            "Class D: recorded for the General Manager (art.107). No points, no explanation window."
        );
        expect(screen.queryByTestId("issue-preview-outcome")).toBeNull();
    });

    it("renders nothing for the null cap fields", () => {
        render(<IssuePreview preview={makePreview({ capHours: null, maxDeductibleHours: null })} />);

        expect(screen.queryByText(/cap|deducted/i)).toBeNull();
    });

    describe("cap line", () => {
        const capped = { capHours: 6, maxDeductibleHours: 6, penaltyHours: 5, penaltyHoursInCycle: 4 };

        it("shows the cycle total, cap and max deductible hours when the pilot is off and hours are positive", () => {
            render(<IssuePreview preview={makePreview(capped)} />);

            expect(screen.getByTestId("issue-preview-cap").textContent).toBe(
                "Penalty hours this cycle: 9 h, cap 6 h, 6 h will be deducted at most"
            );
            expect(screen.queryByTestId("issue-preview-blocked")).toBeNull();
        });

        it("hides the cap line for zero penalty hours", () => {
            render(<IssuePreview preview={makePreview({ ...capped, penaltyHours: 0 })} />);

            expect(screen.queryByTestId("issue-preview-cap")).toBeNull();
        });

        it("hides the cap line and the blocked block under the shadow pilot", () => {
            render(
                <IssuePreview
                    preview={makePreview({ shadowPilot: true, capHours: null, maxDeductibleHours: null })}
                />
            );

            expect(screen.getByTestId("issue-preview-pilot")).toBeTruthy();
            expect(screen.queryByTestId("issue-preview-cap")).toBeNull();
            expect(screen.queryByTestId("issue-preview-blocked")).toBeNull();
        });

        it("still shows the line for a zero cap and rounds fractional hours", () => {
            render(<IssuePreview preview={makePreview({ capHours: 0, maxDeductibleHours: 0, penaltyHours: 2, penaltyHoursInCycle: 1.25 })} />);

            expect(screen.getByTestId("issue-preview-cap").textContent).toBe(
                "Penalty hours this cycle: 3.25 h, cap 0 h, 0 h will be deducted at most"
            );
        });

        it("keeps the 'already' line and never renders the removed blocked or remaining copy", () => {
            render(<IssuePreview preview={makePreview(capped)} />);

            expect(screen.getByText(/This pay cycle \(.+ – .+\): 4 h already/)).toBeTruthy();
            expect(screen.queryByText(/Blocked by the penalty-hour cap/)).toBeNull();
            expect(screen.queryByText(/remaining/)).toBeNull();
        });

        it("hides the cap line when only one of the cap fields is set", () => {
            const { rerender } = render(<IssuePreview preview={makePreview({ capHours: 10, maxDeductibleHours: null })} />);
            expect(screen.queryByTestId("issue-preview-cap")).toBeNull();

            rerender(<IssuePreview preview={makePreview({ capHours: null, maxDeductibleHours: 3 })} />);
            expect(screen.queryByTestId("issue-preview-cap")).toBeNull();
        });
    });
});
