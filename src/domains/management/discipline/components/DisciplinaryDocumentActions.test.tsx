import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import type { StaffAdminTO } from "../../staff/types";
import type { DisciplinaryActionTO } from "../types";
import {
    downloadDisciplinaryDocument, downloadRefusalAct, markActionSigned, recordRefusal,
} from "../../../../shared/api/management";
import { downloadBlob } from "../utils/downloadBlob";
import DisciplinaryDocumentActions from "./DisciplinaryDocumentActions";

jest.mock("../../../../shared/api/management");
jest.mock("../utils/downloadBlob");

// `mock` prefix lets the hoisted factory close over it; defaults to the web build.
let mockIsNativePlatform = false;
jest.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => mockIsNativePlatform },
}));

const mDownloadDoc = jest.mocked(downloadDisciplinaryDocument);
const mDownloadRefusal = jest.mocked(downloadRefusalAct);
const mSign = jest.mocked(markActionSigned);
const mRefusal = jest.mocked(recordRefusal);
const mBlob = jest.mocked(downloadBlob);

function makeAction(overrides: Partial<DisciplinaryActionTO> = {}): DisciplinaryActionTO {
    const base: DisciplinaryActionTO = {
        id: 11, violationId: 1, employeeId: 7, actionLevel: "WRITTEN", scoreAtTime: 70, shadowPilot: false,
        createdAt: "2026-10-07T10:00:00", documentAvailable: true, signedAt: null, signedRecordedByName: null,
        refusalRecordedAt: null, refusalShiftChiefName: null, refusalGmName: null, voidedAt: null,
    };
    return { ...base, ...overrides };
}

function staff(id: number, role: StaffRoles): StaffAdminTO {
    return {
        id, username: `u${id}`, fullName: `Person ${id}`, role, branchId: "b1", pricePerHour: null, enabled: true,
        cprNumber: null, basicSalary: null, housingAllowance: null, transportAllowance: null, telegramConnected: false,
    };
}
const roster = [staff(3, StaffRoles.MANAGER), staff(5, StaffRoles.OWNER)];

function renderActions(action: DisciplinaryActionTO) {
    const onChanged = jest.fn();
    const utils = render(<DisciplinaryDocumentActions action={action} employeeId={7} roster={roster} onChanged={onChanged} />);
    return { ...utils, onChanged };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockIsNativePlatform = false;
});

