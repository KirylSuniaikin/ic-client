import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import bluetoothPrinterService from "./BluetoothPrinterService";
import type { Order } from "../domains/order/types";

// This suite exercises requirements 13-17 of the cordova ReferenceError guard
// (task-spec.md Item 2b): when no native bridge (`window.cordova`) is present -- the normal
// case for this app running as a plain website, not a Cordova build -- every public method on
// BluetoothPrinterService must resolve through its existing try/catch contract rather than let
// an uncaught ReferenceError escape.
//
// The mocked cordova-plugin-bluetooth-serial functions below throw synchronously, standing in
// for the ReferenceError a real, un-mocked `cordova.exec(...)` call would raise in a browser
// with no `cordova` global. If BluetoothPrinterService's guard ever failed to short-circuit
// before reaching BluetoothSerial, these mocks would surface that as an uncaught throw here.
//
// This lives in a second file (mirroring BluetoothPrinterService.test.ts's own documented
// hoisting workaround) because a `jest.mock` factory for a given module path is hoisted once
// per file -- a differently-behaving factory for the same module cannot be swapped in per-test
// within the file that already mocks it as a working, cordova-present bridge.
const mockIsConnectedCalls: number[] = [];

jest.mock("cordova-plugin-bluetooth-serial", () => ({
    __esModule: true,
    default: {
        enable: (): void => {
            throw new ReferenceError("cordova is not defined");
        },
        connect: (): void => {
            throw new ReferenceError("cordova is not defined");
        },
        disconnect: (): void => {
            throw new ReferenceError("cordova is not defined");
        },
        write: (): void => {
            throw new ReferenceError("cordova is not defined");
        },
        isConnected: (): void => {
            mockIsConnectedCalls.push(1);
            throw new ReferenceError("cordova is not defined");
        },
        list: (): void => {
            throw new ReferenceError("cordova is not defined");
        },
    },
}));

function buildOrder(): Order {
    return {
        id: "order-1",
        order_no: 42,
        tel: "12345678",
        customer_name: "Test Customer",
        delivery_method: "Pick Up",
        payment_type: "Card",
        address: "",
        notes: "",
        items: [],
        amount_paid: 10,
        order_type: "Pick Up",
        external_id: null,
        phone_number: "12345678",
        order_created: "2026-07-22T12:00:00Z",
        status: "Kitchen Phase",
        isPaid: true,
        branch_id: "branch-1",
    };
}

beforeEach(() => {
    mockIsConnectedCalls.length = 0;
    // Explicit for clarity: the whole point of this suite is that this global is absent.
    window.cordova = undefined;
});

describe("BluetoothPrinterService -- no native bridge present", () => {
    it("resolves init() without throwing when window.cordova is absent", async () => {
        await expect(bluetoothPrinterService.init()).resolves.toBeUndefined();
    });

    it("resolves connect() without throwing when window.cordova is absent", async () => {
        await expect(bluetoothPrinterService.connect()).resolves.toBeUndefined();
    });

    it("resolves printOrder() to false without throwing when window.cordova is absent", async () => {
        const order = buildOrder();

        await expect(bluetoothPrinterService.printOrder(order)).resolves.toBe(false);
    });

    it("resolves printVatReport() to false without throwing when window.cordova is absent", async () => {
        await expect(bluetoothPrinterService.printVatReport("VAT REPORT")).resolves.toBe(false);
    });

    it("never calls into BluetoothSerial.isConnected from the connection monitor when window.cordova is absent", () => {
        jest.useFakeTimers();

        bluetoothPrinterService.startConnectionMonitor(1000);
        jest.advanceTimersByTime(3000);

        expect(mockIsConnectedCalls).toHaveLength(0);

        jest.useRealTimers();
    });
});
