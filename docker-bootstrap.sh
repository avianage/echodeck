#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Regenerating Prisma client..."
npx prisma generate

echo "Starting the application..."
exec node server.js