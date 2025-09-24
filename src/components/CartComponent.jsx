import React, {useEffect, useState} from "react";
import {Modal, Box, Typography, IconButton, Button} from "@mui/material";
import CartItemHorizontal from "./CartItemHorizontal";
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';

const brandRed = "#E44B4C";


function CartPopup({
                       open,
                       onClose,
                       items = [],
                       onChangeQuantity,
                       onChangeSize,
                       onRemoveItem,
                       onCheckout,
                       openPizzaEditPopUp,
                       isAdmin,
                       handleDiscountChange
                   }) {
    const totalPrice = items.reduce((acc, i) => {
        const discount = i.discount || 0;
        const discountedPrice = i.amount * (1 - discount / 100);
        return acc + discountedPrice * i.quantity;
    }, 0).toFixed(2);
    const [tel, setTel] = useState(null);
    const PIXEL_ID = '1717861405707714';

    useEffect(() => {
        if (!window.fbq) {
            (function (f, b, e, v, n, t, s) {
                if (f.fbq) return;
                n = f.fbq = function () {
                    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
                };
                if (!f._fbq) f._fbq = n;
                n.push = n;
                n.loaded = !0;
                n.version = '2.0';
                n.queue = [];
                t = b.createElement(e);
                t.async = !0;
                t.src = v;
                s = b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t, s);
            })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        }

        window.fbq('init', PIXEL_ID);
        window.fbq('track', 'CartPage');

    }, []);
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
                            onChangeSize={onChangeSize}
                            onRemoveItem={onRemoveItem}
                            openPizzaEditPopUp={openPizzaEditPopUp}
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
                        onClick={() => {
                            onCheckout?.(items, tel, null, null, null)
                        }
                    }
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
                        Checkout (Take Out Only)
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}

export default CartPopup;