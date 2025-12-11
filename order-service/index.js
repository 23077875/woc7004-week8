const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  'amqp://rabbitmq:5672'; // fallback for local rabbit
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'order.db');

app.use(cors());
app.use(express.json());

// Ensure data dir exists and init DB
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS orders (
      orderId TEXT PRIMARY KEY,
      customerName TEXT NOT NULL,
      items TEXT NOT NULL,
      totalAmount REAL NOT NULL,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );`
  );
});

let channel = null;
let connection = null;
const EXCHANGE = 'food_events';

async function setupChannel(ch) {
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

  // Ensure downstream queues exist/bound for first-run convenience
  await ch.assertQueue('restaurant.q', { durable: true });
  await ch.bindQueue('restaurant.q', EXCHANGE, 'order.created');
  await ch.assertQueue('notifications.q', { durable: true });
  await ch.bindQueue('notifications.q', EXCHANGE, '#');
}

// Connect to RabbitMQ
async function connectRabbitMQ() {
  try {
    console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL} ...`);
    connection = await amqp.connect(RABBITMQ_URL);
    connection.on('close', () => {
      console.error('RabbitMQ connection closed. Reconnecting...');
      setTimeout(connectRabbitMQ, 5000);
    });
    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err);
    });

    channel = await connection.createChannel();
    await setupChannel(channel);

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
  db.close();
  process.exit(0);
});

// Health check endpoint
app.get('/health', async (_req, res) => {
  const queueState = channel ? 'up' : 'down';
  res.json({ status: 'OK', service: 'order-service', queue: queueState });
});

// Create new order
app.post('/orders', async (req, res) => {
  try {
    const { customerName, items, totalAmount } = req.body;

    if (!customerName || !items || totalAmount === undefined) {
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

    // persist
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO orders (orderId, customerName, items, totalAmount, status, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          order.orderId,
          order.customerName,
          JSON.stringify(order.items),
          order.totalAmount,
          order.status,
          order.timestamp
        ],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });

    console.log('New order received:', order);

    // Publish to RabbitMQ
    if (channel) {
      channel.publish(
        EXCHANGE,
        'order.created',
        Buffer.from(JSON.stringify(order)),
        { persistent: true }
      );
      console.log('Order published to exchange:', order.orderId);
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

// Get all orders
app.get('/orders', (_req, res) => {
  db.all(`SELECT * FROM orders ORDER BY timestamp DESC LIMIT 100`, [], (err, rows) => {
    if (err) {
      console.error('Error reading orders:', err);
      return res.status(500).json({ error: 'Failed to read orders' });
    }
    const parsed = rows.map((r) => ({
      ...r,
      items: JSON.parse(r.items)
    }));
    res.json(parsed);
  });
});

app.listen(PORT, async () => {
  console.log(`Order Service running on port ${PORT}`);
  await connectRabbitMQ();
});
