import {
    Box,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    Divider, IconButton
} from "@mui/material";
import {updateOrderStatus} from "../api/api";
import {useNavigate} from "react-router-dom";
import {useEffect, useMemo, useState} from "react";
import PrintIcon from "@mui/icons-material/Print";

import DeleteIcon from "@mui/icons-material/Delete";
import {CircularTimer} from "./CircularTimer";
import BluetoorhPrinterService from "../services/BluetoorhPrinterService";
import {usePreciseCountdown} from "./usePreciseCountdown";

const colorRed = '#E44B4C';
const colorBeige = '#FCF4DD';

function formatTime(isoString) {
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

function toEpochMsBahrain(s) {
    if (!s) return Date.now();
    const withT = s.replace(' ', 'T');

    if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(withT)) return Date.parse(withT);

    return Date.parse(withT + '+03:00');
}

const CATEGORY_ORDER = [
    "Combo Deals",
    "Pizzas",
    "Brick Pizzas",
    "Sides",
    "Sauces",
    "Beverages",
];

export function sortItemsByCategory(items) {
    if (!items || !items.length) return 0;

    return [...items].sort((a, b) => {
        const aIndex = CATEGORY_ORDER.indexOf(a.category);
        const bIndex = CATEGORY_ORDER.indexOf(b.category);

        const safeA = aIndex === -1 ? CATEGORY_ORDER.length : aIndex;
        const safeB = bIndex === -1 ? CATEGORY_ORDER.length : bIndex;

        return safeA - safeB;
    });
}

function renderComboDescription(comboItems) {
    return comboItems.map((item, idx) => {
        const extras = [];

        if (item.isThinDough) extras.push("Thin Dough");
        if (item.isGarlicCrust) extras.push("Garlic Crust");

        if (item.description) {
            item.description
                .replace(/[()]/g, "")
                .split("+")
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((s) => extras.push(s));
        }

        return (
            <Box key={idx} sx={{mt: 1, ml: 1}}>
                <Typography variant="body2" fontWeight="bold">
                    {item.name} {item.size ? "(" + item.size + ")" : ""}
                </Typography>

                {extras.length > 0 && (
                    <Typography
                        variant="body2"
                        sx={{color: colorRed, ml: 1}}
                    >
                        {extras.map((e, i) => (
                            <span key={i}>+ {e} </span>
                        ))}
                    </Typography>
                )}
            </Box>
        );
    });
}

export function renderItemDetails(item) {
    if (item.category === "Combo Deals" && Array.isArray(item.comboItemTO)) {
        return renderComboDescription(item.comboItemTO);
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
        <Box sx={{mt: 1, ml: 1}}>
            {extras.map((extra, idx) => (
                <Typography
                    key={idx}
                    variant="body2"
                    sx={{color: colorRed}}
                >
                    + {extra}
                </Typography>
            ))}
        </Box>
    ) : null;
}

