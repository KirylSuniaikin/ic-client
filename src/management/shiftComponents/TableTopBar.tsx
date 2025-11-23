import {Box, Button, IconButton, Stack, Typography} from "@mui/material";
import CloseIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import React from "react";


type Props = {
    onClose: () => void;
    title: string;
    handleSave: () => void;
    total: number;
    saving: boolean;
}
export function TableTopBar({ title, handleSave, onClose, total, saving }: Props) {
    return (
    <Stack direction="row" gap={2} alignItems="center" sx={{p: 2, borderBottom: 1, borderColor: "divider"}}>
        <IconButton onClick={onClose}>
            <CloseIcon/>
        </IconButton>
        <Typography
            variant="body1"
            sx={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
            }}
        >
            {title}
        </Typography>
        <Box flex={1}/>
        <Typography>Total: <b>{total}</b></Typography>

        <Button variant="contained"
                sx={{bgcolor: "#E44B4C", "&:hover": {bgcolor: "#c93d3e"}, borderRadius: 4}}
                onClick={handleSave}
        >
            {saving ? "Saving..." : "Save"}
        </Button>
    </Stack>
    )
}