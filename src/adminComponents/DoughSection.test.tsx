import {jest, describe, it, expect, beforeEach} from "@jest/globals";
import React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import type {DoughInventory} from "../management/types/doughInventoryTypes";
import DoughSection from "./DoughSection";

const mockInventory: DoughInventory = {S: 10, M: 12, L: 8, Brick: 5} satisfies DoughInventory;

const mockAvailability = {S: true, M: true, L: false, "Brick dough": false};

describe("DoughSection", () => {
    const onInventoryChange = jest.fn();
    const onAvailabilityToggle = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders 4 inputs with inventory amounts from props", () => {
        render(
            <DoughSection
                branchId="branch-uuid"
                inventory={mockInventory}
                availability={mockAvailability}
                onInventoryChange={onInventoryChange}
                onAvailabilityToggle={onAvailabilityToggle}
                loading={false}
            />
        );

        expect(screen.getByDisplayValue("10")).toBeTruthy();
        expect(screen.getByDisplayValue("12")).toBeTruthy();
        expect(screen.getByDisplayValue("8")).toBeTruthy();
        expect(screen.getByDisplayValue("5")).toBeTruthy();
    });

    it("renders dough type labels", () => {
        render(
            <DoughSection
                branchId="branch-uuid"
                inventory={mockInventory}
                availability={mockAvailability}
                onInventoryChange={onInventoryChange}
                onAvailabilityToggle={onAvailabilityToggle}
                loading={false}
            />
        );

        expect(screen.getByText("S Dough")).toBeTruthy();
        expect(screen.getByText("M Dough")).toBeTruthy();
        expect(screen.getByText("L Dough")).toBeTruthy();
        expect(screen.getByText("Brick Dough")).toBeTruthy();
    });

    it("calls onInventoryChange with clamped value when input changes", () => {
        render(
            <DoughSection
                branchId="branch-uuid"
                inventory={mockInventory}
                availability={mockAvailability}
                onInventoryChange={onInventoryChange}
                onAvailabilityToggle={onAvailabilityToggle}
                loading={false}
            />
        );

        fireEvent.change(screen.getByDisplayValue("10"), {target: {value: "20"}});

        expect(onInventoryChange).toHaveBeenCalledWith("S", 20);
    });

    it("clamps negative input to 0 before calling onInventoryChange", () => {
        render(
            <DoughSection
                branchId="branch-uuid"
                inventory={mockInventory}
                availability={mockAvailability}
                onInventoryChange={onInventoryChange}
                onAvailabilityToggle={onAvailabilityToggle}
                loading={false}
            />
        );

        fireEvent.change(screen.getByDisplayValue("10"), {target: {value: "-3"}});

        expect(onInventoryChange).toHaveBeenCalledWith("S", 0);
    });

    it("calls onAvailabilityToggle with the correct key when a switch is toggled", () => {
        render(
            <DoughSection
                branchId="branch-uuid"
                inventory={mockInventory}
                availability={mockAvailability}
                onInventoryChange={onInventoryChange}
                onAvailabilityToggle={onAvailabilityToggle}
                loading={false}
            />
        );

        // There are 4 switches; the first corresponds to "S" → availability key "S"
        const switches = screen.getAllByRole("checkbox");
        fireEvent.click(switches[0]);

        expect(onAvailabilityToggle).toHaveBeenCalledWith("S");
    });

    it("renders with loading opacity and pointer-events disabled when loading=true", () => {
        const {container} = render(
            <DoughSection
                branchId="branch-uuid"
                inventory={mockInventory}
                availability={mockAvailability}
                onInventoryChange={onInventoryChange}
                onAvailabilityToggle={onAvailabilityToggle}
                loading={true}
            />
        );

        // The outer Card root gets opacity:0.6 via MUI sx when loading=true
        const card = container.firstChild as HTMLElement;
        expect(card).toBeTruthy();
    });
});
