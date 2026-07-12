import { jest } from "@jest/globals";
import type { AdminBaseInfo, BaseAppInfoResponse, Order, CreateOrderRequest, CustomerCheckResponse, GetHistoryParams, GetHistoryResponse } from "../../../domains/order/types";
import type { QuickPickDto } from "../../../domains/menu/types";
import type { OrderStatusData } from "../../../domains/order-status/types";
import type { StatsResponse } from "../../../domains/management/statistics/types";

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

export const getQuickPicks = jest.fn<Promise<QuickPickDto[]>, [number]>();

export const getHistory = jest.fn<Promise<GetHistoryResponse>, [GetHistoryParams]>();

export const fetchStatistics = jest.fn<Promise<StatsResponse>, [string, string, string, string]>();
