import React, {useEffect, useMemo} from 'react';
import {CacheProvider} from '@emotion/react';
import createCache from '@emotion/cache';
import {prefixer} from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {useTranslation} from 'react-i18next';
import {AuthProvider} from '../domains/auth/context/AuthProvider';
import {CustomerAuthProvider} from '../domains/customer-auth/context/CustomerAuthProvider';
import {CustomerAuthUiProvider} from '../domains/customer-auth/context/CustomerAuthUiProvider';
import {CustomerAuthModals} from '../domains/customer-auth/components/CustomerAuthModals';
import baseTheme from '../shared/utils/theme';
import '../shared/i18n';

interface AppProvidersProps {
    children: React.ReactNode;
}

// Separate Emotion caches: the RTL one runs stylis-plugin-rtl, which auto-flips
// physical CSS (margin-left ↔ margin-right, etc.) for every sx prop in the tree.
const ltrCache = createCache({key: 'mui', stylisPlugins: [prefixer]});
const rtlCache = createCache({key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin]});

export function AppProviders({children}: AppProvidersProps): React.JSX.Element {
    const {i18n} = useTranslation();
    const direction = i18n.dir(); // 'rtl' for Arabic, 'ltr' otherwise

    useEffect(() => {
        document.documentElement.dir = direction;
        document.documentElement.lang = i18n.language;
    }, [direction, i18n.language]);

    const theme = useMemo(() => createTheme(baseTheme, {direction}), [direction]);
    const cache = direction === 'rtl' ? rtlCache : ltrCache;

    return (
        <CacheProvider value={cache}>
            <ThemeProvider theme={theme}>
                <AuthProvider>
                    <CustomerAuthProvider>
                        <CustomerAuthUiProvider>
                            {children}
                            <CustomerAuthModals />
                        </CustomerAuthUiProvider>
                    </CustomerAuthProvider>
                </AuthProvider>
            </ThemeProvider>
        </CacheProvider>
    );
}
