import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter, Routes, Route, useSearchParams, Navigate} from 'react-router-dom';
import HomePage from './HomePage';
import ReadyPage from "./ReadyPage";
import AdminHomePage from "./AdminHomePage";

const root = ReactDOM.createRoot(document.getElementById('root'));
function MenuRoute() {
    const [searchParams] = useSearchParams();
    const userId = searchParams.get('user');
    return <HomePage userParam={userId} />;
}

function ReadyRoute() {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('orderId');
    console.log("Order ID from URL:", orderId); // Debugging line to check the orderId
    return <ReadyPage order={orderId} />;
}

root.render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/menu" />} />
                <Route path="/menu" element={<MenuRoute />} />
                <Route path="/ready" element={<ReadyRoute />} />
                <Route path="/admin/" element={<AdminHomePage />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);