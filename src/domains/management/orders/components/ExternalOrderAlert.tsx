import React from 'react';
import {
    Box,
    Button,
    IconButton,
    Paper,
    Snackbar,
    TextField,
    Typography,
} from '@mui/material';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloseIcon from '@mui/icons-material/Close';
import { sortItemsByCategory, renderItemDetails } from './OrderCard';
import { getExternalOrderId, getOrderDisplayId } from '../hooks/useOrderActions';
import type { Order } from '../../../order/types';

const COLOR_RED = '#E44B4C';

interface ExternalOrderAlertProps {
    alertOrder: Order | null;
    /** Called when the user dismisses without confirming: stops sound and clears alertOrder. */
    onDismiss: () => void;
    /** Called on confirm click: stops sound only — confirmExternalOrder clears alertOrder on success. */
    onStopSound: () => void;
    confirmExternalOrder: (order: Order) => Promise<void>;
    confirmingAccept: boolean;
    cancelDialogOpen: boolean;
    setCancelDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
    cancelReason: string;
    setCancelReason: React.Dispatch<React.SetStateAction<string>>;
    handleCancel: (order: Order | null) => Promise<void>;
    confirmingCancel: boolean;
}

export function ExternalOrderAlert({
    alertOrder,
    onDismiss,
    onStopSound,
    confirmExternalOrder,
    confirmingAccept,
    cancelDialogOpen,
    setCancelDialogOpen,
    cancelReason,
    setCancelReason,
    handleCancel,
    confirmingCancel,
}: ExternalOrderAlertProps): JSX.Element {
    const extId = getExternalOrderId(alertOrder);
    const isJahez = extId !== null && alertOrder?.order_type === 'Jahez';

    return (
        <>
            <Snackbar
                open={Boolean(alertOrder)}
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
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        width: '85vw',
                        maxWidth: 600,
                    }}
                >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ flexGrow: 1 }}>
                            {alertOrder && (
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {alertOrder.order_type === 'Jahez' ? 'Jahez Order' :
                                        alertOrder.order_type === 'Keeta' ? 'Keeta Order' :
                                            'New Order'}: {alertOrder.order_no ?? getOrderDisplayId(alertOrder)}
                                </Typography>
                            )}
                            <Typography variant="body2">Total price: {alertOrder?.amount_paid} BHD</Typography>
                        </Box>

                        {isJahez ? (
                            <>
                                <Box>
                                    {sortItemsByCategory(alertOrder!.items).map((item, idx) => (
                                        <Box key={idx} sx={{ mb: 1.5, pl: 1, borderLeft: '2px solid #e0e0e0' }}>
                                            <Typography variant="body2">
                                                {item.quantity}x <strong>{item.name}</strong>
                                                {item.size && (
                                                    <Typography component="span" variant="body2" sx={{ ml: 1, fontStyle: 'italic' }}>
                                                        ({item.size})
                                                    </Typography>
                                                )}
                                            </Typography>
                                            {renderItemDetails(item)}
                                        </Box>
                                    ))}
                                </Box>
                                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<CheckCircleIcon />}
                                        onClick={() => { if (alertOrder) void confirmExternalOrder(alertOrder); onStopSound(); }}
                                        disabled={confirmingAccept}
                                        sx={{ borderRadius: 4, textTransform: 'none', flex: 1, backgroundColor: COLOR_RED, color: 'white', borderColor: 'white' }}
                                    >
                                        {confirmingAccept ? 'Confirming…' : 'Confirm'}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<CancelIcon />}
                                        onClick={() => setCancelDialogOpen(true)}
                                        sx={{ borderRadius: 4, textTransform: 'none', flex: 1, borderColor: COLOR_RED, color: COLOR_RED }}
                                    >
                                        Cancel
                                    </Button>
                                </Box>
                            </>
                        ) : (
                            <IconButton onClick={onDismiss} size="medium" sx={{ color: COLOR_RED }}>
                                <CloseIcon />
                            </IconButton>
                        )}
                    </Box>
                </Paper>
            </Snackbar>

            <SwipeableDrawer
                anchor="bottom"
                open={cancelDialogOpen}
                onClose={() => setCancelDialogOpen(false)}
                onOpen={() => {}}
                disableDiscovery
                keepMounted
                PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, p: 2 } }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                    <Box sx={{ width: 36, height: 4, borderRadius: 999 }} />
                </Box>
                <Typography variant="h6" sx={{ textAlign: 'center', fontWeight: 600, mb: 2 }}>
                    Cancel Order
                </Typography>
                <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    placeholder="Type reason..."
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Button
                    variant="contained"
                    fullWidth
                    onClick={() => void handleCancel(alertOrder)}
                    disabled={confirmingCancel || !cancelReason.trim()}
                    sx={{
                        backgroundColor: COLOR_RED,
                        color: '#fff',
                        borderRadius: 2,
                        py: 1.5,
                        fontWeight: 600,
                        textTransform: 'none',
                        fontSize: 16,
                        '&:hover': { backgroundColor: '#c73c3d' },
                    }}
                >
                    {confirmingCancel ? 'Cancelling…' : 'Confirm Cancel'}
                </Button>
            </SwipeableDrawer>
        </>
    );
}
