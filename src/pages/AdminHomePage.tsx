import React, { useEffect, useRef } from "react";
import { Alert, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import PizzaLoader from "../domains/order-status/components/animations/PizzaLoader";
import { useAuth } from "../domains/auth/context/AuthProvider";
import { useAdminOrders } from "../domains/management/orders/hooks/useAdminOrders";
import { useDough } from "../domains/management/dough/hooks/useDough";
import { useDeleteOrder } from "../domains/management/orders/hooks/useDeleteOrder";
import { useOrderActions } from "../domains/management/orders/hooks/useOrderActions";
import { useAdminBranchInit } from "../domains/management/_shared/hooks/useBranchSelection";
import { useWakeLock } from "../domains/management/_shared/hooks/useWakeLock";
import { useAlertAudio } from "../domains/management/_shared/hooks/useAlertAudio";
import { useAdminUIState } from "../domains/management/_shared/hooks/useAdminUIState";
import OrderCard from "../domains/management/orders/components/OrderCard";
import AdminTopbar from "../domains/management/orders/components/AdminTopbar";
import HistoryComponent from "../domains/management/orders/components/HistoryComponent";
import ConfigComponent from "../domains/management/config/components/ConfigComponent";
import StatisticsComponent from "../domains/management/statistics/components/StatisticsComponent";
import ShiftPopup from "../domains/management/shift/components/ShiftPopup";
import useClosingAlarm from "../domains/management/shift/hooks/useClosingAlarm";
import PaymentPopup from "../domains/management/orders/components/PaymentPopup";
import { AdminPageModals } from "../domains/management/orders/components/AdminPageModals";
import CashPopup from "../domains/management/shift/components/CashPopup";
import BluetoothPrinterService from "../services/BluetoothPrinterService";
import { DeleteOrderDialog } from "../domains/management/orders/components/DeleteOrderDialog";
import ErrorSnackbar from "../shared/components/ErrorSnackbar";
import DoughSection from "../domains/management/dough/components/DoughSection";
import { ExternalOrderAlert } from "../domains/management/orders/components/ExternalOrderAlert";
import { EditedOrderAlert } from "../domains/management/orders/components/EditedOrderAlert";

function AdminHomePage(): JSX.Element {
    const { username, branchId, userId, role, logout } = useAuth();
    const { availableBranches, selectedBranch, setSelectedBranch, branchError } = useAdminBranchInit(branchId, role);
    const navigate = useNavigate();
    const ui = useAdminUIState();
    const selectedBranchIdStr = selectedBranch ? String(selectedBranch.id) : null;
    // Proxy breaks circular dep: useAdminOrders needs stopSound before useAlertAudio can provide it
    const audioStopRef = useRef<() => void>(() => {});
    const stopSoundProxy = (): void => audioStopRef.current();
    const { orders, setOrders, alertOrder, setAlertOrder, editedOrder, setEditedOrder, workloadLevel, setWorkloadLevel,
        cashStage, eventStage, doughStatus, setDoughStatus, doughAlertOpen, doughAlertMessage, clearDoughAlert, loading,
    } = useAdminOrders(selectedBranchIdStr, stopSoundProxy);
    const { stopSound } = useAlertAudio(alertOrder, editedOrder);
    audioStopRef.current = stopSound;
    const { deleteDialogOpen, orderToDelete, handleDeleteClick, confirmDelete, cancelDelete } = useDeleteOrder(id => setOrders(prev => prev.filter(o => o.id !== id)));
    const { doughLoading, onDoughInventoryChange, onDoughAvailabilityToggle } = useDough(selectedBranchIdStr, doughStatus, setDoughStatus);
    const orderActions = useOrderActions({ setAlertOrder, setOrders });
    useWakeLock();
    useClosingAlarm(true);
    useEffect(() => { void (async (): Promise<void> => { await BluetoothPrinterService.init(); await BluetoothPrinterService.connect(); BluetoothPrinterService.startConnectionMonitor(); })(); }, []);
    if (loading) return <PizzaLoader />;
    if (branchError) return <div>Error: {branchError}</div>;
    const sortedOrders = [...orders].sort((a, b) => new Date(a.order_created).getTime() - new Date(b.order_created).getTime());
    const branchForComponents = selectedBranch ? { ...selectedBranch, id: String(selectedBranch.id) } : null; // id: string for History/Config
    const handlePaymentSuccess = (orderId: string): void => setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isPaid: true } : o));
    return (
        <div className="p-4 max-w-4xl mx-auto">
            {ui.cashWarning && (
                <Box sx={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, width: '90%', maxWidth: 480 }}>
                    <Alert severity="warning" variant="filled" onClose={() => ui.setCashWarning(null)}
                        sx={{ backgroundColor: "#fff3f3", color: "#B00020", fontWeight: 500, fontSize: "1rem" }}>
                        Cash mismatch!
                    </Alert>
                </Box>
            )}
            <PaymentPopup open={ui.paymentDialogOpen} onClose={() => ui.setPaymentDialogOpen(false)} order={ui.selectedOrder} onPaymentSuccess={handlePaymentSuccess} />
            {!ui.isHistoryOpen && !ui.isConfigOpen && !ui.isStatisticsOpen && !ui.managementPageOpen && selectedBranch && (
                <AdminTopbar
                    onOpenHistory={() => ui.setIsHistoryOpen(true)} onOpenStatistics={() => ui.setIsStatisticsOpen(true)}
                    onOpenConfig={() => ui.setIsConfigOpen(true)} onGoToMenu={() => navigate('/menu?isAdmin=true&branchId=' + selectedBranch.id)}
                    branchId={String(selectedBranch.id)} workloadLevel={workloadLevel} onWorkloadChange={setWorkloadLevel}
                    adminId={userId ?? 0} onPurchaseOpen={() => ui.setPurchasePopupOpen(true)} onManagementPageOpen={() => ui.setManagementPageOpen(true)}
                    cashStage={cashStage} onShiftManagementPageOpen={() => ui.setShiftManagementPageOpen(true)} shiftStage={eventStage}
                    onShiftStageClick={() => ui.setShiftPopupOpen(true)} onCashClick={() => ui.setCashPopupOpen(true)}
                    branches={availableBranches ?? undefined} onBranchChange={setSelectedBranch} selectedBranch={selectedBranch}
                    onBlacklistopen={() => ui.setBlacklistOpen(true)} onCashRegisterOpen={() => ui.setCashRegisterOpen(true)}
                    onAccountingOpen={() => ui.setAccountingOpen(true)} role={role} logout={logout} userName={username ?? ""}
                />
            )}
            {selectedBranch && (<>
                <ShiftPopup isOpen={ui.shiftPopupOpen} onClose={() => ui.setShiftPopupOpen(false)} stage={eventStage} branchId={String(selectedBranch.id)} />
                <CashPopup isOpen={ui.cashPopupOpen} onClose={() => ui.setCashPopupOpen(false)} stage={cashStage} branchId={String(selectedBranch.id)} onCashWarning={ui.setCashWarning} />
            </>)}
            {!ui.isHistoryOpen && !ui.isConfigOpen && !ui.isStatisticsOpen && (
                <Box sx={{ p: 1, boxSizing: 'border-box', backgroundColor: "#fbfaf6", minHeight: '100vh', width: '100%',
                    display: 'grid', gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: 1, gridAutoRows: 'max-content' }}>
                    {selectedBranch && <DoughSection branchId={String(selectedBranch.id)}
                        inventory={doughStatus ?? { S: 0, M: 0, L: 0, Brick: 0 }}
                        availability={doughStatus?.availability ?? { S: false, M: false, L: false, "Brick dough": false }}
                        onInventoryChange={onDoughInventoryChange} onAvailabilityToggle={onDoughAvailabilityToggle} loading={doughLoading} card />}
                    {sortedOrders.map(order => <OrderCard key={order.id} order={order}
                        onReadyClick={o => setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: "Ready" } : x))}
                        onDeleteClick={() => handleDeleteClick(order)}
                        onPayClick={o => { ui.setSelectedOrder(o); ui.setPaymentDialogOpen(true); }}
                        onPickedUpClick={o => setOrders(prev => prev.filter(x => x.id !== o.id))}
                        onOvenClick={o => setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: "Oven" } : x))} />)}
                </Box>
            )}
            {ui.isHistoryOpen && branchForComponents && <HistoryComponent selectedBranch={branchForComponents} onClose={() => ui.setIsHistoryOpen(false)} />}
            {ui.isConfigOpen && branchForComponents && <ConfigComponent isOpen={ui.isConfigOpen} onClose={() => ui.setIsConfigOpen(false)} selectedBranch={branchForComponents} />}
            {ui.isStatisticsOpen && selectedBranch && <StatisticsComponent onClose={() => ui.setIsStatisticsOpen(false)} branchId={String(selectedBranch.id)} role={role} />}
            <AdminPageModals selectedBranch={selectedBranch} userId={userId ?? null} username={username ?? null}
                purchasePopupOpen={ui.purchasePopupOpen} onPurchaseClose={() => ui.setPurchasePopupOpen(false)}
                blacklistOpen={ui.blacklistOpen} onBlacklistClose={() => ui.setBlacklistOpen(false)}
                cashRegisterOpen={ui.cashRegisterOpen} onCashRegisterClose={() => ui.setCashRegisterOpen(false)}
                managementPageOpen={ui.managementPageOpen} onManagementPageClose={() => ui.setManagementPageOpen(false)}
                shiftManagementPageOpen={ui.shiftManagementPageOpen} onShiftManagementPageClose={() => ui.setShiftManagementPageOpen(false)}
                accountingOpen={ui.accountingOpen} onAccountingClose={() => ui.setAccountingOpen(false)} />
            <ExternalOrderAlert alertOrder={alertOrder} onDismiss={() => { stopSound(); setAlertOrder(null); }} onStopSound={stopSound} {...orderActions} />
            <EditedOrderAlert editedOrder={editedOrder} onClose={() => { stopSound(); setEditedOrder(null); }} />
            <DeleteOrderDialog open={deleteDialogOpen} order={orderToDelete} onConfirm={confirmDelete} onCancel={cancelDelete} />
            <ErrorSnackbar open={doughAlertOpen} message={doughAlertMessage} severity="error" handleClose={clearDoughAlert} />
        </div>
    );
}

export default AdminHomePage;
