import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, LinearProgress, Typography } from "@mui/material";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import RemoveCircleRoundedIcon from "@mui/icons-material/RemoveCircleRounded";
import { BRAND_RED } from "../../../../../shared/utils/theme";
import type { OrderLineChange } from "./diffOrderLines";
import type { OrderEditSummaryData } from "./useOrderEdit";
import { formatBd, orderLineLabel } from "./orderLineDisplay";
import { EDIT_COLORS } from "./orderEditColors";

export const SUMMARY_SECONDS = 10;

interface OrderEditSummaryProps {
    summary: OrderEditSummaryData;
    /** Fired by Close now and when the countdown reaches zero. */
    onClose: () => void;
}

interface ChangeSectionProps {
    kind: "added" | "removed";
    changes: OrderLineChange[];
}

function ChangeSection({ kind, changes }: ChangeSectionProps): JSX.Element {
    const { t } = useTranslation("orderEdit");
    const isAdded = kind === "added";
    const color = isAdded ? EDIT_COLORS.addedText : EDIT_COLORS.removedText;
    const bg = isAdded ? EDIT_COLORS.addedBg : EDIT_COLORS.removedBg;
    const Icon = isAdded ? AddCircleRoundedIcon : RemoveCircleRoundedIcon;

    return (
        <Box component="section" data-testid={`summary-${kind}`} sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 800, letterSpacing: 1, color, mb: 1 }}>
                {t(isAdded ? "summary.added" : "summary.removed")}
            </Typography>
            {changes.length === 0 && (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {t(isAdded ? "summary.nothingAdded" : "summary.nothingRemoved")}
                </Typography>
            )}
            {changes.map((change, i) => (
                <Box
                    key={i}
                    data-testid={`summary-${kind}-row`}
                    sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: 1.5, py: 1, mb: 0.75, borderRadius: 2, bgcolor: bg, color }}
                >
                    <Icon fontSize="small" sx={{ mt: "2px", flexShrink: 0 }} />
                    <Typography sx={{ fontWeight: 600, color, textDecoration: isAdded ? "none" : "line-through" }}>
                        {t("summary.line", { count: change.quantity, label: orderLineLabel(change.item) })}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}

/** What the save changed, shown for ten seconds before the popup closes itself. */
export function OrderEditSummary({ summary, onClose }: OrderEditSummaryProps): JSX.Element {
    const { t } = useTranslation("orderEdit");
    const [secondsLeft, setSecondsLeft] = useState(SUMMARY_SECONDS);
    // The board re-renders the card several times a second (its own countdown), handing down a new
    // onClose each time; keying the timer on it would restart the second forever.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (secondsLeft <= 0) {
            onCloseRef.current();
            return;
        }
        const timer = window.setTimeout(() => setSecondsLeft(s => s - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [secondsLeft]);

    return (
        <Box data-testid="order-edit-summary" sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2 }}>
                <ChangeSection kind="added" changes={summary.added} />
                <ChangeSection kind="removed" changes={summary.removed} />
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, pt: 1.5, borderTop: `1px solid ${EDIT_COLORS.hairline}` }}>
                    <Typography sx={{ color: "text.secondary" }}>{t("summary.total")}</Typography>
                    <Typography data-testid="summary-total" sx={{ fontWeight: 700, color: EDIT_COLORS.text }}>
                        {t("summary.totalChange", { was: formatBd(summary.originalTotal), now: formatBd(summary.editedTotal) })}
                    </Typography>
                </Box>
            </Box>
            <Box sx={{ p: 2, borderTop: `1px solid ${EDIT_COLORS.hairline}` }}>
                <LinearProgress
                    variant="determinate"
                    value={(secondsLeft / SUMMARY_SECONDS) * 100}
                    aria-hidden
                    sx={{ mb: 1.5, height: 6, borderRadius: 3 }}
                />
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Typography role="timer" aria-live="off" sx={{ flex: 1, color: "text.secondary" }}>
                        {t("summary.closesIn", { count: secondsLeft })}
                    </Typography>
                    <Button
                        variant="contained"
                        disableElevation
                        onClick={onClose}
                        sx={{
                            bgcolor: BRAND_RED,
                            borderRadius: 999,
                            textTransform: "none",
                            fontWeight: 700,
                            minHeight: 44,
                            px: 3,
                            "&:hover": { bgcolor: BRAND_RED, filter: "brightness(0.94)" },
                        }}
                    >
                        {t("summary.closeNow")}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}
