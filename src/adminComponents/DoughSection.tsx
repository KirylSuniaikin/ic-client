import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Grid, Switch, TextField, Typography } from "@mui/material";
import type { DoughInventory, DoughType } from "../management/types/doughInventoryTypes";

const DOUGH_LABELS: Record<string, string> = {
    S: "S Dough",
    M: "M Dough",
    L: "L Dough",
    Brick: "Brick Dough",
};

const DOUGH_TYPES: DoughType[] = ["S", "M", "L", "Brick"];

const AVAILABILITY_KEY: Record<DoughType, string> = {
    S: "S",
    M: "M",
    L: "L",
    Brick: "Brick dough",
};

type DoughAvailability = Record<string, boolean>;

interface DoughSectionProps {
    branchId: string;
    inventory: DoughInventory;
    availability: DoughAvailability;
    onInventoryChange: (type: DoughType, value: number) => void;
    onAvailabilityToggle: (size: string) => void;
    loading: boolean;
}

function getStatusColor(amount: number): string {
    if (amount >= 10) return "#34c759"; // iOS green
    if (amount >= 5)  return "#ff9f0a"; // iOS yellow
    return                 "#ff3b30";   // iOS red
}

export default function DoughSection({
                                         inventory,
                                         availability,
                                         onInventoryChange,
                                         onAvailabilityToggle,
                                         loading,
                                     }: DoughSectionProps): JSX.Element {
    const toRaw = (inv: DoughInventory): Record<DoughType, string> =>
        Object.fromEntries(DOUGH_TYPES.map(t => [t, String(inv[t])])) as Record<DoughType, string>;

    const [rawValues, setRawValues] = useState<Record<DoughType, string>>(() => toRaw(inventory));

    useEffect(() => {
        setRawValues(toRaw(inventory));
    }, [inventory]);

    return (
        <Box
            sx={{
                mb: 2,
                width: "100%",
                opacity: loading ? 0.5 : 1,
                pointerEvents: loading ? "none" : "auto",
                transition: "opacity 0.2s",
            }}
        >
            <Typography
                variant="caption"
                sx={{
                    display: "block",
                    fontWeight: 600,
                    color: "text.secondary",
                    mb: 1.5,
                    fontSize: "0.72rem",
                }}
            >
                Dough inventory
            </Typography>

            <Grid container spacing={1.25}>
                {DOUGH_TYPES.map((type) => {
                    const availabilityKey = AVAILABILITY_KEY[type];
                    const isAvailable = availability[availabilityKey] ?? false;
                    const amount = inventory[type];
                    const dotColor = getStatusColor(amount);

                    return (
                        <Grid size={{ xs: 6 }} key={type}>
                            <Card
                                variant="outlined"
                                sx={{
                                    borderRadius: "16px",
                                    borderColor: "divider",
                                    borderWidth: "0.5px",
                                    backgroundColor: "#fff",
                                    boxShadow: "none",
                                }}
                            >
                                <CardContent
                                    sx={{
                                        p: "14px 16px 12px",
                                        "&:last-child": { pb: "12px" },
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "6px",
                                    }}
                                >
                                    {/* Label + status dot */}
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <Typography
                                            sx={{
                                                fontSize: "0.72rem",
                                                fontWeight: 600,
                                                color: "text.secondary",
                                                letterSpacing: "0.01em",
                                            }}
                                        >
                                            {DOUGH_LABELS[type]}
                                        </Typography>
                                        <Box
                                            sx={{
                                                width: 7,
                                                height: 7,
                                                borderRadius: "50%",
                                                backgroundColor: dotColor,
                                                flexShrink: 0,
                                                transition: "background-color 0.3s",
                                            }}
                                        />
                                    </Box>

                                    {/* Amount */}
                                    <TextField
                                        type="text"
                                        inputMode="numeric"
                                        value={rawValues[type]}
                                        onChange={(e) => {
                                            const str = e.target.value.replace(/[^0-9]/g, '');
                                            setRawValues(prev => ({ ...prev, [type]: str }));
                                            const parsed = parseInt(str, 10);
                                            onInventoryChange(type, isNaN(parsed) ? 0 : Math.max(0, parsed));
                                        }}
                                        inputProps={{ min: 0 }}
                                        variant="standard"
                                        sx={{
                                            "& .MuiInputBase-input": {
                                                fontSize: "2.2rem",
                                                fontWeight: 700,
                                                lineHeight: 1,
                                                letterSpacing: "-0.02em",
                                                color: "text.primary",
                                                p: 0,
                                                MozAppearance: "textfield",
                                                "&::-webkit-outer-spin-button": { display: "none" },
                                                "&::-webkit-inner-spin-button": { display: "none" },
                                            },
                                            "& .MuiInput-underline:before": { borderBottom: "none" },
                                            "& .MuiInput-underline:after": { borderBottom: "none" },
                                            "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottom: "none" },
                                        }}
                                    />

                                    {/* Divider */}
                                    <Box sx={{ height: "0.5px", backgroundColor: "divider" }} />

                                    {/* Toggle row */}
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
                                            {isAvailable ? "Available" : "Unavailable"}
                                        </Typography>
                                        <Switch
                                            checked={isAvailable}
                                            onChange={() => onAvailabilityToggle(availabilityKey)}
                                            size="small"
                                            sx={{
                                                mr: -0.5,
                                                "& .MuiSwitch-switchBase.Mui-checked": { color: "#fff" },
                                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                                    backgroundColor: "#34c759",
                                                    opacity: 1,
                                                },
                                            }}
                                        />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>
        </Box>
    );
}
