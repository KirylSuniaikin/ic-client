// Copy comes from the customerAuth i18n namespace; styled to match
// CustomerLoginPopup/ClientInfoPopup (brand-red bottom Drawer).
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, Box, Button, Chip, CircularProgress, Divider, Drawer, IconButton, Stack, Typography } from "@mui/material";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import { fetchCustomerMe, fetchMyOrders } from "../../../shared/api/customerAuth";
import { useCustomerAuth } from "../context/CustomerAuthProvider";
import { useCustomerAuthUi } from "../context/CustomerAuthUiProvider";
import { CustomerAuthApiError } from "../types";
import type { CustomerMeResponse, CustomerOrderSummary } from "../types";
import { CustomerOrderDetailPopup } from "./CustomerOrderDetailPopup";

const brandRed = "#E44B4C";
const brandRedTint = "#FCE9E9";
const PAGE_SIZE = 3;

type Props = {
    open: boolean;
    onClose: () => void;
};

// Presentational only — tints the status pill by kitchen outcome so a card
// reads at a glance. No effect on the raw status string shown/tested.
// Exported so CustomerOrderDetailPopup can reuse the same tinting logic
// on the same raw `status` string (task-spec.md §3/§4.18).
export function statusStyle(status: string): { bg: string; color: string } {
    const s = status.toLowerCase();
    if (s.includes("cancel") || s.includes("reject")) {
        return { bg: brandRedTint, color: brandRed };
    }
    if (s.includes("pick") || s.includes("ready") || s.includes("complet") || s.includes("done")) {
        return { bg: "#E7F6EC", color: "#1E7B41" };
    }
    return { bg: "#F1F1F3", color: "#5A5A5A" };
}

