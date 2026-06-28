import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Fade } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface OrderConfirmedProps {
    open: boolean;
    duration?: number;
    onClose?: () => void;
}

function OrderConfirmed({ open, duration = 1000, onClose }: OrderConfirmedProps): JSX.Element {
    const { t } = useTranslation("checkout");
    const [visible, setVisible] = useState(open);

    useEffect(() => {
        if (open) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                onClose?.();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [open, duration, onClose]);

    return (
        <Fade in={visible}>
            <Box
                sx={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    backgroundColor: "#fff",
                    borderRadius: 4,
                    boxShadow: 3,
                    px: 4,
                    py: 3,
                    zIndex: 9999,
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    border: "2px solid #4CAF50"
                }}
            >
                <CheckCircleIcon sx={{ fontSize: 40, color: "#4CAF50" }} />
                <Typography variant="h6" sx={{ fontWeight: "bold", color: "#333" }}>
                    {t("orderConfirmed")}
                </Typography>
            </Box>
        </Fade>
    );
}

export default OrderConfirmed;
