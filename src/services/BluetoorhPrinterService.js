// import { Plugins } from '@capacitor/core';
// const { BluetoothSerial } = Plugins;

import BluetoothSerial from "cordova-plugin-bluetooth-serial";

class BluetoothPrinterService {
    constructor() {
        this.mac = "2C:12:09:96:A3:96";
        // this.mac = "AC:80:0A:7C:9D:94";
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

    async printOrder(order) {
        if (!this.isConnected) {
            console.warn("⚠️ Printer not connected");
            return false;
        }

        const text = `
Order #${order.id}
--------------------------
${order.items.map(i => `${i.name} x${i.qty}`).join("\n")}
--------------------------
Total: ${order.total} BHD
\n\n\n`;

        try {
            await new Promise((resolve, reject) => {
                BluetoothSerial.write(
                    text,
                    () => {
                        console.log("🖨️ Printed successfully");
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

export default BluetoothPrinterService;