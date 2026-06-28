import {Box, Typography} from "@mui/material";
import React from "react";
import {useLocalizedItem} from "../../../shared/hooks/useLocalizedItem";

type Props = {
    toppings: Topping[],
    selectedToppings: string[],
    onUpdateSelectedToppings : (updateFn: (prev: string[]) => string[]) => void;
}

type Topping = {
    id: number,
    photo: string,
    name: string,
    name_ar?: string | null,
    price: number,
    available: boolean,
}

const brandRed = "#E44B4C";

export function ToppingsScroll({toppings, selectedToppings, onUpdateSelectedToppings}: Props) {
    const {name: localizeName} = useLocalizedItem();
    const handleToggleIngr = (name: string) => {
        if (selectedToppings.includes(name)) {
            onUpdateSelectedToppings((prev) => prev.filter((x) => x !== name));
        } else {
            onUpdateSelectedToppings((prev) => [...prev, name]);
        }
    };

    return (
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
                    display: "none",
                },
            }}
        >
            {toppings.map((topping) => {
                const active = selectedToppings.includes(topping.name);
                return (
                    <Box
                        key={topping.name}
                        onClick={() => handleToggleIngr(topping.name)}
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
                        {topping.photo ? (
                            <img
                                src={topping.photo}
                                alt={localizeName(topping)}
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
                                    height: 120,
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
                            {localizeName(topping)}
                        </Typography>
                        <Typography variant="body2" sx={{mt: 0.5}}>
                            +{topping.price}
                        </Typography>
                    </Box>
                );
            })}

        </Box>
    )

}
