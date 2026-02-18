# 🤖 WhatsApp Bot Dashboard

A full-stack WhatsApp automation tool with a modern dark-themed web dashboard. Supports multi-account QR login, CSV/Excel contact import, personalized bulk messaging, AI-powered auto-reply, and scheduled recurring messages.

---

## 🚀 One-Command Installation (Easiest)

Install on a fresh machine with a single command:

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

**Windows (PowerShell as Administrator):**
```powershell
iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.ps1'))
```

The installer will:
- ✅ Check prerequisites (Git, Docker, Docker Compose)
- ✅ Clone the repository
- ✅ Setup configuration
- ✅ Start Docker containers
- ✅ Show you the URL to access

**See [INSTALL.md](INSTALL.md) for detailed installation options and troubleshooting.**

---

## ⚡ Quick Start (Manual)

### Option 1: Using Node.js (Local)

```bash
# 1. Install dependencies
npm install

# 2. Configure (optional — can also configure via Settings page)
cp .env.example .env
# Edit .env to add your Gemini/OpenAI API key

# 3. Start the server
npm start

# 4. Open the dashboard
open http://localhost:3000
```

### Option 2: Using Docker (Recommended for Production)

**Simple Setup (access via localhost:3000):**
```bash
# 1. Create .env file with your API keys
cp .env.example .env
# Edit .env to add your Gemini/OpenAI API key

# 2. Build and start the container
docker-compose up -d

# 3. Open the dashboard
open http://localhost:3000

# 4. View logs (optional)
docker-compose logs -f

# 5. Stop the container
docker-compose down
```

**Advanced Setup with Custom Domain (access via whatsapp-bot.local):**
```bash
# Automated setup script (macOS/Linux only)
./setup-local-domain.sh

# Or manual setup:
# 1. Add to /etc/hosts
echo "127.0.0.1       whatsapp-bot.local" | sudo tee -a /etc/hosts

# 2. Start with nginx reverse proxy
docker-compose -f docker-compose.nginx.yml up -d

# 3. Open the dashboard
open http://whatsapp-bot.local
```

See [SETUP_LOCAL_DOMAIN.md](SETUP_LOCAL_DOMAIN.md) for detailed instructions and other options.

**✅ Data Persistence with Docker:**
- All data (database, WhatsApp sessions, uploads) is stored in Docker volumes
- Data **survives container restarts and recreations**
- To completely remove data: `docker-compose down -v` (⚠️ warning: deletes all data)
- To backup data: `docker run --rm -v whatsapp-bot_whatsapp-data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data`

---

## 📱 Features

### 1. WhatsApp Sessions (QR Login)

Connect one or more WhatsApp accounts by scanning a QR code.

1. Go to **Sessions** page
2. Click **"+ Add Account"**
3. Enter a name (e.g. "Business", "Personal")
4. Click **"Create & Get QR"**
5. A QR code will appear — scan it with your WhatsApp mobile app:
   - Open WhatsApp → **Settings** → **Linked Devices** → **Link a Device**
6. Once scanned, the session will show **● Connected**

> **Note:** Sessions persist across server restarts using local auth files stored in `.wwebjs_auth/`.

### 2. Contact Import (CSV / Excel)

Import contacts from `.csv`, `.xlsx`, or `.xls` files.

1. Go to **Contacts** page
2. Click **"📁 Import File"**
3. Select your file — the bot auto-detects columns:
   - **phone** — required (phone number with country code)
   - **name** — contact name
   - **company** — company/organization name
   - Any extra columns become custom template fields
4. Preview the parsed data
5. Enter a **group name** (e.g. "clients", "leads")
6. Click **"✅ Import Contacts"**

#### CSV Format

```csv
phone,name,company,city
+919876543210,Rahul Sharma,TechCorp,Bangalore
+919876543211,Priya Patel,WebIndia,Mumbai
```

- The `phone` column must include the country code (e.g. `+91`, `+1`)
- Column names are case-insensitive and auto-matched
- Extra columns (like `city`) can be used as `{{city}}` in message templates

### 3. Bulk Messaging with Templates

Send personalized messages to entire contact groups.

1. Go to **Messages** page
2. Select the **session** to send from
3. Select the **contact group** to send to
4. Write a **message template** using placeholders:

```
Hello {{name}},

Greetings from {{company}}! We wanted to let you know about our latest updates for {{city}} area.

Best regards,
Team
```

5. See the **Live Preview** with actual contact data filled in
6. Set **delays** between messages (to avoid rate limiting)
7. Click **"🚀 Send to All"**

#### Available Placeholders

| Placeholder | Source |
|---|---|
| `{{name}}` | Contact's name |
| `{{company}}` | Contact's company |
| `{{phone}}` | Contact's phone number |
| `{{any_column}}` | Any custom column from your CSV/Excel file |

### 4. Scheduled / Recurring Messages

Automate message sends on a daily, weekly, or monthly schedule.

