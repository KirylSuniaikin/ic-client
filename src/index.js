import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter, Routes, Route, useSearchParams, Navigate} from 'react-router-dom';
import HomePage from './HomePage';
import AdminHomePage from "./AdminHomePage";
import {CssBaseline} from "@mui/material";
import {OrderStatusPage} from "./OrderStatusPage";
import ManagementPage from "./management/inventorizationComponents/ManagementPage.tsx";
import {PurchasePopup} from "./management/purchaseComponents/PurchasePopup";

const root = ReactDOM.createRoot(document.getElementById('root'));
function MenuRoute() {
    const [searchParams] = useSearchParams();
    const userId = searchParams.get('user');
    return <HomePage userParam={userId} />;
}

function WatchOrderStatus() {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('order_id');
    console.log("[ORDER ID FROM URL]" + orderId);
    return <OrderStatusPage orderId={orderId}></OrderStatusPage>;
}

root.render(
    <React.StrictMode sx ={{scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }}}>
        <CssBaseline/>
        <BrowserRouter sx ={{scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }}}>
            <Routes>
                <Route path="/" element={<Navigate to="/menu" />} />
                <Route path="/menu" element={<MenuRoute />} />
                <Route path="/admin/" element={<AdminHomePage />} />
                <Route path="/order_status" element={<WatchOrderStatus />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);