import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter, Routes, Route, useSearchParams, Navigate} from 'react-router-dom';
import HomePage from './HomePage';
import AdminHomePage from "./AdminHomePage";
import {CssBaseline} from "@mui/material";
import {OrderStatusPage} from "./OrderStatusPage";
import {AuthPage} from "./AuthPage";
import {AuthProvider} from "./management/security/AuthProvider";
import {ProtectedRoute} from "./management/security/ProtectedRoute";

const root = ReactDOM.createRoot(document.getElementById('root'));

function MenuRoute() {
    const [searchParams] = useSearchParams();
    const userId = searchParams.get('user');
    return <HomePage userParam={userId}/>;
}

function WatchOrderStatus() {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('order_id');
    console.log("[ORDER ID FROM URL]" + orderId);
    return <OrderStatusPage orderId={orderId}></OrderStatusPage>;
}

root.render(
    <React.StrictMode sx={{scrollbarWidth: "none", "&::-webkit-scrollbar": {display: "none"}}}>
        <CssBaseline/>
        <BrowserRouter sx={{scrollbarWidth: "none", "&::-webkit-scrollbar": {display: "none"}}}>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<Navigate to="/menu"/>}/>
                    <Route path="/menu" element={<MenuRoute/>}/>
                    <Route path="/admin/*" element={
                        <ProtectedRoute>
                            <AdminHomePage/>
                        </ProtectedRoute>
                    }
                    />
                    <Route path="/order_status" element={<WatchOrderStatus/>}/>
                    <Route path="/menu/kiosk" element={<Navigate to="/menu?mode=kiosk"/>}/>
                    <Route path="/auth" element={<AuthPage/>}/>
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);