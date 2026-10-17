import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook, act, waitFor } from "@testing-library/react";
import { fetchBaseAppInfo } from "../../../shared/api/public";
import { writeChosenBranch, readChosenBranch } from "../utils/customerBranch";
import { useBranchSwitch } from "./useBranchSwitch";
import type { BaseAppInfoResponse } from "../../order/types";
import type { CartItem } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";

jest.mock("../../../shared/api/public");

const mockFetchBaseAppInfo = jest.mocked(fetchBaseAppInfo);

const CURRENT_BRANCH: IBranch = {
    id: "branch-current", externalId: "ext-1", branchNo: 1, branchName: "Seef", locale: "en",
    latitude: null, longitude: null,
};

const TARGET_BRANCH: IBranch = {
    id: "branch-target", externalId: "ext-2", branchNo: 2, branchName: "Juffair", locale: "en",
    latitude: null, longitude: null,
};

const CART_ITEMS = [
    { id: 1, name: "Pepperoni Pizza", size: "M", category: "Pizzas", amount: 3.5, quantity: 1 },
    { id: 2, name: "Water", size: "", category: "Beverages", amount: 0.5, quantity: 1 },
] as unknown as CartItem[];

function baseInfo(menuNames: Array<{ name: string; available: boolean }>): BaseAppInfoResponse {
    return {
        menu: menuNames.map((m, i) => ({
            available: m.available, category: "", description: "", id: i, is_best_seller: false,
            name: m.name, photo: "", price: 0, size: "",
        })),
        extraIngr: [], toppings: [], isSDoughAvailable: false, userInfo: null,
    };
}

function setup(cartItems: CartItem[] = CART_ITEMS) {
    const setCartItems = jest.fn();
    const refreshMenu = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
        (props: { cartItems: CartItem[] }) => useBranchSwitch({
            cartItems: props.cartItems, setCartItems, refreshMenu,
        }),
        { initialProps: { cartItems } }
    );
    return { result, rerender, setCartItems, refreshMenu };
}

