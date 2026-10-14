import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CatalogEntryDrawer from "./CatalogEntryDrawer";
import type { CatalogDrawerTarget } from "./CatalogEntryDrawer";
import type {
    CatalogCategoryTO,
    CatalogItemTO,
    CreateCatalogEntryRequest,
    UpdateCatalogEntryRequest,
} from "../../discipline/types";

const ITEM: CatalogItemTO = {
    id: 11, categoryId: 1, code: "2.1", title: "Wrong recipe", violationClass: "B", points: 15, ttlDays: 180, penaltyHours: 2,
};
const CATEGORY: CatalogCategoryTO = { id: 7, code: "2", name: "Food preparation", correctiveMeasure: null, items: [ITEM] };

const EDIT: CatalogDrawerTarget = { mode: "edit", item: ITEM };
const CREATE: CatalogDrawerTarget = { mode: "create", category: CATEGORY };

const makeCreate = () => jest.fn<Promise<CatalogItemTO>, [CreateCatalogEntryRequest]>().mockResolvedValue(ITEM);
const makeUpdate = () =>
    jest.fn<Promise<CatalogItemTO>, [number, UpdateCatalogEntryRequest]>().mockResolvedValue(ITEM);
const makeClose = () => jest.fn<void, []>();

let createEntry = makeCreate();
let updateEntry = makeUpdate();
let onClose = makeClose();

function renderDrawer(target: CatalogDrawerTarget): void {
    render(<CatalogEntryDrawer target={target} onClose={onClose} createEntry={createEntry} updateEntry={updateEntry} />);
}

const field = (label: string): HTMLInputElement => screen.getByLabelText(label) as HTMLInputElement;
const submit = (name: string): HTMLButtonElement => screen.getByRole("button", { name }) as HTMLButtonElement;

async function chooseClass(letter: string): Promise<void> {
    await userEvent.click(screen.getByRole("combobox", { name: "Class" }));
    await userEvent.click(await screen.findByRole("option", { name: letter }));
}

