// PaymentSheetMobile.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Box, Button, Stack, Paper, Select, MenuItem, TextField,
    IconButton, Typography
} from "@mui/material";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import DeleteIcon from "@mui/icons-material/Delete";
import {sendOrderPayment} from "../api/api";
import Input from "@mui/material/Input";
import InputBase from "@mui/material/InputBase";
import Divider from "@mui/material/Divider";

const COLOR_RED = "#E44B4C";
const GRAY_BG = "#F7F7F8";
const GRAY_BORDER = "#E0E0E0";
const GRAY_TEXT = "#3A3A3A";
const FOCUS_BG = "#F0F0F0";


const mkId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalize = (s) => {
    if (typeof s !== "string") return "";
    const t = s.trim().replace(",", ".");
    const cleaned = t.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length <= 1) return cleaned;
    return parts[0] + "." + parts.slice(1).join("");
};
const toNumber = (s) => {
    const n = parseFloat(normalize(s));
    return Number.isFinite(n) ? n : 0;
};
const toMoney = (n) => Number((Math.round(n * 100) / 100).toFixed(2));

export default function PaymentPopup({
                                               open,
                                               onClose,
                                               order,
                                               onPaymentSuccess
                                           }) {
    const amountPaid = useMemo(() => Number(order?.amount_paid ?? 0), [order]);

    const [selectedType, setSelectedType] = useState(null);
    const [splitMode, setSplitMode] = useState(false);
    const [payers, setPayers] = useState([{ id: mkId(), type: "cash", amount: "" }]);

    useEffect(() => {
        if (open && order) {
            setSelectedType(null);
            setSplitMode(false);
            setPayers([{
                id: mkId(),
                type: "cash",
                amount: amountPaid ? amountPaid.toFixed(2) : ""
            }]);
        }
    }, [open, order, amountPaid]);

    if (!open || !order) return null;

    const total = payers.reduce((s, p) => s + toNumber(p.amount), 0);
    const remaining = toMoney(amountPaid - total);
    const remainingZero = remaining === 0;

    const addPayer = () => setPayers(prev => [...prev, { id: mkId(), type: "Cash", amount: "" }]);
    const removePayer = (index) => setPayers(prev => prev.filter((_, i) => i !== index));
    const updatePayerType = (index, type) =>
        setPayers(prev => prev.map((p, i) => (i === index ? { ...p, type } : p)));
    const updatePayerAmount = (index, value) => {
        let v = value.replace(/[^\d.,]/g, "").replace(",", ".");
        const parts = v.split(".");
        if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
        setPayers(prev => prev.map((p, i) => (i === index ? { ...p, amount: v } : p)));
    };

    const confirmPayment = async () => {
        const branchId = order.branch_id ?? 1;
        if (!splitMode) {
            // single transaction
            await sendOrderPayment({
                orderId: order.id,
                amount: amountPaid,
                type: selectedType,
                branchId
            });
        } else {
            if (!remainingZero) return;
            const txs = payers
                .map(p => ({ amount: toNumber(p.amount), type: p.type }))
                .filter(p => p.amount > 0 && ["Cash", "Card", "Benefit"].includes(p.type));

            for (const tx of txs) {
                await sendOrderPayment({
                    orderId: order.id,
                    amount: tx.amount,
                    type: tx.type,
                    branchId
                });
            }
        }

        onPaymentSuccess?.(order.id);
        onClose();
    };


    const neutralBtn = (selected) => ({
        borderColor: GRAY_BORDER,
        color: GRAY_TEXT,
        borderRadius: 2,
        fontWeight: 800,
        justifyContent: "center",
        px: 1.5,
        py: 1.4,
        fontSize: 15,
        backgroundColor: selected ? GRAY_BG : "#fff",
        "&:hover": { backgroundColor: GRAY_BG, borderColor: GRAY_BORDER }
    });

    const sheetPaperSx = {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: "90vh",
        pb: 2
    };

    const confirmDisabled = (!splitMode && !selectedType) || (splitMode && !remainingZero);

    return (
        <SwipeableDrawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            onOpen={() => {}}
            disableDiscovery
            keepMounted
            PaperProps={{ sx: sheetPaperSx }}
        >
            <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                <Box sx={{ width: 36, height: 4, borderRadius: 999, bgcolor: "grey.400" }} />
            </Box>

            <Box sx={{ px: 2, pt: 0.5, pb: 1.5 }}>
                <Typography
                    sx={{
                        textAlign: "center",
                        fontWeight: 900,
                        color: GRAY_TEXT,
                        fontSize: 22,
                        lineHeight: 1.4
                    }}
                >
                    {amountPaid.toFixed(2)} BHD
                </Typography>

                {splitMode && (
                    <Typography
                        variant="subtitle2"
                        sx={{
                            mt: 0.5,
                            textAlign: "center",
                            fontWeight: 800,
                            color: remainingZero ? "#2E7D32" : COLOR_RED
                        }}
                    >
                        Remaining: {remaining.toFixed(2)} BHD
                    </Typography>
                )}
            </Box>

            <Divider sx={{ mb: 2, borderColor: GRAY_BORDER }} />

            <Box sx={{ px: 2, pb: 10, overflowY: "auto" }}>
                {!splitMode ? (
                    <Stack spacing={1.0}>
                        {["Split", "Card", "Benefit", "Cash"].map((t) => (
                            <Button
                                key={t}
                                variant="outlined"
                                fullWidth
                                sx={neutralBtn(selectedType === t)}
                                onClick={() => {
                                    if (t === "Split") {
                                        setSplitMode(true);
                                        setPayers([{ id: mkId(), type: "Cash", amount: "" }]);
                                        setSelectedType(null);
                                    } else {
                                        setSelectedType(t);
                                    }
                                }}
                            >
                                {t}
                            </Button>
                        ))}
                    </Stack>
                ) : (
                    <>
                        <Divider sx={{ my: 1.5, borderColor: GRAY_BORDER }} />
                        <Stack spacing={1.2}>
                            {payers.map((payer, index) => (
                                <Box
                                    key={payer.id}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        py: 1,
                                        borderBottom: `1px solid ${GRAY_BORDER}`,
                                        "&:focus-within": { backgroundColor: FOCUS_BG },
                                        borderRadius: 2,
                                        px: 1
                                    }}
                                >
                                    <Select
                                        value={payer.type}
                                        onChange={(e) => updatePayerType(index, e.target.value)}
                                        variant="standard"
                                        input={<Input disableUnderline />}
                                        sx={{ minWidth: 90, color: GRAY_TEXT, px: 0.5 }}
                                    >
                                        <MenuItem value="Cash">Cash</MenuItem>
                                        <MenuItem value="Card">Card</MenuItem>
                                        <MenuItem value="Benefit">Benefit</MenuItem>
                                    </Select>

                                    <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: GRAY_BORDER }} />

                                    <InputBase
                                        value={String(payer.amount ?? "")}
                                        onChange={(e) => updatePayerAmount(index, e.target.value)}
                                        onBlur={(e) => {
                                            const n = toNumber(e.target.value);
                                            updatePayerAmount(index, n ? n.toFixed(2) : "");
                                        }}
                                        placeholder="0.00"
                                        inputMode="decimal"
                                        sx={{
                                            flex: 1,
                                            fontSize: 16,
                                            color: GRAY_TEXT,
                                            px: 0.5,
                                            height: 40
                                        }}
                                    />

                                    <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: GRAY_BORDER }} />

                                    <IconButton
                                        onClick={() => removePayer(index)}
                                        sx={{ color: GRAY_TEXT }}
                                        size="small"
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            ))}

                            <Button
                                variant="outlined"
                                onClick={addPayer}
                                sx={{
                                    borderColor: GRAY_BORDER,
                                    color: GRAY_TEXT,
                                    borderRadius: 2,
                                    fontWeight: 700,
                                    "&:hover": { backgroundColor: GRAY_BG, borderColor: GRAY_BORDER }
                                }}
                            >
                                + Add Payer
                            </Button>
                        </Stack>
                    </>
                )}
            </Box>

            <Box
                sx={{
                    position: "fixed",
                    left: 0, right: 0, bottom: 0,
                    p: 2,
                    bgcolor: "#fff",
                    borderTop: `1px solid ${GRAY_BORDER}`
                }}
            >
                <Button
                    fullWidth
                    variant="contained"
                    disabled={confirmDisabled}
                    onClick={confirmPayment}
                    sx={{
                        borderRadius: 2,
                        py: 1.35,
                        fontSize: 15,
                        backgroundColor: confirmDisabled ? "#ddd" : COLOR_RED,
                        color: "#fff",
                        boxShadow: confirmDisabled ? "none" : "0 6px 16px rgba(228,75,76,0.35)",
                        "&:hover": !confirmDisabled ? { backgroundColor: "#c73c3d" } : {}
                    }}
                >
                    Confirm Payment
                </Button>
            </Box>
        </SwipeableDrawer>
    );
}