describe("useBranchSwitch", () => {
    beforeEach(() => {
        localStorage.clear();
        writeChosenBranch(CURRENT_BRANCH);
        mockFetchBaseAppInfo.mockReset();
    });

    it("selecting the branch already chosen is a no-op", () => {
        const { result, refreshMenu } = setup();

        act(() => { result.current.handleBranchSelected(CURRENT_BRANCH); });

        expect(result.current.pickerOpen).toBe(false);
        expect(result.current.warningOpen).toBe(false);
        expect(refreshMenu).not.toHaveBeenCalled();
        expect(readChosenBranch()?.id).toBe(CURRENT_BRANCH.id);
    });

    it("switches immediately with no warning when the cart is empty", () => {
        const { result, refreshMenu } = setup([]);

        act(() => { result.current.handleBranchSelected(TARGET_BRANCH); });

        expect(result.current.warningOpen).toBe(false);
        expect(readChosenBranch()?.id).toBe(TARGET_BRANCH.id);
        expect(refreshMenu).toHaveBeenCalledTimes(1);
    });

    it("opens the warning with a spinner while checking the target branch", async () => {
        let resolveFetch: (value: BaseAppInfoResponse) => void = () => undefined;
        mockFetchBaseAppInfo.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
        const { result } = setup();

        act(() => { result.current.handleBranchSelected(TARGET_BRANCH); });

        expect(result.current.warningOpen).toBe(true);
        expect(result.current.warningLoading).toBe(true);
        expect(result.current.warningTargetBranch).toEqual(TARGET_BRANCH);
        expect(mockFetchBaseAppInfo).toHaveBeenCalledWith(null, TARGET_BRANCH.id);

        await act(async () => { resolveFetch(baseInfo([{ name: "Pepperoni Pizza", available: true }, { name: "Water", available: true }])); });

        expect(result.current.warningLoading).toBe(false);
    });

    it("collects the names of cart items unavailable at the target branch (§6.4 step 4)", async () => {
        mockFetchBaseAppInfo.mockResolvedValue(
            baseInfo([{ name: "Pepperoni Pizza", available: false }, { name: "Water", available: true }])
        );
        const { result } = setup();

        act(() => { result.current.handleBranchSelected(TARGET_BRANCH); });
        await waitFor(() => expect(result.current.warningLoading).toBe(false));

        expect(result.current.warningUnavailableNames).toEqual(["Pepperoni Pizza"]);
    });

    it("treats an item absent from the target menu entirely as unavailable", async () => {
        mockFetchBaseAppInfo.mockResolvedValue(baseInfo([{ name: "Water", available: true }]));
        const { result } = setup();

        act(() => { result.current.handleBranchSelected(TARGET_BRANCH); });
        await waitFor(() => expect(result.current.warningLoading).toBe(false));

        expect(result.current.warningUnavailableNames).toEqual(["Pepperoni Pizza"]);
    });

    it("confirmSwitch drops only the unavailable lines and switches (§6.4 step 6)", async () => {
        mockFetchBaseAppInfo.mockResolvedValue(
            baseInfo([{ name: "Pepperoni Pizza", available: false }, { name: "Water", available: true }])
        );
        const { result, setCartItems, refreshMenu } = setup();

        act(() => { result.current.handleBranchSelected(TARGET_BRANCH); });
        await waitFor(() => expect(result.current.warningLoading).toBe(false));
        act(() => { result.current.confirmSwitch(); });

        expect(setCartItems).toHaveBeenCalledTimes(1);
        // setCartItems is an untyped jest.fn() (no generic), so its recorded call argument is
        // `any` — asserted back to the functional-updater shape the hook is documented to pass.
        const updater = setCartItems.mock.calls[0][0] as (prev: CartItem[]) => CartItem[];
        expect(updater(CART_ITEMS).map(i => i.name)).toEqual(["Water"]);

        expect(readChosenBranch()?.id).toBe(TARGET_BRANCH.id);
        expect(refreshMenu).toHaveBeenCalledTimes(1);
        expect(result.current.warningOpen).toBe(false);
    });

    it("cancelSwitch clears warning state and leaves the cart and chosen branch untouched (§6.4 step 7)", async () => {
        mockFetchBaseAppInfo.mockResolvedValue(baseInfo([{ name: "Pepperoni Pizza", available: false }]));
        const { result, setCartItems, refreshMenu } = setup();

        act(() => { result.current.handleBranchSelected(TARGET_BRANCH); });
        await waitFor(() => expect(result.current.warningLoading).toBe(false));
        act(() => { result.current.cancelSwitch(); });

        expect(setCartItems).not.toHaveBeenCalled();
        expect(refreshMenu).not.toHaveBeenCalled();
        expect(readChosenBranch()?.id).toBe(CURRENT_BRANCH.id);
        expect(result.current.warningOpen).toBe(false);
        expect(result.current.warningTargetBranch).toBeNull();
    });

    it("on fetch failure, surfaces the error and does not switch (§6.4 step 5)", async () => {
        mockFetchBaseAppInfo.mockRejectedValue(new Error("Network down"));
        const { result, refreshMenu } = setup();

        act(() => { result.current.handleBranchSelected(TARGET_BRANCH); });
        await waitFor(() => expect(result.current.warningLoading).toBe(false));

        expect(result.current.warningError).toBe("Network down");
        expect(result.current.warningLoading).toBe(false);
        expect(refreshMenu).not.toHaveBeenCalled();
        expect(readChosenBranch()?.id).toBe(CURRENT_BRANCH.id);
    });

    it("openPicker/closePicker toggle pickerOpen", () => {
        const { result } = setup();

        act(() => { result.current.openPicker(); });
        expect(result.current.pickerOpen).toBe(true);

        act(() => { result.current.closePicker(); });
        expect(result.current.pickerOpen).toBe(false);
    });
});
