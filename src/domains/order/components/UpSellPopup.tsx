import {
    Modal,
    Box,
    Typography,
    Button,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import type { CartItem } from '../../menu/types';

const brandRed = "#E44B4C";

interface UpsellPopupProps {
    open: boolean;
    onClose: () => void;
    upsellItem: CartItem | null;
    upsellType: string;
    onAccept?: (item: CartItem, type: string) => void;
    onDecline?: () => void;
    photo?: string;
    comboPrice: string | number;
}

export function UpsellPopup({
                                        open,
                                        onClose,
                                        upsellItem,
                                        upsellType,
                                        onAccept,
                                        onDecline,
                                        photo,
                                        comboPrice
                                    }: UpsellPopupProps): JSX.Element | null {
    const { t } = useTranslation("checkout");
    if (!upsellItem) return null;

    return (
        <Modal open={open} onClose={onClose} sx={{
            backdropFilter: "blur(6px)",
        }}>
            <Box
                sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    width: "100%",
                    bgcolor: "#fff",
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    boxShadow: "0 -4px 12px rgba(0,0,0,0.15)",
                    p: 3,
                    textAlign: "center",
                }}
            >
                {/* Photo */}
                {photo && (
                    <Box
                        component="img"
                        src={photo}
                        alt={upsellItem.name}
                        sx={{
                            width: "100%",
                            height: "auto",
                            maxWidth: { xs: 320, sm: 800, md: 900, lg: 1000 },
                            maxHeight: { xs: 320, sm: 600, md: 400, lg: 480 },
                            objectFit: "contain",
                            display: "block",
                            mx: "auto",
                            mb: 2,
                        }}
                    />
                )}

                <Typography variant="h6" color="bold" sx={{ mb: 3 }}>
                    {t("upsell.offer", {
                        product: upsellType === "pizza" ? t("upsell.productPizza") : t("upsell.productDetroitBrick"),
                        price: comboPrice,
                    })}
                </Typography>

                {/* Buttons */}
                <Box sx={{ display: "flex", gap: 2 }}>
                    <Button
                        variant="outlined"
                        onClick={() => {
                            onDecline?.();
                            onClose?.();
                        }}
                        sx={{
                            flex: 1,
                            borderRadius: 8,
                            borderColor: "#ccc",
                            color: "#666",
                            textTransform: "none",
                            fontSize: 16,
                        }}
                    >
                        {t("upsell.decline")}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            onAccept?.(upsellItem, upsellType);
                            onClose?.();
                        }}
                        sx={{
                            flex: 1,
                            borderRadius: 8,
                            backgroundColor: brandRed,
                            color: "#fff",
                            textTransform: "none",
                            fontSize: 16,
                            "&:hover": { backgroundColor: "#d23f40" },
                        }}
                    >
                        {t("upsell.accept")}
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}
