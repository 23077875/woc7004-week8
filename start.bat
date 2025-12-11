@echo off
echo Starting Restaurant Order Management System...
echo ===========================================

IF "%RABBITMQ_URL%"=="" (
  SET RABBITMQ_URL=amqp://rabbitmq:5672
  echo RABBITMQ_URL not set. Using local broker URL (amqp://rabbitmq:5672).
  echo For CloudAMQP, set RABBITMQ_URL=amqps://^<user^>:^<pass^>@^<host^>/^<vhost^> before running.
)

REM Build and start all services (local RabbitMQ is optional via profile local-rabbit)
docker-compose up --build -d

echo.
echo Waiting for services to start...
timeout /t 15 /nobreak

echo.
echo ===========================================
echo System is starting up!
echo ===========================================
echo.
echo Services:
echo   Frontend:              http://localhost:3000
echo   Kong API Gateway:      http://localhost:8000
echo   Kong Admin API:        http://localhost:8001
echo   RabbitMQ Management:   http://localhost:15672 (guest/guest, local profile)
echo   Order Service:         http://localhost:3001
echo   Notification Service:  http://localhost:3002
echo   Restaurant Service:    http://localhost:3003
echo   Delivery Service:      http://localhost:3004
echo.
echo To view logs: docker-compose logs -f [service-name]
echo To stop: docker-compose down
echo ===========================================
pause
