import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { PaymentResultUIState, PaymentSessionStatus } from "../types/payment";
import { getPaymentStatus } from "../api/paymentApi";
import { usePaymentStatusPolling } from "../hooks/usePaymentStatusPolling";
import { clearPersistedCart } from "../utils/cartPersistence";

const PaymentResultPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const rawOrderId = searchParams.get("orderId");
    const orderId = rawOrderId ? parseInt(rawOrderId, 10) : null;

    const [uiState, setUiState] = useState<PaymentResultUIState>("loading");
    const [pollingActive, setPollingActive] = useState(false);

    useEffect(() => {
        if (orderId === null || isNaN(orderId)) {
            setUiState("failed");
            return;
        }

        getPaymentStatus(orderId)
            .then((res) => handleStatus(res.status))
            .catch(() => setUiState("failed"));
    }, [orderId]);

    const handleStatus = (status: PaymentSessionStatus): void => {
        if (status === "PAID") {
            clearPersistedCart();
            setUiState("success");
            setTimeout(() => navigate(`/order_status?order_id=${orderId}`), 1500);
        } else if (status === "FAILED") {
            setUiState("failed");
        } else {
            setPollingActive(true);
        }
    };

    usePaymentStatusPolling({
        orderId: pollingActive ? orderId : null,
        onStatusChange: (status) => {
            setPollingActive(false);
            handleStatus(status);
        },
        onTimeout: () => {
            setPollingActive(false);
            setUiState("timeout");
        },
    });

    const handleBack = (): void => navigate("/menu");

    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", p: 3, textAlign: "center" }}>
            {uiState === "loading" && (
                <>
                    <CircularProgress sx={{ color: "#E44B4C", mb: 2 }} />
                    <Typography variant="h6">Checking payment status...</Typography>
                </>
            )}

            {uiState === "success" && (
                <>
                    <Typography variant="h4" sx={{ color: "success.main", mb: 2, fontWeight: "bold" }}>
                        Payment Successful!
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Redirecting to your order...
                    </Typography>
                </>
            )}

            {uiState === "failed" && (
                <>
                    <Typography variant="h4" sx={{ color: "error.main", mb: 2, fontWeight: "bold" }}>
                        Payment Failed
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                        We couldn't process your payment. Please try again.
                    </Typography>
                    <Button variant="contained" onClick={handleBack} sx={{ backgroundColor: "#E44B4C", "&:hover": { backgroundColor: "#c83b3c" } }}>
                        Back to Menu
                    </Button>
                </>
            )}

            {uiState === "timeout" && (
                <>
                    <Typography variant="h4" sx={{ mb: 2, fontWeight: "bold" }}>
                        Still Processing...
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                        We're waiting for confirmation from Credimax. You can refresh or go back.
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2 }}>
                        <Button variant="outlined" onClick={() => window.location.reload()}>
                            Refresh
                        </Button>
                        <Button variant="contained" onClick={handleBack} sx={{ backgroundColor: "#E44B4C", "&:hover": { backgroundColor: "#c83b3c" } }}>
                            Back to Menu
                        </Button>
                    </Box>
                </>
            )}
        </Box>
    );
};

export default PaymentResultPage;
