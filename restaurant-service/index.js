const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;
const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  'amqp://rabbitmq:5672'; // fallback for local rabbit
const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, 'data', 'restaurant.db');
const RESTAURANT_NAME = process.env.RESTAURANT_NAME || 'Demo Kitchen';

app.use(cors());
app.use(express.json());

// Ensure data dir exists and init DB
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS restaurant_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId TEXT,
      restaurantName TEXT,
      status TEXT,
      etaMinutes INTEGER,
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
const INPUT_QUEUE = 'restaurant.q';

async function setupChannel(ch) {
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  await ch.assertQueue(INPUT_QUEUE, { durable: true });
  await ch.bindQueue(INPUT_QUEUE, EXCHANGE, 'order.created');

  // downstream bindings (ensures they exist on first run)
  await ch.assertQueue('delivery.q', { durable: true });
  await ch.bindQueue('delivery.q', EXCHANGE, 'restaurant.accepted');
  await ch.assertQueue('notifications.q', { durable: true });
  await ch.bindQueue('notifications.q', EXCHANGE, '#');
}

function assignEta() {
  // simple deterministic ETA (10-25 minutes)
  return 10 + Math.floor(Math.random() * 16);
}

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
    console.log('Waiting for orders...');

    channel.consume(
      INPUT_QUEUE,
      async (msg) => {
        if (!msg) return;
        try {
          const order = JSON.parse(msg.content.toString());
          const acceptedAt = new Date().toISOString();
          const etaMinutes = assignEta();

          const acceptance = {
            orderId: order.orderId,
            customerName: order.customerName,
            items: order.items,
            totalAmount: order.totalAmount,
            status: 'accepted',
            restaurant: RESTAURANT_NAME,
            etaMinutes,
            acceptedAt
          };

          await runAsync(
            db,
            `INSERT INTO restaurant_events (orderId, restaurantName, status, etaMinutes, payload, createdAt)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              acceptance.orderId,
              acceptance.restaurant,
              acceptance.status,
              acceptance.etaMinutes,
              JSON.stringify(acceptance),
              acceptedAt
            ]
          );

          channel.publish(
            EXCHANGE,
            'restaurant.accepted',
            Buffer.from(JSON.stringify(acceptance)),
            { persistent: true }
          );

          console.log('Order accepted by restaurant', {
            orderId: acceptance.orderId,
            etaMinutes
          });
          channel.ack(msg);
        } catch (err) {
          console.error('Failed to process restaurant acceptance:', err);
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

process.on('SIGINT', async () => {
  if (channel) await channel.close();
  if (connection) await connection.close();
  db.close();
  process.exit(0);
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'restaurant-service',
    queue: channel ? 'up' : 'down'
  });
});

app.get('/restaurant/events', (req, res) => {
  const { orderId, limit = 100 } = req.query;
  const parsedLimit = parseInt(limit, 10);
  const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;
  const boundedLimit = Math.min(safeLimit, 500);
  const params = [];
  let sql = `SELECT * FROM restaurant_events`;
  if (orderId) {
    sql += ` WHERE orderId = ?`;
    params.push(orderId);
  }
  sql += ` ORDER BY id DESC LIMIT ?`;
  params.push(boundedLimit);

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error reading restaurant events:', err);
      return res.status(500).json({ error: 'Failed to read events' });
    }
    const parsed = rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      restaurantName: r.restaurantName,
      status: r.status,
      etaMinutes: r.etaMinutes,
      createdAt: r.createdAt,
      payload: JSON.parse(r.payload)
    }));
    res.json(parsed);
  });
});

app.listen(PORT, async () => {
  console.log(`Restaurant Service running on port ${PORT}`);
  await connectRabbitMQ();
});

