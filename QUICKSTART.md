# Quick Start Guide

## Prerequisites
- Docker Desktop installed and running
- Git installed
- At least 4GB of free RAM

## Step 1: Start the System

### On Windows:
```bash
.\start.bat
```

### On Linux/Mac:
```bash
chmod +x start.sh
./start.sh
```

### Or manually:
```bash
docker-compose up --build -d
```

Use local RabbitMQ with:
```bash
docker-compose --profile local-rabbit up --build -d
```

## Step 2: Wait for Services

Wait about 30-60 seconds for all services to start and be configured.

You can check the status with:
```bash
docker-compose ps
```

## Step 3: Access the Application

Open your browser and go to: **http://localhost:3000**

## Step 4: Test the System

1. **Place an Order**:
   - Fill in the customer name (e.g., "John Doe")
   - Add items separated by commas (e.g., "Pizza, Burger, Coke")
   - Enter total amount (e.g., 45.50)
   - Click "Place Order"

2. **View Notifications**:
   - Fetch via `http://localhost:8000/notifications`
   - Each notification shows order details, stage, timestamp

## Step 5: Monitor Services

### View Logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f order-service
docker-compose logs -f notification-service
```

### RabbitMQ Management UI (local profile):
- URL: http://localhost:15672
- Username: guest
- Password: guest

### Kong Admin API:
```bash
# List services
curl http://localhost:8001/services

# List routes
curl http://localhost:8001/routes
```

## Troubleshooting

### Services not starting?
```bash
docker-compose down -v
docker-compose up --build
```

### Can't access frontend?
- Check if port 3000 is available
- Verify frontend container is running: `docker ps`

### Orders not appearing?
- Check RabbitMQ is running
- View notification-service logs: `docker-compose logs notification-service`
- Verify queue exists in RabbitMQ UI

### Kong routing issues?
- Check Kong logs: `docker-compose logs kong`
- Verify services are registered: `curl http://localhost:8001/services`

## Stopping the System

```bash
docker-compose down
```

To also remove volumes:
```bash
docker-compose down -v
```

## Architecture Flow

```
User → Frontend → Kong Gateway → Order Service → food_events exchange (CloudAMQP/RabbitMQ)
                                                                   ↓
                                             Restaurant Service → Delivery Service
                                                                   ↓
                         User ← Frontend ← Kong Gateway ← Notification Service
```

## Service URLs

- **Frontend**: http://localhost:3000
- **Kong Gateway**: http://localhost:8000
- **Kong Admin**: http://localhost:8001
- **Order Service**: http://localhost:3001
- **Restaurant Service**: http://localhost:3003
- **Delivery Service**: http://localhost:3004
- **Notification Service**: http://localhost:3002
- **RabbitMQ UI (local)**: http://localhost:15672

## Testing API Directly

### Create Order:
```bash
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Jane Smith",
    "items": ["Pasta", "Salad", "Water"],
    "totalAmount": 32.00
  }'
```

### Get Notifications:
```bash
curl http://localhost:8000/notifications
```

### Get Restaurant Events:
```bash
curl http://localhost:8000/restaurant/events
```

### Get Delivery Events:
```bash
curl http://localhost:8000/delivery/events
```

## Next Steps

- Check `ARCHITECTURE.md` for system design details
- Check `API_TESTING.md` for more API examples
- Check `README.md` for complete documentation

Set `RABBITMQ_URL` to your CloudAMQP amqps://... when not running the local broker profile.

Enjoy your Restaurant Order Management System! 🍽️
