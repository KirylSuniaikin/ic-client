import {useEffect, useRef, useState} from "react";
import OrderCard, {renderItemDetails, sortItemsByCategory} from "./adminComponents/OrderCard";
import {
    Alert,
    Box,
    Button,
    IconButton,
    Paper,
    Snackbar, TextField,
    Typography
} from '@mui/material';
import {useNavigate} from "react-router-dom";
import {
    fetchLastStage,
    getAllActiveOrders,
    updateOrderStatus,
    WS_URL
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
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {Masonry} from "@mui/lab";
import PaymentPopup from "./adminComponents/PaymentPopup";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from "@mui/icons-material/Cancel";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import BluetoothPrinterService from "./services/BluetoorhPrinterService";

function AdminHomePage() {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [error, setError] = useState(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isStatisticsOpen, setIsStatisticsOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const navigate = useNavigate();
    const [activeAlertOrder, setActiveAlertOrder] = useState(null);
    const [newlyAddedOrder, setNewlyAddedOrder] = useState(null);
    const [audioAllowed, setAudioAllowed] = useState(false);
    const [shiftPopupOpen, setShiftPopupOpen] = useState(false);
    const [shiftStage, setShiftStage] = useState("OPEN_SHIFT_CASH_CHECK");
    const [cashWarning, setCashWarning] = useState(null);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [newlyUpdatedOrder, setNewlyUpdatedOrder] = useState(null);
    const [activeAlertOrderEdit, setActiveAlertOrderEdit] = useState(null);
    const [confirmingAccept, setConfirmingAccept] = useState(false);
    const [confirmingCancel, setConfirmingCancel] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");


    const audioRef = useRef(null);

    const branchId = "1";
    const STAGE_FLOW = {
        OPEN_SHIFT_CASH_CHECK: "OPEN_SHIFT_EVENT",
        OPEN_SHIFT_EVENT: "CLOSE_SHIFT_EVENT",
        CLOSE_SHIFT_EVENT: "CLOSE_SHIFT_CASH_CHECK",
        CLOSE_SHIFT_CASH_CHECK: "OPEN_SHIFT_CASH_CHECK"
    };

    const colorRed = '#E44B4C';

    useClosingAlarm(true);


    const handleRemoveItem = (orderIdToRemove) => {
        setOrders(prev => {
            return prev.filter(o => o.id !== orderIdToRemove);
        });    }

    const toLongOrNull = (v) => {
        if (v == null) return null;
        if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : null;
        if (typeof v === "string") {
            if (!/^\d+$/.test(v)) return null;
            const n = Number(v);
            return Number.isSafeInteger(n) ? n : null;
        }
        return null;
    };

    const stopSound = () => {
        if (!audioRef.current) return;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    };

    const getId = (o) => {
        toLongOrNull(
            (o && (o.orderNo ?? o.id ?? o.orderId)) ?? null
        );
    }

    const getStringId = (o) => String(o?.id ?? o?.orderId ?? o?.order_no ?? o ?? "");


    const handleMarkReady = (orderId) => {
        setOrders((prev) =>
            prev.map((o) =>
                o.id === orderId ? { ...o, isReady: true } : o
            )
        );
    };

    useEffect(() => {
        (async () => {
            await BluetoothPrinterService.init();
            await BluetoothPrinterService.connect();
            BluetoothPrinterService.startKeepAlive();
        })();
    }, []);

    const SUPPRESS_KEY = 'suppressSoundIds';
    const normalizeId = (x) => String(x);

    const suppressedSoundIdsRef = useRef(new Set());
    const stompRef = useRef(null);

    const editedOrderIdRef = useRef(new Set());
    const EDITED_ORDER_ID_KEY = 'editedOrderId';

    const getExtId = (o) =>
        toLongOrNull(
            (o && (o.jahezOrderId ?? o.jahez_id ?? o.externalId ?? o.external_id)) ?? null
        );

    async function confirmExternalOrder(order) {
        console.log(order);
        const extId = getExtId(order);
        const orderId = normalizeId(order.id);
        if (!extId) {
            console.warn('[Confirm] externalId is missing, skip');
            return;
        }
        setConfirmingAccept(true);
        try {
            await updateOrderStatus({ orderId: orderId, jahezOrderId: extId, orderStatus: "Accepted" });
            setActiveAlertOrder(null);
        } catch (e) {
            console.error("[Confirm] failed:", e?.message || e);
        } finally {
            setConfirmingAccept(false);
        }
    }


    async function handleCancel(order) {
        if (!cancelReason || !cancelReason.trim()) console.log("[Cancel] no cancel reason");
        setConfirmingCancel(true);
        try {
            await updateOrderStatus({orderId: normalizeId(order.id), jahezOrderId: getExtId(order), orderStatus: "Cancelled", reason: cancelReason.trim()});
            setCancelDialogOpen(false);
            setActiveAlertOrder(null);
            setOrders(prev => prev.filter(o => normalizeId(o.id) !== normalizeId(order.id)));
            setCancelReason("");
        } catch (e) {
            console.error("[Cancel] failed:", e?.message || e);
        } finally {
            setConfirmingCancel(false);
        }
    }

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
        if (!newlyUpdatedOrder || !audioRef.current) return;
        const edited = editedOrderIdRef.current.has(newlyUpdatedOrder.id);
        const id = normalizeId(newlyUpdatedOrder.id);
        if(edited) {
            editedOrderIdRef.current.delete(id);
            localStorage.setItem(EDITED_ORDER_ID_KEY, JSON.stringify([...editedOrderIdRef.current]));
            console.log(`[EDITED_ORDERS] ID ${id} was removed from localStorage.`);
        }
        else {
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
        async function initialize() {
            try {
                setLoading(true);
                const response = await getAllActiveOrders();
                try {
                    const arr = JSON.parse(localStorage.getItem(SUPPRESS_KEY) || '[]');
                    suppressedSoundIdsRef.current = new Set(arr.map(String));
                } catch {
                    suppressedSoundIdsRef.current = new Set();
                }
                setOrders(response.orders);
                console.log(response.orders);

                if (stompRef.current?.active) {
                    stompRef.current.deactivate().catch(() => {});
                }

                const socket = new Client({
                    webSocketFactory: () => {
                        const s = new SockJS(WS_URL);
                        const origSend = s.send.bind(s);
                        s.send = (d) => {
                            if (d === '\n') console.log('♥ OUT heartbeat');
                            return origSend(d);
                        };
                        const origOnMessage = s.onmessage;
                        s.onmessage = (e) => {
                            if (e?.data === '\n') console.log('♥ IN heartbeat');
                            origOnMessage?.(e);
                        };
                        return s;
                    },
                    reconnectDelay: 5000,
                    heartbeatIncoming: 10000,
                    heartbeatOutgoing: 10000,
                    debug: (msg) => console.log('[STOMP]', msg),
                });
                stompRef.current = socket;

                socket.onConnect = () => {
                    console.log('🟢 STOMP connected');

                    socket.subscribe('/topic/orders', (frame) => {
                        const newOrder = JSON.parse(frame.body);
                        const id = normalizeId(newOrder?.orderId ?? newOrder?.id ?? newOrder);

                        try {
                            const arr = JSON.parse(localStorage.getItem(SUPPRESS_KEY) || '[]');
                            suppressedSoundIdsRef.current = new Set(arr.map(String));
                        } catch {
                            suppressedSoundIdsRef.current = new Set();
                        }

                        const suppressed = suppressedSoundIdsRef.current.has(id);
                        console.log(`[WS] ID ${id} is suppressed? ${suppressed}`);

                        setOrders(prev => {
                            const exists = prev.some(o => normalizeId(o.id) === id);
                            setTimeout(() => {
                                BluetoothPrinterService
                                    .printOrder(newOrder)
                                    .then(() => console.log("🖨️ Auto print success"))
                                    .catch(e => console.warn("⚠️ Auto print error:", e));
                            }, 0);
                            if (exists) return prev;

                            setNewlyAddedOrder(newOrder);
                            return [...prev, newOrder];
                        });

                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({orderId: newOrder.id}),
                        });
                    });

                    socket.subscribe('/topic/order-updates', (frame) => {
                        const updatedOrder = JSON.parse(frame.body);
                        console.log('♻️ Updated order', updatedOrder);
                        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));

                        setTimeout(() => {
                            BluetoothPrinterService
                                .printOrder(updatedOrder)
                                .then(() => console.log("🖨️ Auto print success"))
                                .catch(e => console.warn("⚠️ Auto print error:", e));
                        }, 0);

                        setNewlyUpdatedOrder(updatedOrder);

                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({orderId: updatedOrder.id}),
                        });
                    });

                    socket.subscribe("/topic/order-ready", (frame) => {
                        const payload = JSON.parse(frame.body);
                        const readyOrderId = getStringId(payload?.orderId ?? payload?.id ?? payload);

                        console.log('✅ Ready orderId', readyOrderId);
                        setOrders(prev =>
                            prev.map(o =>
                                getStringId(o) === readyOrderId
                                    ? { ...o, isReady: true}
                                    : o
                            )
                        );

                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({orderId: payload}),
                        });
                    })

                    socket.subscribe("/topic/order-paid", (frame) => {
                        const payload = JSON.parse(frame.body);
                        const paidOrderId = getStringId(payload?.orderId ?? payload?.id ?? payload);

                        console.log('️💸 Paid orderId', paidOrderId);
                        setOrders(prev =>
                            prev.map(o =>
                                getStringId(o) === paidOrderId
                                    ? { ...o, isPaid: true }
                                    : o
                            )
                        );

                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({orderId: paidOrderId}),
                        });
                    })

                    socket.subscribe("/topic/order-accepted", (frame) => {
                        const payload = JSON.parse(frame.body);
                        const acceptedOrderId = getStringId(payload?.orderId ?? payload?.id ?? payload);
                        console.log("[ORDER_ACCEPTED] ", acceptedOrderId);
                        stopSound()
                        setActiveAlertOrder(null);


                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({orderId: acceptedOrderId}),
                        });
                    })

                    socket.subscribe("/topic/order-cancelled", (frame) => {
                        const payload = JSON.parse(frame.body);
                        const cancelledOrderId = normalizeId(payload?.orderId ?? payload?.id ?? payload);
                        console.log("[ORDER_CANCELLED] ", cancelledOrderId);
                        stopSound()
                        setActiveAlertOrder(null);
                        setOrders(prev => prev.filter(o => getStringId(o) !== cancelledOrderId));
                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({orderId: cancelledOrderId}),
                        });
                    })

                    socket.subscribe("/topic/order-picked-up", (frame) => {
                        const payload = JSON.parse(frame.body);
                        const pickedUpOrderId = getStringId(payload?.orderId ?? payload?.id ?? payload);

                        setOrders(prev => prev.filter(o => getStringId(o) !== pickedUpOrderId));
                        console.log("📦 [ORDER_PICKED_UP]", payload, "→", pickedUpOrderId);

                        socket.publish({
                            destination: '/app/orders/ack',
                            body: JSON.stringify({orderId: pickedUpOrderId}),
                        });
                    })


                };

                socket.onWebSocketClose = () => console.log('🔴 WS disconnected');
                socket.activate();
            } finally {
                setLoading(false);
            }
        }
        async function loadStage(branchId) {
            try {
                const stage = await fetchLastStage(branchId);
                if (!stage) {
                    setShiftStage("OPEN_SHIFT_CASH_CHECK");
                }
                else {
                    const nextStage = STAGE_FLOW[stage] || stage;

                    setShiftStage(nextStage);
                }
                console.log("Last stage: ", stage, ", updated stage to: ");
            } catch (err) {
                console.error("Ошибка загрузки stage:", err);
            }
        }

        loadStage(branchId);
        initialize();

        return () => {
            const c = stompRef.current;
            stompRef.current = null;
            c?.deactivate?.().catch(() => {});
        };
    }, [getAllActiveOrders]);

    if (loading) {
        return <PizzaLoader/>;
    }

    if (error) return <div>Error: {error}</div>;

    const sortedOrders = [...orders].sort(
        (a, b) => new Date(a.order_created) - new Date(b.order_created)
    );


    const handlePaymentSuccess = (orderId) => {
        setOrders((prev) =>
            prev.map((o) =>
                o.id === orderId ? { ...o, isPaid: true } : o
            )
        );
        console.log(orders);
    };

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
                                {cashWarning.expected} BD
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
            {!isHistoryOpen && !isConfigOpen && !isStatisticsOpen && (
                    <AdminTopbar
                        stage={shiftStage}
                        onClick={() => setShiftPopupOpen(true)}
                        onOpenHistory={() => setIsHistoryOpen(true)}
                        onOpenStatistics={() => setIsStatisticsOpen(true)}
                        onOpenConfig={() => setIsConfigOpen(true)}
                        onGoToMenu={() => navigate('/menu?isAdmin=true')}
                    />
            )}
            <ShiftPopup
                isOpen={shiftPopupOpen}
                onClose={() => {
                    setShiftPopupOpen(false);
                }}
                setStage={setShiftStage}
                stage={shiftStage}
                branchId={branchId}
                onCashWarning={setCashWarning}
            />
            {!isHistoryOpen && !isConfigOpen && !isStatisticsOpen &&
                <Box sx={{ pt: 1, pl: 1 }}>
                <Masonry columns={{ xs: 1, sm: 2, md: 3, lg: 4 }} spacing={1} sequential>
                    {sortedOrders.map((order) => (
                        <OrderCard key={order.id} order={order}
                                   onReadyClick={(order) => {
                                        handleMarkReady(order.id)
                                    }}

                                   onPayClick={(order) => {
                                        setSelectedOrder(order);
                                        setPaymentDialogOpen(true);

                                    }}
                                   onPickedUpClick={(order) => {
                                       handleRemoveItem(order.id)
                                   }}
                        />
                    ))}
                </Masonry>
                </Box>
            }

            {isHistoryOpen && (
                <HistoryComponent
                    isOpen={isHistoryOpen}
                    onClose={() => setIsHistoryOpen(false)}
                />
            )}

            {isConfigOpen && (
                <ConfigComponent
                    isOpen={isConfigOpen}
                    onClose={() => setIsConfigOpen(false)}
                />
            )}

            {isStatisticsOpen && (
                <StatisticsComponent
                    isOpen={isStatisticsOpen}
                    onClose={() => setIsStatisticsOpen(false)}
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
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {getExtId(activeAlertOrder) ? 'Jahez Order' : 'New Order'}: {activeAlertOrder?.order_no ?? getId(activeAlertOrder)}
                        </Typography>

                        <Typography variant="body2">
                            Total price: {activeAlertOrder?.amount_paid} BHD
                        </Typography>
                    </Box>

                    {getExtId(activeAlertOrder) ? (
                        <>
                            <Box>
                                {sortItemsByCategory(activeAlertOrder.items).map((item, idx) => (
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
                                confirmExternalOrder(activeAlertOrder)
                                if (audioRef.current) {
                                    audioRef.current.pause();
                                    audioRef.current.currentTime = 0;
                                }
                            }}
                            disabled={confirmingAccept}
                            sx={{ borderRadius: 4, textTransform: 'none', flex: 1, backgroundColor: colorRed, color: "white", borderColor: "white" }}
                        >
                            {confirmingAccept ? 'Confirming…' : 'Confirm'}
                        </Button>

                            <Button
                                variant="outlined"
                                startIcon={<CancelIcon />}
                                onClick={() => setCancelDialogOpen(true)}
                                sx={{ borderRadius: 4, textTransform: "none", flex: 1, borderColor: colorRed, color: colorRed }}
                            >
                                Cancel
                            </Button>
                            </Box>
                        </>
                    ):(

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
{/*<Snackbar*/}
{/*    open={!audioAllowed}*/}
{/*    anchorOrigin={{ vertical: "top", horizontal: "center" }}*/}
{/*    sx={{ zIndex: 1400 }}*/}
{/*>*/}
{/*    <Paper*/}
{/*        elevation={3}*/}
{/*        sx={{*/}
{/*            borderRadius: 3,*/}
{/*            p: 2,*/}
{/*            px: 3,*/}
{/*            backgroundColor: "#fff",*/}
{/*            display: "flex",*/}
{/*            alignItems: "center",*/}
{/*            gap: 2,*/}
{/*            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",*/}
{/*            width: "85vw",*/}
{/*            maxWidth: 600,*/}
{/*        }}*/}
{/*    >*/}
{/*        <Box sx={{ flexGrow: 1 }}>*/}
{/*            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>*/}
{/*                Enable sound for order and close shift alerts*/}
{/*            </Typography>*/}
{/*        </Box>*/}
{/*        <Button*/}
{/*            onClick={() => {*/}
{/*                audioRef.current.play()*/}
{/*                    .then(() => {*/}
{/*                        audioRef.current.pause();*/}
{/*                        audioRef.current.currentTime = 0;*/}
{/*                        setAudioAllowed(true);*/}
{/*                    })*/}
{/*                    .catch(err => {*/}
{/*                        console.warn("Audio permission denied:", err);*/}
{/*                    });*/}
{/*            }}*/}
{/*            variant="outlined"*/}
{/*            sx={{*/}
{/*                textTransform: "uppercase",*/}
{/*                borderColor: colorRed,*/}
{/*                color: colorRed,*/}
{/*                fontWeight: 600,*/}
{/*                borderRadius: 3,*/}
{/*                px: 2.5,*/}
{/*                py: 0.5,*/}
{/*                minWidth: 80,*/}
{/*            }}*/}
{/*        >*/}
{/*            ENABLE*/}
{/*        </Button>*/}
{/*    </Paper>*/}
{/*</Snackbar>*/}
            <SwipeableDrawer
                anchor="bottom"
                open={cancelDialogOpen}
                onClose={() => setCancelDialogOpen(false)}
                onOpen={() => {}}
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
                    <Box sx={{ width: 36, height: 4, borderRadius: 999, bgcolor: "grey.400" }} />
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
