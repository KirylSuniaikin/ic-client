import {Box, SwipeableDrawer, Typography} from "@mui/material";
import React from "react";

type Props = {
    unavailableItems: string[]
    open: boolean
    onClose: () => void
}

const GRAY_TEXT = "#3A3A3A";

export function UnavailablePopup({unavailableItems, open, onClose}: Props) {
    return (
        <SwipeableDrawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            onOpen={() => {}}
            disableDiscovery
            keepMounted
        >
            <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                <Box sx={{ width: 36, height: 4, borderRadius: 999, bgcolor: "grey.400" }} />
            </Box>

            <Box
                sx={{
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 1
                }}
            >
            </Box>
            <Box sx={{ px: 2, pt: 0.5, pb: 1.5 }}>
                <Typography
                    sx={{
                        textAlign: "center",
                        fontWeight: 900,
                        color: GRAY_TEXT,
                        fontSize: 22,
                        lineHeight: 1.4
                    }}
                >
                    Unfortunately {unavailableItems.toString()} {unavailableItems.length>1 ? "are unavailable" : "is unavailable"} right now
                </Typography>
            </Box>
        </SwipeableDrawer>
    )

}