function OrderCard({order,
                       onReadyClick = () => {},
                       isHistory = false,
                       onDeleteClick,
                       onPayClick = order => {},
                       onPickedUpClick = () => {},
                       onOvenClick = () => {},
                   }) {
    const formattedTime = formatTime(order.order_created);
    const navigate = useNavigate();
    const [extraSec, setExtraSec] = useState(0);

    const createdMs = useMemo(
        () => toEpochMsBahrain(order.order_created),
        [order.order_created]
    );

    const TOTAL_SEC = useMemo(
        () => (order.estimation ? order.estimation * 60 : 15 * 60),
        [order.estimation]
    );

    const endTs = useMemo(
        () => createdMs + (TOTAL_SEC + extraSec) * 1000,
        [createdMs, TOTAL_SEC, extraSec]
    );

    const msLeft = usePreciseCountdown(endTs, 250);
    const timeLeft = Math.ceil(msLeft / 1000);

    useEffect(() => {
        let lock;
        async function req() {
            try {
                lock = await navigator.wakeLock?.request("screen");
                document.addEventListener("visibilitychange", () => {
                    if (document.visibilityState === "visible") req();
                }, { once: true });
            } catch {}
        }
        req();
        return () => { try { lock?.release?.(); } catch {} };
    }, []);

    const isCritical = timeLeft < 60;


    const cardBorderColor = !isHistory
        ? (isCritical ? colorRed : 'transparent')
        : 'transparent';

    return (
        <Card sx={{
            mb: 2,
            border: '2px solid',
            borderRadius: 3,
            borderColor: cardBorderColor,
            backgroundColor: order.order_type === "Jahez" ? "#fff5f5" : order.order_type === "Keeta" ? '#CDBA2E' : order.order_type === "Talabat" ? '#fbaa66' :"#fff",
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
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                border: "1px solid #E44B4C",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                mr: 0.8,
                                cursor: "pointer"
                            }}
                            onClick={() => BluetoorhPrinterService.printOrder(order)}
                        >
                            <PrintIcon sx={{ fontSize: 26, color: "#E44B4C" }} />
                        </Box>

                        <Typography variant="h6" component="div">
                            Order:{" "}
                            {order.order_type === "Jahez" ||  order.order_type === "Keeta" ||  order.order_type === "Talabat" ? order.external_id : order.order_no}{" "}
                            <Typography
                                component="span"
                                sx={{ fontSize: 14, color: "text.secondary" }}
                            >
                                ({order?.order_type?.toUpperCase()})
                            </Typography>
                        </Typography>
                    </Box>

                    {!isHistory &&
                        <CircularTimer timeLeft={timeLeft} totalSec={order.estimation*60} />
                    }
                </Box>

                <Divider sx={{mb: 2}}/>

                <Box sx={{mb: 1}}>
                    <Typography variant="body2">
                        <strong>Time:</strong> {formattedTime}
                    </Typography>
                    {order.order_type !== "Jahez" && order.order_type !== "Talabat" && (
                        <Typography variant="body2">
                            <strong>Customer Info:</strong> {order.customer_name || "Rabotyaga"} ({order.phone_number})
                        </Typography>
                    )}
                    <Typography variant="body2" color={colorRed}>
                        <strong>Notes:</strong> {order.notes}
                    </Typography>
                    {!isHistory && (
                        <Typography variant="body2">
                            <strong>Payment type:</strong> {order.payment_type}
                        </Typography>
                    )}
                </Box>

                <Divider sx={{my: 2}}/>

                <Box>
                    {sortItemsByCategory(order.items).map((item, idx) => (
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
                                        sx={{ml: 1, fontStyle: "italic"}}
                                    >
                                        ({item.size})
                                    </Typography>
                                )}
                            </Typography>

                            {renderItemDetails(item)}
                        </Box>
                    ))}
                </Box>
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
                            {order.status==="Kitchen Phase" && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={order.status==="Ready" || order.status==="Picked Up"}
                                    sx=
                                        {{
                                            borderColor: colorBeige,
                                            color: colorRed,
                                            backgroundColor: "white",
                                            mr: 1,
                                            borderRadius: 4
                                        }}
                                    onClick={() => {
                                        updateOrderStatus({
                                            orderId: order.id,
                                            jahezOrderId: order.external_id ? order.external_id : null,
                                            orderStatus: "Oven",
                                            reason: null
                                        }).then(() => {
                                            onOvenClick?.(order)
                                        })
                                    }}
                                >
                                    OVEN
                                </Button>
                            )}
                            {order.status==="Oven" && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={order.status==="Ready"}
                                    sx=
                                        {{
                                            borderColor: colorBeige,
                                            color: colorRed,
                                            backgroundColor: "white",
                                            mr: 1,
                                            borderRadius: 4
                                        }}
                                    onClick={() => {
                                        updateOrderStatus({
                                            orderId: order.id,
                                            jahezOrderId: order.external_id ? order.external_id : null,
                                            orderStatus: "Ready",
                                            reason: null
                                        }).then(() => {
                                            onReadyClick?.(order)
                                        })
                                    }}
                                >
                                    READY
                                </Button>
                            )}
                            {order.status==="Ready" && (
                                <Button
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
                                    onClick={() => {
                                        updateOrderStatus({
                                            orderId: order.id,
                                            jahezOrderId: order.external_id ? order.external_id : null,
                                            orderStatus: "Picked Up",
                                            reason: null
                                        })
                                            .then(() => {
                                                onPickedUpClick?.(order)
                                            })
                                    }}
                                >
                                    PICKED UP
                                </Button>
                            )}
                            {order.order_type !== "Jahez" && order.order_type !== "Keeta" && order.order_type !== "TalabaT" && (
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
                            )}
                        </>
                    )}
                    {order.order_type !== "Jahez" && order.order_type !== "Keeta" && order.order_type !== "Talabat" && (

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
                    )}
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
                            <DeleteIcon fontSize="small"/>
                        </IconButton>
                    )}
                </Box>
            </CardActions>
        </Card>
    );
}

export default OrderCard;