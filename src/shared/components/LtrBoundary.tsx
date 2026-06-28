import React, {useEffect, useMemo} from 'react';
import {CacheProvider} from '@emotion/react';
import createCache from '@emotion/cache';
import {prefixer} from 'stylis';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {I18nextProvider} from 'react-i18next';
import baseTheme from '../utils/theme';
import {enI18n} from '../i18n';

interface LtrBoundaryProps {
    children: React.ReactNode;
}

// Dedicated LTR Emotion cache: no stylis-plugin-rtl, so styles generated inside this boundary are
// never flipped — even when the app is globally in Arabic/RTL (see AppProviders). The unique key
// keeps it from clashing with the app-level 'mui' / 'muirtl' caches.
const ltrCache = createCache({key: 'mui-ltr', stylisPlugins: [prefixer]});

// Forces an English, left-to-right scope regardless of the active language. Staff-only screens
// (admin POS board, admin ordering, login) are English-only and must not localize or invert when a
// customer-facing Arabic preference is stored in localStorage. It overrides four things:
//   1. i18n  — an English-pinned instance, so t()/useLocalizedItem resolve English, not Arabic.
//   2. Emotion cache — undoes the RTL CSS flipping for in-tree styles.
//   3. MUI theme direction — LTR component behaviour (incl. portaled popovers/menus via context).
//   4. dir — the wrapper for in-tree content, and document.body for PORTALED content (popovers,
//      dialogs, selects) which mounts under <body>, outside the wrapper. AppProviders only manages
//      <html dir>, so setting <body dir> here never races it.
export function LtrBoundary({children}: LtrBoundaryProps): React.JSX.Element {
    const theme = useMemo(() => createTheme(baseTheme, {direction: 'ltr'}), []);

    useEffect(() => {
        const previous = document.body.dir;
        document.body.dir = 'ltr';
        return () => {
            document.body.dir = previous;
        };
    }, []);

    return (
        <I18nextProvider i18n={enI18n}>
            <CacheProvider value={ltrCache}>
                <ThemeProvider theme={theme}>
                    <div dir="ltr">{children}</div>
                </ThemeProvider>
            </CacheProvider>
        </I18nextProvider>
    );
}

export default LtrBoundary;
