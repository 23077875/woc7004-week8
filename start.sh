#!/bin/bash

echo "Starting Restaurant Order Management System..."
echo "==========================================="

# Build and start all services
docker-compose up --build -d

echo ""
echo "Waiting for services to start..."
sleep 15

echo ""
echo "==========================================="
echo "System is starting up!"
echo "==========================================="
echo ""
echo "Services:"
echo "  Frontend:              http://localhost:3000"
echo "  Kong API Gateway:      http://localhost:8000"
echo "  Kong Admin API:        http://localhost:8001"
echo "  RabbitMQ Management:   http://localhost:15672 (guest/guest)"
echo "  Order Service:         http://localhost:3001"
echo "  Notification Service:  http://localhost:3002"
echo ""
echo "To view logs: docker-compose logs -f [service-name]"
echo "To stop: docker-compose down"
echo "==========================================="
