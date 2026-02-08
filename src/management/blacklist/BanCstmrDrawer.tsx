import {useState} from "react";
import {Box, Button, Drawer, Stack, TextField, Typography} from "@mui/material";

type Props = {
    open: boolean,
    onClose: () => void,
    onSubmit: (telephone: string) => void,
}

export default function BanCstmrDrawer({open, onClose, onSubmit}: Props) {
    const [telephone, setTelephone] = useState<string>("")
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
                    Block Customer
                </Typography>

                <TextField
                    autoFocus
                    label="Phone Number"
                    fullWidth
                    variant="outlined"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    sx={{ mb: 3,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 4
                        }
                    }}
                    type="tel"
                />


                    <Button
                        fullWidth
                        variant="contained"
                        onClick={() => {
                            onSubmit(telephone)
                            setTelephone("")
                        }}
                        disabled={!telephone}
                        sx={{
                            borderRadius: 4,
                            py: 1.5,
                            bgcolor: '#E44B4C',
                            '&:hover': { bgcolor: '#c73c3d' },
                            fontWeight: 'bold'
                        }}
                    >
                        Add to Blacklist
                    </Button>
            </Box>
        </Drawer>
    )
}