import {Box, Button, Modal, Typography} from "@mui/material";
import Lottie from "lottie-react";
import {useEffect, useState} from "react";
import sadMan from "../loadingAnimations/сrying-emoji-onclose.json";
import {getTimeUntilNextOpening} from "./getTimeUntilNextOpening";


export default function ClosedPopup({ open, onClose }) {
    const [timeLeft, setTimeLeft] = useState("");
    const [nextOpeningMessage, setNextOpeningMessage] = useState("");

    useEffect(() => {
        if (!open) return;
        const { hours, minutes, nextOpeningMessage } = getTimeUntilNextOpening();
        setTimeLeft(hours === 0 && minutes === 0 ? "less than a minute" : `${hours}h ${minutes}m`);
        setNextOpeningMessage(nextOpeningMessage);
    }, [open]);

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(180deg, #fff 0%, #FBFAF6 100%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 3,
                    textAlign: "center",
                }}
            >
                <Box sx={{ width: 260 }}>
                    <Lottie animationData={sadMan} loop={false} autoplay/>
                </Box>

                <Typography variant="h6" sx={{ mt: -2, fontWeight: "bold", color: "#E44B4C" }}>
                    Unfortunately we are closed right now
                </Typography>

                {!nextOpeningMessage && (
                <Typography sx={{ mt: 1.5, fontSize: 16 }}>
                    But you can enjoy our pizza in:
                </Typography>
                )}

                {!nextOpeningMessage && (
                    <Typography sx={{ mt: 0.5, fontSize: 20, fontWeight: "bold" }}>
                        {timeLeft}
                    </Typography>
                )}

                {nextOpeningMessage && (
                    <Typography sx={{ mt: 1.5, fontSize: 16 }}>
                        {nextOpeningMessage}
                    </Typography>
                )}

                <Typography sx={{ mt: 3, fontSize: 14, color: "#888", fontWeight: 500 }}>
                    Working hours:
                </Typography>

                <Box sx={{ mt: 1, fontSize: 14, lineHeight: 1.6 }}>
                    <Typography>Tue, Wed, Sun — 11:30–00:00</Typography>
                    <Typography>Thu — 11:30–01:30</Typography>
                    <Typography>Fri, Sat — 13:30–01:30</Typography>
                    <Typography>Mon — Closed</Typography>
                </Box>

                <Button
                    variant="outlined"
                    onClick={onClose}
                    sx={{
                        mt: 3,
                        borderColor: "#E44B4C",
                        color: "#E44B4C",
                        borderRadius: 16,
                        fontWeight: "bold",
                        "&:hover": {
                            borderColor: "#d13b3c",
                            backgroundColor: "#fff5f5",
                        }
                    }}
                >
                    See you soon!
                </Button>
            </Box>
        </Modal>
    );
}