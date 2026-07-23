import { logger } from "../shared/utils/logger";
import BluetoothSerial from "cordova-plugin-bluetooth-serial";
import type { Order } from '../domains/order/types';
import { buildTicketLines, resolveKitchenNote } from '../domains/menu/utils/orderLines';

function formatExternalId(id: string | number | null | undefined): string {
    if (!id) return "—";
    const strId = String(id);
    if (strId.length <= 4) return strId;
    return `${strId.substring(strId.length - 4)}`;
}

class BluetoothPrinterService {
    private mac: string = '2C:12:09:96:A3:96';
    private isConnected: boolean = false;
    private monitorTimer?: ReturnType<typeof setInterval>;

    async init(): Promise<void> {
        logger.debug("🔹 Initializing Bluetooth...");

        try {
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
                        result += `      ${line}\n`;
                    }
                    const comboNote = resolveKitchenNote(comboItem);
                    if (comboNote) {
                        result += `      Note: ${comboNote}\n`;
                    }
                }
            } else {
                for (const line of buildTicketLines(item)) {
                    result += `   ${line}\n`;
                }
                const itemNote = resolveKitchenNote(item);
                if (itemNote) {
                    result += `   Note: ${itemNote}\n`;
                }
            }

            result += "\n";
        }

        return result;
    }

    startConnectionMonitor(intervalMs: number = 60000): void {
        if (this.monitorTimer) clearInterval(this.monitorTimer);

        this.monitorTimer = setInterval(() => {
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
                ? `Notes: ${order.notes || "—"}\n`
                : "",
            `Payment type: ${order.payment_type || "N/A"}\n`,
            "--------------------------\n",
            this.formatOrderItems(order.items),
            "--------------------------\n",
            `Total: ${order.amount_paid * 0.9} BHD\n`,
            `VAT: ${order.amount_paid * 0.1} BHD\n`,
            `Grand TOTAL: ${order.amount_paid} BHD\n`,
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
