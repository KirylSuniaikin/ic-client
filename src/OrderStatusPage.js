import {Box, Paper, Typography} from "@mui/material";
import {useEffect, useState} from "react";
import {getOrderStatus} from "./api/api";
import PizzaLoader from "./components/loadingAnimations/PizzaLoader";
import {TextTitleWithoutVariant} from "./utils/typography";
import kitchenPhaseAnimation from "./components/loadingAnimations/kitchen_phase_animatiom.json";
import Lottie from "lottie-react";
import readyAnimation from "./components/loadingAnimations/ready-animation.json";

export function OrderStatusPage({orderId}) {
    const [order, setOrder] = useState({});
    const [loading, setLoading] = useState(true);
    const [remaining, setRemaining] = useState(0.1 * 60); // в секундах

    // order.estimationTime

    useEffect(() => {
        async function fetchStatus() {
            const data = await getOrderStatus(orderId);
            setOrder(data);
            console.log(data);
            setLoading(false);
        }
        fetchStatus();
        }, [orderId]);

    useEffect(() => {
        if (!remaining) return;
        const interval = setInterval(() => {
            setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(interval);
    }, [remaining]);


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
            {order.orderStatus === "Kitchen Phase" && (
                remaining > 0 ? (
                    <Typography variant="body1" sx={{ mt: 1 }}>
                        Estimated ready in{" "}
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
                        ✅ Your order should be ready now!
                    </Typography>
                )
            )}
        </Box>
    )
}