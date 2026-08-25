import React from "react";
import AddIcon from "@mui/icons-material/Add";
import HistoryIcon from "@mui/icons-material/History";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import SettingsIcon from "@mui/icons-material/Settings";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import { StaffRoles } from "../../../auth/types";
import type { StaffRoles as StaffRolesType } from "../../../auth/types";

export type AdminNavItem = {
    label: string;
    icon: React.ReactElement;
    onClick: () => void;
};

export type AdminNavSection = {
    title: string;
    items: AdminNavItem[];
};

// Same handler set AdminTopbar already receives as props — nothing added or removed.
export type AdminNavHandlers = {
    onGoToMenu: () => void;
    onShiftManagementPageOpen: () => void;
    onOpenHistory: () => void;
    onOpenConfig: () => void;
    onOpenStatistics: () => void;
    onManagementPageOpen: () => void;
    onPurchaseOpen: () => void;
    onCashRegisterOpen: () => void;
    onAccountingOpen: () => void;
    onBlacklistopen: () => void;
    onAccountManagerOpen: () => void;
    logout: () => void;
};

/**
 * Pure derivation of the admin nav sections for a given role. Replaces the flat
 * cookBaseItems/managerItems/cookItems/supervisorItems/reviewerItems/items ternary chain that
 * used to live inline in AdminTopbar.tsx — the membership per role is unchanged, only the
 * grouping into named sections and the shape of the result (sections, not one flat array) is
 * new. Logout is intentionally not part of any section — AdminNavDrawer pins it separately.
 */
export function buildAdminNavSections(
    role: StaffRolesType | null,
    handlers: AdminNavHandlers
): AdminNavSection[] {
    const isReviewer = role === StaffRoles.REVIEWER;
    const isCook = role === StaffRoles.COOK;
    const isSupervisor = role === StaffRoles.SUPERVISOR;

    // Mirrors the former reviewerItems / cookItems / supervisorItems / managerItems membership
    // (minus Logout, which is no longer part of the flat/sectioned item list).
    const visibleLabels: Set<string> = isReviewer
        ? new Set(["Order History"])
        : isCook
            ? new Set(["New Order", "Shifts", "Order History", "Config", "Statistics"])
            : isSupervisor
                ? new Set(["New Order", "Shifts", "Order History", "Config", "Statistics", "Cash Register"])
                : new Set([
                    "New Order", "Shifts", "Order History", "Statistics", "Config",
                    "Inventory", "Purchase", "Cash Register", "Accounting", "Blacklist",
                    // Manager-and-up only, matching the backend gate on /api/staff/**. A COOK or
                    // SUPERVISOR reaching it would only be 403'd.
                    "Account Manager",
                ]);

    const operations: AdminNavItem[] = [
        {label: "New Order", icon: <AddIcon fontSize="small"/>, onClick: handlers.onGoToMenu},
        {label: "Order History", icon: <HistoryIcon fontSize="small"/>, onClick: handlers.onOpenHistory},
        {label: "Shifts", icon: <ScheduleIcon fontSize="small"/>, onClick: handlers.onShiftManagementPageOpen},
    ];

    const money: AdminNavItem[] = [
        {label: "Cash Register", icon: <ReceiptLongIcon fontSize="small"/>, onClick: handlers.onCashRegisterOpen},
        {label: "Purchase", icon: <ShoppingCartOutlinedIcon fontSize="small"/>, onClick: handlers.onPurchaseOpen},
        {label: "Accounting", icon: <AccountBalanceWalletOutlinedIcon fontSize="small"/>, onClick: handlers.onAccountingOpen},
    ];

    const management: AdminNavItem[] = [
        {label: "Inventory", icon: <Inventory2OutlinedIcon fontSize="small"/>, onClick: handlers.onManagementPageOpen},
        {label: "Statistics", icon: <StackedLineChartIcon fontSize="small"/>, onClick: handlers.onOpenStatistics},
        {label: "Config", icon: <SettingsIcon fontSize="small"/>, onClick: handlers.onOpenConfig},
        {label: "Blacklist", icon: <PersonOffIcon fontSize="small"/>, onClick: handlers.onBlacklistopen},
        {label: "Account Manager", icon: <ManageAccountsOutlinedIcon fontSize="small"/>, onClick: handlers.onAccountManagerOpen},
    ];

    const filterByRole = (items: AdminNavItem[]): AdminNavItem[] =>
        items.filter(item => visibleLabels.has(item.label));

    return [
        {title: "Operations", items: filterByRole(operations)},
        {title: "Money", items: filterByRole(money)},
        {title: "Management", items: filterByRole(management)},
    ];
}
