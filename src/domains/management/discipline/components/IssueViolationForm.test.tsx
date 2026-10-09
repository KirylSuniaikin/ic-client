import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
    fetchDisciplineCatalog,
    issueViolation,
    previewViolation,
    uploadViolationPhoto,
} from "../../../../shared/api/management";
import IssueViolationForm from "./IssueViolationForm";
import { makeCategory, makeItem, makeViolation } from "../testFixtures";
import type { IssuePreviewTO } from "../types";

jest.mock("../../../../shared/api/management");
jest.mock("../../../../shared/utils/timeUtils", () => ({ todayIsoBahrain: () => "2026-10-08" }));

// The real field downscales through a canvas, which jsdom lacks; the form only needs the blob it reports.
function mockPhotoField({ onChange }: { onChange: (p: { pendingImage: Blob | null; removeImage: boolean }) => void }): JSX.Element {
    return (
        <button
            type="button"
            data-testid="photo-stub"
            onClick={(): void => onChange({ pendingImage: new Blob(["x"]), removeImage: false })}
        />
    );
}
jest.mock("../../../../shared/components/EntityPhotoField", () => ({ EntityPhotoField: mockPhotoField }));

const mockCatalog = jest.mocked(fetchDisciplineCatalog);
const mockPreview = jest.mocked(previewViolation);
const mockIssue = jest.mocked(issueViolation);
const mockUpload = jest.mocked(uploadViolationPhoto);

function makePreview(overrides: Partial<IssuePreviewTO> = {}): IssuePreviewTO {
    return {
        violationTypeId: 11, code: "c.11", title: "Item 11", violationClass: "A", points: 1, penaltyHours: 2,
        scoreBefore: 90, scoreAfter: 89, zoneBefore: "GREEN", zoneAfter: "GREEN", formalAction: null,
        outcomeStatus: "ACTIVE", expiresAt: null, shadowPilot: false,
        payCycle: { start: "2026-09-25", end: "2026-10-24" }, penaltyHoursInCycle: 0,
        capHours: null, maxDeductibleHours: null,
        ...overrides,
    };
}

beforeEach(() => {
    mockCatalog.mockReset();
    mockPreview.mockReset();
    mockIssue.mockReset();
    mockUpload.mockReset();
    mockCatalog.mockResolvedValue([
        { ...makeCategory(1, [makeItem(11, "A", 1), makeItem(12, "D", 1)]), correctiveMeasure: "Talk first" },
    ]);
    mockPreview.mockResolvedValue(makePreview());
});

async function pickTypeAndComment(): Promise<void> {
    fireEvent.click(await screen.findByTestId("catalog-category-1"));
    fireEvent.click(screen.getByTestId("catalog-item-11"));
    fireEvent.change(screen.getByTestId("violation-comment"), { target: { value: "  Arrived late  " } });
}

