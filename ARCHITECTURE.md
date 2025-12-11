# Architecture Overview

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Layer                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              React Frontend Application                       │  │
│  │  - Order Form UI    - Notification Dashboard    - Axios      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTP/HTTPS
                              │ REST API Calls
┌─────────────────────────────▼───────────────────────────────────────┐
│                     API Gateway Layer                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Kong API Gateway                          │  │
│  │  - Request Routing    - CORS Handling    - Load Balancing   │  │
│  │  - Rate Limiting      - Authentication    - Logging          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────┬────────────────────────┬────────────────────────┘
                   │                        │
                   │ HTTP                   │ HTTP
┌──────────────────▼────────┐   ┌──────────▼─────────────────────────┐
│   Microservices Layer     │   │    Microservices Layer             │
│  ┌────────────────────┐   │   │   ┌────────────────────────┐      │
│  │  Order Service     │   │   │   │  Notification Service  │      │
│  │  - Order Creation  │   │   │   │  - Message Consumer    │      │
│  │  - Validation      │   │   │   │  - Data Storage        │      │
│  │  - RabbitMQ Pub    │   │   │   │  - API Endpoints       │      │
│  └──────┬─────────────┘   │   │   └────────▲───────────────┘      │
└─────────┼─────────────────┘   └────────────┼────────────────────────┘
          │                                   │
          │ Publish                           │ Consume
          │ (Producer)                        │ (Consumer)
┌─────────▼───────────────────────────────────┴────────────────────────┐
│                    Message Queue Layer                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                        RabbitMQ                              │   │
│  │  Queue: order_notifications                                  │   │
│  │  - Message Persistence    - Acknowledgments    - Durability  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────────┐
│                     Data Persistence Layer                           │
│  ┌──────────────────────┐     ┌──────────────────────────────┐     │
│  │   PostgreSQL DB      │     │   In-Memory Storage          │     │
│  │   (Kong Config)      │     │   (Notifications Cache)      │     │
│  └──────────────────────┘     └──────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Container Architecture (Docker Compose)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Docker Host (restaurant-network)                  │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │   frontend     │  │ order-service  │  │notification-service│  │
│  │  Container     │  │   Container    │  │    Container       │  │
│  │  Port: 3000    │  │  Port: 3001    │  │   Port: 3002       │  │
│  │  (React App)   │  │  (Node.js)     │  │   (Node.js)        │  │
│  └────────────────┘  └────────────────┘  └────────────────────┘  │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │  kong-gateway  │  │ kong-database  │  │    rabbitmq        │  │
│  │   Container    │  │   Container    │  │    Container       │  │
│  │ Port: 8000/8001│  │  Port: 5432    │  │  Port: 5672/15672  │  │
│  │  (Kong 3.4)    │  │ (PostgreSQL)   │  │  (RabbitMQ 3.12)   │  │
│  └────────────────┘  └────────────────┘  └────────────────────┘  │
│                                                                      │
│  ┌────────────────┐                                                 │
│  │  kong-config   │                                                 │
│  │   Container    │  (Init container - configures Kong routes)      │
│  │  (curl/alpine) │                                                 │
│  └────────────────┘                                                 │
│                                                                      │
│  Volumes: kong_data, rabbitmq_data                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## 3. Request Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Order Creation Flow                             │
└─────────────────────────────────────────────────────────────────────┘

 1. User Input               2. API Call             3. Gateway Routing
┌──────────┐              ┌──────────┐              ┌──────────┐
│  React   │─────POST────▶│   Kong   │──────────────▶│  Order   │
│   Form   │ /orders      │ Gateway  │ Route Match  │ Service  │
└──────────┘              └──────────┘              └──────────┘
                               │                          │
                               │ 4. CORS Check            │ 5. Validate
                               │    OPTIONS               │    & Process
                               │                          │
                               ▼                          ▼
                          ┌──────────┐              ┌──────────┐
                          │   CORS   │              │ Generate │
                          │  Plugin  │              │ Order ID │
                          └──────────┘              └──────────┘
                                                          │
                                              6. Publish  │
                                              ┌───────────▼────┐
                                              │   RabbitMQ     │
                                              │     Queue      │
                                              └───────┬────────┘
                                                      │ 7. Consume
                                              ┌───────▼────────┐
                                              │ Notification   │
                                              │    Service     │
                                              └───────┬────────┘
                                                      │ 8. Store
                                                      ▼
                                              ┌──────────────┐
                          ┌───────────────────│  In-Memory   │
                          │ 9. Poll/Fetch     │    Array     │
                          │                   └──────────────┘
                     ┌────▼─────┐
                     │   React  │◀──── 10. Display
                     │Dashboard │      Notification
                     └──────────┘
