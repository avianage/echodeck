#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Regenerating Prisma client..."
npx prisma generate

echo "Starting the application..."
exec npm start
