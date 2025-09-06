import React, {useEffect, useState} from "react";
import {
    Box,
    Button,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Modal,
    Select,
    TextField,
    Typography
} from "@mui/material";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";

const countries = [
    { name: "Bahrain", code: "973", digits: 8 },
    { name: "Saudi Arabia", code: "966", digits: 9 },
    {name: "Oman", code: "968", "digits": 8 },
    {name: "Kuwait", code: "965", digits: 8 },
    {name: "United Arab Emirates", code: "971", digits: 9 },
    { name: "Egypt", code: "20", digits: 10 },
    { name: "Italy", code: "39", digits: 10 },
    { name: "United Kingdom", code: "44", digits: 10 },
    { name: "United States", code: "1", digits: 10 },
    { name: "France", code: "33", digits: 9 },
    { name: "Poland", code: "48", digits: 9 },
    { name: "Czech Republic", code: "420", digits: 9 }
];

const deliveryOptions = ["Pick Up", "Talabat", "Delivery", "Jahez", "Ahlan"];
const paymentOptions = ["Card (Through card machine)", "Cash", "Benefit"];

const brandRed   = "#E44B4C";
const grayText   = "#3A3A3A";
const grayBorder = "#E0E0E0";
const focusBorder= "#B0B0B0";
const focusBg    = "#F0F0F0";


export default function AdminOrderDetailsPopUp({isAdminOrderDetailsPopUpOpen, onClose, onSave, cartItems, setCartItems}) {
    const [selectedCountry, setSelectedCountry] = useState(countries[0].name);
    const [phoneDigits, setPhoneDigits] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [deliveryMethod, setDeliveryMethod] = useState(deliveryOptions[0]);
    const [paymentMethod, setPaymentMethod] = useState(paymentOptions[0]);
    const [globalDiscount, setGlobalDiscount] = useState(0);
    const [note, setNote] = useState("");
    const countryObj = countries.find((c) => c.name === selectedCountry);

    useEffect(() => {
        const order = JSON.parse(localStorage.getItem("orderToEdit"))
        if(order){
            if (order.phone_number != null) {
                const matchedCountry = countries.find((c) => order.phone_number.toString().startsWith(c.code));
                if(matchedCountry){
                    setSelectedCountry(matchedCountry.name);
                    setPhoneDigits(order.phone_number.toString().slice(matchedCountry.code.length));
                    setCustomerName(order.customer_name);
                }
            }
            setNote(order.notes);
            setPaymentMethod(order.payment_type)
        }
    },[])

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
        onSave?.(
            fullPhone,
            customerName,
            deliveryMethod,
            paymentMethod,
            note
        );

        onClose?.();
    }

    const drawerPaperSx = {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: "92vh",
        pb: 2
    };

    const fieldSx = {
        mb: 2,
        "& .MuiOutlinedInput-notchedOutline": { borderColor: grayBorder },
        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: grayBorder },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#B0B0B0" },
        "&.Mui-focused": { backgroundColor: focusBg }
    };

    const captionSx = { fontWeight: 700, color: grayText, mb: 1 };


    return (
        <SwipeableDrawer
            anchor="bottom"
            open={isAdminOrderDetailsPopUpOpen}
            onClose={onClose}
            onOpen={() => {}}
            disableDiscovery
            keepMounted
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxHeight: "92vh",
                }
            }}
        >
            {/* drag handle */}
            <Box sx={{ display: "flex", justifyContent: "center", pt: 1, pb: 0.5 }}>
                <Box sx={{ width: 36, height: 4, borderRadius: 999, bgcolor: "grey.400" }} />
            </Box>

            {/* header */}
            <Box sx={{ px: 2, pt: 0.5, pb: 1 }}>
                <Typography
                    variant="h6"
                    sx={{ fontWeight: 900, color: grayText, textAlign: "Center" }}
                >
                    User Data
                </Typography>
            </Box>

            <Divider sx={{ borderColor: grayBorder, mb: 2 }} />

            {/* content */}
            <Box sx={{ px: 2, pt: 2, pb: 12, overflowY: "auto" }}>
                {/* Country */}
                <TextField
                    select
                    label="Country"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    fullWidth
                    sx={fieldSx}
                    InputProps={{ sx: { borderRadius: 4 } }}
                >
                    {countries.map((option) => (
                        <MenuItem key={option.name} value={option.name}>
                            {option.name} ({option.code})
                        </MenuItem>
                    ))}
                </TextField>

                {/* Phone (optional) */}
                <TextField
                    label={`Phone number (optional)`}
                    fullWidth
                    value={phoneDigits}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val) && val.length <= countryObj.digits) {
                            setPhoneDigits(val);
                            setPhoneError("");
                        }
                    }}
                    error={Boolean(phoneError)}
                    helperText={phoneError || ""}
                    sx={fieldSx}
                    InputProps={{ sx: { borderRadius: 4 } }}
                />

                {/* Name (optional) */}
                <TextField
                    label="Customer Name (optional)"
                    fullWidth
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    sx={fieldSx}
                    InputProps={{ sx: { borderRadius: 4 } }}
                />

                {/* Delivery Method */}
                <TextField
                    select
                    label="Delivery Method"
                    value={deliveryMethod}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                    fullWidth
                    sx={fieldSx}
                    InputProps={{ sx: { borderRadius: 4 } }}
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
                    sx={fieldSx}
                    InputProps={{ sx: { borderRadius: 4 } }}
                >
                    {paymentOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                            {option}
                        </MenuItem>
                    ))}
                </TextField>

                {/* Admin: Order Discount */}
                <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="order-discount-label">Order Discount</InputLabel>
                    <Select
                        labelId="order-discount-label"
                        label="Order Discount"
                        value={globalDiscount}
                        onChange={(e) => {
                            const discount = parseInt(e.target.value, 10);
                            setGlobalDiscount(discount);

                            // keep your discount logic intact
                            const updated = cartItems.map((item) => {
                                const discountedAmount =
                                    item.amount / (1 - (item.discount || 0) / 100);
                                const newAmount = discountedAmount * (1 - discount / 100);
                                return { ...item, discount };
                            });
                            setCartItems(updated);
                        }}
                        sx={{
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: grayBorder },
                            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: grayBorder },
                            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: focusBorder },
                            "&.Mui-focused": { backgroundColor: focusBg },
                            borderRadius: 1
                        }}
                    >
                        {[0,10,20,30,40,50,60,70,80,90,100].map((p) => (
                            <MenuItem key={p} value={p}>{p}%</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Notes */}
                <TextField
                    label="Add a note to order (optional)"
                    fullWidth
                    multiline
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    sx={fieldSx}
                    InputProps={{ sx: { borderRadius: 4 } }}
                />
            </Box>

            {/* sticky CTA */}
            <Box
                sx={{
                    position: "fixed",
                    left: 0, right: 0, bottom: 0,
                    p: 2,
                    bgcolor: "#fff",
                    borderTop: `1px solid ${grayBorder}`
                }}
            >
                <Button
                    fullWidth
                    variant="contained"
                    onClick={handleSave}
                    sx={{
                        backgroundColor: brandRed,
                        color: "#fff",
                        textTransform: "none",
                        fontSize: "1rem",
                        fontWeight: 800,
                        borderRadius: 4,
                        py: 1.2,
                        "&:hover": { backgroundColor: "#d23f40" },
                        boxShadow: "0 6px 16px rgba(228,75,76,0.35)"
                    }}
                >
                    Checkout
                </Button>
            </Box>
        </SwipeableDrawer>
    );
}
