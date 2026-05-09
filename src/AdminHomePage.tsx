import { useEffect, useMemo, useRef, useState } from "react";
import OrderCard, { renderItemDetails, sortItemsByCategory } from "./adminComponents/OrderCard";
import {
    Alert,
    Box,
    Button,
    IconButton,
    Paper,
    Snackbar, TextField,
    Typography
} from '@mui/material';
import { useNavigate } from "react-router-dom";
import {
    getAllActiveOrders, getBaseAdminInfo,
    updateOrderStatus,
} from "./api/api";
import PizzaLoader from "./components/loadingAnimations/PizzaLoader";
import alertSound from "./assets/alert2.mp3";
import CloseIcon from "@mui/icons-material/Close";
import HistoryComponent from "./adminComponents/HistoryComponent";
import ConfigComponent from "./adminComponents/ConfigComponent";
import StatisticsComponent from "./adminComponents/StatisticsComponent";
import AdminTopbar from "./adminComponents/AdminTopbar";
import ShiftPopup from "./components/shiftComponents/ShiftPopup";
import useClosingAlarm from "./components/shiftComponents/hooks/useClosingAlarm";
import PaymentPopup from "./adminComponents/PaymentPopup";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from "@mui/icons-material/Cancel";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import BluetoothPrinterService from "./services/BluetoorhPrinterService";
import { socket } from "./api/socket";
import { PurchasePopup } from "./management/purchaseComponents/PurchasePopup";
import ManagementPage from "./management/inventoryComponents/ManagementPage";
import CashPopup from "./components/shiftComponents/CashPopup";
import { ShiftHomePage } from "./management/shiftComponents/ShiftHomePage";
import BlacklistHomepage from "./management/blacklist/BlacklistHomepage";
import CashRegisterPopup from "./management/cashRegister/CashRegisterPopup";
import { useAuth } from "./management/security/AuthProvider";
import { fetchAllBranches, getBranchInfo } from "./management/api/api";
import type { Order, WorkloadLevel, ShiftEventType } from "./types/orderTypes";
import type { IBranch } from "./management/types/inventoryTypes";

