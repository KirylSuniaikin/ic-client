import {useEffect, useState} from "react";
import {markOrderReady} from "./api/api";

function ReadyPage({order}) {
    const [orderId, setOrderId] = useState(null);


    useEffect(() => {
        if (order) {
            setOrderId(order);
            console.log("Order with id:", order);
        }
        }, []);

    return (
        <div style={{padding: "2rem", fontFamily: "sans-serif"}}>
            <h1>Ready Page</h1>
            {orderId ? (
                <>
                    <p>Order ID: <strong>{orderId}</strong></p>
                    <button onClick={() => markOrderReady(orderId)}>
                        ✅ Mark as Ready
                    </button>
                </>
            ) : (
                <p>No order ID provided.</p>
            )}
        </div>
    );
}

export default ReadyPage;