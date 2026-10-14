import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { StaffAdminTO } from "../../staff/types";
import type { UseStaffDisciplineResult } from "../hooks/useStaffDiscipline";
import type { IssueResult } from "../hooks/useIssueViolation";
import { makeRecord, makeViolation } from "../testFixtures";
import DisciplineDrawer from "./DisciplineDrawer";

jest.mock("../../../../shared/api/management");

const mockUseStaffDiscipline = jest.fn<UseStaffDisciplineResult, [number | null]>();
jest.mock("../hooks/useStaffDiscipline", () => ({
    useStaffDiscipline: (id: number | null) => mockUseStaffDiscipline(id),
}));

// Own tests cover the form; the stub exposes the props the drawer passes and a way to fire onIssued.
let lastFormProps: { staffId: number; canIssueClassD: boolean } | null = null;
let issuedResult: IssueResult = { violation: makeViolation(), photoError: null };
function mockIssueViolationForm(props: { staffId: number; canIssueClassD: boolean; onIssued: (r: IssueResult) => void }): JSX.Element {
    lastFormProps = { staffId: props.staffId, canIssueClassD: props.canIssueClassD };
    return <button type="button" data-testid="form-stub" onClick={(): void => props.onIssued(issuedResult)} />;
}
jest.mock("./IssueViolationForm", () => ({ __esModule: true, default: mockIssueViolationForm }));

function mockPhotoViewer({ open, serverId, title, testIdPrefix }: { open: boolean; serverId: number | null; title: string; testIdPrefix: string }): JSX.Element {
    return <div data-testid="viewer-stub" data-open={open ? "true" : "false"} data-server-id={serverId === null ? "" : String(serverId)} data-title={title} data-prefix={testIdPrefix} />;
}
jest.mock("../../../../shared/components/EntityPhotoViewer", () => ({ EntityPhotoViewer: mockPhotoViewer }));

const target: StaffAdminTO = {
    id: 7, username: "casey.cook", fullName: "Casey Cook", role: StaffRoles.COOK, branchId: "branch-1",
    pricePerHour: null, enabled: true, cprNumber: null, basicSalary: null, housingAllowance: null,
    transportAllowance: null, telegramConnected: false,
};

function state(overrides: Partial<UseStaffDisciplineResult> = {}): UseStaffDisciplineResult {
    return { record: makeRecord(), loading: false, error: null, refresh: jest.fn<void, []>(), ...overrides };
}

function renderDrawer(props: Partial<React.ComponentProps<typeof DisciplineDrawer>> = {}) {
    const onClose = jest.fn();
    const onChanged = jest.fn();
    const utils = render(
        <DisciplineDrawer open target={target} callerRole={StaffRoles.MANAGER} roster={[target]} onClose={onClose} onChanged={onChanged} {...props} />,
    );
    return { ...utils, onClose, onChanged };
}

beforeEach(() => {
    mockUseStaffDiscipline.mockReset();
    mockUseStaffDiscipline.mockReturnValue(state());
    lastFormProps = null;
    issuedResult = { violation: makeViolation(), photoError: null };
});

