import React, { useState } from "react";
import { Box, Modal, TextField, Button, MenuItem, Typography } from "@mui/material";

const brandRed = "#E44B4C";

const countries = [
    { name: "Bahrain", code: "973", digits: 8 },
    { name: "Saudi Arabia", code: "966", digits: 9 }
];

const paymentOptions = ["Cash", "Card (Through card machine)", "Benefit"];

function ClientInfoPopup({ isPhonePopupOpen, onClose, onSave }) {
    const [selectedCountry, setSelectedCountry] = useState(countries[0].name);
    const [phoneDigits, setPhoneDigits] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");

    const countryObj = countries.find((c) => c.name === selectedCountry);

    function handleSave() {
        const regex = /^\d+$/;
        if (!phoneDigits.match(regex)) {
            setPhoneError("Only digits are allowed");
            return;
        }
        if (phoneDigits.length !== countryObj.digits) {
            setPhoneError(`Phone number must be exactly ${countryObj.digits} digits`);
            return;
        }
        setPhoneError("");
        const fullPhone = countryObj.code + phoneDigits;
        onSave?.(
            fullPhone,
            paymentMethod
        );
        onClose?.();
    }

    return (
        <Modal open={isPhonePopupOpen} onClose={onClose}>
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
                <Typography variant="h6" sx={{ mb: 2, textAlign: "center" }}>
                    Enter your phone number to complete your order
                </Typography>
                {/* Country Select */}
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
                {/* Phone input */}
                <TextField
                    label="Phone number"
                    variant="outlined"
                    fullWidth
                    value={phoneDigits}
                    onChange={(e) => {
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
                    Checkout (Pick Up)
                </Button>
            </Box>
        </Modal>
    );
}

export default ClientInfoPopup;