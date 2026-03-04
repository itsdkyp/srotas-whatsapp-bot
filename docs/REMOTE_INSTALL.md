# 🌐 Remote Installation Commands

Copy and paste these commands to install WhatsApp Bot on any machine remotely.

---

## 📋 Before You Share

**IMPORTANT:** Replace `YOUR_USERNAME` in the URLs with your actual GitHub username!

1. Push your code to GitHub
2. Find and replace `YOUR_USERNAME` in these files:
   - `install.sh` (line 9)
   - `install.ps1` (line 6)
   - `INSTALL.md`
   - `README.md`

Example: If your GitHub username is `johndoe`, change:
```
https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh
```
to:
```
https://raw.githubusercontent.com/johndoe/whatsapp-bot/main/install.sh
```

---

## 🐧 Linux Installation

### Using curl (recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

### Using wget
```bash
wget -qO- https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

### Download and inspect first (security-conscious)
```bash
# Download the script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh -o install.sh

# Review the script
cat install.sh

# Make executable and run
chmod +x install.sh
./install.sh
```

---

## 🍎 macOS Installation

### Using curl (recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

### Download and inspect first
```bash
# Download the script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh -o install.sh

# Review the script
cat install.sh

# Make executable and run
chmod +x install.sh
./install.sh
```

---

## 🪟 Windows Installation

### Method 1: PowerShell (Invoke-WebRequest)
**Run PowerShell as Administrator**, then:

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.ps1 -UseBasicParsing | Invoke-Expression
```

### Method 2: PowerShell (WebClient)
**Run PowerShell as Administrator**, then:

```powershell
iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.ps1'))
```

### Method 3: Download and inspect first
**Run PowerShell as Administrator**, then:

```powershell
# Download the script
Invoke-WebRequest -Uri https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.ps1 -OutFile install.ps1

# Review the script
notepad install.ps1

# Run the script
.\install.ps1
```

---

## 📡 Remote Server Installation (SSH)

### Install on remote VPS/Cloud server

```bash
# SSH into your server
ssh user@your-server.com

# Run the installer
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

### Install and setup firewall

```bash
# SSH into your server
ssh user@your-server.com

# Install WhatsApp Bot
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash

# Setup firewall (Ubuntu/Debian)
sudo ufw allow 3000/tcp
sudo ufw allow 80/tcp
sudo ufw enable
```

### Get server IP for access

```bash
# Find your server's public IP
curl -4 ifconfig.me

# Access via: http://YOUR_SERVER_IP:3000
```

---

## 🔗 Installation URLs (Quick Copy)

Update these with your GitHub username before sharing:

### Linux/Mac (curl)
```
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

### Linux/Mac (wget)
```
wget -qO- https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

### Windows (PowerShell)
```
iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.ps1'))
```

### GitHub Repository
```
https://github.com/YOUR_USERNAME/whatsapp-bot
```

### Clone Command
```
git clone https://github.com/YOUR_USERNAME/whatsapp-bot.git
```

---

## 📝 What the Installer Does

1. **Checks prerequisites:**
   - Git
   - Docker
   - Docker Compose

2. **Clones repository:**
   - Linux/Mac: `~/whatsapp-bot`
   - Windows: `%USERPROFILE%\whatsapp-bot`

3. **Sets up configuration:**
   - Creates `.env` file from template
   - Prompts for API key input

4. **Prompts for installation type:**
   - Simple: Access via `http://localhost:3000`
   - Custom domain: Access via `http://whatsapp-bot.local`

5. **Starts Docker containers:**
   - Pulls/builds images
   - Creates volumes for data persistence
   - Starts all services

6. **Shows access information:**
   - Local URL
   - Network URL (for other devices)
   - Useful commands

---

## ⚙️ Post-Installation Steps

After installation completes:

1. **Add API keys:**
   ```bash
   # Linux/Mac
   nano ~/whatsapp-bot/.env

   # Windows
   notepad %USERPROFILE%\whatsapp-bot\.env
   ```

2. **Restart containers:**
   ```bash
   # Linux/Mac
   cd ~/whatsapp-bot && docker-compose restart

   # Windows
   cd %USERPROFILE%\whatsapp-bot; docker-compose restart
   ```

3. **Access dashboard:**
   - Simple: `http://localhost:3000`
   - Custom domain: `http://whatsapp-bot.local`

4. **Create WhatsApp session:**
   - Go to Sessions page
   - Click "+ Add Account"
   - Scan QR code

---

## 🆘 Troubleshooting

### Prerequisites not installed

**Install Docker:**
- Linux: https://docs.docker.com/engine/install/
- macOS: https://docs.docker.com/desktop/install/mac-install/
- Windows: https://docs.docker.com/desktop/install/windows-install/

**Install Git:**
- Linux: `sudo apt install git` (Debian/Ubuntu)
- macOS: `xcode-select --install`
- Windows: https://git-scm.com/downloads

### "Permission denied" errors

**Linux/Mac:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, then try again
```

**Windows:**
- Run PowerShell as Administrator

### Script won't download

**Check internet connection:**
```bash
ping github.com
```

**Try alternative method:**
```bash
# Download manually
git clone https://github.com/YOUR_USERNAME/whatsapp-bot.git
cd whatsapp-bot
./setup-local-domain.sh
```

### Port already in use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
```

---

## 🔒 Security Notes

### Review scripts before running

For security, always review scripts before piping to bash:

```bash
# Download and inspect
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh -o install.sh
cat install.sh

# Run manually
chmod +x install.sh
./install.sh
```

### What the scripts do:
- ✅ Only install/configure WhatsApp Bot
- ✅ Don't collect any data
- ✅ Don't modify system files (except /etc/hosts for custom domain)
- ✅ Open source - review on GitHub

---

## 📚 Additional Resources

- **Full Installation Guide:** [INSTALL.md](INSTALL.md)
- **Quick Reference:** [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Setup Custom Domain:** [SETUP_LOCAL_DOMAIN.md](SETUP_LOCAL_DOMAIN.md)
- **Main Documentation:** [README.md](README.md)

---

## 💬 Share These Commands

Share these one-liners with your team:

**For developers (Linux/Mac):**
```
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
```

**For developers (Windows):**
```
iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.ps1'))
```

**For production servers:**
```
ssh user@server.com "curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash"
```

---

Happy messaging! 📱
