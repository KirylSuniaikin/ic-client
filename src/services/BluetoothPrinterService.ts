import { logger } from "../shared/utils/logger";
import BluetoothSerial from "cordova-plugin-bluetooth-serial";
import type { Order } from '../domains/order/types';
import { buildTicketLines, resolveKitchenNote } from '../domains/menu/utils/orderLines';
import { q3, toDecimal } from '../shared/utils/decimalUtils';

function formatExternalId(id: string | number | null | undefined): string {
    if (!id) return "—";
    const strId = String(id);
    if (strId.length <= 4) return strId;
    return `${strId.substring(strId.length - 4)}`;
}

// GS B n ("Select/Cancel white/black reverse print mode") -- one of the most widely supported
// ESC/POS control sequences across thermal printer firmwares, including the cheap generic ones
// this app targets (unlike printer-specific bold/underline variants, which are hit-or-miss).
// Turns modifier rows (extras, toppings, "NO X" removals) and notes into a solid black box with
// white text on the printed ticket -- kitchen staff missing a "NO Onion" line printed as plain text
// was producing real 1-star reviews, so these rows need to be impossible to skim past. Notes are
// kitchen instructions in the customer's own words ("well done", "no sauce"), just as easy to miss.
const GS = "\x1D";
// Exported so tests can assert on the exact bytes without duplicating this magic sequence.
export const REVERSE_VIDEO_ON = GS + "B" + "\x01";
export const REVERSE_VIDEO_OFF = GS + "B" + "\x00";

/** Wraps one ticket row (a buildTicketLines() modifier or a note) in reverse-video codes for
 * printing -- never applied inside orderLines.ts itself, which is shared with the admin OrderCard
 * (a web UI, not a printer) and must stay plain, printer-format-free text. */
function highlightLine(line: string): string {
    return `${REVERSE_VIDEO_ON}${line}${REVERSE_VIDEO_OFF}`;
}

// BHD has three decimals. Plain float math prints amounts like 12.150000000000002, so the ticket
// totals go through Decimal and are rounded once. VAT is derived from the rounded net so the three
// printed lines always add up exactly.
export function splitTicketTotals(amountPaid: number): { net: string; vat: string; grand: string } {
    const grand = q3(toDecimal(amountPaid));
    const net = q3(grand.times(0.9));
    return { net: net.toFixed(3), vat: grand.minus(net).toFixed(3), grand: grand.toFixed(3) };
}

class BluetoothPrinterService {
    private mac: string = '2C:12:09:96:A3:96';
    private isConnected: boolean = false;
    private monitorTimer?: ReturnType<typeof setInterval>;

    // cordova-plugin-bluetooth-serial calls a bare `cordova` identifier inside its method bodies,
    // which throws a ReferenceError in a plain (non-Cordova) browser. Probing `window.cordova`
    // detects the bridge's absence without our code ever touching that bare identifier itself.
    private isNativeBridgeAvailable(): boolean {
        return typeof window !== 'undefined' && window.cordova !== undefined;
    }

    async init(): Promise<void> {
        logger.debug("🔹 Initializing Bluetooth...");

        try {
            if (!this.isNativeBridgeAvailable()) {
                throw new Error("cordova bridge not available");
            }
            await new Promise<void>((resolve, reject) => {
                BluetoothSerial.enable(
                    () => {
                        logger.debug("✅ Bluetooth enabled: ");
                        resolve();
                    },
                    (err) => {
                        logger.error("❌ Failed to enable Bluetooth", err);
                        reject(err);
                    }
                );
            });
        } catch (err) {
            logger.warn("Bluetooth enable skipped or failed:", err);
        }
    }

    async connect(): Promise<void> {
        logger.debug(`🔹 Connecting to ${this.mac}...`);
        try {
            if (!this.isNativeBridgeAvailable()) {
                throw new Error("cordova bridge not available");
            }
            await new Promise<void>((resolve, reject) => {
                BluetoothSerial.connect(
                    this.mac,
                    () => {
                        this.isConnected = true;
                        logger.debug("✅ Connected to printer via SPP");
                        resolve();
                    },
                    (err) => {
                        logger.error("❌ Connection failed:", err);
                        this.isConnected = false;
                        reject(err);
                    }
                );
            });
        } catch (e) {
            logger.error("Connection error:", e);
        }
    }

