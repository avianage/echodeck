#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set. Aborting."
  exit 1
fi

echo "Running Prisma migrations..."
NODE_OPTIONS="--experimental-require-module" node /prisma-cli/node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "Starting the application..."
HOSTNAME=0.0.0.0 exec node server.js