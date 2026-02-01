import {IBranch} from "../management/types/inventoryTypes";
import {Box, Button, CircularProgress, Stack, Typography} from "@mui/material";
import StorefrontIcon from '@mui/icons-material/Storefront';

type Props = {
    open: boolean,
    branches: IBranch[],
    onSelect: (branch: IBranch) => void
}

export const KioskBranchSelector = (props: Props) => {

    return (
        <Box
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 99999,
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(15px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                animation: "fadeIn 0.3s ease-in-out"
            }}
        >
            <Box
                sx={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    p: 4,
                    borderRadius: 4,
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                    maxWidth: 500,
                    width: "90%",
                    textAlign: "center"
                }}
            >
                <StorefrontIcon sx={{ fontSize: 60, color: "#E44B4C", mb: 2 }} />

                <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ color: "#000" }}>
                    Setup Kiosk Mode
                </Typography>

                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    Please select the branch for this device.<br/>
                    This setting will be saved automatically.
                </Typography>

                    <Stack spacing={2}>
                        {props.branches.map((branch) => (
                            <Button
                                key={branch.id}
                                variant="contained"
                                size="large"
                                onClick={() => props.onSelect(branch)}
                                sx={{
                                    py: 2,
                                    fontSize: "1.2rem",
                                    borderRadius: 3,
                                    backgroundColor: "#fff",
                                    color: "#000",
                                    border: "2px solid #eee",
                                    boxShadow: "none",
                                    "&:hover": {
                                        backgroundColor: "#E44B4C",
                                        color: "#fff",
                                        border: "2px solid #E44B4C",
                                    }
                                }}
                            >
                                {branch.branchName}
                            </Button>
                        ))}
                    </Stack>
            </Box>
        </Box>
    )
}