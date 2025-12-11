# Restaurant Order Management System

A microservices-based restaurant order management system with Kong API Gateway, RabbitMQ message queue, and real-time notification dashboard.

## Architecture

- **Frontend**: React application
- **API Gateway**: Kong Community Edition
- **Order Service**: Node.js microservice for handling orders
- **Notification Service**: Node.js microservice for processing notifications
- **Message Queue**: RabbitMQ for asynchronous communication
- **Database**: PostgreSQL for Kong

## Services

### Frontend (Port 3000)
React-based dashboard for placing orders and viewing notifications in real-time.

### Kong API Gateway (Port 8000)
Routes incoming requests to appropriate microservices:
- `/orders` -> Order Service
- `/notifications` -> Notification Service

### Order Service (Port 3001)
Handles order creation and publishes messages to RabbitMQ queue.

### Notification Service (Port 3002)
Consumes messages from RabbitMQ and stores notifications for dashboard display.

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

2. Start all services:
```bash
docker-compose up --build
```

3. Access the application:
- Frontend: http://localhost:3000
- Kong Admin API: http://localhost:8001
- Kong Gateway: http://localhost:8000
- RabbitMQ Management: http://localhost:15672 (guest/guest)

## Usage

1. Open the frontend at http://localhost:3000
2. Fill in the order form with customer details
3. Submit the order
4. Watch the notification dashboard update in real-time

## Development

### Project Structure
```
Arch/
├── frontend/           # React frontend application
├── order-service/      # Order microservice
├── notification-service/  # Notification microservice
├── kong/              # Kong configuration
└── docker-compose.yml # Docker Compose configuration
```

## Environment Variables

Configure services using environment variables in docker-compose.yml

## License

MIT
