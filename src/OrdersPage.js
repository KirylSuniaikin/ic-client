import {useEffect, useState} from "react";
import OrderCard from "./adminComponents/OrderCard";
import AddIcon from '@mui/icons-material/Add';
import { Fab } from '@mui/material';
import {useNavigate} from "react-router-dom";


function OrdersPage() {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {

        const mockOrders = [
            {
                id: 'a254662',
                type: 'Delivery',
                description: 'Pepperoni x1',
                time: '2025-04-14T13:25:00',
                amountPaid: '3.79',
                customerName: 'John Doe',
                phoneNumber: '+97312345678',
            },
            {
                id: 'a254663',
                type: 'Pickup',
                description: 'Margherita x2',
                time: '2025-04-14T13:45:00',
                amountPaid: '6.50',
                customerName: 'Alice Smith',
                phoneNumber: '+97398765432',
            },
        ];

        setTimeout(() => {
            setOrders(mockOrders);
            setLoading(false);
        }, 1000);
    }, []);

    if (loading) {
        return <div className="p-6 text-gray-500">Loading orders...</div>;
    }

    if (orders.length === 0) {
        return <div className="p-6 text-gray-500">No active orders</div>;
    }

    if (error) return <div>Error: {error}</div>;

    return (
        <div
            className="p-4 max-w-4xl mx-auto">
            {orders.map((order) => (
                <OrderCard key={order.id} order={order}/>
            ))}

            <Fab
                color="primary"
                aria-label="add"
                onClick={() => navigate('/menu?isAdmin=true')}
                sx={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    backgroundColor: '#E44B4C',
                    color: 'white',
                    '&:hover': {
                        backgroundColor: '#d23c3d',
                    },
                }}
            >
                <AddIcon />
            </Fab>
        </div>
    );

}

export default OrdersPage;