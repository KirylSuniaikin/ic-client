import {Box, Button} from "@mui/material";


export default function ShiftTopbar({ stage, onClick }) {
    const getStageData = (stage) => {
        switch (stage) {
            case "OPEN_SHIFT_CASH_CHECK":
            case "CLOSE_SHIFT_CASH_CHECK":
                return "Cash Check";
            case "OPEN_SHIFT_EVENT":
                return "Open Shift";
            case "CLOSE_SHIFT_EVENT":
                return "Close Shift";
            default:
                return "";
        }
    };

    const label = getStageData(stage);

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                px: 1,
                py: 1,
                borderBottom: "1px solid #ddd",
                position: "sticky",
                top: 0,
                zIndex: 10,
            }}
        >
            {label && (
                <Button
                    onClick={onClick}
                    variant="outlined"
                    size="small"
                    sx={{
                        textTransform: "none",
                        borderRadius: "999px",
                        fontWeight: 500,
                        fontSize: "0.8rem",
                        px: 2,
                        py: 0.5,
                        color: "#E44B4C",
                        borderColor: "#E44B4C",
                        '&:hover': {
                            backgroundColor: "#fff5f5",
                            borderColor: "#c63b3c",
                        },
                    }}
                >
                    {label}
                </Button>
            )}
        </Box>
    );
}