describe("DisciplinaryDocumentActions", () => {
    it.each([
        ["ART107", { actionLevel: "TERMINATION_ART107" as const }],
        ["pilot", { shadowPilot: true }],
        ["voided", { voidedAt: "2026-10-08T09:00:00" }],
    ])("renders nothing when documentAvailable is false (%s)", (_name, overrides) => {
        const { container } = renderActions(makeAction({ ...overrides, documentAvailable: false }));

        expect(container.firstChild).toBeNull();
    });

    it("shows download, sign and refusal for an unsigned, unrefused action and no refusal-act download", () => {
        renderActions(makeAction());

        expect(screen.getByText("Download document")).toBeTruthy();
        expect(screen.getByText("Mark signed")).toBeTruthy();
        expect(screen.getByText("Record refusal")).toBeTruthy();
        expect(screen.queryByText("Download refusal act")).toBeNull();
    });

    it("downloads the document and hands the blob to downloadBlob", async () => {
        const blob = new Blob(["x"]);
        mDownloadDoc.mockResolvedValue({ blob, filename: "warning.pdf" });
        renderActions(makeAction());

        fireEvent.click(screen.getByText("Download document"));

        await waitFor(() => expect(mBlob).toHaveBeenCalledWith(blob, "warning.pdf"));
        expect(mDownloadDoc).toHaveBeenCalledWith(11);
    });

    it("mark signed calls the API once with no confirm step, then onChanged", async () => {
        mSign.mockResolvedValue(makeAction({ signedAt: "2026-10-08T09:00:00" }));
        const { onChanged } = renderActions(makeAction());

        fireEvent.click(screen.getByText("Mark signed"));

        await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
        expect(mSign).toHaveBeenCalledTimes(1);
        expect(mSign).toHaveBeenCalledWith(11);
    });

    it("disables Mark signed while the request is in flight", async () => {
        mSign.mockImplementation(() => new Promise<DisciplinaryActionTO>(() => undefined));
        renderActions(makeAction());

        fireEvent.click(screen.getByText("Mark signed"));

        await waitFor(() => expect((screen.getByText("Mark signed") as HTMLButtonElement).disabled).toBe(true));
    });

    it("shows the server message when signing fails and does not call onChanged", async () => {
        mSign.mockRejectedValue(new Error("Document was voided"));
        const { onChanged } = renderActions(makeAction());

        fireEvent.click(screen.getByText("Mark signed"));

        expect((await screen.findByRole("alert")).textContent).toBe("Document was voided");
        expect(onChanged).not.toHaveBeenCalled();
    });

    it("shows the server message when the download fails", async () => {
        mDownloadDoc.mockRejectedValue(new Error("Pilot action"));
        renderActions(makeAction());

        fireEvent.click(screen.getByText("Download document"));

        expect((await screen.findByRole("alert")).textContent).toBe("Pilot action");
        expect(mBlob).not.toHaveBeenCalled();
    });

    it("when signed: shows the signed line and hides sign, refusal and refusal-act download", () => {
        renderActions(makeAction({ signedAt: "2026-10-08T09:00:00", signedRecordedByName: "Gina GM" }));

        expect(screen.getByText("Signed on 8 Oct 2026 (recorded by Gina GM)")).toBeTruthy();
        expect(screen.queryByText("Mark signed")).toBeNull();
        expect(screen.queryByText("Record refusal")).toBeNull();
        expect(screen.queryByText("Download refusal act")).toBeNull();
    });

    it("when refused: shows the refusal line and the refusal-act download, hides sign and refusal", async () => {
        const blob = new Blob(["r"]);
        mDownloadRefusal.mockResolvedValue({ blob, filename: "refusal.pdf" });
        renderActions(makeAction({ refusalRecordedAt: "2026-10-08T09:00:00" }));

        expect(screen.getByText("Refusal recorded on 8 Oct 2026")).toBeTruthy();
        expect(screen.queryByText("Mark signed")).toBeNull();
        expect(screen.queryByText("Record refusal")).toBeNull();

        fireEvent.click(screen.getByText("Download refusal act"));

        await waitFor(() => expect(mBlob).toHaveBeenCalledWith(blob, "refusal.pdf"));
        expect(mDownloadRefusal).toHaveBeenCalledWith(11);
    });

    it("record refusal opens the drawer and posts both ids, then onChanged", async () => {
        mRefusal.mockResolvedValue(makeAction({ refusalRecordedAt: "2026-10-08T09:00:00" }));
        const { onChanged } = renderActions(makeAction());
        fireEvent.click(screen.getByText("Record refusal"));
        const drawer = await screen.findByTestId("refusal-act-drawer");

        fireEvent.mouseDown(within(drawer).getByLabelText("Shift chief"));
        fireEvent.click(within(screen.getByRole("listbox")).getByText("Person 3"));
        fireEvent.mouseDown(within(drawer).getByLabelText("General Manager / Owner"));
        fireEvent.click(within(screen.getByRole("listbox")).getByText("Person 5"));
        fireEvent.click(within(drawer).getByRole("button", { name: "Record refusal" }));

        await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
        expect(mRefusal).toHaveBeenCalledWith(11, { shiftChiefStaffId: 3, gmStaffId: 5 });
    });

    describe("native platform", () => {
        it("hides download buttons but keeps sign and refusal", () => {
            mockIsNativePlatform = true;
            renderActions(makeAction());

            expect(screen.queryByText("Download document")).toBeNull();
            expect(screen.getByText("Mark signed")).toBeTruthy();
            expect(screen.getByText("Record refusal")).toBeTruthy();
        });

        it("hides the refusal-act download too", () => {
            mockIsNativePlatform = true;
            renderActions(makeAction({ refusalRecordedAt: "2026-10-08T09:00:00" }));

            expect(screen.queryByText("Download refusal act")).toBeNull();
            expect(screen.getByText("Refusal recorded on 8 Oct 2026")).toBeTruthy();
        });
    });
});
