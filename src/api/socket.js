import {Client} from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {WS_URL} from "./api";


const socket = new Client({
    webSocketFactory: () => {
        const s = new SockJS(WS_URL);
        const origSend = s.send.bind(s);
        s.send = (d) => {
            if (d === '\n') console.log('♥ OUT heartbeat');
            return origSend(d);
        };
        const origOnMessage = s.onmessage;
        s.onmessage = (e) => {
            if (e?.data === '\n') console.log('♥ IN heartbeat');
            origOnMessage?.(e);
        };
        return s;
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: (msg) => console.log('[STOMP]', msg),
});

export function connectSocket(onConnect) {
    if (socket.connected) {
        console.log("🔁 Socket already connected");
        return;
    }
    socket.onConnect = onConnect;
    socket.activate();
}

export { socket };