    formatOrderItems(items: Order['items']): string {
        let result = "";

        for (const item of items) {
            result += `${item.quantity}x ${item.name}${item.size ? " (" + item.size + ")" : ""}\n`;

            if (item.category === "Combo Deals" && Array.isArray(item.comboItemTO)) {
                for (const comboItem of item.comboItemTO) {
                    result += `    ${comboItem.name}${comboItem.size ? " (" + comboItem.size + ")" : ""}\n`;

                    for (const line of buildTicketLines(comboItem)) {
                        result += `      ${highlightLine(line)}\n`;
                    }
                    const comboNote = resolveKitchenNote(comboItem);
                    if (comboNote) {
                        result += `      ${highlightLine(`Note: ${comboNote}`)}\n`;
                    }
                }
            } else {
                for (const line of buildTicketLines(item)) {
                    result += `   ${highlightLine(line)}\n`;
                }
                const itemNote = resolveKitchenNote(item);
                if (itemNote) {
                    result += `   ${highlightLine(`Note: ${itemNote}`)}\n`;
                }
            }

            result += "\n";
        }

        return result;
    }

    startConnectionMonitor(intervalMs: number = 60000): void {
        if (this.monitorTimer) clearInterval(this.monitorTimer);

        this.monitorTimer = setInterval(() => {
            if (!this.isNativeBridgeAvailable()) {
                return;
            }
            BluetoothSerial.isConnected(
                () => logger.debug("✅ Still connected"),
                async () => {
                    logger.warn("🔴 Lost connection, reconnecting...");
                    try {
                        await this.connect();
                    } catch (e) {
                        logger.error("❌ Reconnect failed:", e);
                    }
                }
            );
        }, intervalMs);
    }

    async printVatReport(text: string): Promise<boolean> {
        if (!this.isConnected) {
            logger.warn("⚠️ Printer not connected — trying to reconnect...");
            try {
                await this.connect();
            } catch (e) {
                logger.error("❌ Reconnect before print failed", e);
                return false;
            }
        }

        try {
            if (!this.isNativeBridgeAvailable()) {
                throw new Error("cordova bridge not available");
            }
            await new Promise<void>((resolve, reject) => {
                BluetoothSerial.write(
                    text,
                    () => {
                        logger.debug("🖨️ Printed successfully: ", text);
                        resolve();
                    },
                    (err) => {
                        logger.error("❌ Print failed:", err);
                        reject(err);
                    }
                );
            });
            return true;
        } catch (e) {
            logger.error("Write error:", e);
            return false;
        }
    }

    async printOrder(order: Order): Promise<boolean> {
        if (!this.isConnected) {
            logger.warn("⚠️ Printer not connected — trying to reconnect...");
            try {
                await this.connect();
            } catch (e) {
                logger.error("❌ Reconnect before print failed", e);
                return false;
            }
        }

        const ESC = "\x1B";
        const LF = "\x0A";
        const alignLeft = ESC + "a" + "\x00";

        const totals = splitTicketTotals(order.amount_paid);

        const text = [
            ESC + "@",
            alignLeft,
            `${ESC}!\x38`,
            '\n', '\n', '\n', '\n',
            "IC PIZZA\n",
            "\n", "\n", "\n", "\n",
            LF,
            `${ESC}!\x38`,
            `#${
                order.order_type !== "Pick Up"
                    ? formatExternalId(order.external_id)
                    : order.order_no
            }\n`,
            `${ESC}!\x08`,
            alignLeft,
            "--------------------------\n",
            "Order Type: " + order.order_type + "\n",
            order.order_type !== "Jahez"
                ? `Customer Info: ${order.customer_name || "—"}\n                 (${order.phone_number})\n`
                : "",
            order.notes.length > 0
                ? `${highlightLine(`Notes: ${order.notes || "—"}`)}\n`
                : "",
            `Payment type: ${order.payment_type || "N/A"}\n`,
            "--------------------------\n",
            this.formatOrderItems(order.items),
            "--------------------------\n",
            `Total: ${totals.net} BHD\n`,
            `VAT: ${totals.vat} BHD\n`,
            `Grand TOTAL: ${totals.grand} BHD\n`,
            "--------------------------\n",
            "220026867000002\n",
            "Flat/Shop No. 0,\n",
            "Building 1284,\n",
            "Road/Street 114, HIDD\n",
            "Block 101, Bahrain\n",
            "\n", "\n", "\n", "\n",
            LF + LF + LF,
        ].join("");

        try {
            if (!this.isNativeBridgeAvailable()) {
                throw new Error("cordova bridge not available");
            }
            await new Promise<void>((resolve, reject) => {
                BluetoothSerial.write(
                    text,
                    () => {
                        logger.debug("🖨️ Printed successfully: ", text);
                        resolve();
                    },
                    (err) => {
                        logger.error("❌ Print failed:", err);
                        reject(err);
                    }
                );
            });
            return true;
        } catch (e) {
            logger.error("Write error:", e);
            return false;
        }
    }
}

const bluetoothPrinterService = new BluetoothPrinterService();
export default bluetoothPrinterService;
