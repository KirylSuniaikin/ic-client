import { jest } from "@jest/globals";

// Manual mock for services/BluetoothPrinterService.ts.
// The real service uses cordova-plugin-bluetooth-serial which is unavailable in Jest.

const BluetoothPrinterService = {
    printOrder: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
    init: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
};

export default BluetoothPrinterService;
