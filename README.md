# 🤖 Srotas WhatsApp Bot

**v1.1.7** · A full-stack WhatsApp automation platform with a modern dark-themed web dashboard. Supports multi-account QR login, CSV/Excel contact import, personalized bulk messaging, AI-powered auto-reply, scheduled recurring messages, quick-reply triggers, message templates, and a built-in license management system.

---

## 📦 Installation

Choose the method that fits your use case:

| Method | Best For |
|---|---|
| [🖥️ Desktop App](#%EF%B8%8F-desktop-app-windows--macos) | End users, non-technical operators |
| [🐳 Docker](#-docker-production) | Server / VPS / production deployments |
| [💻 Local npm](#-local-development-npm) | Developers building or testing locally |

---

## 🖥️ Desktop App (Windows & macOS)

Download the latest installer from the [GitHub Releases page](https://github.com/itsdkyp/srotas-whatsapp-bot/releases/latest).

### Windows

1. Download `Srotas.WhatsApp.Bot.Setup.x.x.x.exe`
2. Double-click the installer and follow the prompts
3. A **Srotas WhatsApp Bot** shortcut is created on your Desktop and Start Menu
4. Launch the app — it opens fullscreen in your default browser chrome

> **Upgrading from an older version?** Uninstall the previous version first via **Add or Remove Programs** before running the new installer.

### macOS

1. Download `Srotas.WhatsApp.Bot-x.x.x-arm64.dmg` (Apple Silicon) or the `.pkg` variant
2. Open the `.dmg` and drag the app to your Applications folder
3. Launch **Srotas WhatsApp Bot** from Applications / Spotlight

---

## 🐳 Docker (Production)

Pull the pre-built multi-arch image from Docker Hub and run it with the included compose file.

### Prerequisites
- Docker Desktop (or Docker Engine + Compose plugin)

### Quick Start

```bash
# 1. Clone this repository
git clone https://github.com/itsdkyp/srotas-whatsapp-bot.git
cd srotas-whatsapp-bot/deploy

# 2. Create your environment file
cp .env.example .env
# Edit .env and add your API keys (see Environment Variables section)

# 3. Start the container (pulls the latest image automatically)
docker compose -f docker-compose.prod.yml up -d

# 4. Open the dashboard
open http://localhost:3000
```

### Useful Docker Commands

```bash
# View live logs
docker logs whatsapp-bot -f

# Pull latest image and restart
docker compose -f docker-compose.prod.yml up -d   # pull_policy: always is set

# Stop container (data is preserved in volumes)
docker compose -f docker-compose.prod.yml down

# Stop and WIPE ALL DATA (⚠️ irreversible)
docker compose -f docker-compose.prod.yml down -v
```

### Data Persistence

All user data is stored in named Docker volumes that survive container restarts and image updates:

| Volume | Contents |
|---|---|
| `deploy_whatsapp-data` | SQLite database (sessions, contacts, campaigns, settings) |
| `deploy_whatsapp-uploads` | Uploaded CSV / Excel files |
| `deploy_whatsapp-auth` | WhatsApp session auth (avoids re-scanning QR) |
| `deploy_whatsapp-cache` | WhatsApp Web browser cache |

### Backup & Restore

```bash
# Backup all volumes to a tar archive
docker run --rm \
  -v deploy_whatsapp-data:/data \
  -v deploy_whatsapp-uploads:/uploads \
  -v deploy_whatsapp-auth:/auth \
  -v deploy_whatsapp-cache:/cache \
  -v $(pwd):/backup \
  alpine tar czf /backup/srotas-backup-$(date +%Y%m%d).tar.gz /data /uploads /auth /cache

# Restore from backup
docker compose -f docker-compose.prod.yml down
docker run --rm \
  -v deploy_whatsapp-data:/data \
  -v deploy_whatsapp-auth:/auth \
  -v $(pwd):/backup \
  alpine tar xzf /backup/srotas-backup-YYYYMMDD.tar.gz
docker compose -f docker-compose.prod.yml up -d
```

---

## 💻 Local Development (npm)

### Prerequisites
- Node.js 18+
- Google Chrome or Chromium (for WhatsApp Web automation)

### Setup

```bash
# 1. Clone and install dependencies
git clone https://github.com/itsdkyp/srotas-whatsapp-bot.git
cd srotas-whatsapp-bot
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env to add your API keys

# 3. Start the dev server
npm run dev

# 4. Open the dashboard
open http://localhost:3000
```

### Fresh Start (Reset All Data)

```bash
# Stop the server (Ctrl+C), then:
rm -rf data/           # wipes SQLite DB — resets license, sessions, contacts
rm -rf .wwebjs_auth/   # forces QR re-scan on next start
rm -rf .wwebjs_cache/  # clears WhatsApp Web asset cache
npm run dev
```

---

## ✨ Features

### 🔑 License Activation

The app requires a one-time license key on first launch.

- Enter your key in the **Activation** screen that appears on first run
- Once activated, the key is stored locally and the screen never appears again
- The **Settings page** shows your license status, masked key, expiry date, and days remaining with a colour-coded badge (✅ Active / ⚠️ Expiring Soon / 🔴 Critical)

### 📱 WhatsApp Sessions (Multi-Account)

Connect one or more WhatsApp accounts via QR code.

1. Go to **Sessions** → **+ Add Account**
2. Enter a name (e.g. "Business", "Support")
3. Scan the QR code with WhatsApp → **Settings** → **Linked Devices** → **Link a Device**
4. The session shows **● Connected** when ready

> Sessions persist across restarts using local auth stored in `.wwebjs_auth/`. Multiple sessions are staggered on startup to prevent CPU overload.

### 📂 Contact Import (CSV / Excel)

Import contacts from `.csv`, `.xlsx`, or `.xls` files.

1. Go to **Contacts** → **📁 Import File**
2. Select your file — columns are auto-detected:
   - **phone** — required, include country code (e.g. `+91`, `+1`)
   - **name**, **company** — standard fields
   - Any extra columns (e.g. `city`, `plan`) become `{{placeholders}}` in templates

```csv
phone,name,company,city
+919876543210,Rahul Sharma,TechCorp,Bangalore
+911234567890,Priya Patel,WebIndia,Mumbai
```

### 📢 Bulk Messaging with Templates

Send personalized messages to entire contact groups.

1. Go to **Campaigns** → select **Session** and **Contact Group**
2. Write a message template with `{{placeholders}}`:

```
Hello {{name}},

Greetings from {{company}}! We have an update for the {{city}} region.

Best regards, Team
```

3. Set send delays (recommended: 8–18 seconds to stay safe)
4. Click **🚀 Send to All** — live progress is shown

### 🕐 Scheduled / Recurring Messages

Automate sends on a recurring schedule.

1. Go to **Scheduler** → **+ New Schedule**
2. Set: Session, Contact Group, Template, Frequency (Daily / Weekly / Monthly), Time
3. Schedules can be toggled on/off and show **next run** / **last run** timestamps

### ⚡ Quick Replies

Define keyword triggers that auto-send a canned response.

1. Go to **Quick Replies** → **+ Add Rule**
2. Set a trigger keyword (e.g. "price") and a response message
3. Enable the rule — incoming messages matching the keyword trigger it instantly

### 📝 Message Templates

Save reusable message templates for use across campaigns, schedules, and quick replies.

1. Go to **Templates** → **+ New Template**
2. Name it and write the body with `{{placeholders}}`
3. Templates are available across the entire app when composing messages

### 🧠 AI Auto-Reply

Automatically reply to incoming WhatsApp messages using Gemini or OpenAI.

1. Go to **Settings** → configure **AI Provider** and **API Key**
2. Customize the **System Prompt** (personality and instructions)
3. Go to **Sessions** → toggle **Auto-Reply ON** for the desired session

The bot maintains local conversation history in SQLite for contextual follow-up replies.

### 🎨 Appearance

- Switch between **Dark Mode** and **Light Mode** from the Settings page
- The selected theme is persisted to the database and restored on every launch (even with a randomly assigned port)

---

## 🛡️ Admin Panel *(Easter Egg)*

Activate with the special Easter Egg key to unlock a hidden **🛡️ Admin** item in the sidebar. Inside:

- **Generate License Keys** — choose duration presets (30 days → 10 years) or enter custom days
- Generated keys use the same HMAC cryptography as the validator — they work out of the box
- **Issued Keys history** — a scrollable table of every key generated, with expiry dates and one-click copy
- History is persisted in SQLite (up to 100 entries)

The admin API endpoints (`/api/admin/*`) refuse requests that are not from an Easter Egg session with a `403 Forbidden`.

---

## ⚙️ Environment Variables

Configure via `.env` file or the Settings page in the dashboard:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `AI_PROVIDER` | `gemini` | AI provider: `gemini` or `openai` |
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `MIN_DELAY_MS` | `8000` | Minimum delay between bulk messages (ms) |
| `MAX_DELAY_MS` | `18000` | Maximum delay between bulk messages (ms) |

> All settings can also be changed at runtime via the **Settings** page and are persisted to SQLite.

---

## 🔌 API Reference

### License

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/license-status` | Returns `{ activated, isLifetime, expiryDate, daysRemaining, keyMasked }` |
| `POST` | `/api/activate` | Activate with `{ key }` |

### Sessions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/sessions` | List all sessions |
| `POST` | `/api/sessions` | Create session `{ name }` |
| `DELETE` | `/api/sessions/:id` | Remove session |
| `POST` | `/api/sessions/:id/restart` | Restart a session |
| `POST` | `/api/sessions/:id/relink` | Force QR re-scan |
| `PUT` | `/api/sessions/:id/auto-reply` | Toggle auto-reply `{ enabled }` |

### Contacts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/contacts?group=&search=` | List / search contacts |
| `GET` | `/api/contacts/groups` | List contact groups |
| `POST` | `/api/contacts/upload` | Upload CSV/Excel file (multipart) |
| `POST` | `/api/contacts/import` | Import parsed contacts `{ contacts, group }` |
| `DELETE` | `/api/contacts/:id` | Delete a contact |
| `DELETE` | `/api/contacts/group/:name` | Delete entire group |

### Messaging

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/messages/send-bulk` | Send bulk `{ sessionId, group, template }` |
| `POST` | `/api/messages/preview` | Preview rendered template |
| `GET` | `/api/messages?phone=&limit=` | Message history |

### Scheduler

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/schedules` | List all schedules |
| `POST` | `/api/schedules` | Create schedule |
| `PUT` | `/api/schedules/:id` | Update schedule |
| `PUT` | `/api/schedules/:id/toggle` | Enable / disable `{ enabled }` |
| `DELETE` | `/api/schedules/:id` | Delete schedule |

### Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings` | Get all settings |
| `PUT` | `/api/settings` | Update settings `{ theme, gemini_api_key, ... }` |

### Admin *(Easter Egg only)*

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/generate-key` | Generate a license key `{ days }` |
| `GET` | `/api/admin/history` | List all previously generated keys |

---

## 📁 Project Structure

```
srotas-whatsapp-bot/
├── main.js                         # Electron entry point (Desktop App)
├── server.js                       # Express server + all API routes
├── package.json
├── .env.example
│
├── src/
│   ├── db/database.js              # SQLite schema + helpers
│   ├── license/index.js            # License validation + key generation
│   ├── whatsapp/
│   │   ├── sessionManager.js       # Multi-account WhatsApp client manager
│   │   └── messageHandler.js       # Incoming message + auto-reply dispatcher
│   ├── contacts/importer.js        # CSV/Excel parser
│   ├── messaging/
│   │   ├── bulkSender.js           # Template engine + bulk send queue
│   │   └── scheduler.js            # Recurring job runner
│   └── ai/
│       ├── provider.js             # Gemini / OpenAI adapter
│       └── memory.js               # Conversation history
│
├── public/                         # Frontend SPA
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js                  # SPA router + utilities
│       ├── sessions.js
│       ├── contacts.js
│       ├── messaging.js
│       ├── scheduler.js
│       ├── templates.js
│       ├── quickreplies.js
│       ├── settings.js
│       ├── admin.js                # Admin panel (Easter Egg)
│       └── help.js
│
├── deploy/
│   ├── docker-compose.prod.yml     # Production compose file
│   ├── docker-compose.yml          # Development compose file
│   └── nginx.conf                  # Nginx reverse proxy example
│
├── .github/workflows/
│   ├── release.yml                 # Electron Desktop App CI (Windows + macOS)
│   └── docker.yml                  # Docker multi-arch image CI
│
├── data/                           # SQLite database (auto-created)
├── uploads/                        # Uploaded files (auto-created)
└── .wwebjs_auth/                   # WhatsApp session auth (auto-created)
```

---

## 🛠️ Troubleshooting

### WhatsApp QR code not appearing / loading forever

```bash
# Clear stale Chromium lock files and restart
docker exec whatsapp-bot find /app/.wwebjs_auth -name "Singleton*" -delete
docker restart whatsapp-bot
```

### Cannot connect on Windows after installation

1. Make sure **Google Chrome** or **Microsoft Edge** is installed — the app uses your system browser for WhatsApp Web automation
2. Check Windows Defender isn't blocking the app

### Upgrading Windows installer fails (NSIS Error)

The app name changed in v1.1.6. If you have an older version installed:

1. Press `Win + R`, paste `%LOCALAPPDATA%\Programs\WhatsApp Bot Server` and delete that folder
2. Run the new `Srotas WhatsApp Bot Setup` installer

### Reset to factory defaults

```bash
rm -rf data/ .wwebjs_auth/ .wwebjs_cache/
npm run dev   # or restart Docker container
```

---

## ⚠️ Important Notes

- **WhatsApp ToS:** Using unofficial WhatsApp automation may violate WhatsApp's Terms of Service. Use responsibly and at your own risk.
- **Rate Limiting:** Always use appropriate delays (8–18 seconds recommended). Sending too fast may result in a temporary number ban.
- **Session Persistence:** Sessions are stored in `.wwebjs_auth/`. Deleting this folder forces a full QR re-scan.
- **Multiple Sessions on Startup:** Sessions are staggered 3.5 seconds apart to avoid overloading the CPU when multiple accounts reconnect simultaneously.

---

## 📜 License

ISC © [Srotas Tech](https://srotas.tech)
