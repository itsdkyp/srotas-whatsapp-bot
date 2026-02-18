@echo off
REM Setup script for whatsapp-bot.local domain on Windows
REM Run as Administrator

setlocal

set DOMAIN=whatsapp-bot.local
set HOSTS_FILE=%SystemRoot%\System32\drivers\etc\hosts
set HOSTS_ENTRY=127.0.0.1       %DOMAIN%

echo ========================================
echo WhatsApp Bot - Local Domain Setup (Windows)
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo.
    echo Right-click on this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo Running as Administrator... OK
echo.

REM Check if entry already exists
findstr /C:"%DOMAIN%" "%HOSTS_FILE%" >nul 2>&1
if %errorLevel% equ 0 (
    echo %DOMAIN% is already configured in hosts file
    echo.
) else (
    echo Adding '%DOMAIN%' to hosts file...

    REM Backup hosts file
    copy "%HOSTS_FILE%" "%HOSTS_FILE%.backup.%DATE:/=%.%TIME::=%"
    echo Backup created: %HOSTS_FILE%.backup.%DATE:/=%.%TIME::=%

    REM Add entry
    echo %HOSTS_ENTRY% >> "%HOSTS_FILE%"
    echo Added '%DOMAIN%' to hosts file
    echo.
)

REM Flush DNS cache
echo Flushing DNS cache...
ipconfig /flushdns >nul
echo DNS cache flushed
echo.

REM Test DNS resolution
echo Testing DNS resolution...
ping -n 1 %DOMAIN% >nul 2>&1
if %errorLevel% equ 0 (
    echo DNS resolution test: OK
) else (
    echo DNS resolution test: FAILED (but this might be expected)
    echo The domain should still work in your browser
)
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Docker is not installed
    echo Please install Docker Desktop for Windows
    echo Download from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: docker-compose is not installed
    echo Please install Docker Compose
    pause
    exit /b 1
)

echo Docker and docker-compose are installed: OK
echo.

REM Check if .env file exists
if not exist .env (
    echo WARNING: .env file not found
    if exist .env.example (
        echo Creating .env from .env.example...
        copy .env.example .env
        echo Please edit .env and add your API keys before accessing the app
    ) else (
        echo ERROR: .env.example not found
        echo Please create .env manually
    )
    echo.
)

REM Ask which setup to use
echo Choose your setup:
echo   1) Simple (access via http://whatsapp-bot.local:3000)
echo   2) With Nginx (access via http://whatsapp-bot.local - no port needed) [RECOMMENDED]
echo.
set /p CHOICE="Enter choice (1 or 2): "

if "%CHOICE%"=="2" (
    set COMPOSE_FILE=docker-compose.nginx.yml
    set URL=http://%DOMAIN%
    echo.
    echo Starting with Nginx reverse proxy...
) else (
    set COMPOSE_FILE=docker-compose.yml
    set URL=http://%DOMAIN%:3000
    echo.
    echo Starting with simple setup...
)

REM Start Docker containers
echo.
echo Starting Docker containers...
docker-compose -f %COMPOSE_FILE% up -d

echo.
echo Waiting for services to start...
timeout /t 5 /nobreak >nul

REM Check if containers are running
docker ps | findstr whatsapp-bot >nul
if %errorLevel% equ 0 (
    echo Containers are running: OK
) else (
    echo ERROR: Containers failed to start
    echo Check logs with: docker-compose -f %COMPOSE_FILE% logs
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Setup Complete!
echo ==========================================
echo.
echo Access your WhatsApp Bot at:
echo   %URL%
echo.
echo View logs:
echo   docker-compose -f %COMPOSE_FILE% logs -f
echo.
echo Stop containers:
echo   docker-compose -f %COMPOSE_FILE% down
echo.
echo Restart containers:
echo   docker-compose -f %COMPOSE_FILE% restart
echo.

REM Open in browser
set /p OPEN="Open in browser now? (y/n): "
if /i "%OPEN%"=="y" (
    timeout /t 2 /nobreak >nul
    start %URL%
)

echo.
echo Happy messaging!
echo.
pause
