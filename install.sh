#!/bin/bash
# WhatsApp Bot - Remote Installation Script
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash
#   or
#   wget -qO- https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-bot/main/install.sh | bash

set -e

# Configuration
REPO_URL="https://github.com/YOUR_USERNAME/whatsapp-bot.git"  # UPDATE THIS!
INSTALL_DIR="$HOME/whatsapp-bot"
DOMAIN="whatsapp-bot.local"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "========================================"
    echo "  WhatsApp Bot - Remote Installer"
    echo "========================================"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_command() {
    if command -v $1 &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

# Main script
print_header

echo "This script will:"
echo "  1. Check prerequisites (Git, Docker, Docker Compose)"
echo "  2. Clone the WhatsApp Bot repository"
echo "  3. Setup environment configuration"
echo "  4. Start Docker containers"
echo "  5. Configure local domain (optional)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Installation cancelled"
    exit 0
fi

echo ""
print_info "Checking prerequisites..."
echo ""

# Check for required commands
HAS_ALL_DEPS=true

if ! check_command git; then
    HAS_ALL_DEPS=false
    print_info "Install git: https://git-scm.com/downloads"
fi

if ! check_command docker; then
    HAS_ALL_DEPS=false
    print_info "Install Docker: https://docs.docker.com/get-docker/"
fi

if ! check_command docker-compose; then
    # Check if it's docker compose (v2)
    if docker compose version &> /dev/null; then
        print_success "docker compose (v2) is installed"
    else
        HAS_ALL_DEPS=false
        print_info "Install Docker Compose: https://docs.docker.com/compose/install/"
    fi
fi

if [ "$HAS_ALL_DEPS" = false ]; then
    print_error "Missing prerequisites. Please install the required software and try again."
    exit 1
fi

echo ""
print_success "All prerequisites met!"
echo ""

# Check if installation directory already exists
if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists"
    read -p "Remove and reinstall? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Removing existing directory..."
        rm -rf "$INSTALL_DIR"
    else
        print_error "Installation cancelled. Please remove $INSTALL_DIR manually or choose a different location."
        exit 1
    fi
fi

# Clone repository
print_info "Cloning repository from $REPO_URL..."
if git clone "$REPO_URL" "$INSTALL_DIR"; then
    print_success "Repository cloned successfully"
else
    print_error "Failed to clone repository"
    exit 1
fi

# Change to install directory
cd "$INSTALL_DIR"

# Create .env file
print_info "Setting up environment configuration..."
if [ -f .env.example ]; then
    cp .env.example .env
    print_success "Created .env file from template"
    echo ""
    print_warning "IMPORTANT: You need to add your API keys to .env file"
    print_info "Edit file: $INSTALL_DIR/.env"
    echo ""
    read -p "Do you want to edit .env now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    fi
else
    print_warning ".env.example not found, creating basic .env"
    cat > .env << EOF
PORT=3000
AI_PROVIDER=gemini
GEMINI_API_KEY=
OPENAI_API_KEY=
AUTO_REPLY_ENABLED=true
SYSTEM_PROMPT=You are a helpful assistant.
MIN_DELAY_MS=8000
MAX_DELAY_MS=18000
EOF
    print_info "Please edit $INSTALL_DIR/.env and add your API keys"
fi

echo ""
print_info "Choose installation type:"
echo "  1) Simple (access via http://localhost:3000)"
echo "  2) With custom domain (access via http://$DOMAIN) [RECOMMENDED]"
echo ""
read -p "Enter choice (1 or 2): " -n 1 -r INSTALL_TYPE
echo ""
echo ""

if [[ $INSTALL_TYPE == "2" ]]; then
    COMPOSE_FILE="docker-compose.nginx.yml"
    USE_CUSTOM_DOMAIN=true
    ACCESS_URL="http://$DOMAIN"

    # Setup custom domain
    print_info "Setting up custom domain: $DOMAIN"

    # Check if already in hosts file
    if grep -q "$DOMAIN" /etc/hosts 2>/dev/null; then
        print_success "Domain already configured in /etc/hosts"
    else
        print_info "Adding $DOMAIN to /etc/hosts (requires sudo)"
        if sudo sh -c "echo '127.0.0.1       $DOMAIN' >> /etc/hosts"; then
            print_success "Added $DOMAIN to /etc/hosts"
        else
            print_warning "Failed to add to /etc/hosts. You may need to add it manually."
            print_info "Add this line to /etc/hosts: 127.0.0.1       $DOMAIN"
        fi
    fi

    # Flush DNS cache
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sudo dscacheutil -flushcache 2>/dev/null || true
        sudo killall -HUP mDNSResponder 2>/dev/null || true
        print_success "DNS cache flushed (macOS)"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v systemd-resolve &> /dev/null; then
            sudo systemd-resolve --flush-caches 2>/dev/null || true
            print_success "DNS cache flushed (Linux)"
        fi
    fi
else
    COMPOSE_FILE="docker-compose.yml"
    USE_CUSTOM_DOMAIN=false
    ACCESS_URL="http://localhost:3000"
fi

echo ""
print_info "Starting Docker containers..."
echo ""

# Check if docker compose v2 is available
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    DOCKER_COMPOSE_CMD="docker-compose"
fi

# Start containers
if $DOCKER_COMPOSE_CMD -f "$COMPOSE_FILE" up -d; then
    print_success "Docker containers started successfully"
else
    print_error "Failed to start Docker containers"
    print_info "Check logs with: cd $INSTALL_DIR && $DOCKER_COMPOSE_CMD logs"
    exit 1
fi

echo ""
print_info "Waiting for services to start..."
sleep 8

# Check if containers are running
if docker ps | grep -q whatsapp-bot; then
    print_success "Containers are running!"
else
    print_error "Containers are not running. Check logs:"
    print_info "cd $INSTALL_DIR && $DOCKER_COMPOSE_CMD logs"
    exit 1
fi

# Get local IP for network access
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "unknown")

