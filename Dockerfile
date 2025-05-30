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
COPY --from=builder /app/proto ./proto
RUN npm ci --omit=dev

# Copy package.yaml to root where Crossplane expects it
COPY --from=builder /app/package.yaml /package.yaml

# Set the entrypoint
ENTRYPOINT ["node", "dist/index.js"]