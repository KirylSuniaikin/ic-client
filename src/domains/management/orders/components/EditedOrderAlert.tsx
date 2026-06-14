import React from 'react';
import { Box, IconButton, Paper, Snackbar, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Order } from '../../../order/types';

interface EditedOrderAlertProps {
    editedOrder: Order | null;
    onClose: () => void;
}

export function EditedOrderAlert({ editedOrder, onClose }: EditedOrderAlertProps): JSX.Element {
    return (
        <Snackbar
            open={Boolean(editedOrder)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            sx={{ zIndex: 1300 }}
        >
            <Paper
                elevation={3}
                sx={{
                    borderRadius: 3,
                    p: 2,
                    px: 3,
                    backgroundColor: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    width: '85vw',
                    maxWidth: 600,
                }}
            >
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Order {editedOrder?.order_no} was edited
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="medium" sx={{ color: '#E44B4C' }}>
                    <CloseIcon />
                </IconButton>
            </Paper>
        </Snackbar>
    );
}
