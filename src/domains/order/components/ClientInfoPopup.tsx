import React, {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Box, Modal, TextField, Button, MenuItem, Typography} from "@mui/material";
import { DEFAULT_BRANCH_ID } from "../../../shared/api/client";
import { countries, localizedCountryName } from "../../../shared/utils/countries";
import { DEFAULT_PAYMENT_METHOD } from "../types";

const brandRed = "#E44B4C";

interface Branch {
    id: string;
    branchName: string;
}

const paymentOptions = ["Cash", DEFAULT_PAYMENT_METHOD, "Benefit"];

interface ClientInfoPopupProps {
    isPhonePopupOpen: boolean;
    onClose: () => void;
    onSave: (phone: string, paymentMethod: string, name: string, note: string, branchId: string) => void;
    phoneNumber: string;
    customerName: string;
    branches: Branch[];
    // Optional — populated from GET /customer/me for a logged-in customer (task-spec.md §4
    // req. 23). Pick-Up orders (the only flow this popup drives) have no address field to save,
    // so this is shown as read-only reference info rather than wired into onSave.
    prefillAddress?: string;
    // Carries over a note the customer already typed in the cart, so it survives the fallback
    // to this popup (a logged-in customer with no name on file still lands here).
    prefillNote?: string;
}

function ClientInfoPopup({isPhonePopupOpen, onClose, onSave, phoneNumber, customerName, branches, prefillAddress, prefillNote}: ClientInfoPopupProps): JSX.Element {
    const { t, i18n } = useTranslation("checkout");
    const [selectedCountry, setSelectedCountry] = useState(countries[0].name);
    const [phoneDigits, setPhoneDigits] = useState(phoneNumber);
    const [phoneError, setPhoneError] = useState("");
    const [name, setName] = useState("");
    const [nameError, setNameError] = useState("");
    const [note, setNote] = useState(prefillNote ?? "");
    const [paymentMethod, setPaymentMethod] = useState(DEFAULT_PAYMENT_METHOD);
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
    const IS_MULTI_BRANCH_ENABLED =  false;


    const countryObj = countries.find((c) => c.name === selectedCountry);

    useEffect(() => {
        if (phoneNumber !== "") {
            const matchedCountry = countries.find((c) => phoneNumber.startsWith(c.code));
            if (matchedCountry) {
                setSelectedCountry(matchedCountry.name);
                setPhoneDigits(phoneNumber.slice(matchedCountry.code.length));
            }
        }
        if (customerName !== "") {
            setName(customerName);
        }
    }, [customerName, phoneNumber]);

    function handleSave(): void {
        if (!countryObj) return;
        const regex = /^\d+$/;
        if (!phoneDigits.match(regex)) {
            setPhoneError(t("clientInfo.errors.onlyDigits"));
            return;
        }
        if (phoneDigits.length !== countryObj.digits) {
            setPhoneError(t("clientInfo.errors.phoneLength", { count: countryObj.digits }));
            return;
        }
        if (!name) {
            setNameError(t("clientInfo.errors.nameRequired"));
            return;
        }
        setPhoneError("");
        setNameError("");
        const fullPhone = countryObj.code + phoneDigits;
        onSave?.(
            fullPhone,
            paymentMethod,
            name,
            note,
            selectedBranch?.id || DEFAULT_BRANCH_ID
        );
        onClose?.();
    }

    return (
        <Modal open={isPhonePopupOpen} onClose={onClose}>
            <Box
                sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    bgcolor: "#fff",
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxHeight: "95vh",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <Box sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                        {t("clientInfo.title")}
                    </Typography>

                    {prefillAddress && (
                        <Typography sx={{ mb: 2, color: "#666", fontSize: 13 }}>
                            {t("clientInfo.savedAddress", { address: prefillAddress })}
                        </Typography>
                    )}

                    <TextField
                        select
                        label={t("clientInfo.country")}
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        fullWidth
                        sx={{ mb: 2 }}
                        InputProps={{ sx: { borderRadius: 4 } }}
                    >
                        {countries.map((option) => (
                            <MenuItem key={option.name} value={option.name}>
                                {localizedCountryName(option, i18n.language)} ({option.code})
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        label={t("clientInfo.phoneNumber")}
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
                        sx={{ mb: 2 }}
                        InputProps={{ sx: { borderRadius: 4 } }}
                    />

                    <TextField
                        label={t("clientInfo.name")}
                        fullWidth
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={Boolean(nameError)}
                        helperText={nameError || ""}
                        sx={{ mb: 2 }}
                        InputProps={{ sx: { borderRadius: 4 } }}
                    />

                    <TextField
                        select
                        label={t("clientInfo.paymentMethod")}
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        fullWidth
                        sx={{ mb: 2 }}
                        InputProps={{ sx: { borderRadius: 4 } }}
                    >
                        {paymentOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </TextField>

                    {IS_MULTI_BRANCH_ENABLED &&
                        <TextField
                        select
                        label={t("clientInfo.pickUpBranch")}
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value as unknown as Branch)}
                        fullWidth
                        sx={{ mb: 2 }}
                        InputProps={{ sx: { borderRadius: 4 } }}
                    >
                        {branches.map((branch) => (
                            <MenuItem key={branch.id} value={branch as unknown as string}>
                                {branch.branchName} (jma)
                            </MenuItem>
                        ))}
                    </TextField>
                    }

                    <TextField
                        label={t("clientInfo.noteLabel")}
                        fullWidth
                        multiline
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        sx={{ mb: 3 }}
                        InputProps={{ sx: { borderRadius: 4 } }}
                    />
                </Box>

                <Box sx={{
                    position: "sticky",
                    bottom: 0,
                    bgcolor: "#fff",
                    borderTop: "1px solid #eee",
                    p: 2,
                    zIndex: 10
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
                            borderRadius: 4,
                            "&:hover": { backgroundColor: "#d23f40" },
                        }}
                    >
                        {t("clientInfo.checkoutTakeOut")}
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}

export default ClientInfoPopup;
