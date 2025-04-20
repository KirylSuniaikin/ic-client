import React, { useEffect, useState } from "react";
import { Box, Typography, Fade } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

function OrderConfirmed({ open, duration = 1000, onClose }) {
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
                    Order Confirmed!
                </Typography>
            </Box>
        </Fade>
    );
}

export default OrderConfirmed;

