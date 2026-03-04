# WhatsApp Bot - Remote Installation Script for Windows (PowerShell)
#
# Usage:
#   iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.ps1'))
#   or
#   Invoke-WebRequest -Uri https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.ps1 -UseBasicParsing | Invoke-Expression

# Configuration
$RepoUrl = "https://github.com/YOUR_USERNAME/whatsapp-bot.git"  # UPDATE THIS!
$InstallDir = "$env:USERPROFILE\whatsapp-bot"
$Domain = "whatsapp-bot.local"
$HostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"

# Functions
function Write-Header {
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "  WhatsApp Bot - Remote Installer" -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
}

function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-ErrorMsg {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Warning {
    param($Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Info {
    param($Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

function Test-Command {
    param($CommandName)
    $exists = $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
    if ($exists) {
        Write-Success "$CommandName is installed"
    } else {
        Write-ErrorMsg "$CommandName is not installed"
    }
    return $exists
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Main script
Clear-Host
Write-Header

Write-Host "This script will:"
Write-Host "  1. Check prerequisites (Git, Docker, Docker Compose)"
Write-Host "  2. Clone the WhatsApp Bot repository"
Write-Host "  3. Setup environment configuration"
Write-Host "  4. Start Docker containers"
Write-Host "  5. Configure local domain (optional)"
Write-Host ""

$continue = Read-Host "Continue? (y/n)"
if ($continue -notmatch '^[Yy]$') {
    Write-Warning "Installation cancelled"
    exit 0
}

Write-Host ""
Write-Info "Checking prerequisites..."
Write-Host ""

# Check for required commands
$hasAllDeps = $true

if (-not (Test-Command git)) {
    $hasAllDeps = $false
    Write-Info "Install Git: https://git-scm.com/downloads"
}

if (-not (Test-Command docker)) {
    $hasAllDeps = $false
    Write-Info "Install Docker Desktop: https://www.docker.com/products/docker-desktop"
}

# Check docker-compose or docker compose
$hasCompose = Test-Command docker-compose
if (-not $hasCompose) {
    # Check if docker compose v2 is available
    try {
        docker compose version | Out-Null
        Write-Success "docker compose (v2) is installed"
        $hasCompose = $true
    } catch {
        $hasAllDeps = $false
        Write-Info "Install Docker Compose: https://docs.docker.com/compose/install/"
    }
}

if (-not $hasAllDeps) {
    Write-ErrorMsg "Missing prerequisites. Please install the required software and try again."
    exit 1
}

Write-Host ""
Write-Success "All prerequisites met!"
Write-Host ""

# Check if installation directory already exists
if (Test-Path $InstallDir) {
    Write-Warning "Directory $InstallDir already exists"
    $remove = Read-Host "Remove and reinstall? (y/n)"
    if ($remove -match '^[Yy]$') {
        Write-Info "Removing existing directory..."
        Remove-Item -Path $InstallDir -Recurse -Force
    } else {
        Write-ErrorMsg "Installation cancelled. Please remove $InstallDir manually or choose a different location."
        exit 1
    }
}

# Clone repository
Write-Info "Cloning repository from $RepoUrl..."
try {
    git clone $RepoUrl $InstallDir 2>&1 | Out-Null
    Write-Success "Repository cloned successfully"
} catch {
    Write-ErrorMsg "Failed to clone repository: $_"
    exit 1
}

# Change to install directory
Set-Location $InstallDir

# Create .env file
Write-Info "Setting up environment configuration..."
if (Test-Path .env.example) {
    Copy-Item .env.example .env
    Write-Success "Created .env file from template"
    Write-Host ""
    Write-Warning "IMPORTANT: You need to add your API keys to .env file"
    Write-Info "Edit file: $InstallDir\.env"
    Write-Host ""
    $editNow = Read-Host "Do you want to edit .env now? (y/n)"
    if ($editNow -match '^[Yy]$') {
        notepad .env
    }
} else {
    Write-Warning ".env.example not found, creating basic .env"
    @"
PORT=3000
AI_PROVIDER=gemini
GEMINI_API_KEY=
OPENAI_API_KEY=
AUTO_REPLY_ENABLED=true
SYSTEM_PROMPT=You are a helpful assistant.
MIN_DELAY_MS=8000
MAX_DELAY_MS=18000
"@ | Out-File -FilePath .env -Encoding UTF8
    Write-Info "Please edit $InstallDir\.env and add your API keys"
}

Write-Host ""
Write-Info "Choose installation type:"
Write-Host "  1) Simple (access via http://localhost:3000)"
Write-Host "  2) With custom domain (access via http://$Domain) [RECOMMENDED]"
Write-Host ""
$installType = Read-Host "Enter choice (1 or 2)"

$useCustomDomain = $false
$composeFile = "docker-compose.yml"
$accessUrl = "http://localhost:3000"

if ($installType -eq "2") {
    $composeFile = "docker-compose.nginx.yml"
    $useCustomDomain = $true
    $accessUrl = "http://$Domain"

    # Setup custom domain
    Write-Info "Setting up custom domain: $Domain"

    # Check if running as administrator for hosts file modification
    if (-not (Test-Administrator)) {
        Write-Warning "Administrator privileges required to modify hosts file"
        Write-Info "Please add this line to $HostsFile manually:"
        Write-Host "127.0.0.1       $Domain" -ForegroundColor Yellow
    } else {
        # Check if already in hosts file
        $hostsContent = Get-Content $HostsFile -ErrorAction SilentlyContinue
        if ($hostsContent -match $Domain) {
            Write-Success "Domain already configured in hosts file"
        } else {
            Write-Info "Adding $Domain to hosts file..."
            try {
                Add-Content -Path $HostsFile -Value "`n127.0.0.1       $Domain"
                Write-Success "Added $Domain to hosts file"
            } catch {
                Write-Warning "Failed to add to hosts file: $_"
                Write-Info "Please add this line to $HostsFile manually:"
                Write-Host "127.0.0.1       $Domain" -ForegroundColor Yellow
            }
        }

        # Flush DNS cache
        Write-Info "Flushing DNS cache..."
        try {
            ipconfig /flushdns | Out-Null
            Write-Success "DNS cache flushed"
        } catch {
            Write-Warning "Failed to flush DNS cache"
        }
    }
}

Write-Host ""
Write-Info "Starting Docker containers..."
Write-Host ""

# Check which docker compose command to use
$dockerComposeCmd = "docker-compose"
try {
    docker compose version | Out-Null
    $dockerComposeCmd = "docker compose"
} catch {
    # Fall back to docker-compose
}

# Start containers
try {
    if ($dockerComposeCmd -eq "docker compose") {
        docker compose -f $composeFile up -d
    } else {
        docker-compose -f $composeFile up -d
    }
    Write-Success "Docker containers started successfully"
} catch {
    Write-ErrorMsg "Failed to start Docker containers: $_"
    Write-Info "Check logs with: cd $InstallDir; $dockerComposeCmd -f $composeFile logs"
    exit 1
}

Write-Host ""
Write-Info "Waiting for services to start..."
Start-Sleep -Seconds 8

# Check if containers are running
$runningContainers = docker ps --format "{{.Names}}"
if ($runningContainers -match "whatsapp-bot") {
    Write-Success "Containers are running!"
} else {
    Write-ErrorMsg "Containers are not running. Check logs:"
    Write-Info "cd $InstallDir; $dockerComposeCmd -f $composeFile logs"
    exit 1
}

# Get local IP for network access
$localIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Ethernet*","Wi-Fi*" | Where-Object {$_.IPAddress -notmatch "^127\."} | Select-Object -First 1).IPAddress
if (-not $localIp) {
    $localIp = "unknown"
}

# Final message
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  ✅ Installation Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Access WhatsApp Bot:" -ForegroundColor Cyan
Write-Host "   Local:   $accessUrl"
if ($localIp -ne "unknown") {
    Write-Host "   Network: http://${localIp}:3000"
}
Write-Host ""
Write-Host "📂 Installation Directory:" -ForegroundColor Cyan
Write-Host "   $InstallDir"
Write-Host ""
Write-Host "⚙️  Configuration:" -ForegroundColor Cyan
Write-Host "   Edit API keys: $InstallDir\.env"
Write-Host ""
Write-Host "📊 Useful Commands:" -ForegroundColor Cyan
if ($dockerComposeCmd -eq "docker compose") {
    Write-Host "   View logs:      cd $InstallDir; docker compose -f $composeFile logs -f"
    Write-Host "   Stop:           cd $InstallDir; docker compose -f $composeFile down"
    Write-Host "   Restart:        cd $InstallDir; docker compose -f $composeFile restart"
    Write-Host "   Start:          cd $InstallDir; docker compose -f $composeFile up -d"
} else {
    Write-Host "   View logs:      cd $InstallDir; docker-compose -f $composeFile logs -f"
    Write-Host "   Stop:           cd $InstallDir; docker-compose -f $composeFile down"
    Write-Host "   Restart:        cd $InstallDir; docker-compose -f $composeFile restart"
    Write-Host "   Start:          cd $InstallDir; docker-compose -f $composeFile up -d"
}
Write-Host ""
Write-Host "⚠️  IMPORTANT:" -ForegroundColor Yellow
Write-Host "   1. Edit .env file and add your API keys (Gemini or OpenAI)"
Write-Host "   2. Restart after editing: docker compose restart" -ForegroundColor Yellow
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   README:         $InstallDir\README.md"
Write-Host "   Quick Ref:      $InstallDir\QUICK_REFERENCE.md"
Write-Host ""

# Offer to open in browser
$openBrowser = Read-Host "Open in browser now? (y/n)"
if ($openBrowser -match '^[Yy]$') {
    Start-Sleep -Seconds 2
    Start-Process $accessUrl
}

Write-Host ""
Write-Success "Happy messaging! 📱"
Write-Host ""
