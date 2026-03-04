# 🌐 Setup Local Domain: whatsapp-bot.local

This guide shows how to access your WhatsApp Bot at `http://whatsapp-bot.local` instead of `http://localhost:3000`.

## 🚀 Quick Setup (Automated)

**macOS/Linux:**
```bash
./setup-local-domain.sh
```

**Windows:**
```batch
Right-click setup-local-domain.bat → Run as administrator
```

The scripts will:
1. Add `whatsapp-bot.local` to your hosts file
2. Flush DNS cache
3. Start Docker containers with your choice of simple or nginx setup
4. Open the dashboard in your browser

---

## 📖 Manual Setup Options

If you prefer manual setup or want to understand what's happening:

## Option 1: Simple /etc/hosts Entry (Recommended for Single Machine)

### Step 1: Edit hosts file

**On macOS/Linux:**
```bash
sudo nano /etc/hosts
```

**On Windows:**
```
# Run as Administrator
notepad C:\Windows\System32\drivers\etc\hosts
```

### Step 2: Add this line

```
127.0.0.1       whatsapp-bot.local
```

### Step 3: Save and test

```bash
# Test DNS resolution
ping whatsapp-bot.local

# Start your Docker container
docker-compose up -d

# Access in browser
open http://whatsapp-bot.local:3000
```

**✅ Pros:** Simple, works immediately
**❌ Cons:** Still need to specify port `:3000`, only works on this machine

---

## Option 2: Nginx Reverse Proxy (Recommended for Production)

Add nginx to handle the domain and remove port requirement.

