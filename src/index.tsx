import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {AppProviders} from './app/providers';
import {AppRouter} from './app/router';
import {installGlobalErrorHandlers} from './shared/utils/globalErrorHandlers';

installGlobalErrorHandlers();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

const app = (
    <React.StrictMode>
        <BrowserRouter>
            <AppProviders>
                <AppRouter/>
            </AppProviders>
        </BrowserRouter>
    </React.StrictMode>
);

// react-snap prerenders build/*.html with real markup; hydrating onto that markup (instead of a
// fresh render into an empty root) avoids a flash-to-blank before the app repaints.
if (rootElement.hasChildNodes()) {
    ReactDOM.hydrateRoot(rootElement, app);
} else {
    ReactDOM.createRoot(rootElement).render(app);
}
