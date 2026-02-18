#!/bin/bash

# Setup script for whatsapp-bot.local domain
# This script configures your system to access the WhatsApp Bot via http://whatsapp-bot.local

set -e

DOMAIN="whatsapp-bot.local"
HOSTS_FILE="/etc/hosts"
HOSTS_ENTRY="127.0.0.1       $DOMAIN"

echo "🌐 WhatsApp Bot - Local Domain Setup"
echo "===================================="
echo ""

# Function to check if domain already exists in hosts file
check_hosts_entry() {
    if grep -q "$DOMAIN" "$HOSTS_FILE" 2>/dev/null; then
        return 0  # exists
    else
        return 1  # doesn't exist
    fi
}

# Function to add hosts entry
add_hosts_entry() {
    echo "📝 Adding '$DOMAIN' to $HOSTS_FILE..."

    # Backup hosts file
    sudo cp "$HOSTS_FILE" "${HOSTS_FILE}.backup.$(date +%Y%m%d-%H%M%S)"
    echo "   Backup created: ${HOSTS_FILE}.backup.$(date +%Y%m%d-%H%M%S)"

    # Add entry
    echo "$HOSTS_ENTRY" | sudo tee -a "$HOSTS_FILE" > /dev/null
    echo "   ✅ Added '$DOMAIN' to hosts file"
}

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
else
    echo "❌ This script only supports macOS and Linux"
    echo "   For Windows, manually add this line to C:\\Windows\\System32\\drivers\\etc\\hosts:"
    echo "   $HOSTS_ENTRY"
    exit 1
fi

echo "🖥️  Detected OS: $OS"
echo ""

# Check if already configured
if check_hosts_entry; then
    echo "✅ '$DOMAIN' is already configured in $HOSTS_FILE"
    echo ""
else
    echo "⚠️  '$DOMAIN' not found in $HOSTS_FILE"
    echo ""
    read -p "Do you want to add it? (y/n) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        add_hosts_entry
        echo ""
    else
        echo "❌ Cancelled. You can manually add this line to $HOSTS_FILE:"
        echo "   $HOSTS_ENTRY"
        exit 1
    fi
fi

# Flush DNS cache
echo "🔄 Flushing DNS cache..."
if [[ "$OS" == "macOS" ]]; then
    sudo dscacheutil -flushcache
    sudo killall -HUP mDNSResponder 2>/dev/null || true
    echo "   ✅ DNS cache flushed (macOS)"
elif [[ "$OS" == "Linux" ]]; then
    if command -v systemd-resolve &> /dev/null; then
        sudo systemd-resolve --flush-caches
        echo "   ✅ DNS cache flushed (systemd-resolved)"
    else
        echo "   ℹ️  No DNS cache to flush (or not using systemd-resolved)"
    fi
fi
echo ""

# Test DNS resolution
echo "🧪 Testing DNS resolution..."
if ping -c 1 "$DOMAIN" &> /dev/null; then
    echo "   ✅ '$DOMAIN' resolves correctly!"
else
    echo "   ⚠️  DNS resolution test failed, but this might be expected"
    echo "      The domain should still work in your browser"
fi
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

echo "✅ Docker and docker-compose are installed"
echo ""

# Ask which setup to use
echo "📦 Choose your setup:"
echo "   1) Simple (access via http://whatsapp-bot.local:3000)"
echo "   2) With Nginx (access via http://whatsapp-bot.local - no port needed) [RECOMMENDED]"
echo ""
read -p "Enter choice (1 or 2): " -n 1 -r
echo ""
echo ""

if [[ $REPLY == "2" ]]; then
    COMPOSE_FILE="docker-compose.nginx.yml"
    URL="http://$DOMAIN"
    echo "🚀 Starting with Nginx reverse proxy..."
else
    COMPOSE_FILE="docker-compose.yml"
    URL="http://$DOMAIN:3000"
    echo "🚀 Starting with simple setup..."
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "   ✅ Created .env file"
        echo "   ⚠️  Please edit .env and add your API keys before accessing the app"
    else
        echo "   ❌ .env.example not found. Please create .env manually"
    fi
    echo ""
fi

# Start Docker containers
echo "🐳 Starting Docker containers..."
docker-compose -f "$COMPOSE_FILE" up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# Check if containers are running
if docker ps | grep -q whatsapp-bot; then
    echo "   ✅ Containers are running!"
else
    echo "   ❌ Containers failed to start. Check logs with:"
    echo "      docker-compose -f $COMPOSE_FILE logs"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "🌐 Access your WhatsApp Bot at:"
echo "   $URL"
echo ""
echo "📊 View logs:"
echo "   docker-compose -f $COMPOSE_FILE logs -f"
echo ""
echo "🛑 Stop containers:"
echo "   docker-compose -f $COMPOSE_FILE down"
echo ""
echo "🔄 Restart containers:"
echo "   docker-compose -f $COMPOSE_FILE restart"
echo ""

# Attempt to open in browser
if command -v open &> /dev/null; then
    read -p "Open in browser now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sleep 2
        open "$URL"
    fi
fi

echo ""
echo "Happy messaging! 📱"