```

## 4. Microservices Communication Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│               Synchronous vs Asynchronous Communication              │
└─────────────────────────────────────────────────────────────────────┘

SYNCHRONOUS (REST API - Kong Gateway)
─────────────────────────────────────
┌──────────┐    HTTP Request      ┌──────────┐
│ Frontend │────────────────────▶│   Kong   │
└──────────┘                      └────┬─────┘
     ▲                                 │
     │                                 │ Route
     │                                 │
     │          HTTP Response          ▼
     └────────────────────────────┌──────────┐
                 200 OK           │ Service  │
                                  └──────────┘

ASYNCHRONOUS (Message Queue - RabbitMQ)
────────────────────────────────────────
┌──────────┐    1. Publish       ┌──────────┐
│  Order   │────────────────────▶│ RabbitMQ │
│ Service  │    (Fire & Forget)  │  Queue   │
└──────────┘                      └────┬─────┘
                                       │
                                       │ 2. Consume
     ┌─────────────────────────────────┘
     │
     ▼
┌──────────────┐
│Notification  │  (Independent Processing)
│  Service     │
└──────────────┘
```

### Event-Driven Flow (Week 8 – Group A)
```
Client → Kong → Order Service ──> food_events (topic exchange)
                                  ├─ restaurant.q (order.created) → Restaurant Service → emits restaurant.accepted
                                  │                                                  └─> delivery.q (restaurant.accepted) → Delivery Service → emits delivery.assigned
                                  └─ notifications.q (#) → Notification Service stores all events
```
- Exchange: `food_events` (topic)
- Routing keys: `order.created`, `restaurant.accepted`, `delivery.assigned`
- Queues: `restaurant.q`, `delivery.q`, `notifications.q`
- Broker: CloudAMQP by default (amqps). Local RabbitMQ available via `--profile local-rabbit`.
- Persistence: per-service SQLite (`/app/data/*.db`) for orders, restaurant decisions, delivery assignments, notifications; Kong still uses PostgreSQL.

## 5. API Gateway Routing Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Kong Gateway Internals                          │
└─────────────────────────────────────────────────────────────────────┘

External Requests (Port 8000)
         │
         ▼
┌─────────────────────────────────────────┐
│         Kong Proxy Layer                │
│  ┌───────────────────────────────────┐ │
│  │  1. Request Validation            │ │
│  │  2. Route Matching                │ │
│  │  3. Plugin Execution              │ │
│  └───────────────────────────────────┘ │
└────────────┬──────────────┬─────────────┘
             │              │
      Route: /orders    Route: /notifications
             │              │
    ┌────────▼──────┐  ┌────▼──────────────┐
    │ Service Def   │  │  Service Def      │
    │ order-service │  │ notification-svc  │
    └────────┬──────┘  └────┬──────────────┘
             │              │
    ┌────────▼──────┐  ┌────▼──────────────┐
    │  CORS Plugin  │  │   CORS Plugin     │
    │  - Origins: * │  │   - Origins: *    │
    │  - Methods    │  │   - Methods       │
    └────────┬──────┘  └────┬──────────────┘
             │              │
             ▼              ▼
    ┌────────────────────────────────┐
    │    Upstream Services           │
    │  order-service:3001            │
    │  notification-service:3002     │
    └────────────────────────────────┘

┌─────────────────────────────────────────┐
│    Kong Admin API (Port 8001)           │
│  - Service Management                   │
│  - Route Configuration                  │
│  - Plugin Management                    │
│  - Health Checks                        │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│      PostgreSQL Database                │
│  - Services Registry                    │
│  - Routes Configuration                 │
│  - Plugins Configuration                │
└─────────────────────────────────────────┘
```

## 6. Message Queue Architecture (RabbitMQ)

```
┌─────────────────────────────────────────────────────────────────────┐
│                  RabbitMQ Message Flow Pattern                       │
└─────────────────────────────────────────────────────────────────────┘

Producer (Order Service)
         │
         │ 1. Create Order
         │    Message
         ▼
┌─────────────────────────────────────────┐
│          Connection                      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │    Channel     │
         └────────┬───────┘
                  │
         2. Publish to Queue
                  │
                  ▼
