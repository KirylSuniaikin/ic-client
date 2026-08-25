import React from 'react';
import type { IBranch } from '../../inventory/types';
import { PurchasePopup } from '../../purchases/components/PurchasePopup';
import BlacklistHomepage from '../../blacklist/components/BlacklistHomepage';
import CashRegisterPopup from '../../cash-register/components/CashRegisterPopup';
import ManagementPage from '../../inventory/components/InventoryPage';
import { ShiftHomePage } from '../../shift/components/ShiftHomePage';
import { AccountingHomePage } from '../../accounting/components/AccountingHomePage';
import AccountManagerScreen from '../../staff/components/AccountManagerScreen';
import type { StaffRoles } from '../../../auth/types';

type Props = {
    selectedBranch: IBranch | null;
    userId: number | null;
    username: string | null;
    purchasePopupOpen: boolean;
    onPurchaseClose: () => void;
    blacklistOpen: boolean;
    onBlacklistClose: () => void;
    cashRegisterOpen: boolean;
    onCashRegisterClose: () => void;
    managementPageOpen: boolean;
    onManagementPageClose: () => void;
    shiftManagementPageOpen: boolean;
    onShiftManagementPageClose: () => void;
    accountingOpen: boolean;
    onAccountingClose: () => void;
    accountManagerOpen: boolean;
    onAccountManagerClose: () => void;
    role: StaffRoles | null;
};

export function AdminPageModals({
    selectedBranch,
    userId,
    username,
    purchasePopupOpen,
    onPurchaseClose,
    blacklistOpen,
    onBlacklistClose,
    cashRegisterOpen,
    onCashRegisterClose,
    managementPageOpen,
    onManagementPageClose,
    shiftManagementPageOpen,
    onShiftManagementPageClose,
    accountingOpen,
    onAccountingClose,
    accountManagerOpen,
    onAccountManagerClose,
    role,
}: Props): JSX.Element {
    const currentUser = { userName: username, id: userId };

    return (
        <>
            {purchasePopupOpen && selectedBranch && (
                <PurchasePopup open={purchasePopupOpen} onClose={onPurchaseClose} adminId={userId ?? 0} branch={selectedBranch} />
            )}
            {blacklistOpen && (
                <BlacklistHomepage open={blacklistOpen} handleClose={onBlacklistClose} />
            )}
            {cashRegisterOpen && selectedBranch && (
                <CashRegisterPopup open={cashRegisterOpen} handleClose={onCashRegisterClose} branch={selectedBranch} />
            )}
            {managementPageOpen && selectedBranch && currentUser.id && (
                <ManagementPage isOpen={managementPageOpen} onClose={onManagementPageClose}
                    user={currentUser as { userName: string | null; id: number }} branch={selectedBranch} />
            )}
            {shiftManagementPageOpen && selectedBranch && (
                <ShiftHomePage open={shiftManagementPageOpen} onClose={onShiftManagementPageClose} branch={selectedBranch} />
            )}
            {accountingOpen && selectedBranch && (
                <AccountingHomePage open={accountingOpen} onClose={onAccountingClose} branch={selectedBranch} />
            )}
            {accountManagerOpen && selectedBranch && (
                <AccountManagerScreen open={accountManagerOpen} onClose={onAccountManagerClose} role={role} branch={selectedBranch} />
            )}
        </>
    );
}