### Step 1: Create nginx config

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        server_name whatsapp-bot.local;

        location / {
            proxy_pass http://whatsapp-bot:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

### Step 2: Update docker-compose.yml

Replace your current `docker-compose.yml` with:

```yaml
version: '3.8'

services:
  whatsapp-bot:
    build: .
    container_name: whatsapp-bot
    restart: unless-stopped
    # Don't expose port directly - nginx handles it
    expose:
      - "3000"
    networks:
      - whatsapp-network

    environment:
      - NODE_ENV=production
      - PORT=3000

    env_file:
      - .env

    volumes:
      - whatsapp-data:/app/data
      - whatsapp-uploads:/app/uploads
      - whatsapp-auth:/app/.wwebjs_auth
      - whatsapp-cache:/app/.wwebjs_cache

    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    container_name: whatsapp-nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - whatsapp-network
    depends_on:
      - whatsapp-bot

networks:
  whatsapp-network:
    driver: bridge

volumes:
  whatsapp-data:
    driver: local
  whatsapp-uploads:
    driver: local
  whatsapp-auth:
    driver: local
  whatsapp-cache:
    driver: local
```

### Step 3: Add to /etc/hosts

```bash
sudo nano /etc/hosts
# Add this line:
127.0.0.1       whatsapp-bot.local
```

### Step 4: Start services

```bash
docker-compose down
docker-compose up -d

# Access without port number!
open http://whatsapp-bot.local
```

**✅ Pros:** No port number needed, professional setup, production-ready
**❌ Cons:** Slightly more complex

---

## Option 3: mDNS/Avahi (For .local domains on network)

If you want `whatsapp-bot.local` to work across your local network (multiple devices), use mDNS.

### On macOS (Built-in Bonjour)

Update `docker-compose.yml` to add hostname:

```yaml
services:
  whatsapp-bot:
    build: .
    container_name: whatsapp-bot
    hostname: whatsapp-bot  # Add this
    # ... rest of config
```

**Note:** macOS Bonjour automatically advertises `.local` domains, but this only works for the container's internal network.

### On Linux (Install Avahi)

```bash
# Install Avahi
sudo apt-get install avahi-daemon avahi-utils

# Start Avahi
sudo systemctl start avahi-daemon
sudo systemctl enable avahi-daemon

# Advertise the service
sudo avahi-publish -a -R whatsapp-bot.local 127.0.0.1
```

**✅ Pros:** Works across network, no /etc/hosts needed on other devices
**❌ Cons:** More complex, requires additional services

---

## Option 4: Traefik Reverse Proxy (Advanced)

For automatic SSL and advanced routing, use Traefik.

### Step 1: Create `docker-compose.traefik.yml`

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    restart: unless-stopped
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
    ports:
      - "80:80"
      - "8080:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - whatsapp-network

  whatsapp-bot:
    build: .
    container_name: whatsapp-bot
    restart: unless-stopped
    expose:
      - "3000"
    networks:
      - whatsapp-network

    environment:
      - NODE_ENV=production
      - PORT=3000

    env_file:
      - .env

    volumes:
      - whatsapp-data:/app/data
      - whatsapp-uploads:/app/uploads
      - whatsapp-auth:/app/.wwebjs_auth
      - whatsapp-cache:/app/.wwebjs_cache

    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.whatsapp-bot.rule=Host(`whatsapp-bot.local`)"
      - "traefik.http.routers.whatsapp-bot.entrypoints=web"
      - "traefik.http.services.whatsapp-bot.loadbalancer.server.port=3000"

networks:
  whatsapp-network:
    driver: bridge

volumes:
  whatsapp-data:
    driver: local
  whatsapp-uploads:
    driver: local
  whatsapp-auth:
    driver: local
  whatsapp-cache:
    driver: local
```

### Step 2: Add to /etc/hosts

```bash
sudo nano /etc/hosts
# Add:
127.0.0.1       whatsapp-bot.local
```

### Step 3: Start with Traefik

```bash
docker-compose -f docker-compose.traefik.yml up -d

# Access
open http://whatsapp-bot.local

# Traefik Dashboard
open http://localhost:8080
```

**✅ Pros:** Automatic routing, load balancing, SSL support, dashboard
**❌ Cons:** Most complex setup

---

## 🎯 Recommended Setup

**For local development (single machine):**
→ **Option 2: Nginx Reverse Proxy**

**For team/network access:**
→ **Option 4: Traefik Reverse Proxy**

**For quick testing:**
→ **Option 1: /etc/hosts only**

---

## 🔒 Adding HTTPS (Optional)

### Self-Signed Certificate

```bash
# Generate certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout whatsapp-bot.key \
  -out whatsapp-bot.crt \
  -subj "/CN=whatsapp-bot.local"

# Update nginx.conf
server {
    listen 443 ssl;
    server_name whatsapp-bot.local;

    ssl_certificate /etc/nginx/ssl/whatsapp-bot.crt;
    ssl_certificate_key /etc/nginx/ssl/whatsapp-bot.key;

    location / {
        proxy_pass http://whatsapp-bot:3000;
        # ... proxy settings
    }
}

# Update docker-compose.yml
volumes:
  - ./nginx.conf:/etc/nginx/nginx.conf:ro
  - ./whatsapp-bot.crt:/etc/nginx/ssl/whatsapp-bot.crt:ro
  - ./whatsapp-bot.key:/etc/nginx/ssl/whatsapp-bot.key:ro
```

Access at: `https://whatsapp-bot.local` (browser will warn about self-signed cert)

---

## 🧪 Testing

```bash
# Test DNS resolution
ping whatsapp-bot.local

# Test HTTP response
curl http://whatsapp-bot.local

# Test from another device on network (if using mDNS)
# From phone/tablet browser
open http://whatsapp-bot.local
```

---

## ❓ Troubleshooting

**"whatsapp-bot.local" not resolving:**
```bash
# Flush DNS cache (macOS)
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# Flush DNS cache (Linux)
sudo systemd-resolve --flush-caches

# Flush DNS cache (Windows)
ipconfig /flushdns
```

**Port 80 already in use:**
```bash
# Check what's using port 80
sudo lsof -i :80

# Kill the process or change nginx port
# In docker-compose.yml:
ports:
  - "8080:80"  # Use port 8080 instead
# Access: http://whatsapp-bot.local:8080
```

**"Connection refused":**
```bash
# Check containers are running
docker-compose ps

# Check nginx logs
docker-compose logs nginx

# Check whatsapp-bot logs
docker-compose logs whatsapp-bot
```
