import {Box, Button, Dialog, IconButton, Stack, TextField, Typography} from "@mui/material";
import CloseIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import React from "react";


type Props = {
    onClose: () => void;
    title: string;
    handleSave: () => void;
    saving: boolean;
    onAddNewRow: () => void;
}
export function TableTopBar({ title, handleSave, onClose, saving, onAddNewRow }: Props) {
    return (
            <Stack direction="row" gap={2} alignItems="center" sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
                <TextField
                    value={title}
                    variant="standard"
                    size="small"
                    sx={{ minWidth: 180, fontWeight: 700 }}
                    inputProps={{ style: { fontWeight: 700, fontSize: "1.1rem" } }}
                />
                <Box flex={1} />
                <Button
                    variant="contained"
                    onClick={() => onAddNewRow}
                    sx={{ bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e"}, borderRadius: 4 }}
                >
                    Add
                </Button>
                <Button variant="contained"
                        sx={{ bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e"}, borderRadius: 4 }}
                        onClick={handleSave}
                >
                    {saving ? "Saving..." : "Save"}
                </Button>
            </Stack>
    )
}
