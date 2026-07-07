// Presentational Live-Activity-style card for the customer's active order
// (task-spec.md §5, Phase 4b; redesigned to the iOS delivery Live-Activity layout).
// TOP-LEFT = branch name, TOP-RIGHT = ETA; then the order number; then a status
// progress track with a node per kitchen stage. Holds no state/logic — rendered by
// HomePage via useActiveOrderIsland.
import React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Box, Typography } from "@mui/material";
import LocalPizzaRoundedIcon from "@mui/icons-material/LocalPizzaRounded";

const brandRed = "#E44B4C";
const track = "rgba(0, 0, 0, 0.08)";

// Ordered kitchen journey shown on the track. "Picked Up" is terminal — the card
// hides once reached (useActiveOrderIsland.isVisible), so it is not a visible stage.
const STAGES: ReadonlyArray<{ key: string; labelKey: string }> = [
    { key: "Kitchen Phase", labelKey: "island.stage.preparing" },
    { key: "Oven", labelKey: "island.stage.inOven" },
    { key: "Ready", labelKey: "island.stage.ready" },
];

function stageIndex(status: string | null): number {
    const idx = STAGES.findIndex((s) => s.key === status);
    // Unknown/early statuses (e.g. "initial-creation") fall back to the first stage.
    return idx < 0 ? 0 : idx;
}

function etaLabel(status: string | null, timeLeft: number, t: TFunction): string {
    if (status === "Ready") return t("island.ready");
    const mins = Math.ceil(timeLeft / 60);
    if (mins <= 0) return t("island.anyMinute");
    return t("island.minutes", { value: mins });
}

type ActiveOrderIslandPillProps = {
    branchName: string;
    orderNumber: number;
    status: string | null;
    timeLeft: number;
    onClick: () => void;
};

export function ActiveOrderIslandPill({
    branchName,
    orderNumber,
    status,
    timeLeft,
    onClick,
}: ActiveOrderIslandPillProps): React.JSX.Element {
    const { t } = useTranslation("customerAuth");
    const idx = stageIndex(status);
    const lastIdx = STAGES.length - 1;
    const fillPct = (idx / lastIdx) * 100;
    const isReady = status === "Ready";

    return (
        <Box
            data-testid="active-order-island-pill"
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
            }}
        >
            {/* Header: branch name + ETA */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                {!isReady && (
                <Typography noWrap sx={{ color: "#1A1A1A", fontSize: 16, fontWeight: 800, lineHeight: 1.3, minWidth: 0, pr: 1 }}>
                    {branchName}
                </Typography>
                )}
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    {!isReady && (
                        <Typography sx={{ color: "#8a8a8a", fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                            {t("island.readyIn")}
                        </Typography>
                    )}
                    <Typography sx={{ color: brandRed, fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>
                        {etaLabel(status, timeLeft, t)}
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
                {/* filled line up to current stage */}
                <Box
                    sx={{
                        position: "absolute",
                        top: "50%",
                        left: 0,
                        width: `${fillPct}%`,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: brandRed,
                        transform: "translateY(-50%)",
                        transition: "width 400ms ease",
                    }}
                />
                {/* stage nodes */}
                {STAGES.map((s, i) => (
                    <Box
                        key={s.key}
                        sx={{
                            position: "absolute",
                            top: "50%",
                            left: `${(i / lastIdx) * 100}%`,
                            transform: "translate(-50%, -50%)",
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: i <= idx ? brandRed : "#fff",
                            border: `2px solid ${i <= idx ? brandRed : track}`,
                        }}
                    />
                ))}
                {/* moving marker at current stage */}
                <Box
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
                        transition: "left 400ms ease",
                    }}
                >
                    <LocalPizzaRoundedIcon sx={{ color: "#fff", fontSize: 13 }} />
                </Box>
            </Box>

            {/* end labels */}
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                <Typography sx={{ color: "#1A1A1A", fontSize: 12, fontWeight: 700 }}>
                    {t(STAGES[0].labelKey)}
                </Typography>
                <Typography sx={{ color: idx >= lastIdx ? brandRed : "#8a8a8a", fontSize: 12, fontWeight: 700 }}>
                    {t(STAGES[lastIdx].labelKey)}
                </Typography>
            </Box>
        </Box>
    );
}

export default ActiveOrderIslandPill;
