import {Alert, Snackbar} from "@mui/material";
import * as React from "react";

type Props={
    open: boolean,
    onClose: () => void,
}

export default function BlackListSnackBar({open, onClose}: Props) {
    return (
        <Snackbar
            open={open}
            autoHideDuration={10000}
            onClose={onClose}
            anchorOrigin={{vertical: 'top', horizontal: 'center'}}
            sx={{
                top: { xs: '24px !important', sm: '32px !important' },
                left: '50%',
                transform: 'translateX(-50%)',
                width: { xs: '90%', sm: 'auto' },
                minWidth: { sm: '400px' },
                zIndex: 2500,
            }}
        >
            <Alert
                severity="error"
                variant="filled"
                sx={{
                    width: '100%',
                    fontSize: '1rem',
                    borderRadius: 3,
                    boxShadow: 6,
                    fontWeight: 500,
                    py: 1.5,
                    px: 3
                }}
            >
                You have been blacklisted. If this is a mistake, please call +97333607710
            </Alert>
        </Snackbar>
    )
}