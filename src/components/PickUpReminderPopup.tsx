import {Box, Button, Stack, Typography} from "@mui/material";
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';

type Props = {
    onClose : () => void,
}

export function PickUpReminderPopup({onClose}: Props) {
    return (
        <Box
            onClick={onClose}
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 1300,
                backdropFilter: "blur(5px)",
                bgcolor: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 1
            }}
        >
        <Box
            sx={{
                width: "100%",
                maxWidth: "400px",
                bgcolor: "#fafafa",
                borderRadius: 4,
                boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                overflow: "hidden",
                p: 2,
                textAlign: "center"
            }}
        >
            <Stack spacing={2} alignItems="center" sx={{ p: 3, pt: 4, pb: 4 }}>
                <Box
                    sx={{
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 1
                    }}
                >
                    <PriorityHighRoundedIcon
                        sx={{ fontSize: 32, color: "#E44B4C" }}
                    />
                    <PriorityHighRoundedIcon
                        sx={{ fontSize: 32, color: "#E44B4C" }}
                    />
                    <PriorityHighRoundedIcon
                        sx={{ fontSize: 32, color: "#E44B4C" }}
                    />
                </Box>

                <Stack direction="row" alignItems="center" gap={1}>
                    <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                        Just a heads-up, we’re takeaway only!
                    </Typography>
                </Stack>

                <Typography variant="h6" color="text.primary" fontWeight="bold">
                    Please come inside the restaurant to pick up your order.
                </Typography>

                <Typography variant="h6" color="text.primary" fontWeight="bold" sx={{ lineHeight: 1.5 }}>
                    If we’re busy, please don’t honk. Just walk in, it really helps us keep the service smooth for you.
                </Typography>

                <Button
                    variant="contained"
                    size="large"
                    onClick={onClose}
                    sx={{
                        mt: 2,
                        borderRadius: 3,
                        bgcolor: "#E44B4C",
                        color: "white",
                        textTransform: "none",
                        fontWeight: "bold",
                        fontSize: "1rem",
                        "&:hover": { bgcolor: "#c93d3e" }
                    }}
                >
                    Alright
                </Button>
            </Stack>
        </Box>
        </Box>
    )
}