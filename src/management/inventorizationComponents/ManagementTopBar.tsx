import * as React from "react";
import { AppBar, Toolbar, IconButton, Typography, Button, Box } from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";

type Props = {
    title?: React.ReactNode;
    newButtonLabel?: string;
    onClose?: () => void;
    onNewClick?: () => void;
};

export function ManagementTopBar({
                                   title = "Purchase",
                                   newButtonLabel = "New",
                                   onClose = () => {},
                                   onNewClick = () => {},
                               }: Props) {
    return (
        <AppBar
            elevation={0}
            color="inherit"
            position="sticky"
            sx={{ borderBottom: 1, borderColor: "divider", backgroundColor: "#fbfaf6" }}
        >
            <Toolbar sx={{ gap: 1 }}>
                <IconButton edge="start" onClick={onClose} aria-label="close" size="small">
                    <ArrowBackIosNewRoundedIcon />
                </IconButton>

                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {title}
                </Typography>

                <Box flex={1} />

                <Button
                    variant="contained"
                    onClick={onNewClick}
                    sx={{ borderRadius: 4, textTransform: "none", fontWeight: 700, bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e" } }}
                >
                    {newButtonLabel}
                </Button>
            </Toolbar>
        </AppBar>
    );
}