1. Go to **Scheduler** page
2. Click **"+ New Schedule"**
3. Fill in:
   - **Schedule Name** — descriptive label
   - **Session** — which WhatsApp account to send from
   - **Contact Group** — which contacts to send to
   - **Message Template** — with `{{placeholders}}`
   - **Frequency** — Daily, Weekly, or Monthly
   - **Day of Week** (for weekly) or **Day of Month** (for monthly)
   - **Send Time** — when to send (24-hour format)
4. Click **"✅ Create Schedule"**

Schedules can be **toggled on/off** and show **next run** / **last run** timestamps.

> **Important:** The scheduler runs as long as the server is running. If you restart the server, pending schedules will resume automatically.

### 5. AI Auto-Reply

Automatically reply to incoming WhatsApp messages using Gemini or OpenAI.

1. Go to **Settings** page:
   - Select **AI Provider** (Google Gemini or OpenAI)
   - Enter your **API Key**
   - Customize the **System Prompt** (personality/instructions for the AI)
   - Click **"💾 Save Settings"**
2. Go to **Sessions** page:
   - Toggle **Auto-Reply** ON for the session you want

The bot stores all conversation history locally in SQLite, giving the AI context for follow-up responses.

---

## 📁 Project Structure

```
whatsapp-bot/
├── server.js                         # Express server + API routes
├── package.json
├── .env                              # Environment configuration
├── .env.example                      # Template for .env
├── .gitignore
├── sample_contacts.csv               # Small test CSV (5 contacts)
├── test_contacts_large.csv           # Larger test CSV (20 contacts)
│
├── src/
│   ├── db/database.js                # SQLite database + tables
│   ├── whatsapp/
│   │   ├── sessionManager.js         # Multi-account WA client manager
│   │   └── messageHandler.js         # Incoming message + auto-reply
│   ├── contacts/importer.js          # CSV/Excel parser
│   ├── messaging/
│   │   ├── bulkSender.js             # Template engine + bulk queue
│   │   └── scheduler.js              # Daily/weekly/monthly job scheduler
│   └── ai/
│       ├── provider.js               # Gemini/OpenAI adapter
│       └── memory.js                 # Conversation history storage
│
├── public/                           # Frontend (SPA)
│   ├── index.html                    # Dashboard shell
│   ├── css/style.css                 # Dark theme styles
│   └── js/
│       ├── app.js                    # Router + utilities
│       ├── sessions.js               # Sessions page logic
│       ├── contacts.js               # Contacts page logic
│       ├── messaging.js              # Bulk messaging page logic
│       ├── scheduler.js              # Scheduler page logic
│       └── settings.js               # Settings page logic
│
├── data/                             # SQLite database (auto-created)
├── uploads/                          # Uploaded CSV/XLSX files (auto-created)
└── .wwebjs_auth/                     # WhatsApp session auth (auto-created)
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `AI_PROVIDER` | `gemini` | AI provider: `gemini` or `openai` |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `AUTO_REPLY_ENABLED` | `true` | Global auto-reply toggle |
| `SYSTEM_PROMPT` | `You are a helpful assistant.` | System prompt for AI replies |
| `MIN_DELAY_MS` | `3000` | Minimum delay between bulk messages (ms) |
| `MAX_DELAY_MS` | `5000` | Maximum delay between bulk messages (ms) |

> Settings can also be changed at runtime via the **Settings** page in the dashboard.

---

## 🔌 API Reference

### Sessions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/sessions` | List all sessions |
| `POST` | `/api/sessions` | Create session `{ name }` |
| `DELETE` | `/api/sessions/:id` | Remove session |
| `PUT` | `/api/sessions/:id/auto-reply` | Toggle auto-reply `{ enabled }` |

### Contacts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/contacts?group=&search=` | List/search contacts |
| `GET` | `/api/contacts/groups` | List contact groups |
| `POST` | `/api/contacts/upload` | Upload CSV/Excel file (multipart) |
| `POST` | `/api/contacts/import` | Import parsed contacts `{ contacts, group }` |
| `DELETE` | `/api/contacts/:id` | Delete a contact |
| `DELETE` | `/api/contacts/group/:name` | Delete entire group |

### Messaging

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/messages/send-bulk` | Send bulk messages `{ sessionId, group, template }` |
| `POST` | `/api/messages/preview` | Preview rendered template `{ template, contact }` |
| `GET` | `/api/messages?phone=&limit=` | Get message history |

### Scheduler

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/schedules` | List all schedules |
| `POST` | `/api/schedules` | Create schedule `{ name, sessionId, groupName, template, frequency, ... }` |
| `PUT` | `/api/schedules/:id` | Update schedule |
| `PUT` | `/api/schedules/:id/toggle` | Enable/disable `{ enabled }` |
| `DELETE` | `/api/schedules/:id` | Delete schedule |

### Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings` | Get all settings |
| `PUT` | `/api/settings` | Update settings |

---

## 🐳 Docker Deployment Guide

### Quick Start with Docker

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd whatsapp-bot

# 2. Create environment file
cp .env.example .env
# Edit .env and add your API keys

# 3. Start with docker-compose
docker-compose up -d

# 4. Access the dashboard
# Open http://localhost:3000 in your browser
```

### Docker Commands

```bash
# Start containers
docker-compose up -d

# Stop containers (data persists)
docker-compose down

