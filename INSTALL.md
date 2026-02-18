# 📦 WhatsApp Bot - Installation Guide

This guide covers all installation methods: one-command remote install, manual setup, and Docker deployment.

---

## 🚀 One-Command Remote Installation (Recommended)

Install and run WhatsApp Bot with a single command on a fresh machine.

### Linux / macOS

Open terminal and run:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

Or using wget:

```bash
wget -qO- https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

### Windows (PowerShell)

**Run PowerShell as Administrator**, then:

```powershell
iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.ps1'))
```

Or:

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.ps1 -UseBasicParsing | Invoke-Expression
```

### What the installer does:

1. ✅ Checks prerequisites (Git, Docker, Docker Compose)
2. ✅ Clones the repository to `~/whatsapp-bot` (or `%USERPROFILE%\whatsapp-bot` on Windows)
3. ✅ Creates `.env` configuration file
4. ✅ Prompts for installation type (simple or with custom domain)
5. ✅ Configures `whatsapp-bot.local` domain (if selected)
6. ✅ Starts Docker containers
7. ✅ Shows access URL and useful commands
8. ✅ Offers to open in browser

### After installation:

1. **Edit API keys:**
   ```bash
   # Linux/Mac
   nano ~/whatsapp-bot/.env

   # Windows
   notepad %USERPROFILE%\whatsapp-bot\.env
   ```

2. **Restart to apply changes:**
   ```bash
   cd ~/whatsapp-bot
   docker-compose restart
   ```

3. **Access the dashboard:**
   - Simple: `http://localhost:3000`
   - Custom domain: `http://whatsapp-bot.local`

---

## 📥 Manual Installation

If you prefer to install manually or the remote script doesn't work:

### Prerequisites

