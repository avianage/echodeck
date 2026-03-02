#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

echo "Running Prisma migrations..."
# In production, we use 'migrate deploy' to apply pending migrations
# Use npx to run the prisma CLI
npx prisma migrate deploy

echo "Starting the application..."
exec node server.js
