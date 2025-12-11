const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;
const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  'amqp://rabbitmq:5672'; // fallback for local rabbit
const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, 'data', 'notifications.db');

app.use(cors());
app.use(express.json());

// Ensure data dir exists and init DB
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId TEXT,
      eventType TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );`
  );
});

function runAsync(dbConn, sql, params = []) {
  return new Promise((resolve, reject) => {
    dbConn.run(sql, params, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

let channel = null;
let connection = null;
const EXCHANGE = 'food_events';
const NOTIFICATIONS_QUEUE = 'notifications.q';

async function setupChannel(ch) {
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  await ch.assertQueue(NOTIFICATIONS_QUEUE, { durable: true });
  await ch.bindQueue(NOTIFICATIONS_QUEUE, EXCHANGE, '#');
}

// Connect to RabbitMQ and start consuming messages
async function connectRabbitMQ() {
  try {
    console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL} ...`);
    connection = await amqp.connect(RABBITMQ_URL);
    connection.on('close', () => {
      console.error('RabbitMQ connection closed. Reconnecting...');
      setTimeout(connectRabbitMQ, 5000);
    });
    connection.on('error', (err) => console.error('RabbitMQ error:', err));

    channel = await connection.createChannel();
    await setupChannel(channel);

    console.log('Connected to RabbitMQ successfully');
    console.log('Waiting for messages...');

    channel.consume(
      NOTIFICATIONS_QUEUE,
      async (msg) => {
        if (!msg) return;
        try {
          const payload = JSON.parse(msg.content.toString());
          const routingKey = msg.fields.routingKey;
          const createdAt = new Date().toISOString();

          await runAsync(
            db,
            `INSERT INTO notifications (orderId, eventType, payload, createdAt) VALUES (?, ?, ?, ?)`,
            [
              payload.orderId || null,
              routingKey,
              JSON.stringify(payload),
              createdAt
            ]
          );

          console.log('Notification received', { routingKey, orderId: payload.orderId });
          channel.ack(msg);
        } catch (err) {
          console.error('Failed to process notification:', err);
          if (msg) {
            try {
              channel.nack(msg, false, true);
            } catch (nackErr) {
              console.error('Failed to nack message:', nackErr);
            }
          }
        }
      },
      { noAck: false }
    );
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
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'notification-service',
    queue: channel ? 'up' : 'down'
  });
});

// Get notifications (latest 100, optional orderId filter)
app.get('/notifications', (req, res) => {
  const { orderId, limit = 100 } = req.query;
  const parsedLimit = parseInt(limit, 10);
  const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;
  const boundedLimit = Math.min(safeLimit, 500);
  const params = [];
  let sql = `SELECT * FROM notifications`;
  if (orderId) {
    sql += ` WHERE orderId = ?`;
    params.push(orderId);
  }
  sql += ` ORDER BY id DESC LIMIT ?`;
  params.push(boundedLimit);

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error reading notifications:', err);
      return res.status(500).json({ error: 'Failed to read notifications' });
    }
    const parsed = rows.map((r) => {
      const payload = JSON.parse(r.payload);
      return {
        id: r.id,
        orderId: r.orderId,
        eventType: r.eventType,
        createdAt: r.createdAt,
        timestamp: payload.timestamp || payload.createdAt || r.createdAt,
        customerName: payload.customerName,
        items: payload.items,
        totalAmount: payload.totalAmount,
        status: payload.status || r.eventType,
        payload
      };
    });
    res.json(parsed);
  });
});

// Get notification by id
app.get('/notifications/id/:id', (req, res) => {
  db.get(
    `SELECT * FROM notifications WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) {
        console.error('Error reading notification:', err);
        return res.status(500).json({ error: 'Failed to read notification' });
      }
      if (!row) return res.status(404).json({ error: 'Notification not found' });
      const payload = JSON.parse(row.payload);
      res.json({
        id: row.id,
        orderId: row.orderId,
        eventType: row.eventType,
        createdAt: row.createdAt,
        timestamp: payload.timestamp || payload.createdAt || row.createdAt,
        customerName: payload.customerName,
        items: payload.items,
        totalAmount: payload.totalAmount,
        status: payload.status || row.eventType,
        payload
      });
    }
  );
});

// Get notification by order ID (latest)
app.get('/notifications/order/:orderId', (req, res) => {
  db.get(
    `SELECT * FROM notifications WHERE orderId = ? ORDER BY id DESC LIMIT 1`,
    [req.params.orderId],
    (err, row) => {
      if (err) {
        console.error('Error reading notification:', err);
        return res.status(500).json({ error: 'Failed to read notification' });
      }
      if (!row) return res.status(404).json({ error: 'Notification not found' });
      const payload = JSON.parse(row.payload);
      res.json({
        id: row.id,
        orderId: row.orderId,
        eventType: row.eventType,
        createdAt: row.createdAt,
        timestamp: payload.timestamp || payload.createdAt || row.createdAt,
        customerName: payload.customerName,
        items: payload.items,
        totalAmount: payload.totalAmount,
        status: payload.status || row.eventType,
        payload
      });
    }
  );
});

app.listen(PORT, async () => {
  console.log(`Notification Service running on port ${PORT}`);
  await connectRabbitMQ();
});