export function CustomerProfilePopup({ open, onClose }: Props): React.JSX.Element {
    const { t } = useTranslation(["customerAuth", "common"]);
    const { token, logout } = useCustomerAuth();
    const { selectedOrderId, openOrderDetail, closeOrderDetail } = useCustomerAuthUi();
    const [profile, setProfile] = useState<CustomerMeResponse | null>(null);
    const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
    const [page, setPage] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Shared by both fetches: a 401 here means the in-memory token expired
    // between opening the popup and this request — clear it and surface a
    // session-expired message instead of a raw error/crash.
    const handleSessionExpired = useCallback(async (): Promise<void> => {
        await logout();
        setError(t("errors.sessionExpired"));
    }, [logout, t]);

    const loadProfile = useCallback(async (): Promise<void> => {
        if (!token) return;
        try {
            const me = await fetchCustomerMe(token);
            setProfile(me);
        } catch (err) {
            if (err instanceof CustomerAuthApiError && err.status === 401) {
                await handleSessionExpired();
            } else {
                setError(t("errors.profileLoadFailed"));
            }
        }
    }, [token, handleSessionExpired, t]);

    const loadOrders = useCallback(async (targetPage: number): Promise<void> => {
        if (!token) return;
        setIsLoading(true);
        try {
            const ordersPage = await fetchMyOrders(token, targetPage, PAGE_SIZE);
            setOrders(ordersPage.orders);
            setHasNext(ordersPage.hasNext);
            setPage(targetPage);
        } catch (err) {
            if (err instanceof CustomerAuthApiError && err.status === 401) {
                await handleSessionExpired();
            } else {
                setError(t("errors.ordersLoadFailed"));
            }
        } finally {
            setIsLoading(false);
        }
    }, [token, handleSessionExpired, t]);

    // loadProfile/loadOrders identity changes whenever `token` changes (e.g.
    // cleared to null by handleSessionExpired's logout()) — routed through
    // refs so the open-reset effect below fires only on an actual open
    // transition, never as a side effect of the in-flight request that
    // triggered it clearing the token.
    const loadProfileRef = useRef(loadProfile);
    loadProfileRef.current = loadProfile;
    const loadOrdersRef = useRef(loadOrders);
    loadOrdersRef.current = loadOrders;

    // Reset to page 0 and refetch both on every (re)open — task-spec-rebuild.md §6.6.
    useEffect(() => {
        if (!open) return;
        setProfile(null);
        setOrders([]);
        setPage(0);
        setHasNext(false);
        setError(null);
        void loadProfileRef.current();
        void loadOrdersRef.current(0);
    }, [open]);

    function handlePrev(): void {
        if (page > 0 && !isLoading) {
            void loadOrders(page - 1);
        }
    }

    function handleNext(): void {
        if (hasNext && !isLoading) {
            void loadOrders(page + 1);
        }
    }

    async function handleLogout(): Promise<void> {
        await logout();
        onClose();
    }

    const initial = (profile?.name ?? "").trim().charAt(0).toUpperCase();

    return (
        <>
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
                {/* Full-screen header bar with an explicit way out (wired to onClose). */}
                <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 56, px: 1 }}>
                    <IconButton aria-label={t("profile.close")} onClick={onClose} sx={{ position: "absolute", left: 4, color: "#333" }}>
                        <ArrowBackIosNewRoundedIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                    <Typography sx={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em" }}>
                        {t("profile.title")}
                    </Typography>
                </Box>

                <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 3, sm: 4 }, pt: 2 }}>
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

                    {isLoading && !profile ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                            <CircularProgress size={28} sx={{ color: brandRed }} />
                        </Box>
                    ) : (
                        profile && (
                            <Stack
                                direction="row"
                                spacing={1.75}
                                alignItems="center"
                                sx={{ mb: 3, bgcolor: "#fff", borderRadius: 4, p: 2, boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}
                            >
                                <Avatar sx={{ bgcolor: brandRed, width: 56, height: 56, fontWeight: 700, fontSize: 24 }}>
                                    {initial}
                                </Avatar>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }} noWrap>
                                        {profile.name ?? t("profile.guest")}
                                    </Typography>
                                    <Typography sx={{ color: "#6b6b6b", fontSize: 14, mt: 0.25 }} noWrap>
                                        {profile.phone}
                                    </Typography>
                                    {typeof profile.amountOfOrders === "number" && profile.amountOfOrders > 0 && (
                                        <Typography sx={{ color: brandRed, fontSize: 12.5, fontWeight: 600, mt: 0.5 }}>
                                            {profile.amountOfOrders} {t(profile.amountOfOrders === 1 ? "profile.orderSingular" : "profile.orderPlural")}
                                        </Typography>
                                    )}
                                </Box>
                            </Stack>
                        )
                    )}

                    <Typography sx={{ mb: 1.25, fontWeight: 700, fontSize: 13, color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {t("profile.orderHistory")}
                    </Typography>

                    <Stack spacing={1.25} sx={{ mb: 2 }}>
                        {!isLoading && orders.length === 0 && (
                            <Box sx={{ textAlign: "center", py: 3, color: "#9a9a9a" }}>
                                <ReceiptLongRoundedIcon sx={{ fontSize: 36, mb: 1, opacity: 0.6 }} />
                                <Typography sx={{ fontSize: 14 }}>
                                    {t("profile.noOrders")}
                                </Typography>
                            </Box>
                        )}
                        {orders.map((order) => {
                            const chip = statusStyle(order.status);
                            return (
                                <Box
                                    key={order.id}
                                    onClick={() => openOrderDetail(order.id)}
                                    sx={{
                                        bgcolor: "#fff",
                                        borderRadius: 3.5,
                                        p: 1.75,
                                        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                                        transition: "box-shadow 0.15s ease",
                                        cursor: "pointer",
                                        "&:hover": { boxShadow: "0 4px 18px rgba(0,0,0,0.08)" },
                                    }}
                                >
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                        <Box>
                                            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
                                                {t("profile.orderNumber", { number: order.orderNumber })}
                                            </Typography>
                                            <Typography sx={{ color: "#9a9a9a", fontSize: 12.5, mt: 0.25 }}>
                                                {order.orderType}
                                            </Typography>
                                        </Box>
                                        <Typography sx={{ fontWeight: 800, fontSize: 15 }}>
                                            {order.amountPaid.toFixed(2)} {t("currency", { ns: "common" })}
                                        </Typography>
                                    </Stack>
                                    <Divider sx={{ my: 1.25, borderColor: "#f2f2f2" }} />
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography sx={{ color: "#8a8a8a", fontSize: 13 }}>
                                            {order.createdAt}
                                        </Typography>
                                        <Chip
                                            label={order.status}
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
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Stack>

                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Button
                            onClick={handlePrev}
                            disabled={page === 0 || isLoading}
                            startIcon={<ChevronLeftRoundedIcon />}
                            sx={{ textTransform: "none", color: brandRed, fontWeight: 600, "&.Mui-disabled": { color: "#c9c9c9" } }}
                        >
                            {t("profile.prev")}
                        </Button>
                        <Typography sx={{ color: "#9a9a9a", fontSize: 13, fontWeight: 600 }}>
                            {t("profile.page", { page: page + 1 })}
                        </Typography>
                        <Button
                            onClick={handleNext}
                            disabled={!hasNext || isLoading}
                            endIcon={<ChevronRightRoundedIcon />}
                            sx={{ textTransform: "none", color: brandRed, fontWeight: 600, "&.Mui-disabled": { color: "#c9c9c9" } }}
                        >
                            {t("profile.next")}
                        </Button>
                    </Stack>
                </Box>

                <Box sx={{ px: { xs: 3, sm: 4 }, pt: 2, pb: { xs: 4, sm: 5 } }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => void handleLogout()}
                        startIcon={<LogoutRoundedIcon />}
                        sx={{
                            py: 1.5,
                            borderColor: brandRed,
                            color: brandRed,
                            bgcolor: "rgba(255,255,255,0.6)",
                            textTransform: "none",
                            fontSize: "1.05rem",
                            fontWeight: 700,
                            borderRadius: 999,
                            "&:hover": { borderColor: "#d23f40", bgcolor: brandRedTint },
                        }}
                    >
                        {t("profile.logout")}
                    </Button>
                </Box>
            </Box>
        </Drawer>
        {/* Rendered as a sibling Drawer so the profile popup's own Drawer stays
            mounted/open underneath — closing the detail popup only clears
            selectedOrderId, it never touches `open`/`onClose` above. */}
        <CustomerOrderDetailPopup
            open={selectedOrderId !== null}
            onClose={closeOrderDetail}
            orderId={selectedOrderId}
        />
        </>
    );
}

export default CustomerProfilePopup;
