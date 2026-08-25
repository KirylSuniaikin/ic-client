import { useEffect } from "react";
import { connectSocket, socket } from "../../../../shared/api/socket";
import { logger } from "../../../../shared/utils/logger";

/** Cross-branch, because the dispatcher board is — mirrors DeliveryAlertPublisher.BOARD_TOPIC. */
const BOARD_TOPIC = "/topic/delivery-board";

/**
 * Keeps the §4 dispatcher board live.
 *
 * The board is the screen a manager stares at while a delivery is stuck, and it used to show a
 * snapshot from the moment it opened — an order that fell out of automatic assignment appeared
 * only if someone thought to reload.
 *
 * The frames carry a type and nothing else: this refetches rather than patching state from the
 * payload, so the board is never partly live and partly stale.
 *
 * Subscribes INSIDE the connectSocket callback, which re-fires on every reconnect — STOMP
 * subscriptions die with their session and are not restored by the transport reconnecting.
 */
export function useDeliveryBoardEvents(onChange: () => void): void {
    useEffect(() => {
        const subscriptions: { unsubscribe: () => void }[] = [];

        const unregister = connectSocket(() => {
            // Clear first: a reconnect must not accumulate a second live subscription per drop.
            subscriptions.forEach((subscription) => subscription.unsubscribe());
            subscriptions.length = 0;

            subscriptions.push(socket.subscribe(BOARD_TOPIC, () => {
                try {
                    onChange();
                } catch (error) {
                    logger.error("Delivery board refresh failed:", error);
                }
            }));
        });

        return () => {
            unregister();
            subscriptions.forEach((subscription) => subscription.unsubscribe());
        };
    }, [onChange]);
}
