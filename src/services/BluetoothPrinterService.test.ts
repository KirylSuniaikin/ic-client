import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import bluetoothPrinterService, { REVERSE_VIDEO_ON, REVERSE_VIDEO_OFF } from "./BluetoothPrinterService";

// Every buildTicketLines() row (dough/crust flags, ADD extras/toppings, REMOVE lines) prints
// inside reverse-video (black box, white text) so kitchen staff can't skim past a "NO Onion" row
// the way they could when it was plain text -- see BluetoothPrinterService.ts for the real
// incident (missed removals costing 1-star reviews) this exists to fix.
function highlighted(line: string): string {
    return `${REVERSE_VIDEO_ON}${line}${REVERSE_VIDEO_OFF}`;
}
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

function buildOrder(items: OrderItem[], overrides: Partial<Order> = {}): Order {
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
        ...overrides,
    };
}

beforeEach(() => {
    mockWriteCalls.length = 0;
    // Real Cordova environments always set this global before app code runs (cordova.js
    // bootstraps it); stub it here so this suite continues to represent a cordova-present
    // device now that BluetoothPrinterService gates every native call on its presence.
    window.cordova = {};
});

describe("BluetoothPrinterService.printOrder -- modifier rows", () => {
    it("prints one row per structured modifier and the translated note", async () => {
        const order = buildOrder([PIZZA_ITEM]);

        const success = await bluetoothPrinterService.printOrder(order);

        expect(success).toBe(true);
        const payload = mockWriteCalls[0];
        expect(payload).toContain("1x Pepperoni (Medium)\n");
        expect(payload).toContain(`   ${highlighted("+ Thin Dough")}\n`);
        expect(payload).toContain(`   ${highlighted("+ Mushroom")}\n`);
        expect(payload).toContain(`   ${highlighted("+ Garlic Topping")}\n`);
        expect(payload).toContain(`   ${highlighted("- NO Onion")}\n`);
        // The note itself is free customer text, not a structured modifier -- never highlighted.
        expect(payload).toContain("   Note: extra crispy\n");
    });

    it("turns reverse video back off after each modifier row, so it never bleeds into the Note line or the next item", async () => {
        const order = buildOrder([PIZZA_ITEM]);

        await bluetoothPrinterService.printOrder(order);

        const payload = mockWriteCalls[0];
        // Every ON has a matching OFF, and the Note row -- printed right after the last modifier
        // row on this item -- starts immediately after an OFF, never inside a still-open ON span.
        expect(payload.split(REVERSE_VIDEO_ON).length - 1).toBe(payload.split(REVERSE_VIDEO_OFF).length - 1);
        expect(payload).toContain(`${REVERSE_VIDEO_OFF}\n   Note:`);
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
        expect(payload).toContain(`      ${highlighted("+ Cheese")}\n`);
        expect(payload).toContain("      Note: light salt\n");
    });

    it("prints the raw description rows for an aggregator item with no structured customizations", async () => {
        const keetaItem: OrderItem = {
            ...PIZZA_ITEM,
            note: undefined,
            noteTranslated: undefined,
            customizations: undefined,
            description: "Cheddar x1, Darblu Cheese x1",
        };
        const order = buildOrder([keetaItem]);

        await bluetoothPrinterService.printOrder(order);

        const payload = mockWriteCalls[0];
        expect(payload).toContain(`   ${highlighted("+ Cheddar")}\n`);
        expect(payload).toContain(`   ${highlighted("+ Darblu Cheese")}\n`);
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

/**
 * Courier-capacity Phase 5 (task-spec.md §5/§11 P4): the printed ticket carries the same
 * "Part k/N" marking as the kitchen card, so a rider collecting part 1 and a rider collecting
 * part 2 are never handed the same piece of paper for the same item.
 */
describe("BluetoothPrinterService.formatOrderItems -- part marker (courier-capacity Phase 5)", () => {
    it("appends the part marker only when partsTotal > 1", () => {
        const part1Item: OrderItem = { ...PIZZA_ITEM, partIndex: 1 };

        const splitOutput = bluetoothPrinterService.formatOrderItems([part1Item], 2);
        const unsplitOutput = bluetoothPrinterService.formatOrderItems([part1Item], 1);
        const noPartsTotalOutput = bluetoothPrinterService.formatOrderItems([part1Item]);

        expect(splitOutput).toContain("1x Pepperoni (Medium) [Part 1/2]\n");
        expect(unsplitOutput).not.toContain("[Part");
        expect(noPartsTotalOutput).not.toContain("[Part");
    });

    it("marks each item with its own part index on a genuinely split order", () => {
        const part1Item: OrderItem = { ...PIZZA_ITEM, partIndex: 1 };
        const part2Item: OrderItem = { ...COMBO_ITEM, partIndex: 2 };

        const output = bluetoothPrinterService.formatOrderItems([part1Item, part2Item], 2);

        expect(output).toContain("1x Pepperoni (Medium) [Part 1/2]\n");
        expect(output).toContain("1x Family Deal (Large) [Part 2/2]\n");
    });

    it("prints every share of a line cut across parts, and keeps an uncut line's plain marker", () => {
        const cutItem: OrderItem = {
            ...PIZZA_ITEM,
            quantity: 5,
            partShares: [{ partIndex: 1, quantity: 3 }, { partIndex: 2, quantity: 2 }],
        };
        const uncutItem: OrderItem = { ...COMBO_ITEM, partIndex: 2, partShares: [{ partIndex: 2, quantity: 1 }] };

        const output = bluetoothPrinterService.formatOrderItems([cutItem, uncutItem], 2);

        expect(output).toContain("5x Pepperoni (Medium) [Part 1/2: 3 of 5] [Part 2/2: 2 of 5]\n");
        expect(output).toContain("1x Family Deal (Large) [Part 2/2]\n");
    });

    it("ignores shares on an order that is not split", () => {
        const item: OrderItem = { ...PIZZA_ITEM, partShares: [{ partIndex: 1, quantity: 1 }, { partIndex: 2, quantity: 1 }] };

        expect(bluetoothPrinterService.formatOrderItems([item], 1)).not.toContain("[Part");
    });

    // A drink/side the allocator did not need to pin to one part carries no partIndex at all.
    it("marks nothing for an item with no partIndex, even on a split order", () => {
        const unassignedItem: OrderItem = { ...PIZZA_ITEM, partIndex: undefined };

        const output = bluetoothPrinterService.formatOrderItems([unassignedItem], 3);

        expect(output).not.toContain("[Part");
    });

    it("leaves a non-split printed ticket byte-identical", async () => {
        const order = buildOrder([PIZZA_ITEM]);

        await bluetoothPrinterService.printOrder(order);

        const payload = mockWriteCalls[0];
        expect(payload).toContain("1x Pepperoni (Medium)\n");
        expect(payload).not.toContain("[Part");
    });

    it("prints the part marker on the whole ticket for a genuinely split order", async () => {
        const order = buildOrder([{ ...PIZZA_ITEM, partIndex: 1 }], { partsTotal: 2 });

        await bluetoothPrinterService.printOrder(order);

        const payload = mockWriteCalls[0];
        expect(payload).toContain("1x Pepperoni (Medium) [Part 1/2]\n");
    });
});
