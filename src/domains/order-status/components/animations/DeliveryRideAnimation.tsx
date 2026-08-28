import { Box } from "@mui/material";
import DeliveryDiningRoundedIcon from "@mui/icons-material/DeliveryDiningRounded";
import React from "react";

// The "Out for delivery" treatment for the order-status screen. Deliberately composed from
// what the app already ships — an MUI icon over a CSS-drawn road — rather than a fourth Lottie
// file: this stage was added late and must not add an animation dependency or a new asset.
//
// The road scrolls and the scooter bobs; the scooter itself does NOT travel across, because its
// position would then read as progress and there is no honest quantity behind it here (the
// island pill is where elapsed time is actually measured). Motion without a claim.

const brandRed = "#E44B4C";

const ROAD_KEYFRAMES = "deliveryRideRoad";
const BOB_KEYFRAMES = "deliveryRideBob";

const DeliveryRideAnimation = (): JSX.Element => (
    <Box
        data-testid="delivery-ride-animation"
        aria-hidden
        sx={{
            width: 260,
            height: 160,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            [`@keyframes ${ROAD_KEYFRAMES}`]: {
                "0%": { backgroundPosition: "0px 0px" },
                "100%": { backgroundPosition: "-48px 0px" },
            },
            [`@keyframes ${BOB_KEYFRAMES}`]: {
                "0%, 100%": { transform: "translateY(0px) rotate(-2deg)" },
                "50%": { transform: "translateY(-6px) rotate(2deg)" },
            },
        }}
    >
        <DeliveryDiningRoundedIcon
            sx={{
                color: brandRed,
                fontSize: 96,
                animation: `${BOB_KEYFRAMES} 1.1s ease-in-out infinite`,
            }}
        />
        <Box
            sx={{
                mt: 1.5,
                width: "100%",
                height: 6,
                borderRadius: 3,
                backgroundColor: "rgba(0, 0, 0, 0.06)",
                backgroundImage:
                    "repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 20px, transparent 20px, transparent 48px)",
                animation: `${ROAD_KEYFRAMES} 0.7s linear infinite`,
            }}
        />
    </Box>
);

export default DeliveryRideAnimation;
