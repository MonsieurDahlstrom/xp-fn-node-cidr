# Stage 1: Build TypeScript
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Runtime image
FROM node:20-slim

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

# Set the entrypoint
ENTRYPOINT ["node", "dist/index.js"]