import type { CapacitorConfig } from '@capacitor/cli';


const config: CapacitorConfig = {
    appId: 'com.ic.app2',
    appName: 'ic-client',
    webDir: 'build',
    server: {
        url: "https://ic-pizza.com/admin",
        cleartext: true
    },
};

export default config;