- **Git** - [Download](https://git-scm.com/downloads)
- **Docker** - [Download](https://docs.docker.com/get-docker/)
- **Docker Compose** - Usually included with Docker Desktop

### Step-by-Step

#### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/whatsapp-bot.git
cd whatsapp-bot
```

#### 2. Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit with your API keys
nano .env  # or notepad .env on Windows
```

Add your API keys:
```env
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
```

#### 3. Start with Docker

**Simple (localhost:3000):**
```bash
docker-compose up -d
```

**With custom domain (whatsapp-bot.local):**
```bash
# Add to hosts file first
echo "127.0.0.1       whatsapp-bot.local" | sudo tee -a /etc/hosts

# Start with nginx
docker-compose -f docker-compose.nginx.yml up -d
```

#### 4. Access Dashboard

- Simple: `http://localhost:3000`
- Custom domain: `http://whatsapp-bot.local`

---

## 🐳 Docker Installation Details

### Docker Compose Files

| File | Purpose | Access |
|------|---------|--------|
| `docker-compose.yml` | Simple setup | `localhost:3000` |
| `docker-compose.nginx.yml` | With nginx reverse proxy | `whatsapp-bot.local` (port 80) |

### Data Persistence

All data is stored in Docker volumes and persists across container restarts:

- `whatsapp-data` - Database (SQLite)
- `whatsapp-uploads` - Media files
- `whatsapp-auth` - WhatsApp session data
- `whatsapp-cache` - WhatsApp cache

### Common Commands

```bash
# Start
docker-compose up -d

# Stop (data persists!)
docker-compose down

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# Remove ALL data (⚠️ Warning!)
docker-compose down -v
```

---

## 💻 Local Development (Without Docker)

For development or if you don't want to use Docker:

### Prerequisites

- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/whatsapp-bot.git
cd whatsapp-bot

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
nano .env  # Add your API keys

# 4. Start server
npm start

# 5. Access at http://localhost:3000
```

### Development Mode

If you want auto-reload on file changes:

```bash
# Install nodemon globally (optional)
npm install -g nodemon

# Run with nodemon
nodemon server.js
```

---

## 🌍 Remote Server Installation

For deploying on a VPS or cloud server:

### Quick Install on Remote Server

SSH into your server, then run:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

### Accessing from Internet

**Option 1: Using ngrok (temporary, for testing)**

```bash
# Install ngrok
# Download from https://ngrok.com/download

# Expose port 3000
ngrok http 3000

# Access via: https://random-id.ngrok.io
```

**Option 2: Using a domain with nginx + SSL**

```bash
# Install nginx and certbot
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# Configure nginx
sudo nano /etc/nginx/sites-available/whatsapp-bot

# Add:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/whatsapp-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Access via: https://your-domain.com
```

---

## 🔧 Troubleshooting

### "Command not found" errors

**Git not installed:**
```bash
# Ubuntu/Debian
sudo apt install git

# macOS
xcode-select --install

# Windows
# Download from https://git-scm.com/downloads
```

**Docker not installed:**
- Download Docker Desktop: https://docs.docker.com/get-docker/
- For Linux servers: https://docs.docker.com/engine/install/

### "Port 3000 already in use"

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
echo "PORT=3001" >> .env
docker-compose restart
```

### "Cannot connect to Docker daemon"

```bash
# Start Docker service (Linux)
sudo systemctl start docker

# macOS/Windows: Open Docker Desktop app
```

### "Permission denied" when cloning

```bash
# Use HTTPS instead of SSH
git clone https://github.com/YOUR_USERNAME/whatsapp-bot.git

# Or setup SSH keys
# https://docs.github.com/en/authentication/connecting-to-github-with-ssh
```

### "whatsapp-bot.local" not resolving

```bash
# Verify hosts file entry
cat /etc/hosts | grep whatsapp-bot

# Add if missing
echo "127.0.0.1       whatsapp-bot.local" | sudo tee -a /etc/hosts

# Flush DNS cache
# macOS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# Linux
sudo systemd-resolve --flush-caches

# Windows (as Administrator)
ipconfig /flushdns
```

### Containers won't start

```bash
# Check logs
docker-compose logs

# Check if port is available
sudo lsof -i :3000
sudo lsof -i :80

# Rebuild containers
docker-compose down
docker-compose up -d --build
```

---

## 📋 Post-Installation Checklist

After installation, make sure to:

- [ ] Edit `.env` and add your API keys (Gemini or OpenAI)
- [ ] Restart Docker containers after editing `.env`
- [ ] Create a WhatsApp session (scan QR code)
- [ ] Import test contacts from `sample_contacts.csv`
- [ ] Test sending a message
- [ ] Configure auto-reply settings if needed
- [ ] Set up backups (see [QUICK_REFERENCE.md](QUICK_REFERENCE.md))

---

## 🔐 Security Recommendations

For production deployments:

1. **Use HTTPS** - Set up SSL with Let's Encrypt
2. **Strong passwords** - If adding authentication
3. **Firewall rules** - Restrict access to necessary ports
4. **Regular backups** - Automate database backups
5. **Update regularly** - Keep Docker images and dependencies updated
6. **Environment variables** - Never commit `.env` to git
7. **Limit API keys** - Use API key restrictions in Google Cloud/OpenAI

---

## 🆘 Getting Help

- **Documentation:** Check [README.md](README.md) and [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Logs:** `docker-compose logs -f`
- **Issues:** Report bugs on GitHub Issues
- **Discord/Slack:** [Add your community link]

---

## 📚 Next Steps

After successful installation:

1. **Read the README** - Full feature documentation
2. **Watch the tutorial** - [Add video link if available]
3. **Join community** - [Add community link]
4. **Star the repo** - Help others find this project! ⭐

---

## 🚀 Quick Reference URLs

Update `YOUR_USERNAME` with your GitHub username before sharing:

**Linux/Mac Remote Install:**
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

**Windows Remote Install:**
```powershell
iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.ps1'))
```

**Manual Clone:**
```bash
git clone https://github.com/YOUR_USERNAME/whatsapp-bot.git
```

---

Happy messaging! 📱
