const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');

const app = express();
const PORT = process.env.PORT || 3002;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';

app.use(cors());
app.use(express.json());

let channel = null;
let connection = null;
const notifications = [];

// Connect to RabbitMQ and start consuming messages
async function connectRabbitMQ() {
  try {
    console.log('Connecting to RabbitMQ...');
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    
    await channel.assertQueue('order_notifications', {
      durable: true
    });
    
    console.log('Connected to RabbitMQ successfully');
    console.log('Waiting for messages...');

    // Start consuming messages
    channel.consume('order_notifications', (msg) => {
      if (msg !== null) {
        const order = JSON.parse(msg.content.toString());
        console.log('Received order notification:', order);
        
        // Store notification
        notifications.unshift({
          ...order,
          notificationTime: new Date().toISOString()
        });

        // Keep only last 100 notifications
        if (notifications.length > 100) {
          notifications.pop();
        }

        // Log to console (dashboard)
        console.log('==========================================');
        console.log(`📦 NEW ORDER NOTIFICATION`);
        console.log(`Order ID: ${order.orderId}`);
        console.log(`Customer: ${order.customerName}`);
        console.log(`Items: ${order.items.join(', ')}`);
        console.log(`Total Amount: $${order.totalAmount}`);
        console.log(`Status: ${order.status}`);
        console.log(`Time: ${order.timestamp}`);
        console.log('==========================================');

        channel.ack(msg);
      }
    }, { noAck: false });

  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    setTimeout(connectRabbitMQ, 5000);
  }
}

// Handle connection errors
process.on('SIGINT', async () => {
  if (channel) await channel.close();
  if (connection) await connection.close();
  process.exit(0);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'notification-service',
    notificationsCount: notifications.length 
  });
});

// Get all notifications
app.get('/notifications', (req, res) => {
  res.json(notifications);
});

// Get notification by order ID
app.get('/notifications/:orderId', (req, res) => {
  const notification = notifications.find(n => n.orderId === req.params.orderId);
  if (notification) {
    res.json(notification);
  } else {
    res.status(404).json({ error: 'Notification not found' });
  }
});

app.listen(PORT, async () => {
  console.log(`Notification Service running on port ${PORT}`);
  await connectRabbitMQ();
});
