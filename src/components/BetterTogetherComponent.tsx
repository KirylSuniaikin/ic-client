import {MenuItem} from "../management/types/menuTypes";
import {Box, Button, Typography} from "@mui/material";
import React from "react";

type BetterTogetherProps = {
    betterTogether: MenuItem[],
    selectedItems: Record<string, number>,
    increaseQuantityOnCrossSell: (name: string) => void;
    decreaseQuantityOnCrossSell: (name: string) => void;
}

const brandRed = "#E44B4C";
const brandGray = "#F5F5F5";

export function BetterTogetherComponent({betterTogether, selectedItems, increaseQuantityOnCrossSell, decreaseQuantityOnCrossSell}: BetterTogetherProps) {
    return (
        <Box>
            <Typography variant="subtitle1" sx={{fontWeight: "bold", mb: 1, px: 0.2}}>
                Better together
            </Typography>

            <Box
                sx={{
                    display: "flex",
                    overflowX: "auto",
                    gap: 1,
                    mb: 2,
                    py: 1,
                    px: 0.2,
                    scrollSnapType: "x mandatory",
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": {
                        display: "none"
                    }
                }}
            >
                {betterTogether.map((item) => {
                    const active = selectedItems[item.name] != null;
                    return (
                        <Box
                            key={item.name}
                            onClick={() => {
                                if (!active) {
                                    increaseQuantityOnCrossSell(item.name);
                                }
                            }}
                            sx={{
                                width: 140,
                                flexShrink: 0,
                                textAlign: "center",
                                p: 2,
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: "13px",
                                color: "#000",
                                boxShadow: active
                                    ? `0 0 0 2px ${brandRed}`
                                    : "0 1px 3px rgba(0,0,0,0.25)",
                                border: "none",
                                "&:hover": {
                                    boxShadow: active
                                        ? `0 0 0 2px ${brandRed}`
                                        : "0 2px 5px rgba(0,0,0,0.2)"
                                }
                            }}
                        >
                            {item.photo ? (
                                <img
                                    src={item.photo}
                                    alt={item.name}
                                    style={{
                                        maxWidth: "100%",
                                        height: 120,
                                        objectFit: "contain"
                                    }}
                                />
                            ) : (
                                <Box
                                    sx={{
                                        width: "100%",
                                        height: 60,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: "#f9f9f9"
                                    }}
                                />
                            )}
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: "bold",
                                    mt: 1,
                                    overflowWrap: "break-word",
                                    wordWrap: "break-word",
                                    whiteSpace: "normal",
                                    lineHeight: 1.2
                                }}
                            >
                                {item.name}
                            </Typography>
                            {!active &&
                                <Typography variant="body2" sx={{mt: 1.2}}>
                                    +{item.price}
                                </Typography>
                            }
                            {active &&
                                <Box
                                    sx={{
                                        backgroundColor: brandGray,
                                        borderRadius: 8,
                                        p: "4px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "4px",
                                        height: 30,
                                        mt: 1.1,
                                        maxWidth: "130px",
                                    }}
                                >
                                    <Button
                                        onClick={() => decreaseQuantityOnCrossSell(item.name)}
                                        sx={{
                                            minWidth: 36,
                                            height: 26,
                                            backgroundColor: "transparent",
                                            color: "#666",
                                            fontSize: "16px",
                                            textTransform: "none",
                                            borderRadius: 8,
                                            p: 0,
                                            "&:hover": {
                                                backgroundColor: "rgba(0,0,0,0.1)"
                                            }
                                        }}
                                    >
                                        –
                                    </Button>
                                    <Box sx={{
                                        minWidth: 22,
                                        textAlign: "center",
                                        fontSize: "15px",
                                        color: "#666"
                                    }}>
                                        {selectedItems[item.name]}
                                    </Box>
                                    <Button
                                        onClick={() => increaseQuantityOnCrossSell(item.name)}
                                        sx={{
                                            minWidth: 36,
                                            height: 26,
                                            backgroundColor: "transparent",
                                            color: "#666",
                                            fontSize: "16px",
                                            textTransform: "none",
                                            borderRadius: 8,
                                            p: 0,
                                            "&:hover": {
                                                backgroundColor: "rgba(0,0,0,0.1)"
                                            }
                                        }}
                                    >
                                        +
                                    </Button>
                                </Box>
                            }

                        </Box>
                    );
                })}
            </Box>
        </Box>
    )

}