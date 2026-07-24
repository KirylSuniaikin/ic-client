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

// Manual mock for shared/api/customerAuth.ts.
// Used by CustomerAuthProvider.test.tsx via jest.mock("../../../shared/api/customerAuth").
export const requestOtp = jest.fn<Promise<void>, [OtpRequestPayload]>();
export const verifyOtp = jest.fn<Promise<CustomerTokenResponse>, [OtpVerifyPayload]>();
export const refreshCustomerToken = jest.fn<Promise<CustomerTokenResponse>, []>();
export const logoutCustomer = jest.fn<Promise<void>, []>();
export const registerCustomerName = jest.fn<Promise<void>, [string, string]>();
export const fetchCustomerMe = jest.fn<Promise<CustomerMeResponse>, [string]>();
export const fetchMyOrders = jest.fn<Promise<CustomerOrdersPageResponse>, [string, number, number]>();
export const fetchOrderDetail = jest.fn<Promise<CustomerOrderDetail>, [string, number]>();
export const fetchActiveOrder = jest.fn<Promise<CustomerActiveOrder | null>, [string]>();
export const fetchSuggestedItems = jest.fn<Promise<SuggestedOrderResponse>, [string]>();
// Resolves to null by default so suites that don't care about the review prompt
// never see the drawer — CustomerAuthModals mounts it unconditionally.
export const fetchReviewPrompt = jest.fn<Promise<ReviewPrompt | null>, [string]>(
    () => Promise.resolve(null)
);
export const ackReviewPrompt = jest.fn<Promise<void>, [string, number, ReviewPromptOutcome]>(
    () => Promise.resolve()
);