# View logs
docker-compose logs -f

# Restart containers
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# Stop and remove ALL data (⚠️ Warning: deletes everything)
docker-compose down -v
```

### Data Persistence

**Docker volumes ensure data survives:**
- ✅ Container restarts (`docker-compose restart`)
- ✅ Container recreations (`docker-compose down && docker-compose up`)
- ✅ Server/host reboots (if `restart: unless-stopped` is set)
- ✅ Docker updates

**Volumes created:**
- `whatsapp-data` → SQLite database (contacts, campaigns, settings)
- `whatsapp-uploads` → Uploaded media files
- `whatsapp-auth` → WhatsApp session authentication
- `whatsapp-cache` → WhatsApp cache files

**List volumes:**
```bash
docker volume ls | grep whatsapp
```

**Inspect a volume:**
```bash
docker volume inspect whatsapp-bot_whatsapp-data
```

### Backup & Restore

**Backup all data:**
```bash
# Create backup of all volumes
docker run --rm \
  -v whatsapp-bot_whatsapp-data:/data \
  -v whatsapp-bot_whatsapp-uploads:/uploads \
  -v whatsapp-bot_whatsapp-auth:/auth \
  -v whatsapp-bot_whatsapp-cache:/cache \
  -v $(pwd):/backup \
  alpine tar czf /backup/whatsapp-backup-$(date +%Y%m%d).tar.gz /data /uploads /auth /cache
```

**Restore from backup:**
```bash
# Stop the application
docker-compose down

# Restore volumes from backup
docker run --rm \
  -v whatsapp-bot_whatsapp-data:/data \
  -v whatsapp-bot_whatsapp-uploads:/uploads \
  -v whatsapp-bot_whatsapp-auth:/auth \
  -v whatsapp-bot_whatsapp-cache:/cache \
  -v $(pwd):/backup \
  alpine tar xzf /backup/whatsapp-backup-YYYYMMDD.tar.gz

# Start the application
docker-compose up -d
```

### Environment Variables in Docker

Edit `.env` file before starting:

```env
# Server
PORT=3000

# AI Configuration
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here

# Auto-Reply
AUTO_REPLY_ENABLED=true
SYSTEM_PROMPT=You are a helpful assistant.

# Message Delays (milliseconds)
MIN_DELAY_MS=8000
MAX_DELAY_MS=18000
```

### Production Deployment Tips

**1. Use a reverse proxy (nginx/traefik):**
```yaml
# Example nginx config
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
```

**2. Enable HTTPS:**
```bash
# Use Let's Encrypt with certbot
sudo certbot --nginx -d your-domain.com
```

**3. Monitor container health:**
```bash
# Check container status
docker-compose ps

# Check health status
docker inspect whatsapp-bot | grep -A 10 Health
```

**4. Set up automatic backups:**
```bash
# Add to crontab (daily backup at 2 AM)
0 2 * * * cd /path/to/whatsapp-bot && docker-compose exec -T whatsapp-bot tar czf - /app/data /app/uploads /app/.wwebjs_auth > backup-$(date +\%Y\%m\%d).tar.gz
```

### Troubleshooting

**Container won't start:**
```bash
# Check logs
docker-compose logs

# Check if port 3000 is already in use
lsof -i :3000
```

**Data not persisting:**
```bash
# Verify volumes are mounted
docker inspect whatsapp-bot | grep -A 20 Mounts

# Check volume exists
docker volume ls | grep whatsapp
```

**Out of disk space:**
```bash
# Check Docker disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

**Permissions issues:**
```bash
# Fix volume permissions
docker-compose exec whatsapp-bot chown -R node:node /app/data /app/uploads /app/.wwebjs_auth
```

---

## 🧪 Testing with Dummy CSV Files

Two test files are included:

1. **`sample_contacts.csv`** — 5 contacts with `phone, name, company, city`
2. **`test_contacts_large.csv`** — 20 contacts with `phone, name, company, city, designation, product_interest`

### Test Flow

```
1. Start server:           npm start
2. Open dashboard:         http://localhost:3000
3. Create a session:       Sessions → Add Account → scan QR
4. Import test contacts:   Contacts → Import File → select sample_contacts.csv
5. Set group name:         "test_group"
6. Confirm import:         Click "Import Contacts"
7. Send test message:      Messages → Select session & group →
                           Type: "Hi {{name}} from {{company}} in {{city}}"
                           → Send to All
8. Create schedule:        Scheduler → New Schedule →
                           Daily at 10:00 → Create
```

---

## ⚠️ Important Notes

- **WhatsApp ToS:** Using unofficial WhatsApp automation may violate WhatsApp's Terms of Service. Use responsibly and at your own risk.
- **Rate Limiting:** WhatsApp may temporarily ban numbers that send too many messages too quickly. Always use appropriate delays (3-5 seconds minimum).
- **Session Persistence:** Sessions are stored in `.wwebjs_auth/`. Deleting this folder will require re-scanning all QR codes.
- **First QR may take time:** The first session initialization downloads Chromium (~170 MB). Subsequent sessions start faster.

---

## 📜 License

ISC
