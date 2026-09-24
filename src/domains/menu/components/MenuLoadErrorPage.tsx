import { Box, Button, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

const brandRed = "#E44B4C";
const brandRedHover = "#CC4344";

interface MenuLoadErrorPageProps {
    title: string;
    message: string;
    reloadLabel: string;
}

/**
 * Shown in place of the menu when the initial fetch fails (server briefly unreachable, cold
 * start, etc.) — previously a raw "Error: Failed to fetch" div, which read as the site being
 * broken rather than a transient hiccup. fetchBaseAppInfo (public.ts) already retries twice
 * before giving up, so reaching this page means those retries were exhausted too. Full-viewport
 * like PizzaLoader so it doesn't jar against the loader it replaces.
 */
export function MenuLoadErrorPage({ title, message, reloadLabel }: MenuLoadErrorPageProps): JSX.Element {
    return (
        <Box
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                backgroundColor: "#fff",
                zIndex: 9999,
                padding: 4,
            }}
        >
            <Typography sx={{ fontSize: "4rem", mb: 2, lineHeight: 1 }} aria-hidden="true">
                😔
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="#1A1A24" sx={{ mb: 1 }}>
                {title}
            </Typography>
            <Typography variant="body1" color="textSecondary" sx={{ mb: 4, maxWidth: 400 }}>
                {message}
            </Typography>
            <Button
                variant="contained"
                size="large"
                startIcon={<RefreshIcon />}
                onClick={() => window.location.reload()}
                sx={{
                    borderRadius: "10px",
                    backgroundColor: brandRed,
                    textTransform: "none",
                    fontSize: "1.05rem",
                    fontWeight: "bold",
                    px: 4,
                    py: 1.5,
                    "&:hover": { backgroundColor: brandRedHover },
                }}
            >
                {reloadLabel}
            </Button>
        </Box>
    );
}
