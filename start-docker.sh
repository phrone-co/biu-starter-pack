#!/bin/bash


echo "📥 Pulling latest images..."
docker-compose pull


# Define environment variables directly
echo "🧹 Cleaning up old containers..."

# Stop and remove containers defined in the docker-compose file


echo "🚀 Starting Docker Compose services..."

# Run Docker Compose with inline environment variables
docker-compose up

echo "✅ Services started successfully!"

# Show running containers
echo "📦 Running containers:"
docker ps

# Show logs (optional)
echo "📜 Showing logs (Press Ctrl+C to exit)..."
docker-compose logs -f