┌──────────────────────────────────────────────────────┐
│              RabbitMQ Broker                         │
│  ┌────────────────────────────────────────────────┐ │
│  │   Exchange (Default/Direct)                    │ │
│  └──────────────────┬─────────────────────────────┘ │
│                     │                                │
│                     ▼                                │
│  ┌──────────────────────────────────────────────┐  │
│  │  Queue: order_notifications                  │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐      │  │
│  │  │ Message │  │ Message │  │ Message │ ...  │  │
│  │  │   #1    │  │   #2    │  │   #3    │      │  │
│  │  └─────────┘  └─────────┘  └─────────┘      │  │
│  │  Properties: durable=true, persistent=true  │  │
│  └──────────────────┬───────────────────────────┘  │
└─────────────────────┼──────────────────────────────┘
                      │
         3. Consume   │
                      ▼
         ┌────────────────┐
         │    Channel     │
         └────────┬───────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│          Connection                      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
Consumer (Notification Service)
         │
         │ 4. Process Message
         │ 5. Acknowledge (ACK)
         ▼
   Store Notification
```

## 7. Deployment Architecture

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

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Docker Compose Orchestration                        │
└─────────────────────────────────────────────────────────────────────┘

docker-compose.yml
         │
         │ docker-compose up --build
         ▼
┌──────────────────────────────────────────────────────────┐
│              Build Phase                                  │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐   │
│  │  Frontend  │  │   Order    │  │  Notification   │   │
│  │   Build    │  │   Build    │  │     Build       │   │
│  │ Dockerfile │  │ Dockerfile │  │   Dockerfile    │   │
│  └────────────┘  └────────────┘  └─────────────────┘   │
└──────────────────────────────────────────────────────────┘
         │
         │ Images Created
         ▼
┌──────────────────────────────────────────────────────────┐
│            Container Startup (Sequential)                 │
│  1. PostgreSQL ──▶ Health Check ──▶ Ready                │
│  2. RabbitMQ   ──▶ Health Check ──▶ Ready                │
│  3. Kong Migration ──▶ DB Setup ──▶ Complete             │
│  4. Kong Gateway ──▶ Health Check ──▶ Ready              │
│  5. Order Service ──▶ RabbitMQ Connect ──▶ Ready         │
│  6. Notification Service ──▶ RabbitMQ Connect ──▶ Ready  │
│  7. Frontend ──▶ Start ──▶ Ready                         │
│  8. Kong Config ──▶ Setup Routes ──▶ Complete            │
└──────────────────────────────────────────────────────────┘
         │
         ▼
    System Ready
┌────────────────────────┐
│ Ports Exposed:         │
│ - 3000 (Frontend)      │
│ - 8000 (Kong Proxy)    │
│ - 8001 (Kong Admin)    │
│ - 3001 (Order Service) │
│ - 3002 (Notification)  │
│ - 5672 (RabbitMQ)      │
│ - 15672 (RabbitMQ UI)  │
└────────────────────────┘
```

## 8. Service Interface Architecture (REST API)

```
┌─────────────────────────────────────────────────────────────────────┐
│                       REST API Endpoints                             │
└─────────────────────────────────────────────────────────────────────┘

ORDER SERVICE (:3001)
─────────────────────
POST /orders
├─ Request Body:
│  {
│    "customerName": "string",
│    "items": ["string"],
│    "totalAmount": number
│  }
├─ Response: 201 Created
│  {
│    "message": "Order created successfully",
│    "order": {
│      "orderId": "uuid",
│      "customerName": "string",
│      "items": ["string"],
│      "totalAmount": number,
│      "status": "received",
│      "timestamp": "ISO-8601"
│    }
│  }
└─ Side Effect: Publishes to RabbitMQ

GET /orders
└─ Response: 200 OK
   {
     "message": "Order service is running",
     "endpoint": "POST /orders to create new orders"
   }

GET /health
└─ Response: 200 OK
   {
     "status": "OK",
     "service": "order-service"
   }

NOTIFICATION SERVICE (:3002)
────────────────────────────
GET /notifications
└─ Response: 200 OK
   [
     {
       "orderId": "uuid",
       "customerName": "string",
       "items": ["string"],
       "totalAmount": number,
       "status": "received",
       "timestamp": "ISO-8601",
       "notificationTime": "ISO-8601"
     }
   ]

GET /notifications/:orderId
├─ Response: 200 OK
│  { notification object }
└─ Response: 404 Not Found
   { "error": "Notification not found" }

GET /health
└─ Response: 200 OK
   {
     "status": "OK",
     "service": "notification-service",
     "notificationsCount": number
   }
```

