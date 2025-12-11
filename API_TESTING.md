# API Testing Guide

## Test the Order Service

### Create an Order
```bash
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "John Doe",
    "items": ["Pizza", "Coke"],
    "totalAmount": 25.50
  }'
```

### Check Order Service Health
```bash
curl http://localhost:3001/health
```

## Test the Notification Service

### Get All Notifications
```bash
curl http://localhost:8000/notifications
```

### Check Notification Service Health
```bash
curl http://localhost:3002/health
```

## Kong Admin API

### List All Services
```bash
curl http://localhost:8001/services
```

### List All Routes
```bash
curl http://localhost:8001/routes
```

### List All Plugins
```bash
curl http://localhost:8001/plugins
```

## RabbitMQ Management

Access the RabbitMQ Management UI at http://localhost:15672
- Username: guest
- Password: guest

You can view:
- Queues and their message counts
- Connections and channels
- Message rates

## Docker Commands

### View logs for a specific service
```bash
docker-compose logs -f order-service
docker-compose logs -f notification-service
docker-compose logs -f kong
```

### View all logs
```bash
docker-compose logs -f
```

### Restart a service
```bash
docker-compose restart order-service
```

### Stop all services
```bash
docker-compose down
```

### Stop and remove volumes
```bash
docker-compose down -v
```

## Testing Flow

1. Start the system: `docker-compose up --build`
2. Wait for all services to be healthy (about 30 seconds)
3. Open frontend: http://localhost:3000
4. Create an order through the UI
5. Watch the notification appear in the dashboard
6. Check notification service logs to see the processed message