# Final message
echo ""
echo -e "${GREEN}"
echo "=========================================="
echo "  ✅ Installation Complete!"
echo "=========================================="
echo -e "${NC}"
echo ""
echo -e "${BLUE}📱 Access WhatsApp Bot:${NC}"
echo "   Local:   $ACCESS_URL"
if [ "$LOCAL_IP" != "unknown" ]; then
    echo "   Network: http://$LOCAL_IP:3000"
fi
echo ""
echo -e "${BLUE}📂 Installation Directory:${NC}"
echo "   $INSTALL_DIR"
echo ""
echo -e "${BLUE}⚙️  Configuration:${NC}"
echo "   Edit API keys: $INSTALL_DIR/.env"
echo ""
echo -e "${BLUE}📊 Useful Commands:${NC}"
echo "   View logs:      cd $INSTALL_DIR && $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE logs -f"
echo "   Stop:           cd $INSTALL_DIR && $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE down"
echo "   Restart:        cd $INSTALL_DIR && $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE restart"
echo "   Start:          cd $INSTALL_DIR && $DOCKER_COMPOSE_CMD -f $COMPOSE_FILE up -d"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "   1. Edit .env file and add your API keys (Gemini or OpenAI)"
echo "   2. Restart after editing: cd $INSTALL_DIR && $DOCKER_COMPOSE_CMD restart"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   README:         $INSTALL_DIR/README.md"
echo "   Quick Ref:      $INSTALL_DIR/QUICK_REFERENCE.md"
echo ""

# Offer to open in browser
if command -v open &> /dev/null || command -v xdg-open &> /dev/null; then
    read -p "Open in browser now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sleep 2
        if command -v open &> /dev/null; then
            open "$ACCESS_URL"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "$ACCESS_URL"
        fi
    fi
fi

echo ""
print_success "Happy messaging! 📱"
echo ""
