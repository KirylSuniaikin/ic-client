import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter, Routes, Route, useSearchParams, Navigate} from 'react-router-dom';
import HomePage from './HomePage';

const root = ReactDOM.createRoot(document.getElementById('root'));
function MenuRoute() {
    const [searchParams] = useSearchParams();
    const userId = searchParams.get('user');
    return <HomePage userParam={userId} />;
}

root.render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/menu" />} />
                <Route path="/menu" element={<MenuRoute />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);