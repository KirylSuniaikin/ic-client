import {AppBar, Box, Button, IconButton, Toolbar, Typography} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import * as React from "react";

type BackTopBarProps = {
    title: string;
    onClose: () => void;
    onAdd?: () => void;
}

export function BackTopBar({title, onClose, onAdd}: BackTopBarProps) {
    return (<AppBar
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

            {onAdd && (
                <>
                    <Box flex={1} />

                    <Button
                        variant="contained"
                        onClick={onAdd}
                        sx={{ borderRadius: 4, textTransform: "none", fontWeight: 700, bgcolor: "#E44B4C", "&:hover": { bgcolor: "#c93d3e" } }}
                    >
                        Add
                    </Button>
                </>
            )}

        </Toolbar>
    </AppBar>)
}