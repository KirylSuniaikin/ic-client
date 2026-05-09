import {Box, Typography} from "@mui/material";
import {useEffect, useRef, useState} from "react";
import {getOrderStatus} from "./api/api";
import PizzaLoader from "./components/loadingAnimations/PizzaLoader";
import {TextTitleWithoutVariant} from "./utils/typography";
import kitchenPhaseAnimation from "./components/loadingAnimations/kitchen_phase_animatiom.json";
import Lottie from "lottie-react";
import readyAnimation from "./components/loadingAnimations/ready-animation.json";
import {connectSocket, socket} from "./api/socket";
import {StompSubscription} from "@stomp/stompjs";

// The order status endpoint returns a shape with camelCase field names
// distinct from the main Order type (which uses snake_case).
export type OrderStatusData = {
    id: number;
    orderStatus: string;
    orderNumber: number;
    orderCreated: string;
    estimationTime: number;
    error?: boolean;
    message?: string;
    branchId: string;
};

interface OrderStatusPageProps {
    orderId: string | null;
}

export function OrderStatusPage({ orderId }: OrderStatusPageProps): JSX.Element {
    const [order, setOrder] = useState<OrderStatusData>({
        id: 0,
        branchId: null,
        error: false,
        estimationTime: 0,
        message: "",
        orderCreated: "",
        orderNumber: 0,
        orderStatus: ""
    });
    const [branchId, setBranchId] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [remaining, setRemaining] = useState<number | undefined>();

    const currentIdRef = useRef(orderId);
    useEffect(() => {
        currentIdRef.current = String(orderId);
    }, [orderId]);

    useEffect(() => {
        async function fetchStatus() {
            const data = await getOrderStatus(orderId ?? "");
            console.log("received data")

            if ("error" in data && data.error) {
                return;
            }
            const orderData = data as OrderStatusData;

            setOrder(orderData);
            setBranchId(orderData.branchId);
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
        if (!branchId) return;

        console.log("Updating subscription")

        let subscription: StompSubscription | undefined;

        connectSocket(() => {
            subscription = socket.subscribe(
                `/topic/${branchId}/order-status-updated`,
                (frame) => {
                    const payload = JSON.parse(frame.body);
                    const eventId = Number(payload.id ?? payload.orderId ?? payload);
                    const currentId = Number(currentIdRef.current);
                    if (eventId === currentId) {
                        setOrder((prev) => ({ ...prev, orderStatus: payload.status }));
                    }
                    socket.publish({
                        destination: '/app/orders/ack',
                        body: JSON.stringify({ orderId: Number(payload.id) }),
                    });
                }
            );
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, [branchId]);

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

    const minutes = Math.floor((remaining ?? 0) / 60);
    const seconds = (remaining ?? 0) % 60;

    const formattedTime =
        remaining !== undefined && remaining > 0
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
                        // cast is needed because JSON modules are typed as `unknown` per global.d.ts
                        animationData={kitchenPhaseAnimation as object}
                        loop
                        autoplay
                        style={{ width: 260, height: 260 }}
                    />
                </Box>
            )}
            {order.orderStatus === "Ready" && (
                <Box sx={{ mt: 1 }}>
                    <Lottie
                        // cast is needed because JSON modules are typed as `unknown` per global.d.ts
                        animationData={readyAnimation as object}
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
                remaining !== undefined && remaining > 0 ? (
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
                        We're working hard to get your order out as soon as possible 🙏🍕
                    </Typography>
                )
            )}
        </Box>
    )
}
