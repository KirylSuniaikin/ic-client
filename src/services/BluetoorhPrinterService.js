import BluetoothSerial from "cordova-plugin-bluetooth-serial";

class BluetoothPrinterService {
    constructor() {
        this.mac = "2C:12:09:96:A3:96";
        // this.mac = "DC:0D:30:EF:F9:55";
        this.isConnected = false;
    }

    async init() {
        console.log("🔹 Initializing Bluetooth...");

        try {
            await new Promise((resolve, reject) => {
                BluetoothSerial.enable(
                    () => {
                        console.log("✅ Bluetooth enabled: ");
                        resolve();
                    },
                    (err) => {
                        console.error("❌ Failed to enable Bluetooth", err);
                        reject(err);
                    }
                );
            });
        } catch (err) {
            console.warn("Bluetooth enable skipped or failed:", err);
        }
    }

    async connect() {
        console.log(`🔹 Connecting to ${this.mac}...`);
        try {
            await new Promise((resolve, reject) => {
                BluetoothSerial.connect(
                    this.mac,
                    () => {
                        this.isConnected = true;
                        console.log("✅ Connected to printer via SPP");
                        resolve();
                    },
                    (err) => {
                        console.error("❌ Connection failed:", err);
                        this.isConnected = false;
                        reject(err);
                    }
                );
            });
        } catch (e) {
            console.error("Connection error:", e);
        }
    }

    formatOrderItems(items) {
        let result = "";

        for (const item of items) {
            result += `${item.quantity}x ${item.name}${item.size ? " (" + item.size + ")" : ""}\n`;

            if (item.category === "Combo Deals" && Array.isArray(item.comboItemTO)) {
                for (const comboItem of item.comboItemTO) {
                    result += `    ${comboItem.name}${comboItem.size ? " (" + comboItem.size + ")" : ""}\n`;

                    const extras = [];

                    if (comboItem.isThinDough) extras.push("Thin Crust");
                    if (comboItem.isGarlicCrust) extras.push("Garlic Crust");

                    if (comboItem.description) {
                        comboItem.description
                            .replace(/[()]/g, "")
                            .split("+")
                            .map(s => s.trim())
                            .filter(Boolean)
                            .forEach(s => extras.push(s));
                    }

                    for (const e of extras) {
                        result += `      + ${e}\n`;
                    }
                }
            }

            // 🔹 3. Если это обычный товар с описанием
            else {
                const desc = item.description?.replace(";", "") || "";
                const cleanDescription = desc
                    .replace(/[()]/g, "")
                    .replace(/^\+/, "")
                    .trim();

                const extras = cleanDescription
                    .split("+")
                    .map(str => str.trim())
                    .filter(Boolean);

                for (const e of extras) {
                    result += `   + ${e}\n`;
                }
            }

            result += "\n";
        }

        return result;
    }

    startConnectionMonitor(intervalMs = 60000) {
        if (this.monitorTimer) clearInterval(this.monitorTimer);

        this.monitorTimer = setInterval(() => {
            BluetoothSerial.isConnected(
                () => console.log("✅ Still connected"),
                async () => {
                    console.warn("🔴 Lost connection, reconnecting...");
                    try {
                        await this.connect();
                    } catch (e) {
                        console.error("❌ Reconnect failed:", e);
                    }
                }
            );
        }, intervalMs);
    }

    async printOrder(order) {
        if (!this.isConnected) {
        console.warn("⚠️ Printer not connected — trying to reconnect...");
        try {
            await this.connect();
        } catch (e) {
            console.error("❌ Reconnect before print failed", e);
            return false;
        }
    }

        const ESC = "\x1B";
        const LF = "\x0A";
        const alignCenter = ESC + "a" + "\x01";
        const alignLeft = ESC + "a" + "\x00";

        const text = [
            ESC + "@",
            alignLeft,
            ESC + "!" + "\x38",
            "IC PIZZA\n",
            LF,
            ESC + "!" + "\x24",
            `Order #${
                order.order_type === "Jahez"
                    ? order.external_id
                    : order.order_no
            }\n`,
            ESC + "!" + "\x08",
            alignLeft,
            "--------------------------\n",
            "Order Type: " + order.order_type + "\n",
            order.order_type !== "Jahez"
                ? `Customer Info: ${order.customer_name || "—"} (${order.phone_number})\n`
                : "",
            `Notes: ${order.notes || "—"}\n`,
            `Payment type: ${order.payment_type || "N/A"}\n`,
            "--------------------------\n",
            this.formatOrderItems(order.items),
            "--------------------------\n",
            `Total: ${order.amount_paid} BHD\n`,
            LF + LF + LF
        ].join("");

        try {
            await new Promise((resolve, reject) => {
                BluetoothSerial.write(
                    text,
                    () => {
                        console.log("🖨️ Printed successfully: ", text);
                        resolve();
                    },
                    (err) => {
                        console.error("❌ Print failed:", err);
                        reject(err);
                    }
                );
            });
            return true;
        } catch (e) {
            console.error("Write error:", e);
            return false;
        }
    }

    async disconnect() {
        console.log("🔹 Disconnecting...");
        try {
            await new Promise((resolve, reject) => {
                BluetoothSerial.disconnect(
                    () => {
                        this.isConnected = false;
                        console.log("🔴 Disconnected");
                        resolve();
                    },
                    (err) => {
                        console.error("❌ Disconnect failed:", err);
                        reject(err);
                    }
                );
            });
        } catch (e) {
            console.error("Disconnect error:", e);
        }
    }
}

export default new BluetoothPrinterService();
