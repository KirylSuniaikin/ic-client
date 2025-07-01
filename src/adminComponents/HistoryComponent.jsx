import {useEffect, useState} from "react";
import {getHistory} from "../api/api";
import PizzaLoader from "../loadingAnimations/PizzaLoader";
import OrderCard from "./OrderCard";
import {Box, IconButton} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";


function HistoryComponent({isOpen, onClose}) {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [error, setError] = useState(null);
    const colorRed = '#E44B4C';

    const handleRemoveItem = (orderIdToRemove) => {
        setOrders(prev => prev.filter(order => order.orderId !== orderIdToRemove));
    }

    useEffect(() => {
        async function initialize() {
            try {
                setLoading(true);
                const response = await getHistory();
                setOrders(response.orders);
                console.log(response.orders, "history orders")
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        initialize();
    }, []);

    if (loading) {
        return <PizzaLoader/>;
    }
    if (error) return <div>Error: {error}</div>;


    const sortedOrders = orders.sort(
        (a, b) => new Date(b.order_created) - new Date(a.order_created)
    );

    return (
        <div className="p-4 max-w-4xl mx-auto">
            {(
                    <Box sx={{
                        position: 'fixed',
                        top: 16,
                        right: 16,
                        zIndex: 10000
                    }}
                    >
                        <IconButton
                            onClick={onClose}
                            sx={{
                                backgroundColor: colorRed,
                                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                                "&:hover": {
                                    backgroundColor: colorRed
                                }
                            }}
                        >
                            <CloseIcon sx={{fontSize: 28, color: "white"}}/>
                        </IconButton>
                    </Box>


                )}
            {sortedOrders.map((order) => (
                <OrderCard key={order.orderId} order={order} handleRemoveItem={handleRemoveItem} isHistory={true}/>
            ))}

        </div>
    )
}

export default HistoryComponent;