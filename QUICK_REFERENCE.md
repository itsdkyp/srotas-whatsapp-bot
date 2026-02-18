# 🚀 Quick Reference - WhatsApp Bot

## Access URLs

| Setup | URL | Port | Notes |
|-------|-----|------|-------|
| **Local (Node.js)** | `http://localhost:3000` | 3000 | No Docker |
| **Docker Simple** | `http://localhost:3000` | 3000 | With Docker |
| **Docker + Nginx** | `http://whatsapp-bot.local` | 80 | Requires hosts file |
| **Docker + Nginx (port)** | `http://whatsapp-bot.local:3000` | 3000 | Alternative |

## Common Commands

### Local Development (Node.js)
```bash
npm install              # Install dependencies
npm start                # Start server
npm run dev              # Start with auto-reload (if configured)
```

### Docker - Simple
```bash
docker-compose up -d              # Start
docker-compose down               # Stop
docker-compose restart            # Restart
docker-compose logs -f            # View logs
docker-compose ps                 # Check status
docker-compose down -v            # Remove with volumes (⚠️ deletes data)
```

### Docker - With Nginx (Custom Domain)
```bash
./setup-local-domain.sh           # Automated setup (recommended)

# Or manually:
docker-compose -f docker-compose.nginx.yml up -d      # Start
docker-compose -f docker-compose.nginx.yml down       # Stop
docker-compose -f docker-compose.nginx.yml logs -f    # View logs
docker-compose -f docker-compose.nginx.yml restart    # Restart
```

## Setup Custom Domain (whatsapp-bot.local)

### Quickest Way
```bash
./setup-local-domain.sh
```

### Manual Way
```bash
# 1. Add to hosts file
echo "127.0.0.1       whatsapp-bot.local" | sudo tee -a /etc/hosts

# 2. Flush DNS cache
# macOS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# Linux
sudo systemd-resolve --flush-caches

# 3. Start with nginx
docker-compose -f docker-compose.nginx.yml up -d

# 4. Access
open http://whatsapp-bot.local
```

## Data Management

### Backup
```bash
# Quick backup
docker run --rm \
  -v whatsapp-bot_whatsapp-data:/data \
  -v whatsapp-bot_whatsapp-auth:/auth \
  -v $(pwd):/backup \
  alpine tar czf /backup/backup-$(date +%Y%m%d).tar.gz /data /auth
```

### Restore
```bash
# Stop containers first
docker-compose down

# Restore from backup
docker run --rm \
  -v whatsapp-bot_whatsapp-data:/data \
  -v whatsapp-bot_whatsapp-auth:/auth \
  -v $(pwd):/backup \
  alpine tar xzf /backup/backup-YYYYMMDD.tar.gz

# Start containers
docker-compose up -d
```

### Check Data Volumes
```bash
docker volume ls | grep whatsapp           # List volumes
docker volume inspect whatsapp-bot_whatsapp-data   # Inspect volume
```

## Troubleshooting

### Port Already in Use
```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port in docker-compose.yml
ports:
  - "3001:3000"
```

### Container Won't Start
```bash
# Check logs
docker-compose logs

# Check container status
docker-compose ps

# Rebuild
docker-compose up -d --build
```

### Can't Access whatsapp-bot.local
```bash
# Test DNS resolution
ping whatsapp-bot.local

# Flush DNS cache (macOS)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Check hosts file
cat /etc/hosts | grep whatsapp-bot

# Restart nginx
docker-compose -f docker-compose.nginx.yml restart nginx
```

### Data Not Persisting
```bash
# Check volume mounts
docker inspect whatsapp-bot | grep -A 20 Mounts

# Verify volumes exist
docker volume ls | grep whatsapp

# Check volume data
docker run --rm -v whatsapp-bot_whatsapp-data:/data alpine ls -la /data
```

## Environment Variables

Edit `.env` file:

```env
# Server
PORT=3000

# AI Configuration
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# Auto-Reply
AUTO_REPLY_ENABLED=true
SYSTEM_PROMPT=You are a helpful assistant.

# Delays (milliseconds)
MIN_DELAY_MS=8000
MAX_DELAY_MS=18000
```

## File Locations

### Local Development
```
data/bot.db              # SQLite database
uploads/                 # Uploaded files
.wwebjs_auth/            # WhatsApp sessions
```

### Docker Volumes
```
whatsapp-bot_whatsapp-data      # Database
whatsapp-bot_whatsapp-uploads   # Uploaded files
whatsapp-bot_whatsapp-auth      # WhatsApp sessions
whatsapp-bot_whatsapp-cache     # WhatsApp cache
```

## Health Checks

```bash
# Check if server is running
curl http://localhost:3000

# With custom domain
curl http://whatsapp-bot.local

# Check container health
docker inspect whatsapp-bot | grep -A 10 Health

# Check nginx health
docker inspect whatsapp-nginx | grep -A 10 Health
```

## Logs

### Local Development
```bash
# Server output (if running npm start)
# Logs appear in terminal
```

### Docker
```bash
# All containers
docker-compose logs -f

# Specific service
docker-compose logs -f whatsapp-bot
docker-compose logs -f nginx

# Last 100 lines
docker-compose logs --tail=100

# Since specific time
docker-compose logs --since="2024-02-18T00:00:00"
```

## Performance

### Check Resource Usage
```bash
# Docker stats
docker stats

# Container-specific
docker stats whatsapp-bot
```

### Optimize
```bash
# Clean up unused Docker resources
docker system prune -a

# Remove old images
docker image prune -a
```

## Network Access

### Access from Other Devices on Network
```bash
# Find your local IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Access from phone/tablet
# http://<YOUR_LOCAL_IP>:3000
# Example: http://192.168.1.100:3000
```

### Port Forwarding (for remote access)
⚠️ **Not recommended for production without proper security**

```bash
# Using ngrok (requires account)
ngrok http 3000
# Access via provided URL: https://random-id.ngrok.io
```

## Production Checklist

- [ ] Set strong `SESSION_SECRET` in `.env`
- [ ] Enable HTTPS (use reverse proxy like nginx with Let's Encrypt)
- [ ] Set up firewall rules
- [ ] Configure backup automation
- [ ] Monitor disk space for volumes
- [ ] Set up logging/monitoring (e.g., Prometheus + Grafana)
- [ ] Enable container restart policies
- [ ] Review and secure API keys
- [ ] Set proper file upload limits
- [ ] Configure rate limiting
