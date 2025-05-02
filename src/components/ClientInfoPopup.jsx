import React, {useEffect, useState} from "react";
import { Box, Modal, TextField, Button, MenuItem, Typography } from "@mui/material";

const brandRed = "#E44B4C";

const countries = [
    { name: "Bahrain", code: "973", digits: 8 },
    { name: "Saudi Arabia", code: "966", digits: 9 },
    { name: "Egypt", code: "20", digits: 10 },
    { name: "Italy", code: "39", digits: 10 },
    { name: "United Kingdom", code: "44", digits: 10 },
    { name: "United States", code: "1", digits: 10 },
    { name: "France", code: "33", digits: 9 },
    { name: "Poland", code: "48", digits: 9 }
];

const paymentOptions = ["Cash", "Card (Through card machine)", "Benefit"];

function ClientInfoPopup({ isPhonePopupOpen, onClose, onSave, phoneNumber, customerName }) {
    const [selectedCountry, setSelectedCountry] = useState(countries[0].name);
    const [phoneDigits, setPhoneDigits] = useState(phoneNumber);
    const [phoneError, setPhoneError] = useState("");
    const [name, setName] = useState("");
    const [nameError, setNameError] = useState("");
    const [note, setNote] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Card (Through card machine)");

    const countryObj = countries.find((c) => c.name === selectedCountry);

    useEffect(() => {
        if (phoneNumber !== "") {
            console.log("Phone number from props:", phoneNumber);
            const matchedCountry = countries.find((c) => phoneNumber.startsWith(c.code));
            if (matchedCountry) {
                setSelectedCountry(matchedCountry.name);
                setPhoneDigits(phoneNumber.slice(matchedCountry.code.length));
            }
        }
        if (customerName !== "") {
            console.log("Customer name from props:", customerName);
            setName(customerName);
        }
    }, []);

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
        if (!name) {
            setNameError("Name is required");
            return;
        }
        setPhoneError("");
        setNameError("");
        const fullPhone = countryObj.code + phoneDigits;
        onSave?.(
            fullPhone,
            paymentMethod,
            name,
            note
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
                {/* Name input */}
                <TextField
                    label="Name"
                    variant="outlined"
                    fullWidth
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={Boolean(nameError)}
                    helperText={nameError || ""}
                    sx={{ mb: 2 }}
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
                {/* Notes */}
                <TextField
                    label="Add a note to your order (optional)"
                    variant="outlined"
                    fullWidth
                    multiline
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    sx={{ mb: 3 }}
                />
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