import { Box, Typography } from "@mui/material";
import Lottie from "lottie-react";
import kitchenPhaseAnimation from "../../../assets/animations/kitchen_phase_animatiom.json";
import readyAnimation from "../../../assets/animations/ready-animation.json";
import { TextTitleWithoutVariant } from "../../../shared/components/typography";
import type { OrderStatusData } from "../types";

// cast is needed because JSON modules are typed as `unknown` per global.d.ts
const kitchenAnim = kitchenPhaseAnimation as object;
const readyAnim = readyAnimation as object;

interface OrderStatusContentProps {
    order: OrderStatusData | null;
    remainingSeconds: number;
}

export function OrderStatusContent({ order, remainingSeconds }: OrderStatusContentProps): JSX.Element {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const formattedTime = remainingSeconds > 0 ? `${minutes}:${seconds.toString().padStart(2, "0")}` : "0:00";

    return (
        <Box sx={{ textAlign: "center", mt: 5, height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#ffffff", px: 2, gap: 2, justifyContent: "center" }}>
            <Typography variant="h5" sx={{ fontWeight: "bold", color: "#E44B4C", mt: 2 }}>
                Order #{order?.orderNumber}
            </Typography>

            {order?.orderStatus === "Kitchen Phase" && <TextTitleWithoutVariant>Your pizza is being prepared 🍕</TextTitleWithoutVariant>}
            {order?.orderStatus === "Oven" && <TextTitleWithoutVariant>Your pizzas are in the oven. Almost ready!</TextTitleWithoutVariant>}
            {order?.orderStatus === "Ready" && (
                <TextTitleWithoutVariant>
                    Your order is ready for pickup! 🚶‍♂️ Come in and grab it <br/>
                    No honking, please. It helps us prepare your orders faster! 🙏☺️
                </TextTitleWithoutVariant>
            )}

            {order?.orderStatus === "Kitchen Phase" && (
                <Box sx={{ mt: 1 }}>
                    <Lottie animationData={kitchenAnim} loop autoplay style={{ width: 260, height: 260 }} />
                </Box>
            )}
            {order?.orderStatus === "Ready" && (
                <Box sx={{ mt: 1 }}>
                    <Lottie animationData={readyAnim} loop autoplay style={{ width: 260, height: 260 }} />
                </Box>
            )}
            {order?.orderStatus === "Oven" && (
                <Box sx={{ mt: 1 }}>
                    <Box component="video" src="/videos/oven-status.mp4" autoPlay muted loop playsInline sx={{ width: 260, height: 260 }} />
                </Box>
            )}

            {order?.orderStatus !== "Ready" && (
                remainingSeconds > 0
                    ? <Typography variant="body1" sx={{ mt: 1 }}>
                        Will be ready in{" "}
                        <Typography component="span" sx={{ fontWeight: "bold", color: "#E44B4C" }}>{formattedTime} ⏱️</Typography>
                    </Typography>
                    : <Typography variant="body1" sx={{ fontWeight: "bold", color: "#2e7d32", mt: 2 }}>
                        We're working hard to get your order out as soon as possible 🙏🍕
                    </Typography>
            )}
        </Box>
    );
}
