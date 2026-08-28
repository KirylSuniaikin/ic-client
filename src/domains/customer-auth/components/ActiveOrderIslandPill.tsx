// Presentational Live-Activity-style card for the customer's active order
// (task-spec.md §5, Phase 4b; redesigned to the iOS delivery Live-Activity layout).
// TOP-LEFT = branch name, TOP-RIGHT = ETA; then the order number; then a status
// progress track with a node per stage. Holds no state/logic — rendered by
// HomePage via useActiveOrderIsland, which owns both clocks.
import React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Box, Typography } from "@mui/material";
import LocalPizzaRoundedIcon from "@mui/icons-material/LocalPizzaRounded";
import DeliveryDiningRoundedIcon from "@mui/icons-material/DeliveryDiningRounded";
import {
    OUT_FOR_DELIVERY_STATUS,
    isDeliveryOrder,
    stageIndexIn,
    stagesFor,
} from "../../../shared/utils/orderStages";
import type { RideProgress } from "../../../shared/utils/orderStages";

const brandRed = "#E44B4C";
const track = "rgba(0, 0, 0, 0.08)";

const SWEEP_KEYFRAMES = "islandRideSweep";
const PULSE_KEYFRAMES = "islandRidePulse";

type ActiveOrderIslandPillProps = {
    branchName: string;
    orderNumber: number;
    status: string | null;
    /** "Delivery" or the pickup type — picks the ladder and the Ready copy. */
    orderType: string;
    timeLeft: number;
    /**
     * The ride's live fill from useActiveOrderIsland, or null when it cannot be quantified
     * (no courier yet, no coordinates). Null is rendered as motion without a number — never
     * as 0%, which would claim the courier has not set off.
     */
    rideProgress: RideProgress | null;
    onClick: () => void;
};

/** The caption above the big figure: what the figure is counting down to, or nothing. */
function etaCaption(riding: boolean, hideCaption: boolean, t: TFunction): string | null {
    if (hideCaption) return null;
    return riding ? t("island.arrivingIn") : t("island.readyIn");
}

/**
 * The big figure in the top-right.
 *
 * During the ride it counts to the door, not to Ready — and once the estimate is passed it
 * stops quoting a number at all, because a negative or zero countdown that keeps ticking is
 * exactly the lie the bar is designed not to tell. With no estimate at all it names the state
 * ("On the way") rather than a fabricated quantity.
 */
function etaLabel(
    status: string | null,
    delivery: boolean,
    timeLeft: number,
    rideProgress: RideProgress | null,
    t: TFunction,
): string {
    if (status === OUT_FOR_DELIVERY_STATUS) {
        if (rideProgress === null) return t("island.onTheWay");
        if (rideProgress.overdue) return t("island.arrivingNow");
        return rideProgress.minutesLeft <= 0
            ? t("island.anyMinute")
            : t("island.minutes", { value: rideProgress.minutesLeft });
    }
    // A delivery order at Ready is waiting for a courier, not for the customer to walk in —
    // the same distinction the push notification's Ready copy already draws.
    if (status === "Ready") return delivery ? t("island.waitingForCourier") : t("island.ready");

    const mins = Math.ceil(timeLeft / 60);
    if (mins <= 0) return t("island.anyMinute");
    return t("island.minutes", { value: mins });
}

