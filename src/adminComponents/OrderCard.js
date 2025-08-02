import {
    Box,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    Divider, Select, MenuItem
} from "@mui/material";
import {markOrderReady, updatePaymentType} from "../api/api";
import {useNavigate} from "react-router-dom";
import {useState} from "react";



function formatTime(isoString) {
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

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
                        sx={{ color: "text.secondary", ml: 1 }}
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
                    sx={{ color: "text.secondary" }}
                >
                    + {extra}
                </Typography>
            ))}
        </Box>
    ) : null;
}

function OrderCard({ order, handleRemoveItem , isHistory = false}) {
    const formattedTime = formatTime(order.order_created);
    const navigate = useNavigate();
    const [paymentType, setPaymentType] = useState(order.payment_type);

    const colorRed = '#E44B4C';
    const colorBeige = '#FCF4DD';
    const paymentOptions = ["Cash", "Card (Through card machine)", "Benefit"];

    const handlePaymentTypeChange = async (orderId, newType) => {
        try {
            await updatePaymentType(orderId, newType);
            setPaymentType(newType);
        } catch (error) {
            console.error("Failed to update payment type", error);
        }
    };
    return (
        <Card sx={{ mb: 2, borderRadius: 3, boxShadow: 3 }}>
            <CardContent>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1
                    }}
                >
                    <Typography variant="h6">Order: {order.order_no}</Typography>
                    <Typography
                        variant="h6"
                        sx={{ fontSize: 14, color: "text.secondary" }}
                    >
                        {order?.order_type?.toUpperCase()}
                    </Typography>
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Box sx={{ mb: 1 }}>
                    <Typography variant="body2">
                        <strong>Time:</strong> {formattedTime}
                    </Typography>
                    <Typography variant="body2">
                        <strong>Customer Info:</strong> {order.customer_name || "—"} ({order.phone_number})
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
                    {!isHistory && <Button
                        variant="contained"
                        size="small"
                        sx=
                            {{
                            borderColor: colorBeige,
                            color: colorRed,
                                backgroundColor: "white",
                            mr: 1,
                            borderRadius: 4
                        }}
                        onClick={() => {markOrderReady(order.id).then(() => {handleRemoveItem?.(order.id)})}}>

                        READY
                    </Button>}
                    <Button
                        variant="outlined"
                        size="small"
                        sx={{
                            borderColor: colorRed,
                            color: colorRed,
                            borderRadius: 4
                        }}
                        onClick={() => {
                            console.log(order)
                            localStorage.setItem("orderToEdit", JSON.stringify(order));
                            navigate("/menu?isAdmin=true&isEditMode=true");
                        }}>
                        EDIT
                    </Button>
                </Box>
            </CardActions>
        </Card>
    );
}

export default OrderCard;




