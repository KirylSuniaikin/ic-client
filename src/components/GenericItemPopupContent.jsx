import React, { useEffect, useState } from "react";
import {
    Modal,
    Box,
    Typography,
    Fab,
    Button
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

function GenericItemPopupContent({ open, onClose, item, onAddToCart }) {
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (open && item) {
            setQuantity(1);
        }
    }, [open, item]);

    if (!item) return null;

    const finalPricePerItem = item.price;

    function handleAdd() {
        const product = {
            ...item,
            name: item.name,
            size: item.size,
            category: item.category,
            quantity: quantity,
            pricePerItem: finalPricePerItem
        };
        onAddToCart?.(product);
        onClose?.();
    }

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: { xs: "90%", md: 400 },
                    maxHeight: "95vh",
                    bgcolor: "#fff",
                    borderRadius: 4,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column"
                }}
            >
                {/* Кнопка закрытия */}
                <Fab
                    size="small"
                    onClick={onClose}
                    sx={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        color: brandRed,
                        backgroundColor: "#fff",
                        zIndex: 9999
                    }}
                >
                    <CloseIcon />
                </Fab>

                <Box sx={{ flex: 1, overflowY: "auto" }}>
                    <Box sx={{ width: "100%", height: 400, overflow: "hidden" }}>
                        <img
                            src={item.photo}
                            alt={item.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    </Box>

                    <Box
                        sx={{
                            flex: 1,
                            overflowY: "auto",
                            px: { xs: 2, md: 3 },
                            pt: 2,
                            pb: 2
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
                            {item.name}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                mb: 2,
                                color: "#444",
                                lineHeight: 1.4,
                                fontSize: "14px"
                            }}
                        >
                            {item.description}
                        </Typography>

                        {/* Счётчик */}
                        <Box
                            sx={{
                                backgroundColor: brandGray,
                                borderRadius: "9999px",
                                p: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "4px",
                                height: 34,
                                mb: 2,
                                maxWidth: "130px",
                                mx: "auto"
                            }}
                        >
                            <Button
                                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                sx={{
                                    minWidth: 40,
                                    height: 26,
                                    backgroundColor: "transparent",
                                    color: "#666",
                                    fontSize: "16px",
                                    textTransform: "none",
                                    borderRadius: "9999px",
                                    p: 0,
                                    "&:hover": {
                                        backgroundColor: "rgba(0,0,0,0.1)"
                                    }
                                }}
                            >
                                –
                            </Button>
                            <Box
                                sx={{
                                    minWidth: 30,
                                    textAlign: "center",
                                    fontSize: "15px",
                                    color: "#666"
                                }}
                            >
                                {quantity}
                            </Box>
                            <Button
                                onClick={() => setQuantity((q) => q + 1)}
                                sx={{
                                    minWidth: 40,
                                    height: 26,
                                    backgroundColor: "transparent",
                                    color: "#666",
                                    fontSize: "16px",
                                    textTransform: "none",
                                    borderRadius: "9999px",
                                    p: 0,
                                    "&:hover": {
                                        backgroundColor: "rgba(0,0,0,0.1)"
                                    }
                                }}
                            >
                                +
                            </Button>
                        </Box>
                    </Box>
                </Box>
                {/* Нижняя панель: кнопка "Add to cart" */}
                <Box
                    sx={{
                        borderTop: "1px solid #eee",
                        p: 2
                    }}
                >
                    <Button
                        variant="contained"
                        fullWidth
                        sx={{
                            backgroundColor: brandRed,
                            color: "#fff",
                            textTransform: "none",
                            fontSize: "16px",
                            borderRadius: 4,
                            "&:hover": {
                                backgroundColor: "#d23f40"
                            }
                        }}
                        onClick={handleAdd}
                    >
                        Add to cart · {(finalPricePerItem * quantity).toFixed(2)}
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}

export default GenericItemPopupContent;