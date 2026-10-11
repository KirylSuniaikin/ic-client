import React from 'react';
import {Routes, Route, useSearchParams, Navigate} from 'react-router-dom';
import HomePage from '../pages/HomePage';
import AdminHomePage from '../pages/AdminHomePage';
import {OrderStatusPage} from '../pages/OrderStatusPage';
import {AuthPage} from '../pages/AuthPage';
import {DELETE_DATA_SECTION_ID, PrivacyPolicyPage} from '../pages/PrivacyPolicyPage';
import {PaymentResultPage} from '../pages/PaymentResultPage';
import {ProtectedRoute} from '../domains/auth/components/ProtectedRoute';
import {captureFbclid} from '../shared/utils/adAttribution';
import BenefitPayBridgePage from "../pages/BenefitPayBridgePage";

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

function WatchPaymentResult(): JSX.Element {
    const [searchParams] = useSearchParams();
    // The opaque per-attempt reference the backend appended to its REDIRECT= target. The outcome
    // is NOT read from here — see PaymentResultPage.
    const reference = searchParams.get('ref');
    return <PaymentResultPage reference={reference}/>;
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
            {/* Public and unauthenticated by design: the customer arrives straight from the
                payment gateway holding no session of ours. */}
            <Route path="/payment_result" element={<WatchPaymentResult/>}/>
            {/* Hosts the wallet widget for a customer arriving from the mobile app — see the page's
                own header for why BenefitPay's checkout cannot be opened top-level. */}
            <Route path="/benefitpay" element={<BenefitPayBridgePage/>}/>
            <Route path="/menu/kiosk" element={<Navigate to="/menu?mode=kiosk"/>}/>
            <Route path="/auth" element={<AuthPage/>}/>
            {/* Public and unauthenticated by design: Google Play requires the privacy policy
                URL to be reachable without a login. The courier app's policy has its own path
                because its store listing must link straight to it. */}
            <Route path="/privacy" element={<PrivacyPolicyPage tab="ic-pizza"/>}/>
            <Route path="/privacy/delivery" element={<PrivacyPolicyPage tab="delivery"/>}/>
            {/* Google Play's data-safety form needs a URL that opens the deletion steps directly. */}
            <Route path="/privacy/delivery/delete-data"
                   element={<PrivacyPolicyPage tab="delivery" focusSectionId={DELETE_DATA_SECTION_ID}/>}/>
        </Routes>
    );
}
