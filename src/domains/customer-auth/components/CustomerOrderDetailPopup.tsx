// Detail-order bottom Drawer opened by tapping an order card in CustomerProfilePopup.
// Follows the same brand-red Drawer/loading/error conventions as CustomerProfilePopup.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Box, Chip, CircularProgress, Divider, Drawer, IconButton, Stack, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { fetchOrderDetail } from "../../../shared/api/customerAuth";
import { useCustomerAuth } from "../context/CustomerAuthProvider";
import { useOrderLiveStatus } from "../hooks/useOrderLiveStatus";
import { imageMap } from "../../../shared/utils/imageMap";
import { CustomerAuthApiError } from "../types";
import type { CustomerOrderDetail, CustomerOrderDetailComboItem } from "../types";
import { statusStyle } from "./CustomerProfilePopup";

const brandRed = "#E44B4C";
const brandRedTint = "#FCE9E9";
const brandGreen = "#1E7B41";

type Props = {
    open: boolean;
    onClose: () => void;
    orderId: number | null;
};

const STATUS_LABEL_KEYS: Record<string, string> = {
    "initial-creation": "orderDetail.status.orderPlaced",
    "Kitchen Phase": "orderDetail.status.inProgress",
    "Oven": "orderDetail.status.inOven",
    "Ready": "orderDetail.status.readyForPickup",
    "Picked Up": "orderDetail.status.pickedUp",
};

function getStatusLabel(status: string, t: TFunction): string {
    const key = STATUS_LABEL_KEYS[status];
    return key ? t(key) : status;
}

function formatDateLabel(dateTime: string): string {
    const datePart = dateTime.split(" ")[0];
    return datePart ?? dateTime;
}

