import React from "react";
import {
    Box,
    Card,
    CardActionArea,
    CardContent,
    Typography,
    useTheme,
} from "@mui/material";
import LocalAtmIcon from "@mui/icons-material/LocalAtm";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import CreditScoreIcon from "@mui/icons-material/CreditScore";

const BRAND_RED = "#E44B4C";

export type PaymentMethod =
    | "Cash"
    | "Card (Through card machine)"
    | "Benefit"
    | "Online";

interface PaymentOptionCardProps {
    selected: boolean;
    onClick: () => void;
    title: string;
    subtitle: string;
    visual: React.ReactNode;
}

function PaymentOptionCard({
    selected,
    onClick,
    title,
    subtitle,
    visual,
}: PaymentOptionCardProps): JSX.Element {
    const theme = useTheme();

    return (
        <Card
            sx={{
                border: selected
                    ? `2px solid ${BRAND_RED}`
                    : `2px solid ${theme.palette.divider}`,
                boxShadow: selected ? 4 : 1,
                borderRadius: 2,
                transition: "border-color 0.15s ease",
                "&:hover": {
                    borderColor: selected ? BRAND_RED : theme.palette.grey[400],
                },
            }}
        >
            <CardActionArea onClick={onClick} aria-pressed={selected} sx={{ height: "100%" }}>
                <CardContent
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.5,
                        py: 2,
                    }}
                >
                    {visual}
                    <Typography variant="body1" fontWeight={600}>
                        {title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {subtitle}
                    </Typography>
                </CardContent>
            </CardActionArea>
        </Card>
    );
}

interface PaymentMethodSelectorProps {
    value: PaymentMethod | null;
    onChange: (method: PaymentMethod) => void;
}

const PAYMENT_OPTIONS: {
    method: PaymentMethod;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
}[] = [
    {
        method: "Cash",
        title: "Pay at restaurant",
        subtitle: "Pay at counter",
        icon: <LocalAtmIcon sx={{ fontSize: 32, color: BRAND_RED }} />,
    },
    {
        method: "Online",
        title: "Online Payment",
        subtitle: "ApplePay, GooglePay",
        icon: <CreditScoreIcon sx={{ fontSize: 32, color: BRAND_RED }} />,
    },
];

function PaymentMethodSelector({
    value,
    onChange,
}: PaymentMethodSelectorProps): JSX.Element {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 1.5,
            }}
        >
            {PAYMENT_OPTIONS.map((option) => (
                <PaymentOptionCard
                    key={option.method}
                    selected={value === option.method}
                    onClick={() => onChange(option.method)}
                    title={option.title}
                    subtitle={option.subtitle}
                    visual={option.icon}
                />
            ))}
        </Box>
    );
}

export default PaymentMethodSelector;
