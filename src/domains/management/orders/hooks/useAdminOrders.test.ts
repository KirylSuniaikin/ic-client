import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import type { StompSubscription, StompHeaders } from "@stomp/stompjs";

// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/socket.ts
jest.mock("../../../../shared/api/socket");
// Factoryless jest.mock() — resolves to src/shared/api/__mocks__/public.ts
jest.mock("../../../../shared/api/public");
// Factoryless jest.mock() — resolves to src/services/__mocks__/BluetoothPrinterService.ts
jest.mock("../../../../services/BluetoothPrinterService");

import { connectSocket, socket } from "../../../../shared/api/socket";
import { getBaseAdminInfo, getAllActiveOrders } from "../../../../shared/api/public";
import { useAdminOrders } from "./useAdminOrders";

const mockConnectSocket = jest.mocked(connectSocket);
const mockSubscribe = jest.mocked(socket.subscribe);
const mockGetBaseAdminInfo = jest.mocked(getBaseAdminInfo);
const mockGetAllActiveOrders = jest.mocked(getAllActiveOrders);

// Builds a minimal StompSubscription whose unsubscribe method can be spied on.
function makeSub(id: string): StompSubscription {
    return {
        id,
        // jest.fn<void, [StompHeaders?]> satisfies (headers?: StompHeaders) => void
        unsubscribe: jest.fn<void, [StompHeaders?]>(),
    };
}

describe("useAdminOrders — subscription lifecycle", () => {
    const stopSound = jest.fn<void, []>();
    let capturedSubs: StompSubscription[];

    beforeEach(() => {
        capturedSubs = [];

        // Simulate instant connection: call onConnect synchronously before resolving
        mockConnectSocket.mockImplementation((onConnect: () => void) => {
            onConnect();
            return Promise.resolve();
        });

        mockSubscribe.mockImplementation(() => {
            const sub = makeSub(`sub-${capturedSubs.length}`);
            capturedSubs.push(sub);
            return sub;
        });

        // Return undefined so the .then(response => { if (!response) return }) branch exits early
        mockGetBaseAdminInfo.mockResolvedValue(undefined);
        mockGetAllActiveOrders.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
        capturedSubs = [];
    });

    it("registers exactly 9 STOMP subscriptions when branchId is provided", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders("branch-1", stopSound));
        });

        expect(capturedSubs).toHaveLength(9);
    });

    it("unsubscribes all 9 subscription handles on unmount — no leak", async () => {
        let unmount!: () => void;

        await act(async () => {
            ({ unmount } = renderHook(() => useAdminOrders("branch-1", stopSound)));
        });

        unmount();

        capturedSubs.forEach(sub => {
            expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
        });
    });

    it("makes no subscriptions when branchId is null", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders(null, stopSound));
        });

        expect(capturedSubs).toHaveLength(0);
    });

    it("does not call connectSocket when branchId is null", async () => {
        await act(async () => {
            renderHook(() => useAdminOrders(null, stopSound));
        });

        expect(mockConnectSocket).not.toHaveBeenCalled();
    });
});
