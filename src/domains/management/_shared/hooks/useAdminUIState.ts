import { useState } from 'react';
import type { Order } from '../../../order/types';

export type AdminUIState = {
    isHistoryOpen: boolean; setIsHistoryOpen: (v: boolean) => void;
    isConfigOpen: boolean; setIsConfigOpen: (v: boolean) => void;
    isStatisticsOpen: boolean; setIsStatisticsOpen: (v: boolean) => void;
    shiftPopupOpen: boolean; setShiftPopupOpen: (v: boolean) => void;
    cashPopupOpen: boolean; setCashPopupOpen: (v: boolean) => void;
    cashWarning: string | null; setCashWarning: (v: string | null) => void;
    paymentDialogOpen: boolean; setPaymentDialogOpen: (v: boolean) => void;
    selectedOrder: Order | null; setSelectedOrder: (v: Order | null) => void;
    purchasePopupOpen: boolean; setPurchasePopupOpen: (v: boolean) => void;
    managementPageOpen: boolean; setManagementPageOpen: (v: boolean) => void;
    shiftManagementPageOpen: boolean; setShiftManagementPageOpen: (v: boolean) => void;
    blacklistOpen: boolean; setBlacklistOpen: (v: boolean) => void;
    cashRegisterOpen: boolean; setCashRegisterOpen: (v: boolean) => void;
    accountingOpen: boolean; setAccountingOpen: (v: boolean) => void;
};

export function useAdminUIState(): AdminUIState {
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isStatisticsOpen, setIsStatisticsOpen] = useState(false);
    const [shiftPopupOpen, setShiftPopupOpen] = useState(false);
    const [cashPopupOpen, setCashPopupOpen] = useState(false);
    const [cashWarning, setCashWarning] = useState<string | null>(null);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [purchasePopupOpen, setPurchasePopupOpen] = useState(false);
    const [managementPageOpen, setManagementPageOpen] = useState(false);
    const [shiftManagementPageOpen, setShiftManagementPageOpen] = useState(false);
    const [blacklistOpen, setBlacklistOpen] = useState(false);
    const [cashRegisterOpen, setCashRegisterOpen] = useState(false);
    const [accountingOpen, setAccountingOpen] = useState(false);

    return {
        isHistoryOpen, setIsHistoryOpen,
        isConfigOpen, setIsConfigOpen,
        isStatisticsOpen, setIsStatisticsOpen,
        shiftPopupOpen, setShiftPopupOpen,
        cashPopupOpen, setCashPopupOpen,
        cashWarning, setCashWarning,
        paymentDialogOpen, setPaymentDialogOpen,
        selectedOrder, setSelectedOrder,
        purchasePopupOpen, setPurchasePopupOpen,
        managementPageOpen, setManagementPageOpen,
        shiftManagementPageOpen, setShiftManagementPageOpen,
        blacklistOpen, setBlacklistOpen,
        cashRegisterOpen, setCashRegisterOpen,
        accountingOpen, setAccountingOpen,
    };
}
