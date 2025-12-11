const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';

app.use(cors());
app.use(express.json());

let channel = null;
let connection = null;

// Connect to RabbitMQ
async function connectRabbitMQ() {
  try {
    console.log('Connecting to RabbitMQ...');
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    
    await channel.assertQueue('order_notifications', {
      durable: true
    });
    
    console.log('Connected to RabbitMQ successfully');
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
  res.json({ status: 'OK', service: 'order-service' });
});

// Create new order
app.post('/orders', async (req, res) => {
  try {
    const { customerName, items, totalAmount } = req.body;

    if (!customerName || !items || !totalAmount) {
      return res.status(400).json({ 
        error: 'Missing required fields: customerName, items, totalAmount' 
      });
    }

    const order = {
      orderId: uuidv4(),
      customerName,
      items: Array.isArray(items) ? items : [items],
      totalAmount: parseFloat(totalAmount),
      status: 'received',
      timestamp: new Date().toISOString()
    };

    console.log('New order received:', order);

    // Publish to RabbitMQ
    if (channel) {
      channel.sendToQueue(
        'order_notifications',
        Buffer.from(JSON.stringify(order)),
        { persistent: true }
      );
      console.log('Order published to queue:', order.orderId);
    } else {
      console.error('RabbitMQ channel not available');
      return res.status(503).json({ error: 'Message queue unavailable' });
    }

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get all orders (for testing)
app.get('/orders', (req, res) => {
  res.json({
    message: 'Order service is running',
    endpoint: 'POST /orders to create new orders'
  });
});

app.listen(PORT, async () => {
  console.log(`Order Service running on port ${PORT}`);
  await connectRabbitMQ();
});
