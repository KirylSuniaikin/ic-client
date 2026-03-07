import {Box, Button, Stack, Typography} from "@mui/material";
import PriorityHighRoundedIcon from "@mui/icons-material/PriorityHighRounded";

type Props = {
    open: boolean;
    onClose: () => void;
}

export function RamadanInfoPopup({open, onClose}: Props) {
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
                            We’d like to let you know that our mini pizzas require a little
                            extra preparation time to ensure they are served fresh
                        </Typography>
                    </Stack>

                    <Stack direction="row" alignItems="center" gap={1}>
                        <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                            نود إعلامكم بأن الميني بيتزا تحتاج إلى وقت بسيط للتحضير، وذلك لضمان تقديمها طازجة وبأفضل
                            جودة ممكنة. نشكركم على صبركم وتفهمكم، ونتمنى أن تنال إعجابكم.
                            شاكرين دعمكم وثقتكم بنا.
                        </Typography>
                    </Stack>

                </Stack>
            </Box>
        </Box>
    )
}