import {
    Box,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    Divider, Select, MenuItem, IconButton
} from "@mui/material";
import {markOrderReady, updatePaymentType} from "../api/api";
import {useNavigate} from "react-router-dom";
import {useEffect, useMemo, useState} from "react";

import DeleteIcon from "@mui/icons-material/Delete";

const colorRed = '#E44B4C';
const colorBeige = '#FCF4DD';
const GRAY_BORDER = "#E0E0E0";
const GRAY_TEXT = "#3A3A3A";
const FOCUS_BG = "#F0F0F0";

function formatTime(isoString) {
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

function toEpochMsBahrain(s) {
    if (!s) return Date.now();
    const withT = s.replace(' ', 'T');

    if (/[Zz]|[+\-]\d{2}:?\d{2}$/.test(withT)) return Date.parse(withT);

    return Date.parse(withT + '+03:00');
}


const getBtnStyle = (isActive) => ({
    borderColor: isActive ? colorRed : GRAY_BORDER,
    color: isActive ? colorRed : GRAY_TEXT,
    borderRadius: 4,
    fontWeight: 800,
    justifyContent: "center",
    px: 1.5,
    py: 1.2,
    fontSize: 15,
    backgroundColor: isActive ? "white" : colorBeige,
    "&:hover": {
        backgroundColor: isActive ? FOCUS_BG : colorBeige,
        borderColor: isActive ? colorRed : GRAY_BORDER,
    },
});

function renderComboDescription(desc) {
    const comboParts = desc.split(";");


    return comboParts.map((part, idx) => {
        const lines = part.trim().split("+");
        const main = lines[0].trim();
        const extras = lines.slice(1).map(e => e.trim()).filter(Boolean);

        return (
            <Box key={idx} sx={{ mt: 1, ml: 1 }}>
                <Typography variant="body2" fontWeight="bold">{main}</Typography>
                {extras.map((extra, i) => (
                    <Typography
                        key={i}
                        variant="body2"
                        sx={{ color: colorRed, ml: 1 }}
                    >
                        + {extra}
                    </Typography>
                ))}
            </Box>
        );
    });
}

function renderItemDetails(item) {


    if (item.category === "Combo Deals" && item.description?.includes(";")) {
        return renderComboDescription(item.description);
    }

    const desc = item.description?.replace(";", "") || "";
    const cleanDescription = desc
        .replace(/[()]/g, "")
        .replace(/^\+/, "")
        .trim();

    const extras = cleanDescription
        .split("+")
        .map(str => str.trim())
        .filter(Boolean);

    return extras.length > 0 ? (
        <Box sx={{ mt: 1, ml: 1 }}>
            {extras.map((extra, idx) => (
                <Typography
                    key={idx}
                    variant="body2"
                    sx={{ color: colorRed }}
                >
                    + {extra}
                </Typography>
            ))}
        </Box>
    ) : null;
}

function OrderCard({ order, onReadyClick = () => {} , isHistory = false, onDeleteClick, onPayClick = order => {}}) {
    const formattedTime = formatTime(order.order_created);
    const navigate = useNavigate();
    const [paymentType, setPaymentType] = useState(order.payment_type);
    const paymentOptions = ["Cash", "Card (Through card machine)", "Benefit"];

    const handlePaymentTypeChange = async (orderId, newType) => {
        try {
            await updatePaymentType(orderId, newType);
            setPaymentType(newType);
        } catch (error) {
            console.error("Failed to update payment type", error);
        }
    };

    const createdMs = useMemo(() => toEpochMsBahrain(order.order_created), [order.order_created]);

    useEffect(() => {
        console.info(order)
    }, [])

    const [timeLeft, setTimeLeft] = useState(() => {
        return Math.floor(15 * 60 - (Date.now() - createdMs) / 1000);
    });
    const isCritical = timeLeft < 180;

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatTime2 = (seconds) => {
        const abs = Math.abs(seconds);
        const mins = String(Math.floor(abs / 60)).padStart(2, "0");
        const secs = String(abs % 60).padStart(2, "0");
        return `${seconds < 0 ? "-" : ""}${mins}:${secs}`;
    };

    return (
        <Card sx={{ mb: 2,
                    border: '2px solid',
                    borderRadius: 3,
                    borderColor: isCritical && !isHistory ? colorRed : 'transparent',
                    boxShadow: 3
        }}>
            <CardContent>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1
                    }}
                >
                    <Typography variant="h6">
                        Order: {order.order_no}{" "}
                        <Typography
                            component="span"
                            sx={{ fontSize: 14, color: "text.secondary" }}
                        >
                            ({order?.order_type?.toUpperCase()})
                        </Typography>
                    </Typography>

                    {!isHistory && <Typography variant="h6"
                                sx={{
                                    color: isCritical ? colorRed : "text.secondary",
                                }}
                    >
                        {formatTime2(timeLeft)}
                    </Typography>}
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Box sx={{ mb: 1 }}>
                    <Typography variant="body2">
                        <strong>Time:</strong> {formattedTime}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Customer Info:</strong> {order.customer_name || "Rabotyaga"} ({order.phone_number})
                    </Typography>
                    <Typography variant="body2" color={colorRed}>
                        <strong>Notes:</strong> {order.notes}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Payment type:</strong> {paymentType}
                    </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box>
                    {order.items.map((item, idx) => (
                        <Box
                            key={idx}
                            sx={{
                                mb: 1.5,
                                pl: 1,
                                borderLeft: "2px solid #e0e0e0"
                            }}
                        >
                            <Typography variant="body2">
                                {item.quantity}x <strong>{item.name}</strong>
                                {item.size && (
                                    <Typography
                                        component="span"
                                        variant="body2"
                                        sx={{ ml: 1, fontStyle: "italic" }}
                                    >
                                        ({item.size})
                                    </Typography>
                                )}
                            </Typography>

                            {renderItemDetails(item)}
                        </Box>
                    ))}
                </Box>
                {isHistory && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Payment Type:</strong>
                        </Typography>
                        <Select
                            value={paymentType}
                            onChange={(e) => handlePaymentTypeChange(order.id, e.target.value)}
                            fullWidth
                            size="small"
                        >
                            {paymentOptions.map((option) => (
                                <MenuItem key={option} value={option}>
                                    {option}
                                </MenuItem>
                            ))}
                        </Select>
                    </Box>
                )}
            </CardContent>

            <CardActions
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    px: 2,
                    pb: 2
                }}
            >
                <Typography variant="h6" fontWeight="bold">
                    BHD {order.amount_paid}
                </Typography>
                <Box>
                    {!isHistory && (
                        <>
                        <Button
                            variant="contained"
                            size="small"
                            disabled={order.isReady}
                            sx=
                                {{
                                borderColor: colorBeige,
                                color: colorRed,
                                backgroundColor: "white",
                                    mr: 1,
                                borderRadius: 4
                            }}
                            onClick={() => {markOrderReady(order.id).then(() => {onReadyClick?.(order)})}}
                        >
                            READY
                        </Button>

                            <Button
                        variant="contained"
                        size="small"
                        disabled={order.isPaid}
                        sx=
                        {{
                            borderColor: colorBeige,
                            color: colorRed,
                            backgroundColor: "white",
                            mr: 1,
                            borderRadius: 4
                        }}
                        onClick={() =>
                            onPayClick(order)
                        }
                        >
                        PAY
                        </Button>
                        </>
                    )}

                    <Button
                        variant="outlined"
                        size="small"
                        sx={{
                            borderColor: colorRed,
                            color: colorRed,
                            borderRadius: 4
                        }}
                        onClick={() => {
                            const safeCopy = JSON.parse(JSON.stringify(order));
                            localStorage.setItem("orderToEdit", JSON.stringify(safeCopy));
                            navigate("/menu?isAdmin=true&isEditMode=true");
                        }}>
                        EDIT
                    </Button>
                    {isHistory && (
                        <IconButton
                            size="small"
                            sx={{
                                border: `1px solid ${colorRed}`,
                                color: colorRed,
                                borderRadius: 4,
                                p: 0.5,
                                ml: 0.5,
                                "&:hover": {
                                    backgroundColor: "rgba(228, 75, 76, 0.08)"
                                }
                            }}
                            onClick={() => onDeleteClick(order)}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
            </CardActions>
        </Card>
    );
}

export default OrderCard;




