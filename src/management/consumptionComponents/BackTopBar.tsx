import {AppBar, IconButton, Toolbar, Typography} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import * as React from "react";

type BackTopBarProps = {
    title: string;
    onClose: () => void;
}

export function BackTopBar({title, onClose}: BackTopBarProps) {
    return (<AppBar
        elevation={0}
        color="inherit"
        position="sticky"
        sx={{ borderBottom: 1, borderColor: "divider" }}
    >
        <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={onClose} aria-label="close" size="small">
                <ArrowBackIosNewRoundedIcon />
            </IconButton>

            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {title}
            </Typography>

        </Toolbar>
    </AppBar>)
}