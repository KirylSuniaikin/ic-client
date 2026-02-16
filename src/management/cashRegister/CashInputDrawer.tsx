import {CashUpdateType} from "../types/branchBalanceTypes";
import {Box, Button, Drawer, InputAdornment, TextField, Typography} from "@mui/material";
import {useState} from "react";

type Props = {
    type: CashUpdateType,
    open: boolean,
    onSubmit: (amount: number, type: CashUpdateType, note: string) => void,
    onClose: () => void,
}

export default function CashInputDrawer({type, open, onSubmit, onClose}: Props) {
    const [amountStr, setAmountStr] = useState<string>("");
    const [note, setNote] = useState<string>("");

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;

        if (val === "") {
            setAmountStr("");
            return;
        }


        if (/^\d*\.?\d{0,2}$/.test(val)) {
            setAmountStr(val);
        }
    };

    const handleSubmit = () => {
        const value = parseFloat(amountStr);
        if (!isNaN(value) && value > 0) {
            onSubmit(value, type, note);
            onClose();
        }
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{zIndex: 1350}}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: { sm: 500 },
                    mx: { sm: 'auto' },
                }
            }}
        >
            <Box sx={{ p: 3, pb: 4 }}>
                <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2, mx: 'auto', mb: 2 }} />

                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, textAlign: 'center' }}>
                    {type===CashUpdateType.CASH_IN ? "Add Cash": "Cash Out"}
                </Typography>

                <TextField
                    autoFocus
                    label="Amount"
                    fullWidth
                    variant="outlined"
                    value={amountStr}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                    inputProps={{ inputMode: 'decimal' }}
                    InputProps={{
                    startAdornment: <InputAdornment position="start">BD</InputAdornment>,
                    sx: {
                        borderRadius: 4,
                        fontSize: '1.2rem',
                        fontWeight: 'bold'
                    }
                }}
                    sx={{ mb: 3 }}
                />

                <TextField
                    autoFocus
                    label="Notes"
                    fullWidth
                    variant="outlined"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    sx={{ mb: 3,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 4
                        }
                    }}
                    type="note"
                />

                <Button
                    fullWidth
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!amountStr || parseFloat(amountStr) <= 0}
                    sx={{
                        borderRadius: 3,
                        py: 1.5,
                        bgcolor: CashUpdateType.CASH_IN  ? '#32a852' : '#E44B4C',
                        color: 'white',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        boxShadow: 'none',
                        '&:hover': {
                            bgcolor: type === CashUpdateType.CASH_IN ? '#2b8f46' : '#c73c3d',
                            boxShadow: 'none'
                        },
                    }}
                >
                    Confirm {type === CashUpdateType.CASH_IN ? "Deposit" : "Withdrawal"}
                </Button>
            </Box>
        </Drawer>
    )
}