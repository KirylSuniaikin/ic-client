import { jest } from "@jest/globals";
import type { AdminBaseInfo, BaseAppInfoResponse, Order, CreateOrderRequest, CustomerCheckResponse } from "../../../domains/order/types";
import type { OrderStatusData } from "../../../domains/order-status/types";

// Manual mock for shared/api/public.ts.
// Exports only the functions used by hook tests.

export const getBaseAdminInfo = jest.fn<Promise<AdminBaseInfo | undefined>, [string]>();

export const getOrderStatus = jest.fn<
    Promise<OrderStatusData | { error: true; message: string }>,
    [string]
>();

export const fetchBaseAppInfo = jest.fn<Promise<BaseAppInfoResponse>, [string | null, string]>();

export const createOrder = jest.fn<Promise<Order>, [CreateOrderRequest]>();

export const checkCustomer = jest.fn<Promise<CustomerCheckResponse | undefined>, [string]>();

export const editOrder = jest.fn<Promise<Order>, [unknown, string]>();

export const getAllActiveOrders = jest.fn<Promise<Order[]>, [string]>();
