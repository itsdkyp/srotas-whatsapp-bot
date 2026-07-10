# syntax=docker/dockerfile:1
# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

# python3 + build-base needed for better-sqlite3 native compilation
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache python3 build-base

WORKDIR /app

COPY package*.json ./

# Cache npm packages between builds — avoids re-downloading on every rebuild
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Copy app source code
COPY . .

# Build the Next.js frontend (exports static files to /app/public)
RUN npm run build:ui

# Stage 2: Lean runtime image
# No Chromium needed! Baileys connects via WebSocket directly.
FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Copy only production dependencies and source from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./
COPY --from=builder /app/sample_contacts.csv ./

RUN mkdir -p data uploads .wwebjs_auth .wwebjs_cache

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "--max-old-space-size=256", "server.js"]