## 9. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    End-to-End Data Flow                              │
└─────────────────────────────────────────────────────────────────────┘

Frontend State
┌──────────────────┐
│ newOrder: {      │
│   customerName   │──┐
│   items          │  │ 1. User submits form
│   totalAmount    │  │    axios.post()
│ }                │  │
└──────────────────┘  │
                      ▼
              ┌──────────────┐
              │  HTTP POST   │ 2. JSON payload
              │  /orders     │    Content-Type: application/json
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │ Kong Gateway │ 3. Route matching
              │ CORS Check   │    Plugin execution
              └──────┬───────┘
                     │
                     ▼
         ┌─────────────────────┐
         │  Order Service      │ 4. Validation
         │  - Validate input   │    Generate UUID
         │  - Generate ID      │    Create order object
         │  - Create order     │
         └────────┬────────────┘
                  │
                  │ 5. Serialize to JSON
                  ▼
         ┌─────────────────────┐
         │   RabbitMQ Queue    │ 6. Message persisted
         │  (order_notifs)     │    to disk
         └────────┬────────────┘
                  │
                  │ 7. Consumer polls
                  ▼
    ┌──────────────────────────┐
    │ Notification Service     │ 8. Deserialize JSON
    │ - Consume message        │    Process order
    │ - Store in array         │    Add notification time
    │ - Log to console         │
    └──────────┬───────────────┘
               │
               │ 9. Store in memory
               ▼
    ┌──────────────────────────┐
    │  notifications = [...]   │
    │  (In-Memory Array)       │
    └──────────┬───────────────┘
               │
               │ 10. Frontend polls
               │     setInterval(3000ms)
               ▼
    ┌──────────────────────────┐
    │   GET /notifications     │ 11. Return array
    │   via Kong Gateway       │     as JSON
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ Frontend State Update    │ 12. setNotifications()
    │ notifications: [...]     │     React re-render
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │   Dashboard Table        │ 13. Display in UI
    │   Renders new row        │
    └──────────────────────────┘
```

## 10. Security & CORS Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CORS & Security Flow                              │
└─────────────────────────────────────────────────────────────────────┘

Browser (localhost:3000)
     │
     │ 1. Preflight Request (CORS)
     │    OPTIONS /orders
     │    Origin: http://localhost:3000
     │    Access-Control-Request-Method: POST
     ▼
┌──────────────────────────────────────────┐
│          Kong Gateway                     │
│  ┌────────────────────────────────────┐  │
│  │  Route Match: /orders              │  │
│  │  Methods: [GET, POST, OPTIONS]     │  │
│  └────────────┬───────────────────────┘  │
│               │                           │
│  ┌────────────▼───────────────────────┐  │
│  │    CORS Plugin                     │  │
│  │  - Check Origin                    │  │
│  │  - Validate Method                 │  │
│  │  - Set CORS Headers                │  │
│  └────────────┬───────────────────────┘  │
└───────────────┼──────────────────────────┘
                │
                │ 2. CORS Response
                │    Access-Control-Allow-Origin: *
                │    Access-Control-Allow-Methods: GET,POST,OPTIONS
                │    Access-Control-Allow-Headers: Accept,Content-Type
                ▼
     Browser validates CORS
                │
                │ 3. Actual Request
                │    POST /orders
                │    Content-Type: application/json
                ▼
        Kong ──▶ Order Service
                │
                │ 4. Response with CORS headers
                ▼
     Browser receives response

Security Layers:
┌─────────────────────────────────────────┐
│ 1. Network Isolation (Docker Network)  │
│    - Internal service communication     │
│    - Only exposed ports accessible      │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ 2. CORS Policy (Kong Plugin)           │
│    - Origin validation                  │
│    - Method restrictions                │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ 3. Input Validation (Service Level)    │
│    - Required field checks              │
│    - Data type validation               │
└─────────────────────────────────────────┘
```

## Future Enhancements

1. Add authentication/authorization
2. Implement persistent storage (MongoDB/PostgreSQL)
3. Add rate limiting via Kong plugins
4. Implement WebSocket for real-time updates
5. Add monitoring/alerting (Prometheus + Grafana)
6. Implement order status updates
7. Add email/SMS notifications
8. Implement order tracking
