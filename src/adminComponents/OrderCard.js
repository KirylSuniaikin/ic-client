import React from 'react';
import './OrderCardStyle.css';

function OrderCard({order}) {
    return (
        <div className="order-card">
            <div className="order-header">
                <div className="order-id">#{order.id}</div>
                <div className="order-type">{order.type}</div>
            </div>

            <div className="order-info">
                <div><strong>Description:</strong> {order.description}</div>
                <div><strong>Time:</strong> {order.time}</div>
                <div><strong>Amount Paid:</strong> BHD {order.amountPaid}</div>
                <div><strong>Customer:</strong> {order.customerName}</div>
                <div><strong>Phone:</strong> {order.phoneNumber}</div>
            </div>

            <div className="order-actions">
                <button className="btn ready">READY</button>
                <button className="btn edit">EDIT</button>
            </div>
        </div>
    );
}

export default OrderCard