describe("DisciplineDrawer", () => {
    it("shows the title, the short staff name and the three tabs", () => {
        renderDrawer();

        expect(screen.getByText("Discipline")).toBeTruthy();
        expect(screen.getByText("Casey Cook")).toBeTruthy();
        expect(screen.getByTestId("discipline-tab-current").textContent).toBe("Current");
        expect(screen.getByTestId("discipline-tab-history").textContent).toBe("History");
        expect(screen.getByTestId("discipline-tab-new").textContent).toBe("Give new punishment");
    });

    it("loads the record for the target id, and for null while closed", () => {
        const { rerender } = renderDrawer();
        expect(mockUseStaffDiscipline).toHaveBeenLastCalledWith(7);

        rerender(<DisciplineDrawer open={false} target={target} callerRole={StaffRoles.MANAGER} roster={[]} onClose={jest.fn()} onChanged={jest.fn()} />);

        expect(mockUseStaffDiscipline).toHaveBeenLastCalledWith(null);
    });

    it("shows a spinner while loading with no record yet", () => {
        mockUseStaffDiscipline.mockReturnValue(state({ record: null, loading: true }));

        renderDrawer();

        expect(screen.getByTestId("discipline-loading")).toBeTruthy();
    });

    it("shows the load error in an alert", () => {
        mockUseStaffDiscipline.mockReturnValue(state({ record: null, error: "HTTP 403" }));

        renderDrawer();

        expect(screen.getByTestId("discipline-error").textContent).toBe("HTTP 403");
    });

    it("shows only the score number in the zone-coloured badge on Current", () => {
        mockUseStaffDiscipline.mockReturnValue(state({ record: makeRecord({ score: 72, zone: "YELLOW" }) }));

        renderDrawer();

        const badge = screen.getByTestId("discipline-score-badge");
        expect(badge.textContent).toBe("72");
        expect(badge.getAttribute("data-zone")).toBe("YELLOW");
        expect(screen.queryByText("Score 72")).toBeNull();
        expect(screen.queryByText("Yellow zone")).toBeNull();
    });

    it("lists active violations and shows the empty text when there are none", () => {
        const { unmount } = renderDrawer();
        expect(screen.getByText("Active violations")).toBeTruthy();
        expect(screen.getByText("No active violations")).toBeTruthy();
        unmount();

        mockUseStaffDiscipline.mockReturnValue(state({
            record: makeRecord({ violations: [makeViolation({ id: 1, title: "Late arrival" })] }),
        }));
        renderDrawer();
        expect(screen.getByText(/Late arrival/)).toBeTruthy();
        expect(screen.queryByText("No active violations")).toBeNull();
    });

    it("shows pending violations under 'Awaiting explanation', hidden when none", () => {
        const { unmount } = renderDrawer();
        expect(screen.queryByText("Awaiting explanation")).toBeNull();
        unmount();

        mockUseStaffDiscipline.mockReturnValue(state({
            record: makeRecord({ violations: [makeViolation({ id: 2, status: "PENDING_EXPLANATION", title: "No uniform" })] }),
        }));
        renderDrawer();
        expect(screen.getAllByText("Awaiting explanation").length).toBeGreaterThan(0);
        expect(screen.getByText(/No uniform/)).toBeTruthy();
    });

    it("shows every violation on History and the empty text when there are none", () => {
        mockUseStaffDiscipline.mockReturnValue(state({ record: makeRecord({ violations: [] }) }));
        renderDrawer();

        fireEvent.click(screen.getByTestId("discipline-tab-history"));

        expect(screen.getByText("No violations on record")).toBeTruthy();
    });

    it("includes cancelled and pending violations on History", () => {
        mockUseStaffDiscipline.mockReturnValue(state({
            record: makeRecord({
                violations: [
                    makeViolation({ id: 1, title: "Active one" }),
                    makeViolation({ id: 2, title: "Cancelled one", status: "CANCELLED" }),
                    makeViolation({ id: 3, title: "Pending one", status: "PENDING_EXPLANATION" }),
                ],
            }),
        }));
        renderDrawer();

        fireEvent.click(screen.getByTestId("discipline-tab-history"));

        const history = screen.getByTestId("discipline-history");
        expect(within(history).getByText(/Active one/)).toBeTruthy();
        expect(within(history).getByText(/Cancelled one/)).toBeTruthy();
        expect(within(history).getByText(/Pending one/)).toBeTruthy();
    });

    it("opens the evidence photo viewer from History for a violation that has a photo", () => {
        mockUseStaffDiscipline.mockReturnValue(state({
            record: makeRecord({ violations: [makeViolation({ id: 42, hasPhoto: true })] }),
        }));
        renderDrawer();
        expect(screen.getByTestId("viewer-stub").getAttribute("data-open")).toBe("false");

        fireEvent.click(screen.getByTestId("discipline-tab-history"));
        fireEvent.click(screen.getByText("View photo"));

        const viewer = screen.getByTestId("viewer-stub");
        expect(viewer.getAttribute("data-open")).toBe("true");
        expect(viewer.getAttribute("data-server-id")).toBe("42");
        expect(viewer.getAttribute("data-title")).toBe("Evidence photo");
        expect(viewer.getAttribute("data-prefix")).toBe("violation-photo");
    });

    it("hides the load error and spinner on the new-punishment tab", () => {
        mockUseStaffDiscipline.mockReturnValue(state({ record: null, error: "HTTP 500" }));
        renderDrawer();

        fireEvent.click(screen.getByTestId("discipline-tab-new"));

        expect(screen.queryByTestId("discipline-error")).toBeNull();
    });

    it("passes the target id to the form and lets MANAGER issue no class D", () => {
        renderDrawer({ callerRole: StaffRoles.MANAGER });

        expect(lastFormProps).toEqual({ staffId: 7, canIssueClassD: false });
    });

    it.each([StaffRoles.SUPER_MANAGER, StaffRoles.OWNER])("lets %s issue class D", (role) => {
        renderDrawer({ callerRole: role });

        expect(lastFormProps?.canIssueClassD).toBe(true);
    });

    it("renders no form without a target", () => {
        renderDrawer({ target: null });

        expect(screen.queryByTestId("form-stub")).toBeNull();
    });

    it("on issue: refreshes the record, calls onChanged, returns to Current and toasts", () => {
        const refresh = jest.fn<void, []>();
        mockUseStaffDiscipline.mockReturnValue(state({ refresh }));
        const { onChanged } = renderDrawer();
        fireEvent.click(screen.getByTestId("discipline-tab-new"));

        fireEvent.click(screen.getByTestId("form-stub"));

        expect(refresh).toHaveBeenCalledTimes(1);
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("discipline-current")).toBeTruthy();
        expect(screen.getByText("Violation recorded")).toBeTruthy();
    });

    it("toasts the awaiting-explanation message for a pending violation", () => {
        issuedResult = { violation: makeViolation({ status: "PENDING_EXPLANATION" }), photoError: null };
        renderDrawer();

        fireEvent.click(screen.getByTestId("form-stub"));

        expect(screen.getByText("Violation recorded — awaiting the employee's explanation")).toBeTruthy();
    });

    it("toasts the photo failure while still treating the save as a success", () => {
        issuedResult = { violation: makeViolation(), photoError: "Too large" };
        const { onChanged } = renderDrawer();

        fireEvent.click(screen.getByTestId("form-stub"));

        expect(screen.getByText("Violation recorded, but the photo could not be uploaded: Too large")).toBeTruthy();
        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("resets to Current when the target changes", () => {
        const { rerender } = renderDrawer();
        fireEvent.click(screen.getByTestId("discipline-tab-history"));
        expect(screen.getByTestId("discipline-history")).toBeTruthy();

        rerender(<DisciplineDrawer open target={{ ...target, id: 8 }} callerRole={StaffRoles.MANAGER} roster={[]} onClose={jest.fn()} onChanged={jest.fn()} />);

        expect(screen.getByTestId("discipline-current")).toBeTruthy();
        expect(screen.queryByTestId("discipline-history")).toBeNull();
    });

    it("resets to Current when the drawer is closed and reopened", () => {
        const { rerender } = renderDrawer();
        fireEvent.click(screen.getByTestId("discipline-tab-history"));

        rerender(<DisciplineDrawer open={false} target={target} callerRole={StaffRoles.MANAGER} roster={[]} onClose={jest.fn()} onChanged={jest.fn()} />);
        rerender(<DisciplineDrawer open target={target} callerRole={StaffRoles.MANAGER} roster={[]} onClose={jest.fn()} onChanged={jest.fn()} />);

        expect(screen.getByTestId("discipline-current")).toBeTruthy();
    });
});
