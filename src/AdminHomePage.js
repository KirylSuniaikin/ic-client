import {useEffect, useRef, useState} from "react";
import OrderCard from "./adminComponents/OrderCard";
import {Alert, Box, Button, Fab, IconButton, Paper, Snackbar, Typography} from '@mui/material';
import {useNavigate} from "react-router-dom";
import {
    DEV_BASE_HOST,
    DEV_SOCKET_URL,
    fetchLastStage,
    getAllActiveOrders,
    PROD_BASE_HOST,
    PROD_SOCKET_URL
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

    const canDelete = (o) => Boolean(o?.isPaid && o?.isReady);

    const handleRemoveItem = (orderIdToRemove) => {
        setOrders(prev => {
            const target = prev.find(o => o.id === orderIdToRemove);
            if (!target) return prev;
            if (!canDelete(target)) return prev;
            return prev.filter(o => o.id !== orderIdToRemove);
        });    }



    const handleMarkReady = (orderId) => {
        setOrders((prev) =>
            prev.map((o) =>
                o.id === orderId ? { ...o, isReady: true } : o
            )
        );
    };

    const SUPPRESS_KEY = 'suppressSoundIds';
    const normalizeId = (x) => String(x);

    const suppressedSoundIdsRef = useRef(new Set());
    const stompRef = useRef(null);

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
                        const s = new SockJS(PROD_SOCKET_URL);
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
                        const id = normalizeId(newOrder.id);

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
                            if (exists) {
                                return prev;
                            }

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
                        setOrders(prev => prev.map(o => o.orderId === updatedOrder.orderId ? updatedOrder : o));
                    });
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

    const sortedOrders = orders.sort(
        (a, b) => new Date(b.order_created) - new Date(a.order_created)
    );

    const handlePaymentSuccess = (orderId) => {
        setOrders((prev) =>
            prev.map((o) =>
                o.id === orderId ? { ...o, isPaid: true } : o
            )
        );
        handleRemoveItem(orderId)
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
                                        handleRemoveItem(order.id)
                                    }}

                                   onPayClick={(order) => {
                                        setSelectedOrder(order);
                                        setPaymentDialogOpen(true);

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
                            New Order: {activeAlertOrder?.id}
                        </Typography>
                        <Typography variant="body2">
                            Total price: {activeAlertOrder?.amount_paid} BHD
                        </Typography>
                    </Box>
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
                </Paper>
            </Snackbar>

<Snackbar
    open={!audioAllowed}
    anchorOrigin={{ vertical: "top", horizontal: "center" }}
    sx={{ zIndex: 1400 }}
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
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                Enable sound for order and close shift alerts
            </Typography>
        </Box>
        <Button
            onClick={() => {
                audioRef.current.play()
                    .then(() => {
                        audioRef.current.pause();
                        audioRef.current.currentTime = 0;
                        setAudioAllowed(true);
                    })
                    .catch(err => {
                        console.warn("Audio permission denied:", err);
                    });
            }}
            variant="outlined"
            sx={{
                textTransform: "uppercase",
                borderColor: colorRed,
                color: colorRed,
                fontWeight: 600,
                borderRadius: 3,
                px: 2.5,
                py: 0.5,
                minWidth: 80,
            }}
        >
            ENABLE
        </Button>
    </Paper>
</Snackbar>
        </div>
    );

}

export default AdminHomePage;
