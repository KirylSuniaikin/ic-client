import * as React from "react";
import { Box, Dialog, Drawer, IconButton, Typography, useMediaQuery } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import theme from "../../../../shared/utils/theme";

export interface ResponsiveSheetProps {
    open: boolean;
    onClose: () => void;
    /** Heading. Omit to render the close affordance only — for content that carries its own title. */
    title?: string;
    /** Secondary line under the title, e.g. who the action targets. */
    subtitle?: React.ReactNode;
    /** Widest the desktop dialog may grow. Phones always take the full width. */
    maxWidth?: number;
    testId?: string;
    children: React.ReactNode;
}

/**
 * One presentation shell for the management popups: a bottom sheet on a phone, a centred dialog
 * from `sm` up. Generalises the split TaskCardDrawer already makes inline — a bottom sheet on a
 * laptop strands its content against the bottom edge of a wide screen, and a centred dialog on a
 * phone is hard to reach one-handed.
 *
 * Callers supply only the body; the grabber, header, close button, radii, scroll behaviour and
 * safe-area padding live here so the popups cannot drift apart from each other again.
 */
export default function ResponsiveSheet({
    open,
    onClose,
    title,
    subtitle,
    maxWidth = 460,
    testId,
    children,
}: ResponsiveSheetProps): React.JSX.Element {
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const header = (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: title ? 2.5 : 0 }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                {title && (
                    <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, lineHeight: 1.25, color: "#1f2430" }}>
                        {title}
                    </Typography>
                )}
                {subtitle && (
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
                        {subtitle}
                    </Typography>
                )}
            </Box>
            <IconButton
                size="small"
                onClick={onClose}
                aria-label="Close"
                sx={{ mt: -0.5, mr: -1, color: "#8a8f98" }}
            >
                <CloseIcon fontSize="small" />
            </IconButton>
        </Box>
    );

    const content = (
        <Box
            data-testid={testId}
            sx={{
                px: 3,
                pt: isMobile ? 1.5 : 2.5,
                // Phones need the home-indicator inset; a dialog sits well clear of it.
                pb: isMobile ? "calc(24px + env(safe-area-inset-bottom))" : 3,
                // Rounding every field from the shell keeps the popups consistent without each
                // one repeating the same sx on every TextField and Select it happens to render.
                "& .MuiOutlinedInput-root": { borderRadius: "12px" },
                "& .MuiAlert-root": { borderRadius: "12px" },
            }}
        >
            {isMobile && (
                <Box sx={{ width: 40, height: 4, bgcolor: "#e3e1db", borderRadius: 2, mx: "auto", mb: 2 }} />
            )}
            {header}
            {children}
        </Box>
    );

    if (isMobile) {
        return (
            <Drawer
                anchor="bottom"
                open={open}
                onClose={onClose}
                sx={{ zIndex: 1350 }}
                PaperProps={{
                    sx: {
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        maxHeight: "92vh",
                        overflowY: "auto",
                        backgroundColor: "#fff",
                    },
                }}
            >
                {content}
            </Drawer>
        );
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            sx={{ zIndex: 1350 }}
            slotProps={{
                paper: {
                    elevation: 0,
                    sx: {
                        borderRadius: "18px",
                        maxWidth,
                        boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
                    },
                },
                backdrop: { sx: { backgroundColor: "rgba(15,23,42,0.35)" } },
            }}
        >
            {content}
        </Dialog>
    );
}
