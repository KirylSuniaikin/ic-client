import {Box, Typography} from "@mui/material";
import PizzaLoader from "../domains/order-status/components/animations/PizzaLoader";
import { OrderStatusContent } from "../domains/order-status/components/OrderStatusContent";
import { useOrderStatus } from "../domains/order-status/hooks/useOrderStatus";

interface OrderStatusPageProps {
    orderId: string | null;
}

// Thin route shell (see ic-client/.claude/CLAUDE.md "Pages are thin shells"): the whole status
// body lives in OrderStatusContent. It used to be duplicated here verbatim, which meant the
// domain component was dead code and every status change had to be made twice — the delivery
// ladder was added to the component, so the copy had to go.
export function OrderStatusPage({ orderId }: OrderStatusPageProps): JSX.Element {
    const { order, loading, remainingSeconds } = useOrderStatus(orderId ?? "");

    if (order?.error) {
        return (
            <Box sx={{ textAlign: "center", mt: 8 }}>
                <Typography variant="h4">😕</Typography>
                <Typography variant="h6" sx={{ mt: 1 }}>
                    Order not found
                </Typography>
            </Box>
        );
    }

    if (loading) return <PizzaLoader/>;

    return <OrderStatusContent order={order} remainingSeconds={remainingSeconds} />;
}
