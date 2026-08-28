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

function renderCard(withEdit: boolean) {
    const onSelect = jest.fn<void, [CustomerAddress]>();
    const onEdit = jest.fn<void, [CustomerAddress]>();
    render(
        <I18nextProvider i18n={i18n}>
            <AddressCard
                address={ADDRESS}
                selected={false}
                onSelect={onSelect}
                onEdit={withEdit ? onEdit : undefined}
            />
        </I18nextProvider>
    );
    return { onSelect, onEdit };
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
});