describe("CatalogEntryDrawer", () => {
    beforeEach(() => {
        createEntry = makeCreate();
        updateEntry = makeUpdate();
        onClose = makeClose();
    });

    it("edit mode: shows title read-only, prefilled values and the future-only caption", () => {
        renderDrawer(EDIT);

        expect(screen.getByText("Edit 2.1")).toBeTruthy();
        expect(screen.getByText("Wrong recipe")).toBeTruthy();
        expect(screen.queryByLabelText("Title")).toBeNull();
        expect(field("Points").value).toBe("15");
        expect(field("Expiry (days)").value).toBe("180");
        expect(field("Penalty hours").value).toBe("2");
        expect(screen.getByText(/Changes apply to future violations only/)).toBeTruthy();
    });

    it("edit mode submits an update without title or categoryId", async () => {
        renderDrawer(EDIT);
        await userEvent.clear(field("Points"));
        await userEvent.type(field("Points"), "20");

        await userEvent.click(submit("Save"));

        await waitFor(() => expect(updateEntry).toHaveBeenCalledTimes(1));
        expect(updateEntry).toHaveBeenCalledWith(11, { violationClass: "B", points: 20, ttlDays: 180, penaltyHours: 2 });
        const payload = updateEntry.mock.calls[0][1] as Record<string, unknown>;
        expect(payload).not.toHaveProperty("title");
        expect(payload).not.toHaveProperty("categoryId");
        expect(onClose).toHaveBeenCalled();
    });

    it("create mode: titles the drawer, starts empty and submits with the category id", async () => {
        renderDrawer(CREATE);
        expect(screen.getByText("Add entry — Food preparation")).toBeTruthy();
        expect(submit("Add entry").disabled).toBe(true);

        await userEvent.type(field("Title"), "  New thing ");
        await userEvent.type(field("Points"), "5");
        await userEvent.type(field("Expiry (days)"), "90");
        await userEvent.type(field("Penalty hours"), "0.5");
        await userEvent.click(submit("Add entry"));

        await waitFor(() => expect(createEntry).toHaveBeenCalledTimes(1));
        expect(createEntry).toHaveBeenCalledWith({
            categoryId: 7, title: "New thing", violationClass: "A", points: 5, ttlDays: 90, penaltyHours: 0.5,
        });
        expect(onClose).toHaveBeenCalled();
    });

    it("create mode keeps submit disabled when the title is blank", async () => {
        renderDrawer(CREATE);
        await userEvent.type(field("Points"), "5");
        await userEvent.type(field("Expiry (days)"), "90");
        await userEvent.type(field("Penalty hours"), "0");

        expect(submit("Add entry").disabled).toBe(true);
    });

    it.each([
        ["points zero", "Points", "0"],
        ["points non-integer", "Points", "1.5"],
        ["expiry zero", "Expiry (days)", "0"],
        ["expiry negative", "Expiry (days)", "-3"],
        ["hours above 999.99", "Penalty hours", "1000"],
        ["hours with three decimals", "Penalty hours", "1.234"],
        ["hours empty", "Penalty hours", ""],
    ])("keeps submit disabled for invalid %s", async (_name, label, value) => {
        renderDrawer(EDIT);
        await userEvent.clear(field(label));
        if (value !== "") await userEvent.type(field(label), value);

        expect(submit("Save").disabled).toBe(true);
    });

    it("accepts hours of 0 and 999.99", async () => {
        renderDrawer(EDIT);
        await userEvent.clear(field("Penalty hours"));
        await userEvent.type(field("Penalty hours"), "999.99");
        expect(submit("Save").disabled).toBe(false);

        await userEvent.clear(field("Penalty hours"));
        await userEvent.type(field("Penalty hours"), "0");
        expect(submit("Save").disabled).toBe(false);
    });

    it("class D disables the numeric fields and submits the fixed payload", async () => {
        renderDrawer(EDIT);

        await chooseClass("D");

        expect(field("Points").disabled).toBe(true);
        expect(field("Expiry (days)").disabled).toBe(true);
        expect(field("Penalty hours").disabled).toBe(true);
        await userEvent.click(submit("Save"));
        await waitFor(() => expect(updateEntry).toHaveBeenCalledTimes(1));
        expect(updateEntry).toHaveBeenCalledWith(11, { violationClass: "D", points: 0, ttlDays: null, penaltyHours: 0 });
    });

    it("switching D to B clears points and expiry and disables submit until valid", async () => {
        renderDrawer({ mode: "edit", item: { ...ITEM, violationClass: "D", points: 0, ttlDays: null, penaltyHours: 0 } });
        expect(submit("Save").disabled).toBe(false);

        await chooseClass("B");

        expect(field("Points").disabled).toBe(false);
        expect(field("Points").value).toBe("");
        expect(field("Expiry (days)").value).toBe("");
        expect(submit("Save").disabled).toBe(true);

        await userEvent.type(field("Points"), "15");
        await userEvent.type(field("Expiry (days)"), "180");
        expect(submit("Save").disabled).toBe(false);
    });

    it("shows the server message and stays open when saving is rejected", async () => {
        updateEntry.mockRejectedValue(new Error("Entry already exists"));
        renderDrawer(EDIT);

        await userEvent.click(submit("Save"));

        const alert = await screen.findByRole("alert");
        expect(within(alert).getByText("Entry already exists")).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
        expect(submit("Save").disabled).toBe(false);
    });

    it("disables submit while the request is in flight", async () => {
        updateEntry.mockImplementation(() => new Promise<CatalogItemTO>(() => undefined));
        renderDrawer(EDIT);

        await userEvent.click(submit("Save"));

        expect(submit("Save").disabled).toBe(true);
        expect(updateEntry).toHaveBeenCalledTimes(1);
    });
});
