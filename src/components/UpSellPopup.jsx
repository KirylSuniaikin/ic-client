import {
    Modal,
    Box,
    Typography,
    Button,
} from "@mui/material";

const brandRed = "#E44B4C";

export function UpsellPopup({
                                        open,
                                        onClose,
                                        upsellItem,
                                        upsellType,
                                        onAccept,
                                        onDecline,
                                        photo,
                                        comboPrice
                                    }) {
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
                {/* Фото пиццы / брика */}
                {photo && (
                    <img
                        src={photo}
                        alt={upsellItem.name}
                        style={{
                            width: "100%",
                            maxWidth: 260,
                            height: 200,
                            objectFit: "contain",
                            margin: "0 auto 16px",
                            borderRadius: 12,
                        }}
                    />
                )}

                <Typography variant="h6" color="bold" sx={{ mb: 3 }}>
                    {upsellType === "pizza" ? "Pizza " : "Detroit Brick"} + Sauce + Drink just for {comboPrice}
                </Typography>

                {/* Кнопки */}
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
                        Next time
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
                        Yes, show me!
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}
