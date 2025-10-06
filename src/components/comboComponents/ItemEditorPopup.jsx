import React, { useState } from "react";
import {
    Box,
    Typography,
    Button,
    IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const brandRed = "#E44B4C";

function ItemEditorPopup({ open, onClose, items, size, onSave, target, dough: initialDough, crust: initialCrust }) {
    const [selectedItem, setSelectedItem] = useState(items[0]);
    const [dough, setDough] = useState(initialDough || "Traditional");
    const [crust, setCrust] = useState(initialCrust || "Classic Crust");

    function handleConfirm() {
        if (!selectedItem) return;
        onSave({
            item: selectedItem,
            size,
            dough,
            crust,
        });
        onClose();
    }

    if (!open) return null;

    return (
        <Box
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 2000,
                backdropFilter: "blur(6px)",
                backgroundColor: "rgba(0,0,0,0.3)",
            }}
            onClick={onClose}
        >
            <Box
                sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    p: 2,
                    width: "100%",
                    maxHeight: "85vh",
                    bgcolor: "#fff",
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    display: "flex",
                    flexDirection: "column",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        color: "#666",
                    }}
                >
                    <CloseIcon />
                </IconButton>

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 1,
                        flex: 1,
                        overflowY: "auto",
                        mt: 4,
                        pb: 2,
                    }}
                >
                    {items.map((it) => {
                        const isSelected = selectedItem?.id === it.id;

                        return (
                            <Box
                                key={it.id}
                                onClick={() => setSelectedItem(it)}
                                sx={{
                                    border: isSelected ? `2px solid ${brandRed}` : "1px solid #eee",
                                    borderRadius: 3,
                                    p: 1,
                                    textAlign: "center",
                                    cursor: "pointer",
                                }}
                            >
                                <Box
                                    component="img"
                                    src={it.photo}
                                    alt={it.name}
                                    sx={{
                                        width: "100%",
                                        height: "auto",
                                        maxWidth: { xs: 320, sm: 800, md: 900, lg: 1000 },
                                        maxHeight: { xs: 320, sm: 600, md: 400, lg: 480 },
                                        objectFit: "contain",
                                        display: "block",
                                        mx: "auto",
                                        mb: 2,
                                    }}
                                />
                                    <Typography sx={{ mt: 1, fontWeight: 500 }}>
                                        {it.name}
                                    </Typography>
                            </Box>
                        );
                    })}
                </Box>

                {/* Кнопка Add */}
                <Button
                    fullWidth
                    variant="contained"
                    sx={{
                        mt: 1,
                        backgroundColor: brandRed,
                        color: "#fff",
                        borderRadius: "9999px",
                        fontWeight: 600,
                    }}
                    onClick={handleConfirm}
                >
                    Add
                </Button>
            </Box>
        </Box>
    );
}

export default ItemEditorPopup;








