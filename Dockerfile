# syntax=docker/dockerfile:1
# Stage 1: Build & Dependencies
FROM node:18-alpine AS builder

# Cache apk packages between builds (speeds up repeated builds significantly)
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache python3 build-base

WORKDIR /app

COPY package*.json ./

# Cache npm packages between builds — avoids re-downloading on every rebuild
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Copy app source code
COPY . .

# Stage 2: Lean runtime image
FROM node:18-alpine

# Cache apk packages between builds
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

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

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
