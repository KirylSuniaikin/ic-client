declare module 'cordova-plugin-bluetooth-serial' {
  interface BluetoothSerial {
    enable(success: () => void, failure: (err: unknown) => void): void;
    connect(address: string, success: () => void, failure: (err: unknown) => void): void;
    disconnect(success: () => void, failure: (err: unknown) => void): void;
    write(data: string, success: () => void, failure: (err: unknown) => void): void;
    isConnected(success: () => void, failure: () => void): void;
    list(success: (devices: BluetoothDevice[]) => void, failure: (err: unknown) => void): void;
  }

  interface BluetoothDevice {
    name: string;
    address: string;
    id: string;
  }

  const BluetoothSerial: BluetoothSerial;
  export default BluetoothSerial;
}
