import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfigComponent from "./ConfigComponent";
import { ManagementBranchScopeProvider } from "../../_shared/context/ManagementBranchScope";
import { fetchBaseAppInfo } from "../../../../shared/api/public";
import { getDoughInventory } from "../../../../shared/api/management";
import { StaffRoles } from "../../../auth/types";
import type { IBranch } from "../../inventory/types";
import type { BaseAppInfoResponse } from "../../../order/types";
import type { DoughStatus } from "../../dough/types";

/**
 * Where the delivery configuration actually lives (manual §02 "Delivery configuration").
 *
 * `ConfigComponent`'s only existing suite is about the branch selector and contains no reference
 * to delivery at all — so the switch and the zone editor could have been unmounted, moved to a tab
 * nobody can reach, or handed the wrong branch, with the whole suite green. Both components have
 * thorough suites of their own; what was missing is that anything mounts them.
 *
 * They are probes here for the usual reason: rendering them for real would fire their own requests
 * and this file is about the wiring, not about either component's behaviour.
 */

jest.mock("../../../../shared/api/public");
jest.mock("../../../../shared/api/management");

// ScheduleView owns useSchedule and would fire its own request the moment the tab mounts.
jest.mock("./ScheduleView", () => ({
    __esModule: true,
    default: () => null,
}));

const mockDeliverySwitch = jest.fn();
jest.mock("./DeliverySwitch", () => ({
    __esModule: true,
    default: (props: unknown) => {
        mockDeliverySwitch(props);
        return <div>DeliverySwitchProbe</div>;
    },
}));

const mockZonesSection = jest.fn();
jest.mock("./DeliveryZonesSection", () => ({
    __esModule: true,
    default: (props: unknown) => {
        mockZonesSection(props);
        return <div>DeliveryZonesSectionProbe</div>;
    },
}));

const mockFetchBaseAppInfo = jest.mocked(fetchBaseAppInfo);
const mockGetDoughInventory = jest.mocked(getDoughInventory);

const BRANCH_A = {
    id: "branch-a", externalId: "A", branchNo: 1, branchName: "Al Hidd", locale: "en",
    latitude: 26.2285, longitude: 50.586, deliveryEnabled: true, deliveryRadiusKm: 7,
} as unknown as IBranch;

// `deliveryRadiusKm` is ABSENT rather than null: that is the shape a branch payload written before
// the column existed actually has, and it is the only one that tells `?? null` apart from nothing
// at all. With an explicit null both spellings produce null and the assertion below proves nothing.
const BRANCH_B = {
    id: "branch-b", externalId: "B", branchNo: 2, branchName: "Riffa", locale: "en",
    latitude: 26.13, longitude: 50.55, deliveryEnabled: false,
} as unknown as IBranch;

function renderConfig(role: StaffRoles = StaffRoles.SUPER_MANAGER, branches: IBranch[] = [BRANCH_A, BRANCH_B]): void {
    render(
        <ManagementBranchScopeProvider branches={branches} homeBranch={BRANCH_A}>
            <ConfigComponent isOpen onClose={jest.fn()} selectedBranch={BRANCH_A} role={role} />
        </ManagementBranchScopeProvider>,
    );
}

async function openDeliveryTab(): Promise<void> {
    await waitFor(() => expect(screen.getByText("Menu Availability")).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "Delivery" }));
}

beforeEach(() => {
    jest.clearAllMocks();
    mockFetchBaseAppInfo.mockResolvedValue({ menu: [] } as unknown as BaseAppInfoResponse);
    mockGetDoughInventory.mockResolvedValue({ S: 0, M: 0, L: 0, Brick: 0 } as unknown as DoughStatus);
});

