import React from 'react';
import {ThemeProvider} from '@mui/material/styles';
import {AuthProvider} from '../domains/auth/context/AuthProvider';
import theme from '../shared/utils/theme';

interface AppProvidersProps {
    children: React.ReactNode;
}

export function AppProviders({children}: AppProvidersProps): React.JSX.Element {
    return (
        <ThemeProvider theme={theme}>
            <AuthProvider>
                {children}
            </AuthProvider>
        </ThemeProvider>
    );
}
