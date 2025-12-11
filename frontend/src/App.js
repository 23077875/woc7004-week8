import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [newOrder, setNewOrder] = useState({
    customerName: '',
    items: '',
    totalAmount: ''
  });

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/notifications`);
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/orders`, {
        customerName: newOrder.customerName,
        items: newOrder.items.split(',').map(item => item.trim()),
        totalAmount: parseFloat(newOrder.totalAmount)
      });
      setNewOrder({ customerName: '', items: '', totalAmount: '' });
      alert('Order placed successfully!');
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to place order');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🍽️ Restaurant Order Management</h1>
      </header>

      <div className="container">
        <div className="order-form">
          <h2>Place New Order</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Customer Name:</label>
              <input
                type="text"
                value={newOrder.customerName}
                onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Items (comma-separated):</label>
              <input
                type="text"
                value={newOrder.items}
                onChange={(e) => setNewOrder({ ...newOrder, items: e.target.value })}
                placeholder="e.g., Pizza, Burger, Coke"
                required
              />
            </div>
            <div className="form-group">
              <label>Total Amount ($):</label>
              <input
                type="number"
                step="0.01"
                value={newOrder.totalAmount}
                onChange={(e) => setNewOrder({ ...newOrder, totalAmount: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn-submit">Place Order</button>
          </form>
        </div>

        <div className="notifications-panel">
          <h2>📊 Order Notifications Dashboard</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {notifications.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center' }}>No notifications yet</td>
                  </tr>
                ) : (
                  notifications.map((notification, index) => (
                    <tr key={index}>
                      <td>{new Date(notification.timestamp).toLocaleTimeString()}</td>
                      <td>{notification.orderId}</td>
                      <td>{notification.customerName}</td>
                      <td>{notification.items?.join(', ')}</td>
                      <td>${notification.totalAmount?.toFixed(2)}</td>
                      <td>
                        <span className="status-badge">{notification.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
