import {Box, Typography} from "@mui/material";
import {useEffect, useState} from "react";
import {getOrderStatus} from "./api/api";
import PizzaLoader from "./components/loadingAnimations/PizzaLoader";
import {TextTitleWithoutVariant} from "./utils/typography";
import kitchenPhaseAnimation from "./components/loadingAnimations/kitchen_phase_animatiom.json";
import Lottie from "lottie-react";
import readyAnimation from "./components/loadingAnimations/ready-animation.json";
import {connectSocket, socket} from "./api/socket";

export function OrderStatusPage({orderId}) {
    const [order, setOrder] = useState({});
    const [loading, setLoading] = useState(true);
    const [remaining, setRemaining] = useState();

    useEffect(() => {
        async function fetchStatus() {
            const data = await getOrderStatus(orderId);
            setOrder(data);
            setLoading(false);
        }
        fetchStatus();
    }, [orderId]);

    useEffect(() => {
        if (!order?.orderCreated || !order?.estimationTime) return;

        const createdTime = new Date(order.orderCreated).getTime();
        const totalSec = order.estimationTime * 60;

        function updateRemaining() {
            const now = Date.now();
            const elapsedSec = Math.floor((now - createdTime) / 1000);
            const remainingSec = Math.max(totalSec - elapsedSec, 0);
            setRemaining(remainingSec);
        }

        updateRemaining();
        const intervalId = setInterval(updateRemaining, 1000);

        return () => clearInterval(intervalId);
    }, [order]);

    useEffect(() => {
        connectSocket(()=> {
            socket.subscribe("/topic/order-status-updated", (frame) => {
                const payload = JSON.parse(frame.body);
                const status = payload.status;
                console.log("[ORDER STATUS UPDATE] " + payload);
                if(payload.id === order?.id){
                    console.log("[ORDER STATUS UPDATE] " + payload.id);
                    setOrder((prev) => ({ ...prev, orderStatus: status }));
                }

                socket.publish({
                    destination: '/app/orders/ack',
                    body: JSON.stringify({orderId: payload}),
                });
            })
        })
    }, [orderId]);

    if (order?.error) {
        return (
            <Box sx={{ textAlign: "center", mt: 8 }}>
                <Typography variant="h4">😕</Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>
                    Order not found
                </Typography>
            </Box>
        );
    }

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    const formattedTime =
        remaining > 0
            ? `${minutes}:${seconds.toString().padStart(2, "0")}`
            : "0:00";


    if (loading) return <PizzaLoader/>;

    return (
        <Box
            sx={{
                textAlign: "center",
                mt: 5,
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                backgroundColor: "#ffffff",
                px: 2,
                gap: 2,
                justifyContent: "center",
            }}
        >
            <Typography
                variant="h5"
                sx={{ fontWeight: "bold", color: "#E44B4C", mt: 2 }}
            >
                Order #{order.orderNumber}
            </Typography>

            {order.orderStatus === "Kitchen Phase" && (
                <TextTitleWithoutVariant>
                    Your pizza is being prepared 🍕
                </TextTitleWithoutVariant>
            )}

            {order.orderStatus === "Oven" && (
                <TextTitleWithoutVariant>
                    Your pizzas are in the oven. Almost ready!
                </TextTitleWithoutVariant>
            )}

            {order.orderStatus === "Ready" && (

                <TextTitleWithoutVariant>
                    Your order is ready for pickup! 🚶‍♂️
                    Come in and grab it <br/>
                    No honking, please. It helps us prepare your orders faster! 🙏☺️
                </TextTitleWithoutVariant>
            )}

            {order.orderStatus === "Kitchen Phase" && (
                <Box sx={{ mt: 1 }}>
                    <Lottie
                        animationData={kitchenPhaseAnimation}
                        loop
                        autoplay
                        style={{ width: 260, height: 260 }}
                    />
                </Box>
            )}
            {order.orderStatus === "Ready" && (
                <Box sx={{ mt: 1 }}>
                    <Lottie
                        animationData={readyAnimation}
                        loop={true}
                        autoplay
                        style={{ width: 260, height: 260 }}
                    />
                </Box>
            )}
            {order.orderStatus === "Oven" && (
                <Box sx={{mt: 1}}>
                    <Box
                        component="video"
                        src="/videos/oven-status.mp4"
                        autoPlay
                        muted
                        loop
                        playsInline
                        sx={{
                        width: 260,
                        height: 260,
                        }}
                    >
                    </Box>
                </Box>
            )}

            {order.orderStatus !== "Ready" && (
                remaining > 0 ? (
                    <Typography variant="body1" sx={{mt: 1 }}>
                        Will be ready in{" "}
                        <Typography
                            component="span"
                            sx={{
                                fontWeight: "bold",
                                color: "#E44B4C",
                            }}
                        >
                            {formattedTime} ⏱️
                        </Typography>
                    </Typography>
                ) : (
                    <Typography
                        variant="body1"
                        sx={{
                            fontWeight: "bold",
                            color: "#2e7d32",
                            mt: 2,
                        }}
                    >
                        We’re working hard to get your order out as soon as possible 🙏🍕
                    </Typography>
                )
            )}
        </Box>
    )
}