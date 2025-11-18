import {useState} from "react";
import {
    Button,
    Typography,Drawer, Box, TextField
} from "@mui/material";
import {sendShiftEvent} from "../../api/api";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    stage: string;
    branchId: string;
    onCashWarning: (warning: string) => void;
}

export default function CashPopup({isOpen, onClose, stage, branchId, onCashWarning}: Props) {
    const [cash, setCash] = useState("");

    const handleSubmit = async () => {
        try {
            onClose();
            const data = await sendShiftEvent({
                type: stage,
                datetime: new Date().toISOString(),
                branch_id: branchId,
                cash_amount: parseFloat(cash),
                prep_plan: null,
            });

            if (data?.cashWarning) {
                onCashWarning(data.cashWarning);
                setTimeout(() => onCashWarning(null), 5000);
            } else {
                onCashWarning(null);
            }

            setCash('');

        } catch (error) {
            console.error('Error occurred while sending an shift event:', error);
        }
    };


    const getStageTitle = (stage: string) => {
        switch (stage) {
            case "OPEN_SHIFT_CASH_CHECK":
                return "Start Cash Balance";
            case "CLOSE_SHIFT_CASH_CHECK":
                return "End Cash Balance";
            default:
                return "Shift Step";
        }
    };

    return (

        <Drawer
            anchor="bottom"
            open={isOpen}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    p: 3,
                    backgroundColor: "#fff",
                    boxShadow: 6,
                    maxHeight: "85vh",
                    overflowY: "auto",
                },
            }}
        >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 ,  textAlign: "center" }}>
                {getStageTitle(stage)}
            </Typography>
                <>
                    <Box sx={{ pb: 7 }}>

                        <TextField
                            label="Cash Amount"
                            type="number"
                            inputMode="decimal"
                            value={cash}
                            onChange={e => setCash(e.target.value)}
                            fullWidth
                            placeholder="Cash Amount"
                            sx={{
                                borderRadius: 2,
                                backgroundColor: "#fff",
                                border: "1px solid #ddd",
                                mb: 2,
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: 2,
                                },
                            }}
                            InputProps={{ sx: { px: 2, py: 1.5 } }}
                        />
                    </Box>
                    <Box
                        sx={{
                            position: "fixed",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            p: 2,
                            backgroundColor: "#fff",
                            borderTop: "1px solid #eee",
                            zIndex: 1301,
                        }}
                    >
                        <Button
                            onClick={handleSubmit}
                            variant="contained"
                            fullWidth
                            disabled={!cash}
                            sx={{
                                backgroundColor: "#E44B4C",
                                borderRadius: "999px",
                                textTransform: "none",
                                fontWeight: "bold",
                                py: 1.25,
                                fontSize: "1rem",
                                '&:hover': {
                                    backgroundColor: '#c63b3c',
                                },
                            }}
                        >
                            Submit
                        </Button>
                    </Box>
                </>
        </Drawer>
    );
}
