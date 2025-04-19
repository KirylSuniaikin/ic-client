import {useEffect, useState} from "react";
import OrderCard from "./adminComponents/OrderCard";
import AddIcon from '@mui/icons-material/Add';
import { Fab } from '@mui/material';
import {useNavigate} from "react-router-dom";
import {getAllActiveOrders} from "./api/api";
import PizzaLoader from "./components/PizzaLoader";


function AdminHomePage() {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleRemoveItem = (orderIdToRemove) => {
        setOrders(prev => prev.filter(order => order.orderId !== orderIdToRemove));
    }

    useEffect(() => {
        async function loadActiveOrders() {
            try {
                setLoading(true);
                const response = await getAllActiveOrders();
                setOrders(response.orders);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        console.log("useEffect called");

        loadActiveOrders();
    }, []);

    if (loading) {
        return <PizzaLoader/>;
    }



    if (error) return <div>Error: {error}</div>;


    const sortedOrders = orders.sort(
        (a, b) => new Date(b.order_created) - new Date(a.order_created)
    );

    return (

        <div
            className="p-4 max-w-4xl mx-auto">
            {sortedOrders.map((order) => (
                <OrderCard key={order.id} order={order} handleRemoveItem={handleRemoveItem}/>
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
                <AddIcon/>
            </Fab>
        </div>
    );

}

export default AdminHomePage;