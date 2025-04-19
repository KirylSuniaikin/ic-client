import React, {useState} from "react";
import {Modal, Box, Typography, IconButton, Button, TextField} from "@mui/material";
import CartItemHorizontal from "./CartItemHorizontal";
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';

const brandRed = "#E44B4C";
const brandColor2 = "#FCF4DD";


function CartPopup({
                           open,
                           onClose,
                           items = [],
                           onChangeQuantity,
                           onRemoveItem,
                           onCheckout,
                            isAdmin,
                       handleDiscountChange
                       }) {
    const totalPrice = items.reduce((acc, i) => {
        const discount = i.discount || 0;
        const discountedPrice = i.amount * (1 - discount / 100);
        return acc + discountedPrice * i.quantity;
    }, 0).toFixed(2);
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
                        position: "relative",
                        height: 56,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        px: 2,
                        backgroundColor: "#fafafa",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                    }}
                >
                    {/*  */}
                    <Box
                        sx={{
                            position: "absolute",
                            left: 8,
                            top: "50%",
                            transform: "translateY(-50%)",
                            display: "flex",
                            alignItems: "center"
                        }}
                    >
                        {/* Arrow button */}
                        <IconButton
                            onClick={onClose}
                            sx={{
                                color: brandRed,
                                ml: 1.3,
                                p: 0
                            }}
                        >
                            <ArrowBackIosNewIcon fontSize="medium" />
                        </IconButton>
                        {/* Vertical */}
                        <Box
                            sx={{
                                width: "1px",
                                height: "100%",
                                backgroundColor: "#ccc",
                                ml: 1
                            }}
                        />
                    </Box>

                    {/* Logo */}
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
                            isAdmin={isAdmin}
                            handleDiscountChange={handleDiscountChange}
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
                            width: 210,
                            "&:hover": {
                                backgroundColor: brandRed
                            }
                        }}
                    >
                        Checkout (Pick Up Only)
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}

export default CartPopup;