export function ActiveOrderIslandPill({
    branchName,
    orderNumber,
    status,
    orderType,
    timeLeft,
    rideProgress,
    onClick,
}: ActiveOrderIslandPillProps): React.JSX.Element {
    const { t } = useTranslation("customerAuth");

    const delivery = isDeliveryOrder(orderType);
    const stages = stagesFor(orderType);
    const idx = stageIndexIn(stages, status);
    const lastIdx = stages.length - 1;
    const riding = status === OUT_FOR_DELIVERY_STATUS;

    // One track segment as a share of the whole track — the unit the ride's fill is measured in.
    const segmentPct = 100 / lastIdx;
    // Time-based fill only inside the ride's own segment: everything before it is a completed
    // step and everything after it has not happened, so neither may move on a clock.
    const rideFraction = riding ? (rideProgress?.fraction ?? 0) : 0;
    const fillPct = ((idx + rideFraction) / lastIdx) * 100;

    // Ready is the end of the line for a pickup order, so its layout collapses to the call to
    // action. A delivery order's Ready is a waypoint, but its copy is just as long.
    const hideBranchName = status === "Ready";
    const showIndeterminateRide = riding && rideProgress === null;
    const caption = etaCaption(riding, hideBranchName, t);

    return (
        <Box
            data-testid="active-order-island-pill"
            data-order-type={delivery ? "delivery" : "pickup"}
            role="button"
            onClick={onClick}
            sx={{
                position: "fixed",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 9999,
                width: "calc(100% - 24px)",
                maxWidth: 400,
                boxSizing: "border-box",
                px: 2,
                py: 1.75,
                borderRadius: 5,
                backgroundColor: "#fff",
                border: "1px solid rgba(0, 0, 0, 0.06)",
                boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.14)",
                cursor: "pointer",
                [`@keyframes ${SWEEP_KEYFRAMES}`]: {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(100%)" },
                },
                [`@keyframes ${PULSE_KEYFRAMES}`]: {
                    "0%, 100%": { boxShadow: "0px 0px 0px 0px rgba(228, 75, 76, 0.45)" },
                    "50%": { boxShadow: "0px 0px 0px 7px rgba(228, 75, 76, 0)" },
                },
            }}
        >
            {/* Header: branch name + ETA */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                {!hideBranchName && (
                <Typography noWrap sx={{ color: "#1A1A1A", fontSize: 16, fontWeight: 800, lineHeight: 1.3, minWidth: 0, pr: 1 }}>
                    {branchName}
                </Typography>
                )}
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    {caption !== null && (
                        <Typography sx={{ color: "#8a8a8a", fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                            {caption}
                        </Typography>
                    )}
                    <Typography sx={{ color: brandRed, fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>
                        {etaLabel(status, delivery, timeLeft, rideProgress, t)}
                    </Typography>
                </Box>
            </Box>

            {/* Order number with a thumbnail-style icon */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2.5,
                        backgroundColor: "#FCE9E9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <LocalPizzaRoundedIcon sx={{ color: brandRed, fontSize: 24 }} />
                </Box>
                <Typography sx={{ color: "#1A1A1A", fontSize: 17, fontWeight: 800 }}>
                    {t("island.orderNumber", { number: orderNumber })}
                </Typography>
            </Box>

            {/* Status progress track */}
            <Box sx={{ position: "relative", height: 22, mx: 1.25 }}>
                {/* base line */}
                <Box
                    sx={{
                        position: "absolute",
                        top: "50%",
                        left: 0,
                        right: 0,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: track,
                        transform: "translateY(-50%)",
                    }}
                />
                {/* filled line up to current stage (plus the ride's elapsed share of its segment) */}
                <Box
                    data-testid="island-track-fill"
                    data-fill-pct={fillPct.toFixed(2)}
                    sx={{
                        position: "absolute",
                        top: "50%",
                        left: 0,
                        width: `${fillPct}%`,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: brandRed,
                        transform: "translateY(-50%)",
                        transition: "width 900ms linear",
                    }}
                />
                {/* No estimate to fill by: sweep the ride's segment instead, so the track still
                    reads as moving without asserting how far along it is. */}
                {showIndeterminateRide && (
                    <Box
                        data-testid="island-ride-indeterminate"
                        sx={{
                            position: "absolute",
                            top: "50%",
                            left: `${idx * segmentPct}%`,
                            width: `${segmentPct}%`,
                            height: 4,
                            borderRadius: 2,
                            transform: "translateY(-50%)",
                            overflow: "hidden",
                            "&::after": {
                                content: '""',
                                position: "absolute",
                                inset: 0,
                                background: `linear-gradient(90deg, transparent, ${brandRed}, transparent)`,
                                animation: `${SWEEP_KEYFRAMES} 1.6s ease-in-out infinite`,
                            },
                        }}
                    />
                )}
                {/* stage nodes */}
                {stages.map((s, i) => (
                    <Box
                        key={s.key}
                        sx={{
                            position: "absolute",
                            top: "50%",
                            left: `${i * segmentPct}%`,
                            transform: "translate(-50%, -50%)",
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: i <= idx ? brandRed : "#fff",
                            border: `2px solid ${i <= idx ? brandRed : track}`,
                        }}
                    />
                ))}
                {/* moving marker at current position */}
                <Box
                    data-testid="island-track-marker"
                    sx={{
                        position: "absolute",
                        top: "50%",
                        left: `${fillPct}%`,
                        transform: "translate(-50%, -50%)",
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        backgroundColor: brandRed,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0px 2px 6px rgba(228, 75, 76, 0.4)",
                        transition: "left 900ms linear",
                        // The bar is deliberately frozen once the estimate is passed; the pulse is
                        // what keeps "running late" from reading as "stuck".
                        ...((showIndeterminateRide || rideProgress?.overdue)
                            ? { animation: `${PULSE_KEYFRAMES} 1.8s ease-out infinite` }
                            : {}),
                    }}
                >
                    {riding
                        ? <DeliveryDiningRoundedIcon data-testid="island-marker-courier" sx={{ color: "#fff", fontSize: 14 }} />
                        : <LocalPizzaRoundedIcon sx={{ color: "#fff", fontSize: 13 }} />}
                </Box>
            </Box>

            {/* end labels */}
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                <Typography sx={{ color: "#1A1A1A", fontSize: 12, fontWeight: 700 }}>
                    {t(stages[0].labelKey)}
                </Typography>
                <Typography sx={{ color: idx >= lastIdx ? brandRed : "#8a8a8a", fontSize: 12, fontWeight: 700 }}>
                    {t(stages[lastIdx].labelKey)}
                </Typography>
            </Box>
        </Box>
    );
}

export default ActiveOrderIslandPill;
