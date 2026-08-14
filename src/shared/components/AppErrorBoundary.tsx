import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { Box, Button, Typography } from '@mui/material';
import { reportClientError } from '../api/telemetry';

interface AppErrorBoundaryOwnProps {
    children: React.ReactNode;
}

type AppErrorBoundaryProps = AppErrorBoundaryOwnProps & WithTranslation;

interface AppErrorBoundaryState {
    hasError: boolean;
}

// Catches uncaught render/lifecycle errors anywhere below it in the tree and reports
// them via the shared telemetry client (prod-only no-op is handled inside
// reportClientError itself — this component always calls it unconditionally).
// Wrapped with withTranslation so it can render localized copy even though it is a
// class component (hooks are not available inside class lifecycle methods).
class AppErrorBoundaryBase extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
    state: AppErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): AppErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, _info: React.ErrorInfo): void {
        void reportClientError({
            source: 'error-boundary',
            message: error.message,
            stack: error.stack,
            url: window.location.href,
            userAgent: navigator.userAgent,
        });
    }

    handleReload = (): void => {
        window.location.reload();
    };

    render(): React.ReactNode {
        if (!this.state.hasError) {
            return this.props.children;
        }

        const { t } = this.props;

        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minHeight: '100vh',
                    p: 3,
                    gap: 2,
                }}
            >
                <Typography variant="h6">{t('errorBoundary.title')}</Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('errorBoundary.message')}
                </Typography>
                <Button variant="contained" onClick={this.handleReload}>
                    {t('errorBoundary.reload')}
                </Button>
            </Box>
        );
    }
}

export const AppErrorBoundary = withTranslation('common')(AppErrorBoundaryBase);
export default AppErrorBoundary;
