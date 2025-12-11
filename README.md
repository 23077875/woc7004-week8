# Restaurant Order Management System

A microservices/event-driven food ordering simulation (Group A – Week 8) with Kong gateway, RabbitMQ/CloudAMQP, and per-service SQLite persistence.

## Architecture

- **Frontend**: React app (port 3000)
- **API Gateway**: Kong (ports 8000/8001)
- **Order Service**: Receives orders, persists to SQLite, emits `order.created`
- **Restaurant Service**: Consumes `order.created`, persists acceptance, emits `restaurant.accepted`
- **Delivery Service**: Consumes `restaurant.accepted`, assigns driver, emits `delivery.assigned`
- **Notification Service**: Consumes all events, persists to SQLite
- **Message Broker**: RabbitMQ topic exchange `food_events` (set `RABBITMQ_URL` for CloudAMQP; local broker with profile `local-rabbit`)
- **Database**: PostgreSQL (Kong), SQLite files per service

## Services & Routes
- `/orders` -> Order Service (3001)
- `/restaurant` -> Restaurant Service (3003)
- `/delivery` -> Delivery Service (3004)
- `/notifications` -> Notification Service (3002)

## Getting Started

### Prerequisites
- Docker
- Docker Compose
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Arch
```

2. Start all services (set `RABBITMQ_URL` for CloudAMQP, or use local default):
```bash
docker-compose up --build
```

To use local RabbitMQ, enable profile:
```bash
docker-compose --profile local-rabbit up --build
```

3. Access the application:
- Frontend: http://localhost:3000
- Kong Admin API: http://localhost:8001
- Kong Gateway: http://localhost:8000
- RabbitMQ Management (local profile): http://localhost:15672 (guest/guest)

Frontend API base:
- Copy `frontend/env.example` to `frontend/.env` (or `.env.local`) and set `REACT_APP_API_BASE_URL`.
- Common values: `http://localhost:8000` (via Kong) or `http://localhost:3001` (direct order-service).

## Usage
1) Post orders via gateway: `POST http://localhost:8000/orders`
2) Poll recent notifications: `GET http://localhost:8000/notifications`
3) Inspect persistence (service ports): `/restaurant/events`, `/delivery/events`

## Load Testing (k6)
- Normal load (50 rps for 2m):
  ```bash
  k6 run k6/load-normal.js -e KONG_URL=http://localhost:8000/orders
  ```
- Peak load (200 rps for 2m):
  ```bash
  k6 run k6/load-peak.js -e KONG_URL=http://localhost:8000/orders
  ```

## Environment Variables
- `RABBITMQ_URL`: set to your CloudAMQP amqps://… URL; defaults to `amqp://rabbitmq:5672` (local broker/profile)
- `DB_PATH` per service (defaults to /app/data/*.db)
- `REACT_APP_API_BASE_URL`: frontend base URL for API calls (e.g., `http://localhost:8000` for Kong or `http://localhost:3001` direct)
  

## License
MIT
