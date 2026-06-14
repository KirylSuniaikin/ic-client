import React from 'react';
import type { IBranch } from '../../inventory/types';
import { PurchasePopup } from '../../purchases/components/PurchasePopup';
import BlacklistHomepage from '../../blacklist/components/BlacklistHomepage';
import CashRegisterPopup from '../../cash-register/components/CashRegisterPopup';
import ManagementPage from '../../inventory/components/InventoryPage';
import { ShiftHomePage } from '../../shift/components/ShiftHomePage';
import { AccountingHomePage } from '../../accounting/components/AccountingHomePage';

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
        </>
    );
}