function AdminHomePage(): JSX.Element {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isStatisticsOpen, setIsStatisticsOpen] = useState(false)
    const navigate = useNavigate();
    const [activeAlertOrder, setActiveAlertOrder] = useState<Order | null>(null);
    const [newlyAddedOrder, setNewlyAddedOrder] = useState<Order | null>(null);
    const [shiftPopupOpen, setShiftPopupOpen] = useState(false);
    const [cashPopupOpen, setCashPopupOpen] = useState(false);
    const [cashWarning, setCashWarning] = useState<string | null>(null);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [newlyUpdatedOrder, setNewlyUpdatedOrder] = useState<Order | null>(null);
    const [activeAlertOrderEdit, setActiveAlertOrderEdit] = useState<Order | null>(null);
    const [confirmingAccept, setConfirmingAccept] = useState(false);
    const [confirmingCancel, setConfirmingCancel] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [workloadLevel, setWorkloadLevel] = useState<WorkloadLevel>("IDLE");
    const [purchasePopupOpen, setPurchasePopupOpen] = useState(false);
    const [managementPageOpen, setManagementPageOpen] = useState(false);
    const [cashStage, setCashStage] = useState<ShiftEventType>("OPEN_SHIFT_CASH_CHECK");
    const [eventStage, setEventStage] = useState<ShiftEventType>("OPEN_SHIFT_EVENT");
    const [shiftManagementPageOpen, setShiftManagementPageOpen] = useState(false);
    const { username, branchId, userId, role, logout } = useAuth();
    const [availableBranches, setAvailableBranches] = useState<IBranch[] | null>(null);
    const [selectedBranch, setSelectedBranch] = useState<IBranch | null>(null);
    const [blacklistOpen, setBlacklistOpen] = useState(false);
    const [cashRegisterOpen, setCashRegisterOpen] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const currentUser = useMemo(() => ({
        userName: username,
        id: userId
    }), [username, userId]);

    const CASH_STAGE_FLOW = useMemo<Record<string, ShiftEventType>>(() => ({
        OPEN_SHIFT_CASH_CHECK: "CLOSE_SHIFT_CASH_CHECK",
        CLOSE_SHIFT_CASH_CHECK: "OPEN_SHIFT_CASH_CHECK"
    }), [])

    const EVENT_STAGE_FLOW = useMemo<Record<string, ShiftEventType>>(() => ({
        OPEN_SHIFT_EVENT: "CLOSE_SHIFT_EVENT",
        CLOSE_SHIFT_EVENT: "OPEN_SHIFT_EVENT"
    }), [])

    const colorRed = '#E44B4C';

    useClosingAlarm(true);


    const handleRemoveItem = (orderIdToRemove: string): void => {
        setOrders(prev => {
            return prev.filter(o => o.id !== orderIdToRemove);
        });
    }

    const handleMarkInOven = (orderId: string): void => {
        setOrders((prev) =>
            prev.map((o) =>
                o.id === orderId ? { ...o, status: "Oven" } : o
            )
        );
    }

    const onWorkloadChange = (newLevel: WorkloadLevel): void => {
        setWorkloadLevel(newLevel);
    }

    const toLongOrNull = (v: unknown): number | null => {
        if (v == null) return null;
        if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : null;
        if (typeof v === "string") {
            if (!/^\d+$/.test(v)) return null;
            const n = Number(v);
            return Number.isSafeInteger(n) ? n : null;
        }
        return null;
    };

    const stopSound = (): void => {
        if (!audioRef.current) return;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    };

    const getId = (o: unknown): number | null => {
        const obj = o as { orderNo?: unknown; id?: unknown; orderId?: unknown } | null;
        return toLongOrNull(
            (obj && (obj.orderNo ?? obj.id ?? obj.orderId)) ?? null
        );
    }

    const getStringId = (o: unknown): string => {
        const obj = o as { id?: unknown; orderId?: unknown; order_no?: unknown } | null;
        return String(obj?.id ?? obj?.orderId ?? obj?.order_no ?? o ?? "");
    }


    const handleMarkReady = (orderId: string): void => {
        setOrders((prev) =>
            prev.map((o) =>
                o.id === orderId ? { ...o, status: "Ready" } : o
            )
        );
    };

    useEffect(() => {
        (async () => {
            await BluetoothPrinterService.init();
            await BluetoothPrinterService.connect();
            BluetoothPrinterService.startConnectionMonitor();
        })();
    }, []);

    const SUPPRESS_KEY = 'suppressSoundIds';
    const normalizeId = (x: unknown): string => String(x);

    const suppressedSoundIdsRef = useRef(new Set<string>());
    const stompRef = useRef<typeof socket | null>(null);

    const EDITED_ORDER_ID_KEY = 'editedOrderId';

    const getExtId = (o: Order | null): number | null =>
        toLongOrNull(
            (o && (o.jahezOrderId ?? o.external_id)) ?? null
        );

    async function confirmExternalOrder(order: Order): Promise<void> {
        const extId = getExtId(order);
        const orderId = normalizeId(order.id);
        if (!extId) {
            console.warn('[Confirm] externalId is missing, skip');
            return;
        }
        setConfirmingAccept(true);
        try {
            // orderStatus "Accepted" is not in the OrderStatus union — cast to pass existing logic unchanged
            await updateOrderStatus({ orderId: orderId, jahezOrderId: String(extId), orderStatus: "Accepted" as Order['status'], reason: null });
            setActiveAlertOrder(null);
        } catch (e) {
            setError(String(e))
            console.error("[Confirm] failed:", e instanceof Error ? e.message : e);
        } finally {
            setConfirmingAccept(false);
        }
    }

    async function handleCancel(order: Order | null): Promise<void> {
        if (!order) return;
        if (!cancelReason || !cancelReason.trim()) console.log("[Cancel] no cancel reason");
        setConfirmingCancel(true);
        try {
            await updateOrderStatus({
                orderId: normalizeId(order.id),
                jahezOrderId: getExtId(order) !== null ? String(getExtId(order)) : null,
                orderStatus: "Cancelled",
                reason: cancelReason.trim()
            });
            setCancelDialogOpen(false);
            setActiveAlertOrder(null);
            setOrders(prev => prev.filter(o => normalizeId(o.id) !== normalizeId(order.id)));
            setCancelReason("");
        } catch (e) {
            console.error("[CANCEL] failed:", e instanceof Error ? e.message : e);
        } finally {
            setConfirmingCancel(false);
        }
    }

    useEffect(() => {
        async function initBranches(): Promise<void> {
            try {
                if (branchId !== "NONE" && role !== "SUPER_MANAGER") {
                    const branchInfo = await getBranchInfo(branchId ?? "");
                    setAvailableBranches([branchInfo]);
                    setSelectedBranch(branchInfo);
                } else {
                    const allBranches = await fetchAllBranches();
                    setAvailableBranches(allBranches);

                    if (allBranches.length > 0) {
                        const targetBranch = allBranches.find(b => b.branchNo === 1);
                        setSelectedBranch(targetBranch || allBranches[0]);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch branches:", err);
                setError("Failed to fetch branches");
            }
        }

        initBranches();
    }, [branchId]);

    useEffect(() => {
        audioRef.current = new Audio(alertSound);
        audioRef.current.loop = true;
    }, []);

    useEffect(() => {
        if (!newlyAddedOrder || !audioRef.current) return;
        const id = normalizeId(newlyAddedOrder.id);
        const suppressed = suppressedSoundIdsRef.current.has(id);
        console.log(suppressedSoundIdsRef.current);
        if (suppressed) {
            suppressedSoundIdsRef.current.delete(id);
            localStorage.setItem(SUPPRESS_KEY, JSON.stringify([...suppressedSoundIdsRef.current]));
            console.log(`[SUPPRESS] ID ${id} was removed from localStorage.`);
        } else {
            console.log(`[AUDIO] Playing sound for new order ID: ${id}`);
            setActiveAlertOrder(newlyAddedOrder);
            audioRef.current.currentTime = 0;
            audioRef.current.play()
                .then(() => console.log('[AUDIO] playing'))
                .catch(e => console.warn('[AUDIO] play() blocked/error:', e));
        }

        setNewlyAddedOrder(null);
    }, [newlyAddedOrder, audioRef, setActiveAlertOrder]);

    useEffect(() => {
        let lock: WakeLockSentinel | undefined;

        async function req(): Promise<void> {
            try {
                lock = await navigator.wakeLock?.request("screen");
                document.addEventListener("visibilitychange", () => {
                    if (document.visibilityState === "visible") req();
                }, { once: true });
            } catch {
            }
        }

        req();
        return () => {
            try {
                lock?.release?.();
            } catch {
            }
        };
    }, []);

    useEffect(() => {
        if (!newlyUpdatedOrder || !audioRef.current) return;
        const id = normalizeId(String(newlyUpdatedOrder.id));
        const suppressed = suppressedSoundIdsRef.current.has(id);
        if (suppressed) {
            suppressedSoundIdsRef.current.delete(id);
            localStorage.setItem(EDITED_ORDER_ID_KEY, JSON.stringify([...suppressedSoundIdsRef.current]));
            console.log(`[EDITED_ORDERS] ID ${id} was removed from localStorage.`);
        } else {
            console.log(`[AUDIO] Playing sound for updated order ID: ${id}`);
            setActiveAlertOrderEdit(newlyUpdatedOrder);
            audioRef.current.currentTime = 0;
            audioRef.current.play()
                .then(() => console.log('[AUDIO] playing'))
                .catch(e => console.warn('[AUDIO] play() blocked/error:', e));
        }

        setNewlyUpdatedOrder(null);
    }, [newlyUpdatedOrder, audioRef, setActiveAlertOrderEdit]);

    useEffect(() => {
        if (!selectedBranch) return

        async function initialize(): Promise<void> {
            try {
                setLoading(true);
                // IBranch.id is numeric; String() coerces to match the string parameter
                const response = await getAllActiveOrders(String(selectedBranch!.id));
                try {
                    const arr = JSON.parse(localStorage.getItem(SUPPRESS_KEY) || '[]') as unknown[];
                    suppressedSoundIdsRef.current = new Set(arr.map(String));
                } catch {
                    suppressedSoundIdsRef.current = new Set();
                }
                // Runtime response wraps orders in an object; cast to access .orders
                setOrders((response as unknown as { orders: Order[] }).orders ?? response);

                if (stompRef.current?.active) {
                    stompRef.current.deactivate().catch(() => {
                    });
                }

                stompRef.current = socket;

                socket.onConnect = () => {
                    console.log('🟢 STOMP connected for branch: ', selectedBranch!.branchName);

                    socket.subscribe(`/topic/${selectedBranch!.id}/orders`, async (frame) => {
                        const newOrder = JSON.parse(frame.body) as Order;
                        const id = normalizeId(newOrder?.id ?? newOrder);

                        try {
                            const arr = JSON.parse(localStorage.getItem(SUPPRESS_KEY) || '[]') as unknown[];
                            suppressedSoundIdsRef.current = new Set(arr.map(String));
                        } catch {
                            suppressedSoundIdsRef.current = new Set();
                        }

                        const suppressed = suppressedSoundIdsRef.current.has(id);
                        console.log(`[WS] ID ${id} is suppressed? ${suppressed}`);
                        if ("Keeta" !== newOrder.order_type) {
                            try {
                                await BluetoothPrinterService.printOrder(newOrder);
                                console.log("🖨️ Auto print success");
                            } catch (e) {
                                console.warn("⚠️ Auto print error:", e);
                            }
                        }

                        setOrders(prev => {
                            const exists = prev.some(o => normalizeId(o.id) === id);
                            if (exists) return prev;

                            setNewlyAddedOrder(newOrder);
                            return [...prev, newOrder];
                        });

                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({ orderId: newOrder.id }),
                        });
                    });

                    socket.subscribe(`/topic/${selectedBranch!.id}/order-updates`, async (frame) => {
                        const updatedOrder = JSON.parse(frame.body) as Order;

                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({ orderId: updatedOrder.id }),
                        });

                        try {
                            const arr = JSON.parse(localStorage.getItem(EDITED_ORDER_ID_KEY) || '[]') as unknown[];
                            suppressedSoundIdsRef.current = new Set(arr.map(String));
                        } catch {
                            suppressedSoundIdsRef.current = new Set();
                        }

                        // Do not await the printer here, so we don't delay the STOMP ack!
                        BluetoothPrinterService.printOrder(updatedOrder)
                            .then(() => console.log("🖨️ Auto print success"))
                            .catch(e => console.warn("⚠️ Auto print error:", e));

                        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                        setNewlyUpdatedOrder(updatedOrder);
                    });

                    socket.subscribe(`/topic/${selectedBranch!.id}/order-paid`, (frame) => {
                        const payload = JSON.parse(frame.body) as { orderId?: unknown; id?: unknown };
                        const paidOrderId = getStringId(payload?.orderId ?? payload?.id ?? payload);

                        setOrders(prev =>
                            prev.map(o =>
                                getStringId(o) === paidOrderId
                                    ? { ...o, isPaid: true }
                                    : o
                            )
                        );

                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({ orderId: paidOrderId }),
                        });
                    })

                    socket.subscribe(`/topic/${selectedBranch!.id}/order-accepted`, (frame) => {
                        const payload = JSON.parse(frame.body) as { orderId?: unknown; id?: unknown };
                        const acceptedOrderId = getStringId(payload?.orderId ?? payload?.id ?? payload);
                        stopSound()
                        setActiveAlertOrder(null);


                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({ orderId: acceptedOrderId }),
                        });
                    })

                    socket.subscribe(`/topic/${selectedBranch!.id}/order-cancelled`, (frame) => {
                        const payload = JSON.parse(frame.body) as { orderId?: unknown; id?: unknown };
                        const cancelledOrderId = normalizeId(payload?.orderId ?? payload?.id ?? payload);
                        console.log("[ORDER_CANCELLED] ", cancelledOrderId);
                        stopSound()
                        setActiveAlertOrder(null);
                        setOrders(prev => prev.filter(o => getStringId(o) !== cancelledOrderId));
                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({ orderId: cancelledOrderId }),
                        });
                    })

                    socket.subscribe(`/topic/${selectedBranch!.id}/order-status-updated`, (frame) => {
                        const payload = JSON.parse(frame.body) as { orderId?: unknown; id?: unknown; status?: string };
                        const orderId = getStringId(payload?.orderId ?? payload?.id);
                        const status = payload.status;

                        if (status === "Picked Up") {
                            console.log("[ORDER_STATUS] Order is picked up with id: ", orderId);
                            setOrders(prev => prev.filter(o => getStringId(o) !== orderId));
                        } else {
                            console.log("[ORDER_STATUS] Updated order status ->", status);
                            setOrders(prev =>
                                prev.map(o =>
                                    getStringId(o) === orderId
                                        ? { ...o, status: status as Order['status'] }
                                        : o
                                )
                            );
                        }

                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({ orderId: orderId }),
                        });
                    });

                    socket.subscribe(`/topic/${selectedBranch!.id}/admin-base-info`, (frame) => {
                        const payload = JSON.parse(frame.body) as {
                            branchId: unknown;
                            level: WorkloadLevel;
                            cashStage: string;
                            checklistStage: string;
                        };
                        if (String(payload.branchId) === String(selectedBranch!.id)) {
                            onWorkloadChange(payload.level);
                            const nextCashStage = (CASH_STAGE_FLOW[payload.cashStage] || payload.cashStage) as ShiftEventType;
                            const nextEventStage = (EVENT_STAGE_FLOW[payload.checklistStage] || payload.checklistStage) as ShiftEventType;
                            setCashStage(nextCashStage);
                            setEventStage(nextEventStage);
                        }
                    })
                };

                socket.onWebSocketClose = () => console.log('🔴 WS disconnected');
                socket.activate();
            } finally {
                setLoading(false);
            }
        }

        async function fetchAdminBaseInfo(bid: string): Promise<void> {
            try {
                const response = await getBaseAdminInfo(bid);
                if (!response) {
                    setEventStage("OPEN_SHIFT_EVENT");
                    setCashStage("OPEN_SHIFT_CASH_CHECK");
                } else {
                    // AdminBaseInfo has [key: string]: unknown — access dynamic keys safely
                    const resp = response as Record<string, unknown>;
                    const nextCashStage = (CASH_STAGE_FLOW[String(resp['cashStage'] ?? '')] ||
                        String(resp['cashStage'] ?? '')) as ShiftEventType;
                    const nextEventStage = (EVENT_STAGE_FLOW[String(resp['checklistStage'] ?? '')] ||
                        String(resp['checklistStage'] ?? '')) as ShiftEventType;
                    onWorkloadChange(resp['level'] as WorkloadLevel)
                    setCashStage(nextCashStage);
                    setEventStage(nextEventStage);
                }
            } catch (err) {
                console.error("Ошибка загрузки stage:", err);
            }
        }

        fetchAdminBaseInfo(String(selectedBranch.id));
        initialize();

        return () => {
            const c = stompRef.current;
            stompRef.current = null;
            c?.deactivate?.().catch(() => {
            });
        };
    }, [CASH_STAGE_FLOW, EVENT_STAGE_FLOW, selectedBranch]);

    if (loading) {
        return <PizzaLoader />;
    }

    if (error) return <div>Error: {error}</div>;

    const sortedOrders = [...orders].sort(
        (a, b) => new Date(a.order_created).getTime() - new Date(b.order_created).getTime()
    );


    const handlePaymentSuccess = (orderId: string): void => {
        setOrders((prev) =>
            prev.map((o) =>
                o.id === orderId ? { ...o, isPaid: true } : o
            )
        );
    };

    // HistoryComponent and ConfigComponent expect SelectedBranch with id: string
    // IBranch.id is number at runtime but the API routes use it as a path segment
    // Cast branch to the expected shape — logic is unchanged
    const branchForComponents = selectedBranch
        ? { ...selectedBranch, id: String(selectedBranch.id) }
        : null;

    return (

        <div className="p-4 max-w-4xl mx-auto">
            {cashWarning && (
                <Box
                    sx={{
                        position: 'fixed',
                        top: 16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 2000,
                        width: '90%',
                        maxWidth: 480,
                    }}
                >
                    <Alert
                        severity="warning"
                        variant="filled"
                        onClose={() => setCashWarning(null)}
                        sx={{
                            backgroundColor: "#fff3f3",
                            color: "#B00020",
                            fontWeight: 500,
                            fontSize: "1rem",
                        }}
                    >
                        Cash mismatch! <br />
                        <strong>Expected: </strong>
                        <span style={{ color: "#E44B4C", fontWeight: 700 }}>
                            {cashWarning} BD
                        </span>
                    </Alert>
                </Box>
            )}
            <PaymentPopup
                open={paymentDialogOpen}
                onClose={() => setPaymentDialogOpen(false)}
                order={selectedOrder}
                onPaymentSuccess={handlePaymentSuccess}
            />
            {!isHistoryOpen && !isConfigOpen && !isStatisticsOpen && !managementPageOpen && selectedBranch && (

                <AdminTopbar
                    onOpenHistory={() => setIsHistoryOpen(true)}
                    onOpenStatistics={() => setIsStatisticsOpen(true)}
                    onOpenConfig={() => setIsConfigOpen(true)}
                    onGoToMenu={() => navigate('/menu?isAdmin=true&branchId=' + selectedBranch.id)}
                    branchId={String(selectedBranch.id)}
                    workloadLevel={workloadLevel}
                    onWorkloadChange={onWorkloadChange}
                    adminId={userId ?? 0}
                    onPurchaseOpen={() => setPurchasePopupOpen(true)}
                    onManagementPageOpen={() => setManagementPageOpen(true)}
                    cashStage={cashStage}
                    onShiftManagementPageOpen={() => setShiftManagementPageOpen(true)}
                    shiftStage={eventStage}
                    onShiftStageClick={() => setShiftPopupOpen(true)}
                    onCashClick={() => setCashPopupOpen(true)}
                    branches={availableBranches ?? undefined}
                    onBranchChange={setSelectedBranch}
                    selectedBranch={selectedBranch}
                    onBlacklistopen={() => setBlacklistOpen(true)}
                    onCashRegisterOpen={() => setCashRegisterOpen(true)}
                    role={role}
                    logout={logout}
                    userName={username ?? ""}
                />
            )}
            {selectedBranch && (
                <>
                    <ShiftPopup
                        isOpen={shiftPopupOpen}
                        onClose={() => {
                            setShiftPopupOpen(false);
                        }}
                        stage={eventStage}
                        branchId={String(selectedBranch.id)}
                    />
                    <CashPopup
                        isOpen={cashPopupOpen}
                        onClose={() => setCashPopupOpen(false)}
                        stage={cashStage}
                        branchId={String(selectedBranch.id)}
                        onCashWarning={setCashWarning}
                    />
                </>
            )}
            {!isHistoryOpen && !isConfigOpen && !isStatisticsOpen &&
                <Box sx=
                    {{
                        p: 1,
                        boxSizing: 'border-box',
                        backgroundColor: "#fbfaf6",
                        minHeight: '100vh',
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: 'repeat(1, 1fr)',
                            sm: 'repeat(2, 1fr)',
                            md: 'repeat(3, 1fr)',
                            lg: 'repeat(4, 1fr)'
                        },
                        gap: 1,
                        gridAutoRows: 'max-content',
                        // alignItems: 'flex-start'
                    }}>
                    {sortedOrders.map((order) => (
                        <OrderCard key={order.id} order={order}
                            onReadyClick={(order) => {
                                handleMarkReady(order.id)
                            }}
                            onDeleteClick={() => {}}
                            onPayClick={(order) => {
                                setSelectedOrder(order);
                                setPaymentDialogOpen(true);

                            }}
                            onPickedUpClick={(order) => {
                                handleRemoveItem(order.id)
                            }}
                            onOvenClick={(order) => {
                                handleMarkInOven(order.id)
                            }}
                        />
                    ))}
                </Box>
            }

            {isHistoryOpen && branchForComponents && (
                <HistoryComponent
                    selectedBranch={branchForComponents}
                    onClose={() => setIsHistoryOpen(false)}
                />
            )}

            {isConfigOpen && branchForComponents && (
                <ConfigComponent
                    isOpen={isConfigOpen}
                    onClose={() => setIsConfigOpen(false)}
                    selectedBranch={branchForComponents}
                />
            )}

            {isStatisticsOpen && selectedBranch && (
                <StatisticsComponent
                    onClose={() => setIsStatisticsOpen(false)}
                    branchId={String(selectedBranch.id)}
                    role={role}
                />
            )}

            {purchasePopupOpen && selectedBranch && (
                <PurchasePopup
                    open={purchasePopupOpen}
                    onClose={() => setPurchasePopupOpen(false)}
                    adminId={userId ?? 0}
                    branch={selectedBranch}
                />
            )}

            {blacklistOpen && (
                <BlacklistHomepage
                    open={blacklistOpen}
                    handleClose={() => setBlacklistOpen(false)}
                />
            )}

            {cashRegisterOpen && selectedBranch && (
                <CashRegisterPopup
                    open={cashRegisterOpen}
                    handleClose={() => setCashRegisterOpen(false)}
                    branch={selectedBranch}
                />
            )}

            {managementPageOpen && selectedBranch && currentUser.id && (
                <ManagementPage
                    isOpen={managementPageOpen}
                    onClose={() => setManagementPageOpen(false)}
                    user={currentUser as { userName: string | null; id: number }}
                    branch={selectedBranch}
                />
            )}

            {shiftManagementPageOpen && selectedBranch && (
                <ShiftHomePage open={shiftManagementPageOpen}
                    onClose={() => setShiftManagementPageOpen(false)}
                    branch={selectedBranch}
                />
            )}

            <Snackbar
                open={Boolean(activeAlertOrder)}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
                sx={{ zIndex: 1300 }}
            >
                <Paper
                    elevation={3}
                    sx={{
                        borderRadius: 3,
                        p: 2,
                        px: 3,
                        backgroundColor: "#fff",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                        width: "85vw",
                        maxWidth: 600,
                    }}
                >
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <Box sx={{ flexGrow: 1 }}>
                            {activeAlertOrder &&
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {activeAlertOrder.order_type === "Jahez" ? "Jahez Order" :
                                        activeAlertOrder.order_type === "Keeta" ? "Keeta Order" :
                                            "New Order"}: {activeAlertOrder?.order_no ?? getId(activeAlertOrder)}
                                </Typography>
                            }

                            <Typography variant="body2">
                                Total price: {activeAlertOrder?.amount_paid} BHD
                            </Typography>
                        </Box>

                        {getExtId(activeAlertOrder) && activeAlertOrder?.order_type === "Jahez" ? (
                            <>
                                <Box>
                                    {sortItemsByCategory(activeAlertOrder!.items).map((item, idx) => (
                                        <Box
                                            key={idx}
                                            sx={{ mb: 1.5, pl: 1, borderLeft: "2px solid #e0e0e0" }}
                                        >
                                            <Typography variant="body2">
                                                {item.quantity}x <strong>{item.name}</strong>
                                                {item.size && (
                                                    <Typography
                                                        component="span"
                                                        variant="body2"
                                                        sx={{ ml: 1, fontStyle: "italic" }}
                                                    >
                                                        ({item.size})
                                                    </Typography>
                                                )}
                                            </Typography>
                                            {renderItemDetails(item)}
                                        </Box>
                                    ))}
                                </Box>
                                <Box sx={{ display: "flex", gap: 2, mt: 1 }}>

                                    <Button
                                        variant="outlined"
                                        startIcon={<CheckCircleIcon />}
                                        onClick={() => {
                                            if (activeAlertOrder) confirmExternalOrder(activeAlertOrder)
                                            if (audioRef.current) {
                                                audioRef.current.pause();
                                                audioRef.current.currentTime = 0;
                                            }
                                        }}
                                        disabled={confirmingAccept}
                                        sx={{
                                            borderRadius: 4,
                                            textTransform: 'none',
                                            flex: 1,
                                            backgroundColor: colorRed,
                                            color: "white",
                                            borderColor: "white"
                                        }}
                                    >
                                        {confirmingAccept ? 'Confirming…' : 'Confirm'}
                                    </Button>

                                    <Button
                                        variant="outlined"
                                        startIcon={<CancelIcon />}
                                        onClick={() => setCancelDialogOpen(true)}
                                        sx={{
                                            borderRadius: 4,
                                            textTransform: "none",
                                            flex: 1,
                                            borderColor: colorRed,
                                            color: colorRed
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </Box>
                            </>
                        ) : (

                            <IconButton
                                onClick={() => {
                                    if (audioRef.current) {
                                        audioRef.current.pause();
                                        audioRef.current.currentTime = 0;
                                    }
                                    setActiveAlertOrder(null);
                                }}
                                size="medium"
                                sx={{ color: colorRed }}
                            >
                                <CloseIcon />
                            </IconButton>
                        )}
                    </Box>
                </Paper>
            </Snackbar>

            <Snackbar
                open={Boolean(activeAlertOrderEdit)}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
                sx={{ zIndex: 1300 }}
            >
                <Paper
                    elevation={3}
                    sx={{
                        borderRadius: 3,
                        p: 2,
                        px: 3,
                        backgroundColor: "#fff",
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                        width: "85vw",
                        maxWidth: 600,
                    }}
                >
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            Order {activeAlertOrderEdit?.order_no} was edited
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={() => {
                            if (audioRef.current) {
                                audioRef.current.pause();
                                audioRef.current.currentTime = 0;
                            }
                            setActiveAlertOrderEdit(null);
                        }}
                        size="medium"
                        sx={{ color: colorRed }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Paper>
            </Snackbar>

            <SwipeableDrawer
                anchor="bottom"
                open={cancelDialogOpen}
                onClose={() => setCancelDialogOpen(false)}
                onOpen={() => {
                }}
                disableDiscovery
                keepMounted
                PaperProps={{
                    sx: {
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        p: 2,
                    },
                }}
            >
                <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                    <Box sx={{ width: 36, height: 4, borderRadius: 999, abgcolor: "grey.400" }} />
                </Box>

                <Typography variant="h6" sx={{ textAlign: "center", fontWeight: 600, mb: 2 }}>
                    Cancel Order
                </Typography>

                <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    placeholder="Type reason..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    sx={{
                        mb: 3,
                        "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                        },
                    }}
                />

                <Button
                    variant="contained"
                    fullWidth
                    onClick={() => handleCancel(activeAlertOrder)}
                    disabled={confirmingCancel || !cancelReason.trim()}
                    sx={{
                        backgroundColor: colorRed,
                        color: "#fff",
                        borderRadius: 2,
                        py: 1.5,
                        fontWeight: 600,
                        textTransform: "none",
                        fontSize: 16,
                        "&:hover": {
                            backgroundColor: "#c73c3d",
                        },
                    }}
                >
                    {confirmingCancel ? "Cancelling…" : "Confirm Cancel"}
                </Button>
            </SwipeableDrawer>
        </div>

    );

}

export default AdminHomePage;
