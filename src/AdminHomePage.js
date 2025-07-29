import {useEffect, useState} from "react";
import OrderCard from "./adminComponents/OrderCard";
import AddIcon from '@mui/icons-material/Add';
import {Alert, Box, Button, Fab, IconButton, Paper, Snackbar, Typography} from '@mui/material';
import {useNavigate} from "react-router-dom";
import {DEV_SOCKET_URL, fetchLastStage, getAllActiveOrders, PROD_SOCKET_URL,} from "./api/api";
import PizzaLoader from "./loadingAnimations/PizzaLoader";
import { io } from "socket.io-client";
import alertSound from "./assets/alert2.mp3";
import CloseIcon from "@mui/icons-material/Close";
import {ExpandLess, History, Menu} from "@mui/icons-material";
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import HistoryComponent from "./adminComponents/HistoryComponent";
import ConfigComponent from "./adminComponents/ConfigComponent";
import StatisticsComponent from "./adminComponents/StatisticsComponent";
import ShiftTopbar from "./shiftComponents/ShiftTopbar";
import ShiftPopup from "./shiftComponents/ShiftPopup";

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
    const [audioRef] = useState(new Audio(alertSound));
    const [audioAllowed, setAudioAllowed] = useState(false);
    const [shiftPopupOpen, setShiftPopupOpen] = useState(false);
    const [shiftStage, setShiftStage] = useState("OPEN_SHIFT_CASH_CHECK");
    const [cashWarning, setCashWarning] = useState(null);


    const branchId = "1";
    const STAGE_FLOW = {
        OPEN_SHIFT_CASH_CHECK: "OPEN_SHIFT_EVENT",
        OPEN_SHIFT_EVENT: "CLOSE_SHIFT_CASH_CHECK",
        CLOSE_SHIFT_CASH_CHECK: "CLOSE_SHIFT_EVENT",
        CLOSE_SHIFT_EVENT: "OPEN_SHIFT_CASH_CHECK"
    };

    const colorRed = '#E44B4C';


    const handleRemoveItem = (orderIdToRemove) => {
        setOrders(prev => prev.filter(order => order.id !== orderIdToRemove));
    }

    useEffect(() => {
        let socket;

        async function initialize() {
            try {
                setLoading(true);
                const response = await getAllActiveOrders();
                setOrders(response.orders);

                socket = io(PROD_SOCKET_URL, {transports: ["websocket"]});

                socket.on("order_created", (newOrder, callback) => {
                    console.log("✅ New order received", newOrder);
                    setOrders(prev => {
                        const exists = prev.find(o => o.orderId === newOrder.orderId);
                        return exists ? prev : [...prev, newOrder];
                    });
                    setActiveAlertOrder(newOrder);
                    if (audioRef) {
                        audioRef.loop = true;
                        audioRef.play().catch((e) => console.warn("🎧 Не удалось воспроизвести звук:", e));
                    }
                    if (callback) {
                        callback("OK!");
                        console.log("🔔 Sent ACK to server");
                    }
                });

                socket.on("test_push", (data) => {
                    console.log("💙 Heartbeat from server:", data);
                });

                socket.on("order_updated", (updatedOrder) => {
                    console.log("♻️ Заказ обновлён:", updatedOrder);
                    setOrders(prev =>
                        prev.map(order =>
                            order.orderId === updatedOrder.orderId ? updatedOrder : order
                        )
                    );
                });
                socket.on("connect", () => {
                    console.log("🟢 WebSocket подключён");
                    socket.emit("join_room", "orders_room");
                });


                socket.on("disconnect", () => {
                    console.log("🔴 WebSocket отключён");
                });
            } catch (err) {
                setError(err.message);
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
            if (socket) socket.disconnect();
        };
    }, []);

    if (loading) {
        return <PizzaLoader/>;
    }


    if (error) return <div>Error: {error}</div>;


    const sortedOrders = orders.sort(
        (a, b) => new Date(b.order_created) - new Date(a.order_created)
    );

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
            {!isHistoryOpen && !isConfigOpen && !isStatisticsOpen && (
                <ShiftTopbar stage={shiftStage} onClick={() => setShiftPopupOpen(true) } />
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
            {!isHistoryOpen && !isConfigOpen && !isStatisticsOpen && sortedOrders.map((order) => (
                <OrderCard key={order.orderId} order={order} handleRemoveItem={handleRemoveItem}/>
            ))}
            {!isSettingsOpen &&
                <Fab
                color="primary"
                aria-label="menu"
                onClick={() => setIsSettingsOpen(true)}
                sx={{
                position: 'fixed',
                top: 64,
                right: 16,
                backgroundColor: colorRed,
                color: "white",
                '&:hover': {
                backgroundColor: '#d23c3d',
            },
            }}
                >
                <Menu sx={{ fontSize: 30 }}/>
                </Fab>
            }
            {isSettingsOpen && !isHistoryOpen && <Fab
                color="primary"
                aria-label="ExpandLess"
                onClick={() => setIsSettingsOpen(false)}
                sx={{
                    position: 'fixed',
                    top: 16,
                    right: 16,
                    backgroundColor: colorRed,
                    color: "white",
                    '&:hover': {
                        backgroundColor: '#d23c3d',
                    },
                }}
            >
                <ExpandLess sx={{ fontSize: 30 }}/>
            </Fab>
            }

            {isSettingsOpen && !isHistoryOpen && !isConfigOpen && !isStatisticsOpen && <Fab
                color="primary"
                aria-label="history"
                onClick={() => setIsHistoryOpen(true)}
                sx={{
                    position: 'fixed',
                    top: 146,
                    right: 16,
                    backgroundColor: colorRed,
                    color: "white",
                    '&:hover': {
                        backgroundColor: '#d23c3d',
                    },
                }}
            >
                <History sx={{ fontSize: 30 }}/>
            </Fab>
            }

            {isSettingsOpen && !isHistoryOpen && !isConfigOpen && !isStatisticsOpen && <Fab
                color="primary"
                aria-label="add"
                onClick={() => navigate('/menu?isAdmin=true')}
                sx={{
                    position: 'fixed',
                    top: 81,
                    right: 16,
                    backgroundColor: colorRed,
                    color: 'white',
                    '&:hover': {
                        backgroundColor: '#d23c3d',
                    },
                }}
            >
                <AddIcon sx={{ fontSize: 30 }}/>
            </Fab>}

            {isSettingsOpen && !isHistoryOpen && !isConfigOpen && !isStatisticsOpen && <Fab
                color="primary"
                aria-label="ToggleOn"
                onClick={() => setIsConfigOpen(true)}
                sx={{
                    position: 'fixed',
                    top: 276,
                    right: 16,
                    backgroundColor: colorRed,
                    color: 'white',
                    '&:hover': {
                        backgroundColor: '#d23c3d',
                    },
                }}
            >
                <ToggleOnIcon sx={{ fontSize: 30 }}/>
            </Fab>}


            {isSettingsOpen && !isHistoryOpen && !isConfigOpen && !isStatisticsOpen && <Fab
                color="primary"
                aria-label="add"
                onClick={() =>
                    setIsStatisticsOpen(true)
            }
                sx={{
                    position: 'fixed',
                    top: 211,
                    right: 16,
                    backgroundColor: colorRed,
                    color: 'white',
                    '&:hover': {
                        backgroundColor: '#d23c3d',
                    },
                }}
            >
                <StackedLineChartIcon sx={{ fontSize: 30 }} />
            </Fab>}



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
                            New Order: {activeAlertOrder?.orderId}
                        </Typography>
                        <Typography variant="body2">
                            Total price: {activeAlertOrder?.amount_paid} BHD
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={() => {
                            if (audioRef) {
                                audioRef.pause();
                                audioRef.currentTime = 0;
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
                            Enable sound for order alerts
                        </Typography>
                    </Box>
                    <Button
                        onClick={() => {
                            audioRef.play()
                                .then(() => {
                                    audioRef.pause();
                                    audioRef.currentTime = 0;
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