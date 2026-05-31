import { Box, Typography, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import React from "react";

type Props = {
    unavailableItems: string[];
    open: boolean;
    onClose: () => void;
    message?: string;
    standalone?: boolean; // ← new prop
};

export function UnavailablePopup({ unavailableItems, open, onClose, message, standalone }: Props) {
    if (!open) return null;

    return (
        <Box
            sx={{
                position: standalone ? "fixed" : "absolute",
                inset: 0,
                zIndex: standalone ? 1300 : 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.96)",
                backdropFilter: "blur(6px)",
                px: 3,
                textAlign: "center",
            }}
        >
            {/* Close button top-right */}
            <IconButton
                onClick={onClose}
                sx={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    color: "#888",
                }}
            >
                <CloseIcon />
            </IconButton>

            {/* Warning icon */}
            <Box
                sx={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    backgroundColor: "#FFF3F3",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 3,
                }}
            >
                <WarningAmberRoundedIcon sx={{ fontSize: 38, color: "#E44B4C" }} />
            </Box>

            {/* Main message */}
            <Typography
                sx={{
                    fontWeight: 800,
                    fontSize: 20,
                    color: "#1A1A1A",
                    lineHeight: 1.4,
                    mb: 2,
                }}
            >
                {message ?? "Some items are no longer available"}
            </Typography>

            {/* Unavailable item chips */}
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    justifyContent: "center",
                    mb: 3,
                }}
            >
                {unavailableItems.map((item) => (
                    <Box
                        key={item}
                        sx={{
                            px: 2,
                            py: 0.75,
                            borderRadius: 999,
                            backgroundColor: "#FFF3F3",
                            border: "1px solid #F5C2C2",
                        }}
                    >
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#E44B4C" }}>
                            {item}
                        </Typography>
                    </Box>
                ))}
            </Box>

            {/* Sub-text */}
            <Typography sx={{ fontSize: 14, color: "#888", lineHeight: 1.6 }}>
                These items have been removed from your cart.{"\n"}Feel free to continue with your remaining order.
            </Typography>
        </Box>
    );
}
