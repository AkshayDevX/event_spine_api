# --- Stage 1: Build ---
FROM node:24-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (like bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code and config
COPY . .

# Build the application
RUN npm run build

# --- Stage 2: Production ---
FROM node:24-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install production dependencies only
COPY package*.json ./
RUN apk add --no-cache python3 make g++ \
    && npm install --omit=dev \
    && apk del python3 make g++

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist
# Copy migrations for database setup
COPY --from=builder /app/drizzle ./drizzle

# Expose API port
EXPOSE 3000

# Entrypoint will be overridden by docker-compose for worker role
CMD ["node", "dist/src/main.js"]
