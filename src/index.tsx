import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {AppProviders} from './app/providers';
import {AppRouter} from './app/router';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
const root = ReactDOM.createRoot(rootElement);

root.render(
    <React.StrictMode>
        <BrowserRouter>
            <AppProviders>
                <AppRouter/>
            </AppProviders>
        </BrowserRouter>
    </React.StrictMode>
);