describe("IssueViolationForm", () => {
    it("loads the catalog and shows the picker with the corrective measure on expand", async () => {
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={jest.fn()} />);

        fireEvent.click(await screen.findByTestId("catalog-category-1"));

        expect(screen.getByTestId("catalog-measure-1").textContent).toBe("Talk first");
    });

    it("hides class D picker entries from a caller who may not issue them", async () => {
        render(<IssueViolationForm staffId={7} canIssueClassD={false} onIssued={jest.fn()} />);

        fireEvent.click(await screen.findByTestId("catalog-category-1"));

        expect(screen.queryByTestId("catalog-item-12")).toBeNull();
    });

    it("shows the catalog load error", async () => {
        mockCatalog.mockRejectedValue(new Error("Catalog down"));

        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={jest.fn()} />);

        expect(await screen.findByText("Catalog down")).toBeTruthy();
    });

    it("defaults both dates to today and limits them with min/max", async () => {
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={jest.fn()} />);
        const discovered = await screen.findByTestId("violation-discovered-on");
        const occurred = screen.getByTestId("violation-occurred-on");

        expect((discovered as HTMLInputElement).value).toBe("2026-10-08");
        expect((occurred as HTMLInputElement).value).toBe("2026-10-08");
        expect(discovered.getAttribute("max")).toBe("2026-10-08");
        expect(discovered.getAttribute("min")).toBe("2026-09-08");
        expect(occurred.getAttribute("max")).toBe("2026-10-08");
    });

    it("caps the comment at 2000 characters", async () => {
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={jest.fn()} />);

        expect((await screen.findByTestId("violation-comment")).getAttribute("maxlength")).toBe("2000");
    });

    it("keeps the submit button disabled and makes no preview call until type and comment exist", async () => {
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={jest.fn()} />);
        await screen.findByTestId("catalog-category-1");

        expect((screen.getByTestId("issue-violation-submit") as HTMLButtonElement).disabled).toBe(true);
        expect(mockPreview).not.toHaveBeenCalled();
    });

    it("previews once type and comment are set and enables the button", async () => {
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={jest.fn()} />);

        await pickTypeAndComment();

        expect(await screen.findByTestId("issue-preview")).toBeTruthy();
        expect(screen.getByText("Penalty hours: 2 h")).toBeTruthy();
        expect(mockPreview).toHaveBeenCalledTimes(1);
        expect((screen.getByTestId("issue-violation-submit") as HTMLButtonElement).disabled).toBe(false);
    });

    it("shows the pilot note instead of hours when the server says shadowPilot", async () => {
        mockPreview.mockResolvedValue(makePreview({ shadowPilot: true }));
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={jest.fn()} />);

        await pickTypeAndComment();

        expect(await screen.findByTestId("issue-preview-pilot")).toBeTruthy();
        expect(screen.queryByText(/Penalty hours/)).toBeNull();
    });

    it("shows a preview error and keeps the button disabled", async () => {
        mockPreview.mockRejectedValue(new Error("Occurred date is in the future"));
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={jest.fn()} />);

        await pickTypeAndComment();

        expect((await screen.findByTestId("issue-preview-error")).textContent).toBe("Occurred date is in the future");
        expect((screen.getByTestId("issue-violation-submit") as HTMLButtonElement).disabled).toBe(true);
    });

    it("submits the trimmed request and reports the result", async () => {
        const violation = makeViolation({ id: 91 });
        mockIssue.mockResolvedValue(violation);
        const onIssued = jest.fn();
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={onIssued} />);
        await pickTypeAndComment();
        await screen.findByTestId("issue-preview");

        fireEvent.click(screen.getByTestId("issue-violation-submit"));

        await waitFor(() => expect(onIssued).toHaveBeenCalledWith({ violation, photoError: null }));
        expect(mockIssue).toHaveBeenCalledWith(7, {
            violationTypeId: 11, issuerComment: "Arrived late", occurredOn: "2026-10-08", discoveredOn: "2026-10-08",
        });
        expect((screen.getByTestId("violation-comment") as HTMLTextAreaElement).value).toBe("");
    });

    it("disables the button and shows 'Recording…' while the request is in flight", async () => {
        let resolveIssue: (v: ReturnType<typeof makeViolation>) => void = () => {};
        mockIssue.mockReturnValue(new Promise((r) => { resolveIssue = r; }));
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={jest.fn()} />);
        await pickTypeAndComment();
        await screen.findByTestId("issue-preview");

        fireEvent.click(screen.getByTestId("issue-violation-submit"));

        await waitFor(() => expect(screen.getByTestId("issue-violation-submit").textContent).toBe("Recording…"));
        expect((screen.getByTestId("issue-violation-submit") as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByTestId("issue-violation-submit"));
        expect(mockIssue).toHaveBeenCalledTimes(1);
        resolveIssue(makeViolation());
        await waitFor(() => expect(screen.getByTestId("issue-violation-submit").textContent).toBe("Give punishment"));
    });

    it("keeps the submit button enabled when the preview is over the cap", async () => {
        mockPreview.mockResolvedValue(makePreview({ capHours: 0, maxDeductibleHours: 0 }));
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={jest.fn()} />);
        await pickTypeAndComment();
        await screen.findByTestId("issue-preview");

        await waitFor(() => expect((screen.getByTestId("issue-violation-submit") as HTMLButtonElement).disabled).toBe(false));
    });

    it("keeps the submit button enabled when this violation pushes the total past the cap", async () => {
        mockPreview.mockResolvedValue(makePreview({
            penaltyHoursInCycle: 4, penaltyHours: 5, capHours: 6, maxDeductibleHours: 6,
        }));
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={jest.fn()} />);
        await pickTypeAndComment();
        await screen.findByTestId("issue-preview");

        await waitFor(() => expect((screen.getByTestId("issue-violation-submit") as HTMLButtonElement).disabled).toBe(false));
    });

    it("keeps the form filled and shows the server message when the save is rejected", async () => {
        mockIssue.mockRejectedValue(new Error("Could not save the violation"));
        const onIssued = jest.fn();
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={onIssued} />);
        await pickTypeAndComment();
        await screen.findByTestId("issue-preview");

        fireEvent.click(screen.getByTestId("issue-violation-submit"));

        expect((await screen.findByTestId("issue-submit-error")).textContent).toBe("Could not save the violation");
        expect((screen.getByTestId("violation-comment") as HTMLTextAreaElement).value).toBe("  Arrived late  ");
        expect(onIssued).not.toHaveBeenCalled();
    });

    it("uploads a held photo after the save and still succeeds when the upload is rejected", async () => {
        const violation = makeViolation({ id: 91 });
        mockIssue.mockResolvedValue(violation);
        mockUpload.mockRejectedValue(new Error("Too large"));
        const onIssued = jest.fn();
        render(<IssueViolationForm staffId={7} canIssueClassD onIssued={onIssued} />);
        await pickTypeAndComment();
        fireEvent.click(screen.getByTestId("photo-stub"));
        await screen.findByTestId("issue-preview");

        fireEvent.click(screen.getByTestId("issue-violation-submit"));

        await waitFor(() => expect(onIssued).toHaveBeenCalledWith({ violation, photoError: "Too large" }));
        expect(mockUpload).toHaveBeenCalledWith(91, expect.any(Blob));
        expect(screen.queryByTestId("issue-submit-error")).toBeNull();
    });
});
