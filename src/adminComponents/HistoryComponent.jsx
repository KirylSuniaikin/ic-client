import {useEffect, useState} from "react";
import {getHistory} from "../api/api";
import PizzaLoader from "../components/loadingAnimations/PizzaLoader";
import OrderCard from "./OrderCard";
import {Box, IconButton} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {Masonry} from "@mui/lab";


function HistoryComponent({isOpen, onClose}) {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [error, setError] = useState(null);
    const colorRed = '#E44B4C';

    const handleRemoveItem = (orderIdToRemove) => {
        setOrders(prev => prev.filter(order => order.id !== orderIdToRemove));
    }

    useEffect(() => {
        async function initialize() {
            try {
                setLoading(true);
                const response = await getHistory();
                setOrders(response.orders);
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
                            <CloseIcon sx={{fontSize: 30, color: "white"}}/>
                        </IconButton>
                    </Box>


                )}
            <Box sx={{ pt: 1, pl: 1 }}>
            <Masonry columns={{ xs: 1, sm: 2, md: 3, lg: 4 }} spacing={1} sequential>
                {sortedOrders.map((order) => (
                    <OrderCard key={order.id} order={order} handleRemoveItem={handleRemoveItem} isHistory={true}/>
                ))}
            </Masonry>
            </Box>
        </div>
    )
}

export default HistoryComponent;