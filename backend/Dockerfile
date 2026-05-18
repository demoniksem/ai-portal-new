# Stage 1: Production dependencies only
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Stage 2: Build stage — compile TypeScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine
WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Set environment
ENV NODE_ENV=production

# Run as non-root user. Pre-create the uploads directory owned by that user —
# the app writes uploads under dist/uploads at startup, and the copied dist/ is
# root-owned, so without this the non-root process crashes with EACCES.
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/dist/uploads && \
    chown -R nodejs:nodejs /app/dist/uploads
USER nodejs

EXPOSE 3001

CMD ["node", "dist/index.js"]
