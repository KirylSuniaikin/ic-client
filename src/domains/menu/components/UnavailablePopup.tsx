import { Box, Typography, IconButton, Modal } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import React from "react";
import { useTranslation } from "react-i18next";
import { useDesktopLayout } from "../../../shared/hooks/useDesktopLayout";
import { centredModalPaperSx, toArray } from "../../../shared/utils/desktopDialog";
import type { SxArrayEntry } from "../../../shared/utils/desktopDialog";

const UNAVAILABLE_DESKTOP_SX: ReadonlyArray<SxArrayEntry> = [
    ...toArray(centredModalPaperSx(440)),
    { alignItems: "center", p: 4, textAlign: "center" },
];

type Props = {
    unavailableItems: string[];
    open: boolean;
    onClose: () => void;
    message?: string;
    standalone?: boolean; // ← new prop
};

export function UnavailablePopup({ unavailableItems, open, onClose, message, standalone }: Props) {
    const { t } = useTranslation("menu");
    const isDesktop = useDesktopLayout();
    if (!open) return null;

    // The same children on every path, so the phone and in-cart markup does not move.
    const body = (
        <>
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
                {message ?? t("unavailable.defaultMessage")}
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
            <Typography sx={{ fontSize: 14, color: "#888", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                {t("unavailable.removedNotice")}
            </Typography>
        </>
    );

    if (standalone && isDesktop) {
        // PC: a centred card in a Modal, which brings the focus trap, Esc and backdrop close.
        return (
            <Modal open onClose={onClose}>
                <Box sx={UNAVAILABLE_DESKTOP_SX}>{body}</Box>
            </Modal>
        );
    }

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
            {body}
        </Box>
    );
}
