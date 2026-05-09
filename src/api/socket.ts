import {Client} from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {WS_URL} from "./api";


const socket = new Client({
    webSocketFactory: (): WebSocket => {
        const s = new SockJS(WS_URL);
        const origSend = s.send.bind(s);
        s.send = (d) => {
            if (d === '\n') console.log('♥ OUT heartbeat');
            return origSend(d);
        };
        // Cast needed: SockJS onmessage is typed with this:void which prevents optional chaining call
        const origOnMessage = s.onmessage as ((e: MessageEvent) => void) | null;
        s.onmessage = (e) => {
            if (e?.data === '\n') console.log('♥ IN heartbeat');
            origOnMessage?.(e);
        };
        // SockJS is structurally compatible with WebSocket but not typed as one
        return s as unknown as WebSocket;
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: (msg) => console.log('[STOMP]', msg),
});

export function connectSocket(onConnect: () => void): void {
    if (socket.connected) {
        console.log("🔁 Socket already connected");
        return;
    }
    socket.onConnect = onConnect;
    socket.activate();
}

export { socket };
