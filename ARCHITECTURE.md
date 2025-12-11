# Architecture Overview

## System Diagram

```
┌─────────────┐
│   Browser   │
│  (React)    │
└──────┬──────┘
       │
       │ HTTP (Port 3000)
       │
       v
┌─────────────────────────────────────────┐
│         Kong API Gateway                │
│           (Port 8000)                   │
│                                         │
│  Routes:                                │
│  - /orders → order-service              │
│  - /notifications → notification-service│
└────┬──────────────────────┬─────────────┘
     │                      │
     │ HTTP                 │ HTTP
     │                      │
     v                      v
┌──────────────┐     ┌─────────────────┐
│Order Service │     │Notification Svc │
│  (Port 3001) │     │   (Port 3002)   │
└──────┬───────┘     └────────▲────────┘
       │                      │
       │                      │
       │ Publish              │ Consume
       │                      │
       v                      │
┌──────────────────────────────┴────────┐
│          RabbitMQ                     │
│    Queue: order_notifications         │
│         (Port 5672)                   │
└───────────────────────────────────────┘
```

## Components

### 1. Frontend (React)
- **Technology**: React 18
- **Port**: 3000
- **Purpose**: User interface for placing orders and viewing notifications
- **Features**:
  - Order form for placing new orders
  - Real-time notification dashboard
  - Auto-refresh every 3 seconds

### 2. Kong API Gateway
- **Technology**: Kong Gateway 3.4 (Community Edition)
- **Ports**: 
  - 8000 (Proxy)
  - 8001 (Admin API)
- **Purpose**: Central API Gateway for routing and managing requests
- **Features**:
  - Route management
  - CORS plugin enabled
  - Request/Response logging
  - Service discovery

### 3. Order Service (Microservice)
- **Technology**: Node.js + Express
- **Port**: 3001
- **Purpose**: Handle order creation and publish to message queue
- **Endpoints**:
  - `POST /orders` - Create new order
  - `GET /health` - Health check
- **Flow**:
  1. Receive order request
  2. Validate order data
  3. Generate unique order ID
  4. Publish to RabbitMQ queue
  5. Return success response

### 4. Notification Service (Microservice)
- **Technology**: Node.js + Express
- **Port**: 3002
- **Purpose**: Consume messages from queue and serve notifications
- **Endpoints**:
  - `GET /notifications` - Get all notifications
  - `GET /notifications/:orderId` - Get specific notification
  - `GET /health` - Health check
- **Flow**:
  1. Listen to RabbitMQ queue
  2. Consume order messages
  3. Store in memory (can be extended to database)
  4. Log to console
  5. Serve via API

### 5. RabbitMQ
- **Technology**: RabbitMQ 3.12
- **Ports**: 
  - 5672 (AMQP)
  - 15672 (Management UI)
- **Purpose**: Message broker for asynchronous communication
- **Queue**: `order_notifications`
- **Features**:
  - Durable queue
  - Message persistence
  - Manual acknowledgment

### 6. PostgreSQL
- **Technology**: PostgreSQL 15
- **Port**: 5432
- **Purpose**: Database for Kong configuration
- **Usage**: Stores Kong services, routes, and plugins

## Communication Flow

### Order Creation Flow:
1. User fills order form in React frontend
2. Frontend sends POST request to Kong Gateway at `http://localhost:8000/orders`
3. Kong routes request to Order Service
4. Order Service validates and creates order
5. Order Service publishes message to RabbitMQ queue
6. Order Service returns success response
7. Notification Service consumes message from queue
8. Notification Service stores notification
9. Frontend polls `/notifications` endpoint
10. Kong routes request to Notification Service
11. Notification Service returns all notifications
12. Frontend displays notifications in dashboard

## Security Considerations

- CORS enabled for cross-origin requests
- Input validation on order creation
- Health check endpoints for monitoring
- Environment variables for configuration
- Service-to-service communication within Docker network

## Scalability

- Services are containerized and can be scaled independently
- RabbitMQ queue ensures reliable message delivery
- Kong Gateway can be configured with load balancing
- Stateless services allow horizontal scaling

## Monitoring

- RabbitMQ Management UI for queue monitoring
- Kong Admin API for gateway monitoring
- Docker logs for each service
- Health check endpoints for all services

## Future Enhancements

1. Add authentication/authorization
2. Implement persistent storage (MongoDB/PostgreSQL)
3. Add rate limiting via Kong plugins
4. Implement WebSocket for real-time updates
5. Add monitoring/alerting (Prometheus + Grafana)
6. Implement order status updates
7. Add email/SMS notifications
8. Implement order tracking