// Adapted from OrderCard.renderComboDescription: bold name+size per combo item, followed by
// red "+ extra" lines derived from that combo item's description (no isThinDough/isGarlicCrust
// fields on this DTO, so only description-derived extras apply here).
function renderComboItems(comboItems: CustomerOrderDetailComboItem[]): React.JSX.Element[] {
    return comboItems.map((comboItem, index) => {
        const extras = comboItem.description
            .replace(/[()]/g, "")
            .split("+")
            .map((segment) => segment.trim())
            .filter(Boolean);

        return (
            <Box key={comboItem.name + "-" + index} sx={{ mt: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                    {comboItem.name}
                    {comboItem.size ? " (" + comboItem.size + ")" : ""}
                </Typography>
                {extras.length > 0 && (
                    <Typography sx={{ color: brandRed, fontSize: 12.5 }}>
                        {extras.map((extra, extraIndex) => (
                            <span key={extraIndex}>+ {extra} </span>
                        ))}
                    </Typography>
                )}
            </Box>
        );
    });
}

function formatTime12Hour(dateTime: string): string {
    const timePart = dateTime.split(" ")[1] ?? dateTime;
    const [hoursRaw, minutesRaw] = timePart.split(":");
    const hours = Number(hoursRaw);
    if (!minutesRaw || Number.isNaN(hours)) return timePart;
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return hour12 + ":" + minutesRaw + " " + period;
}

export function CustomerOrderDetailPopup({ open, onClose, orderId }: Props): React.JSX.Element {
    const { t } = useTranslation(["customerAuth", "common"]);
    const { token, logout } = useCustomerAuth();
    const [detail, setDetail] = useState<CustomerOrderDetail | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSessionExpired = useCallback(async (): Promise<void> => {
        await logout();
        setError(t("errors.sessionExpired"));
    }, [logout, t]);

    const loadDetail = useCallback(async (id: number): Promise<void> => {
        if (!token) return;
        setIsLoading(true);
        try {
            const result = await fetchOrderDetail(token, id);
            setDetail(result);
        } catch (err) {
            if (err instanceof CustomerAuthApiError && err.status === 401) {
                await handleSessionExpired();
            } else {
                setError(t("errors.orderDetailLoadFailed"));
            }
        } finally {
            setIsLoading(false);
        }
    }, [token, handleSessionExpired, t]);

    const loadDetailRef = useRef(loadDetail);
    loadDetailRef.current = loadDetail;

    useEffect(() => {
        if (!open || orderId === null) return;
        setDetail(null);
        setError(null);
        void loadDetailRef.current(orderId);
    }, [open, orderId]);

    // Live tracking (task-spec.md §4.14/§6.6-7): subscribes to this order's branch topic
    // while the popup is open with a loaded detail, and on any forward status transition
    // refetches the full detail via REST so the status chip + statusHistory timeline reflect
    // the live state — no client-side timestamp synthesis for the new timeline entry.
    const { resyncTick } = useOrderLiveStatus(detail?.branchId ?? null, orderId);

    useEffect(() => {
        if (resyncTick > 0 && orderId !== null) {
            void loadDetailRef.current(orderId);
        }
    }, [resyncTick, orderId]);

    const chip = detail ? statusStyle(detail.status) : null;
    const hasNotes = Boolean(detail?.notes && detail.notes.trim().length > 0);

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    height: "100dvh",
                    "@supports not (height: 100dvh)": { height: "100vh" },
                    width: "100%",
                    maxWidth: { sm: 480 },
                    mx: { sm: "auto" },
                    borderTopLeftRadius: { xs: 20, sm: 28 },
                    borderTopRightRadius: { xs: 20, sm: 28 },
                    overflow: "hidden",
                    background: "linear-gradient(170deg, #FFFBFA 0%, #FFF2F1 45%, #FBE3E3 100%)",
                },
            }}
        >
            <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 56, px: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em" }}>
                        {t("orderDetail.title")}
                    </Typography>
                    <IconButton aria-label={t("profile.close")} onClick={onClose} sx={{ position: "absolute", right: 4, color: "#333" }}>
                        <CloseRoundedIcon sx={{ fontSize: 22 }} />
                    </IconButton>
                </Box>

                <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 3, sm: 4 }, pt: 1, pb: 4 }}>
                    {error && (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.75,
                                bgcolor: brandRedTint,
                                borderRadius: 2.5,
                                px: 1.5,
                                py: 1,
                                mb: 2,
                            }}
                        >
                            <ErrorOutlineRoundedIcon sx={{ fontSize: 18, color: brandRed }} />
                            <Typography sx={{ color: brandRed, fontSize: 13.5, fontWeight: 500 }}>
                                {error}
                            </Typography>
                        </Box>
                    )}

                    {isLoading && !detail ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                            <CircularProgress size={28} sx={{ color: brandRed }} />
                        </Box>
                    ) : (
                        detail && (
                            <>

                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                                    <Typography sx={{ color: brandRed, fontWeight: 800, fontSize: 16 }}>
                                        {t("orderDetail.orderIdLabel", { number: detail.orderNumber })}
                                    </Typography>
                                    {chip && (
                                        <Chip
                                            label={detail.status}
                                            size="small"
                                            sx={{
                                                bgcolor: chip.bg,
                                                color: chip.color,
                                                fontWeight: 700,
                                                fontSize: 12,
                                                height: 24,
                                                borderRadius: 999,
                                            }}
                                        />
                                    )}
                                </Stack>
                                <Typography sx={{ color: "#8a8a8a", fontSize: 13, mb: 2.5 }}>
                                    {formatDateLabel(detail.createdAt)} - {formatTime12Hour(detail.createdAt)}
                                </Typography>

                                <Stack spacing={0} sx={{ mb: 2.5 }}>
                                    {detail.items.map((item, index) => (
                                        <Stack
                                            key={item.name + "-" + index}
                                            direction="row"
                                            alignItems="center"
                                            spacing={1.5}
                                            sx={{ py: 1.25, borderBottom: index < detail.items.length - 1 ? "1px solid #f2f2f2" : "none" }}
                                        >
                                            <Box
                                                component="img"
                                                src={imageMap[item.name]}
                                                alt={item.name}
                                                sx={{ width: 48, height: 48, borderRadius: 2, objectFit: "cover", bgcolor: "#f2f2f2", flexShrink: 0 }}
                                            />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography noWrap sx={{ fontWeight: 700, fontSize: 14 }}>
                                                    {item.name}
                                                </Typography>
                                                <Typography sx={{ color: brandRed, fontWeight: 700, fontSize: 14 }}>
                                                    {item.unitAmount.toFixed(2)} {t("currency", { ns: "common" })}
                                                </Typography>
                                                {item.comboItems.length > 0 && renderComboItems(item.comboItems)}
                                            </Box>
                                            <Typography sx={{ color: "#8a8a8a", fontSize: 12.5, whiteSpace: "nowrap" }}>
                                                {t("orderDetail.qty", { count: item.quantity })}
                                            </Typography>
                                        </Stack>
                                    ))}
                                </Stack>

                                <Box sx={{ bgcolor: "#F4F4F4", borderRadius: 3, p: 2, mb: hasNotes ? 2 : 2.5 }}>
                                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                                        <Typography sx={{ color: "#6b6b6b", fontSize: 13.5 }}>
                                            {t("orderDetail.amount")}
                                        </Typography>
                                        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>
                                            {detail.amount.toFixed(2)} {t("currency", { ns: "common" })}
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
                                        <Typography sx={{ color: "#6b6b6b", fontSize: 13.5 }}>
                                            {t("orderDetail.discount")}
                                        </Typography>
                                        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>
                                            -{detail.discount.toFixed(2)} {t("currency", { ns: "common" })}
                                        </Typography>
                                    </Stack>
                                    <Divider sx={{ borderColor: "#e5e5e5", mb: 1.5 }} />
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography sx={{ color: "#6b6b6b", fontSize: 13.5 }}>
                                            {t("orderDetail.paymentMethod")}: {detail.paymentType}
                                        </Typography>
                                        <Chip
                                            label={detail.isPaid ? t("orderDetail.paid") : t("orderDetail.unpaid")}
                                            size="small"
                                            sx={{ bgcolor: detail.isPaid ? "#E7F6EC" : "#FCE9E9", color: detail.isPaid ? brandGreen : "#E44B4C", fontWeight: 700, fontSize: 12, height: 24, borderRadius: 999 }}
                                        />
                                    </Stack>
                                </Box>

                                {hasNotes && (
                                    <Box sx={{ bgcolor: "#F4F4F4", borderRadius: 3, p: 2, mb: 2.5 }}>
                                        <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.75 }}>
                                            {t("orderDetail.notes")}
                                        </Typography>
                                        <Typography sx={{ fontSize: 14 }}>{detail.notes}</Typography>
                                    </Box>
                                )}

                                <Typography sx={{ mb: 1.5, fontWeight: 700, fontSize: 13, color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    {t("orderDetail.timeline")}
                                </Typography>
                                <Stack spacing={0}>
                                    {detail.statusHistory.map((entry, index) => (
                                        <Stack key={entry.status + "-" + index} direction="row" alignItems="flex-start" spacing={1.5}>
                                            <Stack alignItems="center" sx={{ width: 22 }}>
                                                <CheckCircleRoundedIcon sx={{ fontSize: 22, color: brandGreen }} />
                                                {index < detail.statusHistory.length - 1 && (
                                                    <Box sx={{ width: 2, flex: 1, minHeight: 22, bgcolor: brandGreen, my: 0.25 }} />
                                                )}
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flex: 1, pb: 2.25 }}>
                                                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                                                    {getStatusLabel(entry.status, t)}
                                                </Typography>
                                                <Typography sx={{ color: "#8a8a8a", fontSize: 13 }}>
                                                    {formatTime12Hour(entry.changedAt)}
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    ))}
                                </Stack>
                            </>
                        )
                    )}
                </Box>
            </Box>
        </Drawer>
    );
}

export default CustomerOrderDetailPopup;
