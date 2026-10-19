import { Box, Button, IconButton, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { BRAND_RED } from "../../../shared/utils/theme";

// The phone cart's frame — header and red action button — shared with the payment page that
// follows it (owner, 19 Oct 2026), so the two read as one screen moving on. Moved out of
// CartComponent unchanged. The total line that sat above the button is gone: the total is in the
// button's own label now (owner, 19 Oct 2026).

// The full-screen paper on the phone. Key order matches the literal this replaced, so the phone's
// CSS class is unchanged.
export const SCREEN_ROOT_SX = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#FAFAFA",
} satisfies SxProps<Theme>;

interface ScreenHeaderProps {
    title: string;
    onBack: () => void;
    /** The back button's accessible name. The cart's never had one; the payment page's says "Back". */
    backLabel?: string;
}

export function ScreenHeader({ title, onBack, backLabel }: ScreenHeaderProps): JSX.Element {
    return (
        <Box
            sx={{
                position: "relative",
                height: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 2,
                backgroundColor: "#fafafa",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
        >
            <Box
                sx={{
                    position: "absolute",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <IconButton
                    onClick={onBack}
                    aria-label={backLabel}
                    sx={{ color: BRAND_RED, ml: 1.3, p: 0 }}
                >
                    <ArrowBackIosNewIcon fontSize="medium" />
                </IconButton>
                <Box
                    sx={{
                        width: "1px",
                        height: "100%",
                        backgroundColor: "#ccc",
                        ml: 1,
                    }}
                />
            </Box>
            <Typography variant="h5">{title}</Typography>
        </Box>
    );
}

// One size for every button at the foot of the cart and the payment page, ours and Apple's, so the
// two read as one family and switching to Apple Pay does not move the button (owner, 19 Oct 2026:
// ours was the shorter one). 48px is Apple's own button's height, well above its 30px minimum.
export const PAY_BUTTON_HEIGHT = 48;
// In px. Apple's guidelines let its button's corner radius match the buttons around it.
export const PAY_BUTTON_RADIUS = 16;

// The strip both buttons sit in: 24px in from each side, on the content's edge, under the hairline
// the total line used to draw between the scrolling content and the button.
export const PAY_BUTTON_SLOT_SX = {
    flexShrink: 0,
    px: 3,
    py: 2,
    borderTop: "1px solid #eee",
} satisfies SxProps<Theme>;

interface ActionButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

/** The red button at the foot of the cart and the payment page. */
export function ActionButton({ label, onClick, disabled = false }: ActionButtonProps): JSX.Element {
    return (
        <Box sx={PAY_BUTTON_SLOT_SX}>
            <Button
                variant="contained"
                onClick={onClick}
                disabled={disabled}
                sx={{
                    backgroundColor: BRAND_RED,
                    color: "#fff",
                    textTransform: "none",
                    fontWeight: "bold",
                    height: PAY_BUTTON_HEIGHT,
                    borderRadius: `${PAY_BUTTON_RADIUS}px`,
                    width: "100%",
                    "&:hover": { backgroundColor: BRAND_RED },
                }}
            >
                {label}
            </Button>
        </Box>
    );
}
