import React, {useState} from "react";
import {Modal, Box, Typography, IconButton, Button, TextField} from "@mui/material";
import CartItemHorizontal from "./CartItemHorizontal";
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import {createOrder} from "../api/api";

const brandRed = "#E44B4C";
const brandColor2 = "#FCF4DD";

/**
 * CartPopupDodo
 *
 * Полноэкранное окно с верхней шапкой (логотип + заголовок + закрытие),
 * списком товаров и нижней панелью (цена слева, кнопка "К оформлению" справа).
 *
 * Props:
 *  - open (boolean)
 *  - onClose() => void
 *  - items (array): [{ name, size, description, photo, quantity, price }, ...]
 *  - onChangeQuantity(item, newQty)
 *  - onRemoveItem(item)
 *  - onCheckout(items)
 */
function CartPopup({
                           open,
                           onClose,
                           items = [],
                           onChangeQuantity,
                           onRemoveItem,
                           onCheckout
                       }) {
    const totalPrice = items.reduce((acc, i) => acc + i.pricePerItem * i.quantity, 0).toFixed(2);
    const [tel, setTel] = useState(null);
    const [phoneError, setPhoneError] = useState(false);


    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#FAFAFA"
                }}
            >
                <Box
                    sx={{
                        position: "relative",       // чтобы стрелку можно было позиционировать absolute
                        height: 56,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",   // чтобы логотип был по центру всей полосы
                        px: 2,
                        backgroundColor: "#fafafa",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                    }}
                >
                    {/* Блок со стрелкой и вертикальной чертой, "приклеенный" слева */}
                    <Box
                        sx={{
                            position: "absolute",
                            left: 8,                     // небольшой отступ слева
                            top: "50%",                  // по центру высоты
                            transform: "translateY(-50%)",
                            display: "flex",
                            alignItems: "center"
                        }}
                    >
                        {/* Кнопка-стрелка */}
                        <IconButton
                            onClick={onClose}
                            sx={{
                                color: brandRed,
                                ml: 1.3,
                                p: 0 // убираем лишние внутренние отступы, чтобы иконка была аккуратнее
                            }}
                        >
                            <ArrowBackIosNewIcon fontSize="medium" />
                        </IconButton>
                        {/* Вертикальная полоса-разделитель */}
                        <Box
                            sx={{
                                width: "1px",
                                height: "100%",
                                backgroundColor: "#ccc",
                                ml: 1
                            }}
                        />
                    </Box>

                    {/* Логотип в самом центре всей шапки */}
                    <Box>
                        <Typography variant="h5" >
                            Cart
                        </Typography>
                    </Box>
                </Box>

                <Box
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        p: 2
                    }}
                >
                    {items.map((item, idx) => (
                        <CartItemHorizontal
                            key={idx}
                            item={item}
                            onChangeQuantity={onChangeQuantity}
                            onRemoveItem={onRemoveItem}
                        />
                    ))}
                </Box>

                <Box
                    sx={{
                        flexShrink: 0,
                        height: 56,
                        borderTop: "1px solid #eee",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        px: 2
                    }}
                >
                    <Typography variant="h6" fontWeight="bold" sx={{ color: "#000", ml: 1.5 }}>
                        {totalPrice}
                    </Typography>

                    <Button
                        variant="contained"
                        onClick={() => onCheckout?.(items, tel, totalPrice)}
                        sx={{
                            backgroundColor: brandRed,
                            color: "#fff",
                            textTransform: "none",
                            fontWeight: "bold",
                            borderRadius: 4,
                            width: 180,
                            "&:hover": {
                                backgroundColor: brandRed
                            }
                        }}
                    >
                        Checkout
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}

export default CartPopup;