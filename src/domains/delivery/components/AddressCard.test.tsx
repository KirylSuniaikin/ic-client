import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../shared/i18n";
import { AddressCard } from "./AddressCard";
import type { CustomerAddress } from "../types";

const ADDRESS: CustomerAddress = {
    id: "a1", label: "Home", block: "338", road: "3801", building: "12", flat: null,
    note: null, latitude: 26.2285, longitude: 50.586,
};

function renderCard(withEdit: boolean, address: CustomerAddress = ADDRESS, withDelete = false) {
    const onSelect = jest.fn<void, [CustomerAddress]>();
    const onEdit = jest.fn<void, [CustomerAddress]>();
    const onDelete = jest.fn<void, [CustomerAddress]>();
    render(
        <I18nextProvider i18n={i18n}>
            <AddressCard
                address={address}
                selected={false}
                onSelect={onSelect}
                onEdit={withEdit ? onEdit : undefined}
                onDelete={withDelete ? onDelete : undefined}
            />
        </I18nextProvider>
    );
    return { onSelect, onEdit, onDelete };
}

/**
 * The outer row carries role="radio" AND wraps an MUI `Radio`, whose own input carries the same
 * role — `getByRole("radio")` is ambiguous. The row is the one that owns the key handler.
 */
function selectableRow(): HTMLElement {
    // The row is the outermost node carrying the role; the MUI input is nested inside it.
    const rows = screen.getAllByRole("radio").filter((node) => node.tagName !== "INPUT");
    if (rows.length !== 1) throw new Error(`expected one selectable row, found ${rows.length}`);
    return rows[0];
}

describe("AddressCard", () => {
    /**
     * The pencil sits inside the row, which is itself the select target. Without
     * stopPropagation the click would also change where the order is delivered — a surprise on
     * a row the customer only meant to correct.
     */
    it("edits without selecting when the pencil is clicked", () => {
        const { onSelect, onEdit } = renderCard(true);

        fireEvent.click(screen.getByRole("button", { name: /edit address/i }));

        expect(onEdit).toHaveBeenCalledWith(ADDRESS);
        expect(onSelect).not.toHaveBeenCalled();
    });

    // Clicked on the label rather than on the MUI Radio: the row itself is the select target,
    // and `getByRole("radio")` is ambiguous here because MUI's Radio renders its own input.
    it("still selects when the row itself is clicked", () => {
        const { onSelect } = renderCard(true);

        fireEvent.click(screen.getByText("Home"));

        expect(onSelect).toHaveBeenCalledWith(ADDRESS);
    });

    /** Read-only lists (the §1.6 confirm sheet) pass no onEdit and must show no pencil. */
    it("shows no pencil when no edit handler is given", () => {
        renderCard(false);

        expect(screen.queryByRole("button", { name: /edit address/i })).toBeNull();
    });

    /**
     * The row is a div carrying role="radio", so keyboard selection has to be wired by hand. A
     * customer picking a delivery address with a keyboard is not exotic — it is anyone on a
     * laptop, and the alternative is that the address list simply cannot be operated.
     */
    it("can be chosen from the keyboard, not only by clicking", () => {
        const { onSelect } = renderCard(true);
        const row = selectableRow();

        fireEvent.keyDown(row, { key: "Enter" });
        fireEvent.keyDown(row, { key: " " });

        expect(onSelect).toHaveBeenCalledTimes(2);
        expect(onSelect).toHaveBeenCalledWith(ADDRESS);
    });

    it("ignores a keystroke that is not a selection", () => {
        const { onSelect } = renderCard(true);

        fireEvent.keyDown(selectableRow(), { key: "Tab" });

        expect(onSelect).not.toHaveBeenCalled();
    });

    /**
     * Labels are optional. Falling through to an empty heading would leave a row the customer
     * cannot tell apart from the one below it, on the screen where they choose between them.
     */
    it("names an unlabelled address rather than showing a blank row", () => {
        renderCard(false, { ...ADDRESS, label: null });

        expect(screen.getByText("Saved address")).toBeTruthy();
        expect(screen.getByText(/Block 338/)).toBeTruthy();
    });

    /**
     * "Use my current location" with nothing typed is a real, supported outcome (§12.7: the pin is
     * the single value everything downstream depends on). It leaves every Bahrain part null, and
     * `formatAddressLine` then returns "" — which must read as "a pinned location", not as a row
     * with a missing line.
     */
    it("says the address is a bare pin when no Bahrain parts were given", () => {
        renderCard(false, { ...ADDRESS, block: null, road: null, building: null, flat: null });

        expect(screen.getByText("Pinned location")).toBeTruthy();
    });

    /** A delivery note is the "gate code is 1234" line — it must survive onto the card. */
    it("shows the delivery note when there is one", () => {
        renderCard(false, { ...ADDRESS, note: "Gate code 1234" });

        expect(screen.getByText(/Gate code 1234/)).toBeTruthy();
    });
});

/**
 * The bin.
 *
 * A saved address the customer no longer uses had no way off the list — they could correct it or
 * add another beside it, and that was all. The list only grows, and the one they actually want is
 * further down every time.
 *
 * Confirmation is in the card rather than in a dialog. This list lives inside a bottom sheet, and
 * a modal opened from inside another modal is how the dispatcher's sheet ended up rendering behind
 * the panel that opened it; an in-place confirm cannot stack wrong, and it keeps the address the
 * customer is deleting in front of them while they answer.
 */
describe("AddressCard — deleting", () => {
    it("does not delete on the first tap", () => {
        const { onDelete } = renderCard(true, ADDRESS, true);

        fireEvent.click(screen.getByLabelText("Delete address"));

        expect(onDelete).not.toHaveBeenCalled();
    });

    it("deletes once the customer confirms", () => {
        const { onDelete } = renderCard(true, ADDRESS, true);

        fireEvent.click(screen.getByLabelText("Delete address"));
        fireEvent.click(screen.getByText("Delete"));

        expect(onDelete).toHaveBeenCalledWith(ADDRESS);
    });

    it("keeps the address when the customer backs out", () => {
        const { onDelete } = renderCard(true, ADDRESS, true);

        fireEvent.click(screen.getByLabelText("Delete address"));
        fireEvent.click(screen.getByText("Keep"));

        expect(onDelete).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Delete address")).toBeTruthy();
    });

    /**
     * Reaching for the bin is not a choice of where to deliver. Without `stopPropagation` the row
     * underneath would also select the address the customer is in the middle of removing.
     */
    it("does not select the address while reaching for the bin", () => {
        const { onSelect } = renderCard(true, ADDRESS, true);

        fireEvent.click(screen.getByLabelText("Delete address"));

        expect(onSelect).not.toHaveBeenCalled();
    });

    it("neither confirming nor cancelling selects the address", () => {
        const { onSelect } = renderCard(true, ADDRESS, true);

        fireEvent.click(screen.getByLabelText("Delete address"));
        fireEvent.click(screen.getByText("Delete"));

        expect(onSelect).not.toHaveBeenCalled();
    });

    /** The §1.6 confirm sheet lists addresses read-only; nothing on it may remove one. */
    it("shows no bin where the list is read-only", () => {
        renderCard(false);

        expect(screen.queryByLabelText("Delete address")).toBeNull();
    });
});
