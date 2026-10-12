import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import ProfileHeader from "./ProfileHeader";
import ProfileStats from "./ProfileStats";
import { StaffRoles } from "../../../auth/types";

describe("ProfileHeader", () => {
    it("shows initials, name, role and the zone pill when there is no photo", () => {
        render(<ProfileHeader name="Casey Lee" role={StaffRoles.SUPER_MANAGER} zone="YELLOW" />);

        expect(screen.getByText("CL")).toBeTruthy();
        expect(screen.getByText("Casey Lee")).toBeTruthy();
        expect(screen.getByText("super manager at IC Pizza")).toBeTruthy();
        expect(screen.getByTestId("profile-zone-pill").textContent).toBe("Yellow zone");
    });

    it("renders the photo when a url is given", () => {
        render(<ProfileHeader name="Casey" role={null} zone={null} photoUrl="/p.png" />);

        expect(screen.getByRole("img", { name: "Casey" }).getAttribute("src")).toBe("/p.png");
        expect(screen.queryByTestId("profile-zone-pill")).toBeNull();
    });
});

describe("ProfileStats", () => {
    const summary = { periodStart: "2026-09-25", periodEnd: "2026-10-24", totalHours: 120.5, totalCost: null, totalSalary: null };

    it("shows score, hours and violation count with the pay period", () => {
        render(<ProfileStats score={82} zone="GREEN" activeCount={2} summary={summary} />);

        expect(screen.getByTestId("my-profile-score").textContent).toBe("82");
        expect(screen.getByTestId("profile-hours").textContent).toBe("120.50");
        expect(screen.getByTestId("profile-active-count").textContent).toBe("2");
        expect(screen.getByText("25 Sep 2026 – 24 Oct 2026")).toBeTruthy();
        expect(screen.queryByText(/Total salary/)).toBeNull();
    });

    it("shows pay figures only when present, including a zero salary", () => {
        render(<ProfileStats score={100} zone="GREEN" activeCount={0} summary={{ ...summary, totalSalary: 0, totalCost: 410 }} />);

        expect(screen.getByText("Total salary: BD 0.000")).toBeTruthy();
        expect(screen.getByText("Total cost: BD 410.000")).toBeTruthy();
    });

    it("shows dashes while data is missing", () => {
        render(<ProfileStats score={null} zone={null} activeCount={null} summary={null} />);

        expect(screen.getByTestId("my-profile-score").textContent).toBe("–");
        expect(screen.getByTestId("profile-hours").textContent).toBe("–");
    });
});
