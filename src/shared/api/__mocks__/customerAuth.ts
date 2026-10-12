import { jest } from "@jest/globals";
import type {
    OtpRequestPayload,
    OtpVerifyPayload,
    CustomerTokenResponse,
    CustomerMeResponse,
    CustomerOrdersPageResponse,
    CustomerOrderDetail,
    CustomerActiveOrder,
    ReviewPrompt,
    ReviewPromptOutcome,
    SuggestedOrderResponse,
} from "../../../domains/customer-auth/types";
import type {
    ApplePayEligibilityResponse,
    ApplePayOrderResponse,
    ApplePayPayRequest,
    ApplePayPaymentResponse,
} from "../../../domains/order/applePayTypes";
import type {
    CardEligibilityResponse,
    CardOrderResponse,
    CardPayRequest,
    CardPaymentResponse,
    CardSessionResponse,
} from "../../../domains/order/cardPaymentTypes";
import type { CreateOrderRequest } from "../../../domains/order/types";

// Manual mock for shared/api/customerAuth.ts.
// Used by CustomerAuthProvider.test.tsx via jest.mock("../../../shared/api/customerAuth").
export const requestOtp = jest.fn<Promise<void>, [OtpRequestPayload]>();
export const verifyOtp = jest.fn<Promise<CustomerTokenResponse>, [OtpVerifyPayload]>();
export const refreshCustomerToken = jest.fn<Promise<CustomerTokenResponse>, []>();
export const logoutCustomer = jest.fn<Promise<void>, []>();
export const registerCustomerName = jest.fn<Promise<void>, [string, string]>();
export const updateCustomerName = jest.fn<Promise<CustomerMeResponse>, [string, string]>();
export const fetchCustomerMe = jest.fn<Promise<CustomerMeResponse>, [string]>();
export const fetchMyOrders = jest.fn<Promise<CustomerOrdersPageResponse>, [string, number, number]>();
export const fetchOrderDetail = jest.fn<Promise<CustomerOrderDetail>, [string, number]>();
export const fetchActiveOrder = jest.fn<Promise<CustomerActiveOrder | null>, [string]>();
// Apple Pay (F-1..F-5). Not eligible by default so suites that mount the cart never see the button.
export const fetchApplePayEligibility = jest.fn<Promise<ApplePayEligibilityResponse>, [string]>(
    () => Promise.resolve({ enabled: false })
);
export const requestApplePayMerchantSession = jest.fn<Promise<unknown>, [string, string]>();
export const createApplePayOrder = jest.fn<Promise<ApplePayOrderResponse>, [string, CreateOrderRequest]>();
export const payApplePayOrder = jest.fn<Promise<ApplePayPaymentResponse>, [string, number, ApplePayPayRequest]>();
export const fetchApplePayPaymentStatus = jest.fn<Promise<ApplePayPaymentResponse>, [string, number]>();
// Card / Hosted Session (C-1..C-5). Not eligible by default, same reason as Apple Pay.
export const fetchCardEligibility = jest.fn<Promise<CardEligibilityResponse>, [string]>(
    () => Promise.resolve({ enabled: false })
);
export const createCardOrder = jest.fn<Promise<CardOrderResponse>, [string, CreateOrderRequest]>();
export const createCardSession = jest.fn<Promise<CardSessionResponse>, [string, number]>();
export const payCardOrder = jest.fn<Promise<CardPaymentResponse>, [string, number, CardPayRequest]>();
export const fetchCardPaymentStatus = jest.fn<Promise<CardPaymentResponse>, [string, number]>();
export const fetchSuggestedItems = jest.fn<Promise<SuggestedOrderResponse>, [string]>();
// Resolves to null by default so suites that don't care about the review prompt
// never see the drawer — CustomerAuthModals mounts it unconditionally.
export const fetchReviewPrompt = jest.fn<Promise<ReviewPrompt | null>, [string]>(
    () => Promise.resolve(null)
);
export const ackReviewPrompt = jest.fn<Promise<void>, [string, number, ReviewPromptOutcome]>(
    () => Promise.resolve()
);
