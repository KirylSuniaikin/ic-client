import {Box, Typography,  Button} from "@mui/material";




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

    // const { label, icon } = getStageData();

    // return (
    //     <Paper
    //         onClick={onClick}
    //         elevation={3}
    //         sx={{
    //             position: "fixed",
    //             top: 0,
    //             left: 0,
    //             width: "100%",
    //             zIndex: 1100,
    //             bgcolor: "#fff",
    //             display: "flex",
    //             alignItems: "center",
    //             justifyContent: "space-between",
    //             px: 2,
    //             py: 1.2,
    //             borderBottom: "2px solid #E44B4C",
    //             cursor: "pointer",
    //             userSelect: "none",
    //             touchAction: "manipulation",
    //             transition: "background-color 0.2s",
    //             "&:active": {
    //                 backgroundColor: "#f9f9f9",
    //             },
    //         }}
    //     >
    //         <Box display="flex" alignItems="center" gap={1}>
    //             {icon}
    //             <Typography variant="subtitle1" fontWeight="bold" color="#E44B4C">
    //                 {label}
    //             </Typography>
    //         </Box>
    //     </Paper>
    // );
}
