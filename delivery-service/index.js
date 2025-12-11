const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3004;
const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  'amqp://rabbitmq:5672'; // fallback for local rabbit
const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, 'data', 'delivery.db');

app.use(cors());
app.use(express.json());

// Ensure data dir exists and init DB
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS delivery_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId TEXT,
      driverName TEXT,
      status TEXT,
      etaMinutes INTEGER,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );`
  );
});

let channel = null;
let connection = null;
const EXCHANGE = 'food_events';
const INPUT_QUEUE = 'delivery.q';

const DRIVERS = ['Alex', 'Jamie', 'Taylor', 'Sam', 'Jordan', 'Lee', 'Morgan'];

function pickDriver() {
  return DRIVERS[Math.floor(Math.random() * DRIVERS.length)];
}

async function setupChannel(ch) {
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
  await ch.assertQueue(INPUT_QUEUE, { durable: true });
  await ch.bindQueue(INPUT_QUEUE, EXCHANGE, 'restaurant.accepted');

  await ch.assertQueue('notifications.q', { durable: true });
  await ch.bindQueue('notifications.q', EXCHANGE, '#');
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
    console.log('Waiting for restaurant acceptances...');

    channel.consume(
      INPUT_QUEUE,
      (msg) => {
        if (!msg) return;
        const accepted = JSON.parse(msg.content.toString());
        const driverName = pickDriver();
        const assignedAt = new Date().toISOString();
        const etaMinutes = Math.max(5, (accepted.etaMinutes || 15) - 5);

        const assignment = {
          orderId: accepted.orderId,
          driverName,
          status: 'driver_assigned',
          etaMinutes,
          assignedAt,
          restaurant: accepted.restaurant,
          customerName: accepted.customerName,
          items: accepted.items,
          totalAmount: accepted.totalAmount
        };

        db.run(
          `INSERT INTO delivery_events (orderId, driverName, status, etaMinutes, payload, createdAt)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            assignment.orderId,
            assignment.driverName,
            assignment.status,
            assignment.etaMinutes,
            JSON.stringify(assignment),
            assignedAt
          ],
          (err) => {
            if (err) {
              console.error('Failed to persist delivery event:', err);
            }
          }
        );

        channel.publish(
          EXCHANGE,
          'delivery.assigned',
          Buffer.from(JSON.stringify(assignment)),
          { persistent: true }
        );

        console.log('Driver assigned', {
          orderId: assignment.orderId,
          driver: assignment.driverName
        });
        channel.ack(msg);
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
    service: 'delivery-service',
    queue: channel ? 'up' : 'down'
  });
});

app.get('/delivery/events', (req, res) => {
  const { orderId, limit = 100 } = req.query;
  const boundedLimit = Math.min(parseInt(limit, 10) || 100, 500);
  const params = [];
  let sql = `SELECT * FROM delivery_events`;
  if (orderId) {
    sql += ` WHERE orderId = ?`;
    params.push(orderId);
  }
  sql += ` ORDER BY id DESC LIMIT ?`;
  params.push(boundedLimit);

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error reading delivery events:', err);
      return res.status(500).json({ error: 'Failed to read events' });
    }
    const parsed = rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      driverName: r.driverName,
      status: r.status,
      etaMinutes: r.etaMinutes,
      createdAt: r.createdAt,
      payload: JSON.parse(r.payload)
    }));
    res.json(parsed);
  });
});

app.listen(PORT, async () => {
  console.log(`Delivery Service running on port ${PORT}`);
  await connectRabbitMQ();
});

