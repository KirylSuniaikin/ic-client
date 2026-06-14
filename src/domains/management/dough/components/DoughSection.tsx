import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Grid, IconButton, Switch, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import type { DoughInventory, DoughType } from "../types";

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
    card?: boolean;
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
                                         card = false,
                                     }: DoughSectionProps): JSX.Element {
    const toRaw = (inv: DoughInventory): Record<DoughType, string> =>
        Object.fromEntries(DOUGH_TYPES.map(t => [t, String(inv[t])])) as Record<DoughType, string>;

    const [rawValues, setRawValues] = useState<Record<DoughType, string>>(() => toRaw(inventory));

    useEffect(() => {
        setRawValues(toRaw(inventory));
    }, [inventory]);

    const inner = (
        <Box
            sx={{
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
                                    <Box sx={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                const newVal = Math.max(0, amount - 1);
                                                setRawValues(prev => ({ ...prev, [type]: String(newVal) }));
                                                onInventoryChange(type, newVal);
                                            }}
                                            sx={{ p: "2px" }}
                                        >
                                            <RemoveIcon fontSize="small" />
                                        </IconButton>
                                        <TextField
                                            type="text"
                                            inputMode="numeric"
                                            value={rawValues[type]}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                // Negative input is clamped to 0 per FR7 ("count cannot go below 0")
                                                if (raw.includes('-')) {
                                                    setRawValues(prev => ({ ...prev, [type]: '0' }));
                                                    onInventoryChange(type, 0);
                                                    return;
                                                }
                                                const str = raw.replace(/[^0-9]/g, '');
                                                setRawValues(prev => ({ ...prev, [type]: str }));
                                                const parsed = parseInt(str, 10);
                                                onInventoryChange(type, isNaN(parsed) ? 0 : Math.max(0, parsed));
                                            }}
                                            inputProps={{ min: 0 }}
                                            variant="standard"
                                            sx={{
                                                flex: 1,
                                                "& .MuiInputBase-input": {
                                                    fontSize: "2.2rem",
                                                    fontWeight: 700,
                                                    lineHeight: 1,
                                                    letterSpacing: "-0.02em",
                                                    color: "text.primary",
                                                    p: 0,
                                                    textAlign: "center",
                                                    MozAppearance: "textfield",
                                                    "&::-webkit-outer-spin-button": { display: "none" },
                                                    "&::-webkit-inner-spin-button": { display: "none" },
                                                },
                                                "& .MuiInput-underline:before": { borderBottom: "none" },
                                                "& .MuiInput-underline:after": { borderBottom: "none" },
                                                "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottom: "none" },
                                            }}
                                        />
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                const newVal = Math.max(0, amount + 1);
                                                setRawValues(prev => ({ ...prev, [type]: String(newVal) }));
                                                onInventoryChange(type, newVal);
                                            }}
                                            sx={{ p: "2px" }}
                                        >
                                            <AddIcon fontSize="small" />
                                        </IconButton>
                                    </Box>

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

    if (card) {
        return (
            <Card
                sx={{
                    mb: 2,
                    border: "2px solid transparent",
                    borderRadius: 3,
                    alignSelf: "flex-start",
                    backgroundColor: "#fff",
                    boxShadow: 3,
                }}
            >
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    {inner}
                </CardContent>
            </Card>
        );
    }

    return <Box sx={{ mb: 2, width: "100%" }}>{inner}</Box>;
}
