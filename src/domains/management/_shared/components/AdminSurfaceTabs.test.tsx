import { jest, describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { StaffRoles } from "../../../auth/types";
import AdminSurfaceTabs from "./AdminSurfaceTabs";

describe("AdminSurfaceTabs", () => {
    describe("role gating", () => {
        it("renders nothing for role null", () => {
            const { container } = render(
                <AdminSurfaceTabs role={null} activeTab="orders" onChange={jest.fn()} />
            );

            expect(container.firstChild).toBeNull();
            expect(screen.queryByTestId("admin-surface-tabs")).toBeNull();
        });

        it("renders nothing for role COOK", () => {
            render(<AdminSurfaceTabs role={StaffRoles.COOK} activeTab="orders" onChange={jest.fn()} />);

            expect(screen.queryByTestId("admin-surface-tabs")).toBeNull();
        });

        it("renders nothing for role SUPERVISOR", () => {
            render(<AdminSurfaceTabs role={StaffRoles.SUPERVISOR} activeTab="orders" onChange={jest.fn()} />);

            expect(screen.queryByTestId("admin-surface-tabs")).toBeNull();
        });

        it("renders nothing for role REVIEWER", () => {
            render(<AdminSurfaceTabs role={StaffRoles.REVIEWER} activeTab="orders" onChange={jest.fn()} />);

            expect(screen.queryByTestId("admin-surface-tabs")).toBeNull();
        });

        it("renders both tab options for role MANAGER", () => {
            render(<AdminSurfaceTabs role={StaffRoles.MANAGER} activeTab="orders" onChange={jest.fn()} />);

            expect(screen.getByTestId("admin-tab-orders")).toBeTruthy();
            expect(screen.getByTestId("admin-tab-board")).toBeTruthy();
        });

        it("renders both tab options for role SUPER_MANAGER", () => {
            render(<AdminSurfaceTabs role={StaffRoles.SUPER_MANAGER} activeTab="orders" onChange={jest.fn()} />);

            expect(screen.getByTestId("admin-tab-orders")).toBeTruthy();
            expect(screen.getByTestId("admin-tab-board")).toBeTruthy();
        });
    });

    describe("onChange", () => {
        it("calls onChange('board') exactly once when clicking the board tab", () => {
            const onChange = jest.fn<void, [string]>();
            render(<AdminSurfaceTabs role={StaffRoles.MANAGER} activeTab="orders" onChange={onChange} />);

            fireEvent.click(screen.getByTestId("admin-tab-board"));

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith("board");
        });

        it("calls onChange('orders') exactly once when clicking the orders tab", () => {
            const onChange = jest.fn<void, [string]>();
            render(<AdminSurfaceTabs role={StaffRoles.MANAGER} activeTab="board" onChange={onChange} />);

            fireEvent.click(screen.getByTestId("admin-tab-orders"));

            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith("orders");
        });
    });
});
