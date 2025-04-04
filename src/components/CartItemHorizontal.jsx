import React from "react";
import {
    Box,
    Typography,
    IconButton,
    Button,
    Divider,
    CardMedia
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const brandGray = "#f3f3f3";

/**
 * CartItemHorizontalDodo
 *
 * - Фото (80×80) слева
 * - Справа: название (с учётом item.size в скобках) и описание
 * - Крестик (X) в правом верхнем углу (absolute)
 * - Горизонтальная линия
 * - Нижняя часть: цена (за всё кол-во) + отступ; счётчик (–/число/+) справа
 *
 * Props:
 *  - item: { name, size?, description?, photo, quantity, price }
 *  - onChangeQuantity(item, newQty)
 *  - onRemoveItem(item)
 */
function CartItemHorizontal({
                                    item,
                                    onChangeQuantity,
                                    onRemoveItem
                                }) {
    let title = item.name;
    if (item.size) {
        title += ` (${item.size})`;
    }

    const itemTotal = (item.pricePerItem  * item.quantity).toFixed(2);
    return (
        <Box
            sx={{
                position: "relative",
                backgroundColor: "#fff",
                borderRadius: 6,
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                p: 2,
                mb: 2
            }}
        >
            <IconButton
                onClick={() => onRemoveItem?.(item)}
                sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    color: "#555",
                }}
            >
                <CloseIcon />
            </IconButton>

            <Box sx={{ display: "flex", alignItems: "flex-start" }}>
                <Box sx={{ width: 80, height: 80, flexShrink: 0, mr: 2 }}>
                    <CardMedia
                        component="img"
                        image={item.photo}
                        alt={title}
                        sx={{
                            width: 80,
                            height: 80,
                            objectFit: "cover",
                            borderRadius: 4
                        }}
                    />
                </Box>

                {/* Текст: заголовок + описание. Добавляем pr:40, чтобы не пересекалось с крестиком */}
                <Box sx={{ flex: 1, minWidth: 0, pr: "40px" }}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ color: "#000" }}>
                        {title}
                    </Typography>
                    {item.description && (
                        <Typography variant="body2" sx={{ color: "#555", mt: 0.5 }}>
                            {item.description}
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* Разделитель */}
            <Divider sx={{ my: 1.5 }} />

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    py: 0.1
                }}
            >
                {/* Цена с небольшим правым отступом */}
                <Typography
                    variant="body1"
                    fontWeight="bold"
                    sx={{
                        color: "#333",
                        mr: "auto",
                        ml: 2// пусть цена занимает левую часть, а счётчик уедет вправо
                    }}
                >
                    {itemTotal}
                </Typography>

                {/* Счётчик (– / число / +) */}
                <Box
                    sx={{
                        backgroundColor: brandGray,
                        borderRadius: "9999px",
                        display: "flex",
                        alignItems: "center",
                        p: "4px",
                        gap: "4px"
                    }}
                >
                    {/* Минус */}
                    <Button
                        onClick={() =>
                            item.quantity > 1 &&
                            onChangeQuantity?.(item, item.quantity - 1)
                        }
                        disabled={item.quantity <= 1}
                        sx={{
                            minWidth: 32,
                            height: 28,
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
                            minWidth: 20,
                            textAlign: "center",
                            fontSize: "15px",
                            color: "#666"
                        }}
                    >
                        {item.quantity}
                    </Box>

                    {/* Плюс */}
                    <Button
                        onClick={() => onChangeQuantity?.(item, item.quantity + 1)}
                        sx={{
                            minWidth: 32,
                            height: 28,
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
    );
}

export default CartItemHorizontal;