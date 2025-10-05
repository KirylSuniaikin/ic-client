import {Box, Button, TextField, ToggleButton, ToggleButtonGroup, Typography} from "@mui/material";
import React from "react";

const brandRed = "#E44B4C";
const brandGray = "#f3f3f3";

export function ItemCard ({ item,
                              onChange,
                              fixed,
                              dough,
                              crust,
                              onDoughChange,
                              onCrustChange,
                              description,
                              setDescription
                            }) {

    if (!item) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 2.5,
                    mb: 2,
                    bgcolor: "#fff",
                    borderRadius: 5,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                    minHeight: 120,
                }}
            >
                <Typography color="text.secondary">No item available</Typography>
            </Box>
        );
    }
    return(
        <Box
            sx={{
                p: 2.5,
                mb: 2,
                bgcolor: "#fff",
                borderRadius: 5,
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "flex-start" }}>
                <img
                    src={item.photo}
                    alt={item?.name}
                    style={{
                        width: 120,
                        height: 120,
                        objectFit: "cover",
                        borderRadius: 12,
                    }}
                />

                <Box
                    sx={{
                        ml: 2,
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        minHeight: 120,
                    }}
                >
                    <Box>
                        <Typography fontWeight="500" sx={{ mb: 0.5 }}>
                            {item?.name}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {item.description || " "}
                        </Typography>
                    </Box>

                    {!fixed && (
                        <Button
                            variant="outlined"
                            size="small"
                            sx={{
                                color: brandRed,
                                backgroundColor: "#ffe5e6",
                                borderColor: "white",
                                textTransform: "none",
                                fontSize: "15px",
                                borderRadius: 8,
                                "&:hover": { backgroundColor: "#d23f40" },
                                alignSelf: "flex-start",
                                mt: 1,
                            }}
                            onClick={onChange}
                        >
                            Change
                        </Button>
                    )}
                </Box>
            </Box>

            {item.category === "Pizzas" && (
                <Box sx={{ mt: 2 }}>
                    {item.size !== "S" && (
                        <>
                            <ToggleButtonGroup
                                exclusive
                                value={dough}
                                onChange={(e, val) => val && onDoughChange(val)}
                                sx={{ backgroundColor: brandGray, borderRadius: "9999px", p: "4px", mb: 1, "& .MuiToggleButtonGroup-grouped": { border: 0, flex: 1, borderRadius: "9999px", mr: "4px", "&:not(:last-of-type)": { borderRight: "none" }, }, }}
                                fullWidth
                            >
                                {["Traditional Dough", "Thin Dough"].map((d) => (
                                    <ToggleButton key={d} value={d} sx={{ textTransform: "none", fontSize: "13px", justifyContent: "center", color: "#666", borderRadius: "9999px", height: 30, "&:hover": { backgroundColor: "transparent" }, "&.Mui-selected": { backgroundColor: "#fff", color: brandRed, boxShadow: "0 2px 4px rgba(0,0,0,0.25)", "&:hover": { backgroundColor: "#fff" }, }, }}>
                                        {d}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </>
                    )}

                    <ToggleButtonGroup
                        exclusive
                        value={crust}
                        onChange={(e, val) => val && onCrustChange(val)}
                        sx={{ backgroundColor: brandGray, borderRadius: "9999px", p: "4px", mb: 1, "& .MuiToggleButtonGroup-grouped": { border: 0, flex: 1, borderRadius: "9999px", mr: "4px", "&:not(:last-of-type)": { borderRight: "none" }, }, }}
                        fullWidth
                    >
                        {["Classic Crust", "Garlic Crust"].map((c) => (
                            <ToggleButton key={c} value={c} sx={{ textTransform: "none", fontSize: "13px", justifyContent: "center", color: "#666", borderRadius: "9999px", height: 30, "&:hover": { backgroundColor: "transparent" }, "&.Mui-selected": { backgroundColor: "#fff", color: brandRed, boxShadow: "0 2px 4px rgba(0,0,0,0.25)", "&:hover": { backgroundColor: "#fff" }, }, }}>
                                {c}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>

                    <TextField
                        label="Add a note"
                        fullWidth
                        multiline
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        sx={{mb: 3, mt:2}}
                        InputProps={{sx: {borderRadius: 4}}}
                    />
                </Box>
            )}
        </Box>
    );
}