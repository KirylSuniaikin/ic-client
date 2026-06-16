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

// Registry of connection listeners. STOMP fires socket.onConnect on EVERY
// (re)connection — including the auto-reconnects that follow the browser killing
// an idle socket. A single overwritable socket.onConnect slot lost re-subscription
// whenever more than one consumer connected (the last caller won the slot, so the
// others never re-subscribed and silently received nothing). Dispatching to every
// registered listener instead lets each consumer re-establish its subscriptions on
// every reconnect.
const connectListeners = new Set<() => void>();

socket.onConnect = (): void => {
    connectListeners.forEach((listener) => {
        try {
            listener();
        } catch (e) {
            // One consumer's re-subscribe failing must not block the others
            logger.error('[STOMP] onConnect listener failed', e);
        }
    });
};

/**
 * Register a callback to run on every (re)connection of the shared socket and
 * return an unregister function for effect cleanup. If the socket is already
 * connected the callback also runs immediately, so a late subscriber does not
 * have to wait for the next reconnect to set up its subscriptions.
 */
export function connectSocket(onConnect: () => void): () => void {
    connectListeners.add(onConnect);

    if (socket.connected) {
        onConnect();
    } else if (!socket.active) {
        // Not connected and not already activating — kick off the connection
        socket.activate();
    }

    return () => {
        connectListeners.delete(onConnect);
    };
}

export { socket };
