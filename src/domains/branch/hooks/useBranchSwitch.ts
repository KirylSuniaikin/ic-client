import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { fetchBaseAppInfo } from "../../../shared/api/public";
import type { CartItem } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";
import { writeChosenBranch } from "../utils/customerBranch";
import { useBranchResolution } from "./useBranchResolution";

export interface UseBranchSwitchParams {
    cartItems: CartItem[];
    setCartItems: Dispatch<SetStateAction<CartItem[]>>;
    refreshMenu: () => Promise<void>;
}

export interface UseBranchSwitchResult {
    pickerOpen: boolean;
    openPicker: () => void;
    closePicker: () => void;
    /** Handler for BranchPickerDrawer's onSelect when it is reopened voluntarily (task-spec.md §6.4). */
    handleBranchSelected: (branch: IBranch) => void;
    warningOpen: boolean;
    warningLoading: boolean;
    warningTargetBranch: IBranch | null;
    warningUnavailableNames: string[];
    warningError: string | null;
    confirmSwitch: () => void;
    cancelSwitch: () => void;
}

/**
 * Re-entry branch switch (task-spec.md §6.4). `useBranchResolution` only reads/resolves — this
 * hook is the one place that WRITES a mid-session branch change, and it never reimplements branch
 * resolution itself.
 */
export function useBranchSwitch({ cartItems, setCartItems, refreshMenu }: UseBranchSwitchParams): UseBranchSwitchResult {
    const { chosenBranchId } = useBranchResolution();

    const [pickerOpen, setPickerOpen] = useState(false);
    const [warningOpen, setWarningOpen] = useState(false);
    const [warningLoading, setWarningLoading] = useState(false);
    const [warningTargetBranch, setWarningTargetBranch] = useState<IBranch | null>(null);
    const [warningUnavailableNames, setWarningUnavailableNames] = useState<string[]>([]);
    const [warningError, setWarningError] = useState<string | null>(null);

    // Guards against a stale fetch resolving after the customer already cancelled (or reopened
    // the picker and started a second check) — only the most recent request's result is applied.
    const requestIdRef = useRef(0);

    function openPicker(): void {
        setPickerOpen(true);
    }

    function closePicker(): void {
        setPickerOpen(false);
    }

    function clearWarningState(): void {
        requestIdRef.current += 1;
        setWarningOpen(false);
        setWarningLoading(false);
        setWarningTargetBranch(null);
        setWarningUnavailableNames([]);
        setWarningError(null);
    }

    function switchToBranch(branch: IBranch): void {
        writeChosenBranch(branch);
        void refreshMenu();
    }

    async function checkTargetAvailability(branch: IBranch, requestId: number): Promise<void> {
        try {
            const baseInfo = await fetchBaseAppInfo(null, branch.id);
            if (requestIdRef.current !== requestId) return;
            const unavailableNames = cartItems
                .filter(item => !baseInfo.menu.some(menuItem => menuItem.name === item.name && menuItem.available === true))
                .map(item => item.name);
            setWarningUnavailableNames(unavailableNames);
            setWarningLoading(false);
        } catch (error) {
            if (requestIdRef.current !== requestId) return;
            setWarningError(error instanceof Error ? error.message : String(error));
            setWarningLoading(false);
        }
    }

    function handleBranchSelected(branch: IBranch): void {
        setPickerOpen(false);

        if (branch.id === chosenBranchId) return;

        if (cartItems.length === 0) {
            switchToBranch(branch);
            return;
        }

        requestIdRef.current += 1;
        const requestId = requestIdRef.current;
        setWarningTargetBranch(branch);
        setWarningUnavailableNames([]);
        setWarningError(null);
        setWarningOpen(true);
        setWarningLoading(true);
        void checkTargetAvailability(branch, requestId);
    }

    function confirmSwitch(): void {
        if (!warningTargetBranch) return;
        const target = warningTargetBranch;
        const namesToRemove = warningUnavailableNames;
        setCartItems(prev => prev.filter(item => !namesToRemove.includes(item.name)));
        switchToBranch(target);
        clearWarningState();
    }

    function cancelSwitch(): void {
        clearWarningState();
    }

    return {
        pickerOpen, openPicker, closePicker, handleBranchSelected,
        warningOpen, warningLoading, warningTargetBranch, warningUnavailableNames, warningError,
        confirmSwitch, cancelSwitch,
    };
}