describe("ConfigComponent — the delivery configuration surface", () => {
    /**
     * Both live on their own Delivery tab. They used to sit under Schedule, which shares their
     * role gate but not their subject: the switch answers "is this kitchen delivering today" and
     * the zones answer "where to", and neither is a question about opening hours. The coverage map
     * was unfindable filed under a word that means something else.
     *
     * Originally: they answer "what is this one kitchen
     * delivering today", and they need the MANAGER-and-up roles that `/api/management/delivery/**`
     * requires — which is exactly the audience that tab is already gated to.
     */
    it("mounts the delivery switch and the zone editor on their own Delivery tab", async () => {
        renderConfig();
        await openDeliveryTab();

        expect(screen.getByText("DeliverySwitchProbe")).toBeTruthy();
        expect(screen.getByText("DeliveryZonesSectionProbe")).toBeTruthy();
    });

    it("keeps them off the Menu tab, which is about the menu", async () => {
        renderConfig();
        await waitFor(() => expect(screen.getByText("Menu Availability")).toBeTruthy());

        expect(screen.queryByText("DeliverySwitchProbe")).toBeNull();
        expect(screen.queryByText("DeliveryZonesSectionProbe")).toBeNull();
    });

    /** Both are scoped to whichever branch the selector currently points at, not to a default. */
    it("scopes both to the branch in scope, with that branch's own delivery state", async () => {
        renderConfig();
        await openDeliveryTab();

        expect(mockDeliverySwitch).toHaveBeenLastCalledWith(expect.objectContaining({
            branchId: "branch-a",
            deliveryEnabled: true,
        }));
        expect(mockZonesSection).toHaveBeenLastCalledWith(expect.objectContaining({
            branchId: "branch-a",
            branchLatitude: 26.2285,
            branchLongitude: 50.586,
        }));
    });

    /**
     * The radius is what the coverage circle is drawn from (manual §02: "Radius per branch").
     * A branch whose payload carries none must hand the map `null` rather than `undefined`, so the
     * map draws nothing instead of a circle of unknown size.
     */
    it("hands the map the branch's own radius", async () => {
        renderConfig();
        await openDeliveryTab();

        expect(mockZonesSection).toHaveBeenLastCalledWith(
            expect.objectContaining({ branchRadiusKm: 7 }));
    });

    /**
     * A branch whose payload carries no radius must hand the map `null`, not `undefined`: the map
     * draws nothing for null, and a circle of unknown size is worse than no circle at all.
     */
    it("hands the map null when the branch payload carries no radius", async () => {
        render(
            <ManagementBranchScopeProvider branches={[BRANCH_B]} homeBranch={BRANCH_B}>
                <ConfigComponent isOpen onClose={jest.fn()} selectedBranch={BRANCH_B}
                                 role={StaffRoles.SUPER_MANAGER} />
            </ManagementBranchScopeProvider>,
        );
        await openDeliveryTab();

        expect(mockZonesSection).toHaveBeenLastCalledWith(
            expect.objectContaining({ branchRadiusKm: null }));
    });

    /**
     * A COOK cannot reach the Delivery tab at all, which is how the delivery surface inherits the
     * backend's own gate on `/api/management/delivery/**` without a second role check of its own.
     * Asserting against a role that HAS the tab and one that does not is what makes this mean
     * something — a gate that merely excluded a role nobody has would prove nothing.
     */
    it("is unreachable for a role that cannot open the Delivery tab", async () => {
        renderConfig(StaffRoles.COOK);
        await waitFor(() => expect(screen.getByText("Menu Availability")).toBeTruthy());

        expect(screen.queryByRole("button", { name: "Schedule" })).toBeNull();
        expect(screen.queryByText("DeliverySwitchProbe")).toBeNull();
    });

    /**
     * A half-drawn zone is unsaved work like any other. Switching branch under it would either
     * discard it silently or — worse — leave it pointing at a kitchen it was not drawn for.
     */
    it("warns before a branch switch throws away an unsaved zone", async () => {
        renderConfig();
        await openDeliveryTab();

        // Nothing pending yet: switching goes straight through.
        await userEvent.click(screen.getByRole("combobox"));
        await userEvent.click(await screen.findByRole("option", { name: /Riffa/ }));
        expect(screen.queryByText("Discard changes?")).toBeNull();

        // Now the editor reports a dirty draft, which is the only signal ConfigComponent has.
        const { onDirtyChange } = mockZonesSection.mock.calls[
            mockZonesSection.mock.calls.length - 1
        ][0] as { onDirtyChange: (dirty: boolean) => void };
        act(() => { onDirtyChange(true); });

        await userEvent.click(screen.getByRole("combobox"));
        await userEvent.click(await screen.findByRole("option", { name: /Al Hidd/ }));

        expect(await screen.findByText("Discard changes?")).toBeTruthy();
        // The copy names the zone draft explicitly — a generic "unsaved changes" would leave the
        // manager guessing which of the three editors on this screen they are about to lose.
        expect(screen.getByText(/delivery-zone/)).toBeTruthy();
    });
});
