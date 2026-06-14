import { logger } from "../utils/logger";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { WS_URL } from "./client";

const socket = new Client({
    webSocketFactory: (): WebSocket => {
        const s = new SockJS(WS_URL);
        const origSend = s.send.bind(s);
        s.send = (d) => {
            if (d === '\n' && process.env.NODE_ENV === 'development') logger.debug('♥ OUT heartbeat');
            return origSend(d);
        };
        // Cast needed: SockJS onmessage is typed with this:void which prevents optional chaining call
        const origOnMessage = s.onmessage as ((e: MessageEvent) => void) | null;
        s.onmessage = (e) => {
            if (e?.data === '\n' && process.env.NODE_ENV === 'development') logger.debug('♥ IN heartbeat');
            origOnMessage?.(e);
        };
        // SockJS is structurally compatible with WebSocket but not typed as one
        return s as unknown as WebSocket;
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: (msg) => {
        if (process.env.NODE_ENV === 'development') logger.debug('[STOMP]', msg);
    },
});

export async function connectSocket(onConnect: () => void): Promise<void> {
    if (socket.connected) {
        // Fix: call onConnect immediately so subscribers don't miss the connection
        onConnect();
        return;
    }
    // Fix: await any in-progress deactivation before re-activating
    if (socket.active) {
        await socket.deactivate();
    }
    socket.onConnect = onConnect;
    socket.activate();
}

export { socket };
