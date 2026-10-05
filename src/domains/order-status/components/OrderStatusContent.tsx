import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import Lottie from "lottie-react";
import kitchenPhaseAnimation from "../../../assets/animations/kitchen_phase_animatiom.json";
import readyAnimation from "../../../assets/animations/ready-animation.json";
import DeliveryRideAnimation from "./animations/DeliveryRideAnimation";
import { CourierTrackingMap } from "./CourierTrackingMap";
import { DeliveryPartsProgress } from "./DeliveryPartsProgress";
import { TextTitleWithoutVariant } from "../../../shared/components/typography";
import { formatBahrainClock } from "../../../shared/utils/timeUtils";
import {
    OUT_FOR_DELIVERY_STATUS,
    isDeliveryOrder,
    stageIndexIn,
    stagesFor,
} from "../../../shared/utils/orderStages";
import { useCourierTracking } from "../hooks/useCourierTracking";
import type { OrderStatusData } from "../types";

// cast is needed because JSON modules are typed as `unknown` per global.d.ts
const kitchenAnim = kitchenPhaseAnimation as object;
const readyAnim = readyAnimation as object;

const brandRed = "#E44B4C";
const DELIVERED_STATUS = "Delivered";

interface OrderStatusContentProps {
    order: OrderStatusData | null;
    remainingSeconds: number;
}

export function OrderStatusContent({ order, remainingSeconds }: OrderStatusContentProps): JSX.Element {
    const { t } = useTranslation("customerAuth");

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const formattedTime = remainingSeconds > 0 ? `${minutes}:${seconds.toString().padStart(2, "0")}` : "0:00";

    const status = order?.orderStatus ?? null;
    // The same ladder the native notification bar draws (OrderPushNotifier), so the shade and
    // the screen can never disagree about how many steps are left.
    const delivery = isDeliveryOrder(order?.orderType);
    const stages = stagesFor(order?.orderType);
    const currentStage = stageIndexIn(stages, status);
    const riding = status === OUT_FOR_DELIVERY_STATUS;
    const delivered = status === DELIVERED_STATUS;

    // Called unconditionally — hooks cannot be called inside the `riding` branch below.
    const { couriers, parts, destination } = useCourierTracking(order?.id ?? null, delivery, status);

    // A wall-clock arrival needs no ticking: left alone it simply falls into the past, which is
    // an honest way to say "running late". The moving, elapsed-time bar lives on the island pill.
    const arrivalClock = formatBahrainClock(order?.estimatedDeliveredAt);

    // The countdown is to Ready, so it stops being the thing to show the moment the order is
    // ready — for a pickup order that is the end, for a delivery order the ride takes over.
    const showReadyCountdown = status !== "Ready" && !riding && !delivered;

    return (
        <Box sx={{ textAlign: "center", mt: 5, height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#ffffff", px: 2, gap: 2, justifyContent: "center" }}>
            <Typography variant="h5" sx={{ fontWeight: "bold", color: brandRed, mt: 2 }}>
                Order #{order?.orderNumber}
            </Typography>

            {status === "Kitchen Phase" && <TextTitleWithoutVariant>Your pizza is being prepared 🍕</TextTitleWithoutVariant>}
            {status === "Oven" && <TextTitleWithoutVariant>Your pizzas are in the oven. Almost ready!</TextTitleWithoutVariant>}
            {status === "Ready" && (
                delivery
                    ? <TextTitleWithoutVariant>{t("orderStatus.readyForDelivery")}</TextTitleWithoutVariant>
                    : (
                        <TextTitleWithoutVariant>
                            Your order is ready for pickup! 🚶‍♂️ Come in and grab it <br/>
                            No honking, please. It helps us prepare your orders faster! 🙏☺️
                        </TextTitleWithoutVariant>
                    )
            )}
            {riding && <TextTitleWithoutVariant>{t("orderStatus.outForDelivery")}</TextTitleWithoutVariant>}
            {delivered && <TextTitleWithoutVariant>{t("orderStatus.delivered")}</TextTitleWithoutVariant>}

            {status === "Kitchen Phase" && (
                <Box sx={{ mt: 1 }}>
                    <Lottie animationData={kitchenAnim} loop autoplay style={{ width: 260, height: 260 }} />
                </Box>
            )}
            {(status === "Ready" || delivered) && (
                <Box sx={{ mt: 1 }}>
                    <Lottie animationData={readyAnim} loop autoplay style={{ width: 260, height: 260 }} />
                </Box>
            )}
            {status === "Oven" && (
                <Box sx={{ mt: 1 }}>
                    <Box component="video" src="/videos/oven-status.mp4" autoPlay muted loop playsInline sx={{ width: 260, height: 260 }} />
                </Box>
            )}
            {riding && (
                <Box sx={{ mt: 1 }}>
                    <DeliveryRideAnimation />
                    <CourierTrackingMap couriers={couriers} destination={destination} split={parts.length > 1} />
                    <DeliveryPartsProgress parts={parts} />
                </Box>
            )}

            {/* The ladder itself — a delivery order keeps two steps to go once the kitchen is done. */}
            <Box data-testid="order-stage-track" sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                {stages.map((stage, i) => (
                    <Box
                        key={stage.key}
                        data-testid={`order-stage-${i}`}
                        data-reached={i <= currentStage ? "true" : "false"}
                        sx={{
                            width: i === currentStage ? 12 : 8,
                            height: i === currentStage ? 12 : 8,
                            borderRadius: "50%",
                            backgroundColor: i <= currentStage ? brandRed : "rgba(0, 0, 0, 0.12)",
                        }}
                    />
                ))}
            </Box>
            <Typography sx={{ color: "#8a8a8a", fontSize: 13, fontWeight: 700 }}>
                {t(stages[currentStage].labelKey)}
            </Typography>

            {riding && (
                <Typography variant="body1" data-testid="ride-arrival-line" sx={{ mt: 1 }}>
                    {arrivalClock !== null
                        ? t("orderStatus.arrivingAround", { time: arrivalClock })
                        : t("orderStatus.arrivalUnknown")}
                </Typography>
            )}

            {showReadyCountdown && (
                remainingSeconds > 0
                    ? <Typography variant="body1" sx={{ mt: 1 }}>
                        Will be ready in{" "}
                        <Typography component="span" sx={{ fontWeight: "bold", color: brandRed }}>{formattedTime} ⏱️</Typography>
                    </Typography>
                    : <Typography variant="body1" sx={{ fontWeight: "bold", color: "#2e7d32", mt: 2 }}>
                        We're working hard to get your order out as soon as possible 🙏🍕
                    </Typography>
            )}
        </Box>
    );
}
