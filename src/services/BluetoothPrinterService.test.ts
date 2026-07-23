import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import bluetoothPrinterService from "./BluetoothPrinterService";
import type { Order, OrderItem } from "../domains/order/types";

// The real cordova plugin talks to a native SPP bridge that does not exist under Jest/jsdom, so
// the underlying cordova-plugin-bluetooth-serial module (not the service) is mocked here -- the
// existing src/services/__mocks__/BluetoothPrinterService.ts mocks the whole service (used by its
// consumers, e.g. useAdminOrders.test.ts) and would bypass the very formatOrderItems logic this
// suite is verifying, so it does not fit and is intentionally not reused.
//
// The mock factory below is hoisted above every import by babel-plugin-jest-hoist, so it cannot
// close over an ordinary module-scope variable, and it cannot call jest.fn() either -- the
// imported `jest` binding is itself out-of-scope from inside the factory. Both restrictions are
// satisfied by writing connect/write as plain functions that push onto a `mock`-prefixed array;
// that naming is the one out-of-scope reference babel-plugin-jest-hoist explicitly allows, and it
// works at runtime because the array is only ever read once a test starts (see beforeEach
// clearing it below), long after this module has finished loading.
const mockWriteCalls: string[] = [];

jest.mock("cordova-plugin-bluetooth-serial", () => ({
    __esModule: true,
    default: {
        enable: (success: () => void): void => success(),
        connect: (_address: string, success: () => void): void => success(),
        disconnect: (success: () => void): void => success(),
        write: (data: string, success: () => void): void => {
            mockWriteCalls.push(data);
            success();
        },
        isConnected: (success: () => void): void => success(),
        list: (success: (devices: unknown[]) => void): void => success([]),
    },
}));

// Pizza item carrying one of each structured-customization kind (ADD topping, ADD extra
// ingredient, REMOVE) plus the dough flag and a translated note -- mirrors the spec target
// ticket format verbatim (task-spec.md "Target format").
const PIZZA_ITEM: OrderItem = {
    id: 1,
    name: "Pepperoni",
    category: "Pizza",
    size: "Medium",
    quantity: 1,
    amount: 5.5,
    description: "+(Mushroom, Garlic Topping) -(Onion)",
    note: "raw note should be superseded by noteTranslated",
    noteTranslated: "extra crispy",
    isThinDough: true,
    isGarlicCrust: false,
    discountAmount: 0,
    customizations: [
        { action: "ADD", extraIngrId: 5, name: "Mushroom" },
        { action: "ADD", toppingId: 900, name: "Garlic" },
        { action: "REMOVE", componentId: 7, name: "Onion" },
    ],
};

// Combo item so the combo-child branch of formatOrderItems (comboItemTO loop, six-space indent)
// is exercised too.
const COMBO_ITEM: OrderItem = {
    id: 2,
    name: "Family Deal",
    category: "Combo Deals",
    size: "Large",
    quantity: 1,
    amount: 8,
    description: "",
    isThinDough: false,
    isGarlicCrust: false,
    discountAmount: 0,
    comboItemTO: [
        {
            name: "Zaatar Manakish",
            size: "Small",
            category: "Manakish",
            isThinDough: false,
            isGarlicCrust: false,
            description: "",
            noteTranslated: "light salt",
            quantity: 1,
            customizations: [{ action: "ADD", extraIngrId: 9, name: "Cheese" }],
        },
    ],
};

function buildOrder(items: OrderItem[]): Order {
    return {
        id: "order-1",
        order_no: 42,
        tel: "12345678",
        customer_name: "Test Customer",
        delivery_method: "Pick Up",
        payment_type: "Card",
        address: "",
        notes: "",
        items,
        amount_paid: 13.5,
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
    mockWriteCalls.length = 0;
});

describe("BluetoothPrinterService.printOrder -- modifier rows", () => {
    it("prints one row per structured modifier and the translated note", async () => {
        const order = buildOrder([PIZZA_ITEM]);

        const success = await bluetoothPrinterService.printOrder(order);

        expect(success).toBe(true);
        const payload = mockWriteCalls[0];
        expect(payload).toContain("1x Pepperoni (Medium)\n");
        expect(payload).toContain("   + Thin Dough\n");
        expect(payload).toContain("   + Mushroom\n");
        expect(payload).toContain("   + Garlic Topping\n");
        expect(payload).toContain("   - NO Onion\n");
        expect(payload).toContain("   Note: extra crispy\n");
    });

    it("renders an exact minus-NO-Onion row, never a bare removal name", async () => {
        const order = buildOrder([PIZZA_ITEM]);

        await bluetoothPrinterService.printOrder(order);

        const payload = mockWriteCalls[0];
        expect(payload).toContain("- NO Onion");
    });

    it("never collapses multiple ADD rows onto a single comma-joined line (regression)", async () => {
        const order = buildOrder([PIZZA_ITEM]);

        await bluetoothPrinterService.printOrder(order);

        const payload = mockWriteCalls[0];
        expect(payload).not.toContain("+ Mushroom, Garlic Topping");
    });

    it("never prints a removal as an addition (no plus-Onion row)", async () => {
        const order = buildOrder([PIZZA_ITEM]);

        await bluetoothPrinterService.printOrder(order);

        const payload = mockWriteCalls[0];
        expect(payload).not.toContain("+ Onion");
        expect(payload).not.toContain("+Onion");
    });

    it("prints combo-child modifier rows and notes with the deeper combo indent", async () => {
        const order = buildOrder([COMBO_ITEM]);

        await bluetoothPrinterService.printOrder(order);

        const payload = mockWriteCalls[0];
        expect(payload).toContain("    Zaatar Manakish (Small)\n");
        expect(payload).toContain("      + Cheese\n");
        expect(payload).toContain("      Note: light salt\n");
    });

    it("omits the Note line entirely when no note applies", async () => {
        const noNoteItem: OrderItem = {
            ...PIZZA_ITEM,
            note: undefined,
            noteTranslated: undefined,
            description: "",
        };
        const order = buildOrder([noNoteItem]);

        await bluetoothPrinterService.printOrder(order);

        const payload = mockWriteCalls[0];
        expect(payload).not.toContain("Note:");
    });
});
