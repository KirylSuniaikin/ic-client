import { Dialog, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ManagementTopBar } from '../../_shared/components/ManagementTopBar';
import { CourierDispatcherPanel } from '../../couriers/components/CourierDispatcherPanel';
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
    courierDispatcherOpen: boolean;
    onCourierDispatcherClose: () => void;
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
    courierDispatcherOpen,
    onCourierDispatcherClose,
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

            {/* §4. Not branch-scoped like the others: the panel lists every courier across
                branches, and a manager triaging a stuck delivery needs to see all of them. */}
            {courierDispatcherOpen && (
                <Dialog
                    fullScreen
                    open={courierDispatcherOpen}
                    onClose={onCourierDispatcherClose}
                    PaperProps={{ sx: { backgroundColor: '#fbfaf6' } }}
                >
                    {/* The same bar every other management screen opens with, rather than a bare
                        DialogTitle — this panel used to be the one place that looked borrowed. */}
                    <ManagementTopBar title="Delivery" onBack={onCourierDispatcherClose} />
                    <CourierDispatcherPanel />
                </Dialog>
            )}
        </>
    );
}
