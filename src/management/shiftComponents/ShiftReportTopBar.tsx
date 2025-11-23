import {AppBar, Box, Button, IconButton, Toolbar, Typography} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";


export function ShiftReportTopBar({onClose = () => {}, onNewClick = () => {}}) {
    return (
        <AppBar elevation={0} color="inherit" sx={{ borderBottom: 1, borderColor: "divider",
        }}>
            <Toolbar sx={{ gap: 1 }}>
                <IconButton edge="start" onClick={onClose} aria-label="close" size="small" sx={{borderColor: "divider"}}>
                    <ArrowBackIosNewRoundedIcon />
                </IconButton>

                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Shifts
                </Typography>

                <Box flex={1} />

                <Button
                    variant="contained"
                    onClick={onNewClick}
                    sx={{ borderRadius: 4, textTransform: "none", fontWeight: 700, bgcolor: "#E44B4C" }}
                >
                    New
                </Button>
            </Toolbar>
        </AppBar>
    )
}