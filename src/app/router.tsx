import React from 'react';
import {Routes, Route, useSearchParams, Navigate} from 'react-router-dom';
import HomePage from '../pages/HomePage';
import AdminHomePage from '../pages/AdminHomePage';
import {OrderStatusPage} from '../pages/OrderStatusPage';
import {AuthPage} from '../pages/AuthPage';
import {ProtectedRoute} from '../domains/auth/components/ProtectedRoute';
import {captureFbclid} from '../shared/utils/adAttribution';

function MenuRoute(): JSX.Element {
    const [searchParams] = useSearchParams();
    const userId = searchParams.get('user');
    const recommendedIds = searchParams.getAll('recommended_items');
    const giftId = searchParams.get('gift');
    const fbclid = searchParams.get('fbclid');
    if (fbclid) {
        // Last-click attribution: a newly-arriving fbclid overwrites any previously stored value.
        captureFbclid(fbclid);
    }
    return <HomePage userParam={userId} recommendedIds={recommendedIds} giftId={giftId}/>;
}

function WatchOrderStatus(): JSX.Element {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('order_id');
    return <OrderStatusPage orderId={orderId}></OrderStatusPage>;
}

export function AppRouter(): JSX.Element {
    return (
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
    );
}
