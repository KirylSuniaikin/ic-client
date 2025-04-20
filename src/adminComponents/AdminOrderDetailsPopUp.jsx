import React, {useState} from "react";
import {Box, Button, FormControl, InputLabel, MenuItem, Modal, Select, TextField, Typography} from "@mui/material";
import {useNavigate} from "react-router-dom";

const countries = [
    { name: "Bahrain", code: "973", digits: 8 },
    { name: "Saudi Arabia", code: "966", digits: 9 }
];
const deliveryOptions = ["Pick Up", "Talabat", "Delivery", "Jahez", "Ahlan"];
const paymentOptions = ["Cash", "Card", "Benefit"];

const brandRed = "#E44B4C";



function AdminOrderDetailsPopUp({isAdminOrderDetailsPopUpOpen, onClose, onSave, cartItems, setCartItems}) {
    const [selectedCountry, setSelectedCountry] = useState(countries[0].name);
    const [phoneDigits, setPhoneDigits] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [deliveryMethod, setDeliveryMethod] = useState(deliveryOptions[0]);
    const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0]);
    const [globalDiscount, setGlobalDiscount] = useState(0);
    const navigate = useNavigate();

    const countryObj = countries.find((c) => c.name === selectedCountry);

    function handleSave() {
        const regex = /^\d+$/;

        if (phoneDigits) {
            if (!phoneDigits.match(regex)) {
                setPhoneError("Only digits are allowed");
                return;
            }

            if (phoneDigits.length !== countryObj.digits) {
                setPhoneError(`Phone number must be exactly ${countryObj.digits} digits`);
                return;
            }
        }

        setPhoneError("");

        const fullPhone = phoneDigits ? countryObj.code + phoneDigits : null;

        onSave?.({
            phone: fullPhone,
            customerName,
            deliveryMethod,
            paymentMethod
        });

        onClose?.();
    }


    return (
        <Modal open={isAdminOrderDetailsPopUpOpen} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    backgroundColor: "#fff",
                    p: 3,
                    width: 300,
                    borderRadius: 2,
                    boxShadow: 24,
                    outline: "none"
                }}
            >
                {/* Заголовок */}
                <Typography variant="h6" sx={{ mb: 2, textAlign: "center" }}>
                    User Data
                </Typography>
                {/* Country select */}
                <TextField
                    select
                    label="Country"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    fullWidth
                    sx={{ mb: 2 }}
                >
                    {countries.map((option) => (
                        <MenuItem key={option.name} value={option.name}>
                            {option.name} ({option.code})
                        </MenuItem>
                    ))}
                </TextField>
                {/* Phone number input */}
                <TextField
                    label="Phone Number (optional)"
                    variant="outlined"
                    fullWidth
                    value={phoneDigits}
                    onChange={(e) => {
                        // Разрешаем только цифры
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) {
                            setPhoneDigits(val);
                            setPhoneError("");
                        }
                    }}
                    error={Boolean(phoneError)}
                    helperText={phoneError || ""}
                    sx={{
                        mb: 2,
                        "& .MuiOutlinedInput-root": {
                            "&.Mui-error fieldset": {
                                borderColor: brandRed
                            }
                        }
                    }}
                />

                {/* Customer Name (optional) */}
                <TextField
                    label="Customer Name (optional)"
                    variant="outlined"
                    fullWidth
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    sx={{ mb: 2 }}
                />

                {/* Delivery Method */}
                <TextField
                    select
                    label="Delivery Method"
                    value={deliveryMethod}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                    fullWidth
                    sx={{ mb: 2 }}
                >
                    {deliveryOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                            {option}
                        </MenuItem>
                    ))}
                </TextField>

                {/* Payment Method */}
                <TextField
                    select
                    label="Payment Method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    fullWidth
                    sx={{ mb: 3 }}
                >
                    {paymentOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                            {option}
                        </MenuItem>
                    ))}
                </TextField>

                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="order-discount-label">Order Discount</InputLabel>
                    <Select
                        labelId="order-discount-label"
                        value={globalDiscount} // например, 50
                        label="Order Discount"
                        onChange={(e) => {
                            const discount = parseInt(e.target.value);
                            setGlobalDiscount(discount);


                            const updated = cartItems.map((item) => {
                                const discountedAmount = item.amount / (1 - (item.discount || 0) / 100);
                                const newAmount = discountedAmount * (1 - discount / 100);

                                return {
                                    ...item,
                                    discount,
                                };
                            });

                            setCartItems(updated);
                        }}

                    >
                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((percent) => (
                            <MenuItem key={percent} value={percent}>
                                {percent}%
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Checkout Button */}
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleSave}
                    sx={{
                        backgroundColor: brandRed,
                        color: "#fff",
                        textTransform: "none",
                        "&:hover": {
                            backgroundColor: "#d23f40"
                        }
                    }}
                >
                    Checkout
                </Button>
            </Box>
        </Modal>
    );
}

export default AdminOrderDetailsPopUp;