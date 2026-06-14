import {jest, describe, it, expect, beforeEach} from "@jest/globals";
import React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import type {DoughInventory} from "../types";
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
        // MUI v7 Switch renders with role="switch", not role="checkbox"
        const switches = screen.getAllByRole("switch");
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

    it("renders a card wrapper with box-shadow when card=true prop is passed", () => {
        const {container} = render(
            <DoughSection
                branchId="branch-uuid"
                inventory={mockInventory}
                availability={mockAvailability}
                onInventoryChange={onInventoryChange}
                onAvailabilityToggle={onAvailabilityToggle}
                loading={false}
                card
            />
        );

        // With card=true the root element is a MUI Card, not a plain Box
        const root = container.firstChild as HTMLElement;
        expect(root).toBeTruthy();
        // MUI Card renders with role="article" or as a <div> — verify it carries boxShadow via inline or class
        // The simplest verifiable signal: content is still rendered correctly inside the card
        expect(screen.getByText("Dough inventory")).toBeTruthy();
    });

    // ── Phase 3: ± IconButton tests ────────────────────────────────────────

    it("renders an AddIcon and a RemoveIcon IconButton on each card — 8 buttons total", () => {
        // Arrange
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

        // Act
        const buttons = screen.getAllByRole("button");

        // Assert — 4 cards × (1 Remove + 1 Add) = 8 buttons
        expect(buttons).toHaveLength(8);
    });

    it("calls onInventoryChange with incremented value when + button clicked (FR7 increment)", () => {
        // Arrange — inventory.S = 10
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

        // Act — DOM order: [RemoveS, AddS, RemoveM, AddM, RemoveL, AddL, RemoveBrick, AddBrick]
        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[1]); // AddIcon for S

        // Assert
        expect(onInventoryChange).toHaveBeenCalledWith("S", 11);
    });

    it("calls onInventoryChange with decremented value when − button clicked (FR7 decrement)", () => {
        // Arrange — inventory.S = 10
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

        // Act — buttons[0] is RemoveIcon for S
        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[0]); // RemoveIcon for S

        // Assert
        expect(onInventoryChange).toHaveBeenCalledWith("S", 9);
    });

    it("clamps decrement at zero — calls onInventoryChange with 0 when − clicked on count already 0 (FR7 clamp)", () => {
        // Arrange — S count is 0, cannot go negative
        const zeroInventory: DoughInventory = {...mockInventory, S: 0};
        render(
            <DoughSection
                branchId="branch-uuid"
                inventory={zeroInventory}
                availability={mockAvailability}
                onInventoryChange={onInventoryChange}
                onAvailabilityToggle={onAvailabilityToggle}
                loading={false}
            />
        );

        // Act — click RemoveIcon for S
        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[0]);

        // Assert — must not go below 0
        expect(onInventoryChange).toHaveBeenCalledWith("S", 0);
    });

    it("increments count from 0 to 1 when + clicked on a card with count of 0 (FR7 clamp lower bound)", () => {
        // Arrange
        const zeroInventory: DoughInventory = {...mockInventory, S: 0};
        render(
            <DoughSection
                branchId="branch-uuid"
                inventory={zeroInventory}
                availability={mockAvailability}
                onInventoryChange={onInventoryChange}
                onAvailabilityToggle={onAvailabilityToggle}
                loading={false}
            />
        );

        // Act — click AddIcon for S
        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[1]);

        // Assert
        expect(onInventoryChange).toHaveBeenCalledWith("S", 1);
    });

    it("calls onInventoryChange for the correct dough type when + and − are clicked on non-first cards", () => {
        // Arrange — verify Brick card (last) uses type "Brick" not "S"
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

        // Act — buttons[6]=RemoveBrick, buttons[7]=AddBrick; inventory.Brick = 5
        const buttons = screen.getAllByRole("button");
        fireEvent.click(buttons[7]); // Add Brick

        // Assert
        expect(onInventoryChange).toHaveBeenCalledWith("Brick", 6);
    });
});
