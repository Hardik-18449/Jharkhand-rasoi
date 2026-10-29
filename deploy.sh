#!/bin/bash
# ==============================================================================
# Jharkhand Rasoi - Automated Deployment Script
# Usage: ./deploy.sh  or  bash deploy.sh
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status

echo ""
echo "🚀 ======================================================"
echo "   Starting Jharkhand Rasoi Deployment"
echo "=========================================================="
echo ""

# Ensure we are in the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📂 Current Directory: $PWD"

# 1. Stash or discard minor local changes (e.g. package-lock from npm) to avoid merge conflicts
echo "📥 Checking git status & pulling latest code..."
if [ -f "Frontend/package-lock.json" ]; then
    git restore Frontend/package-lock.json 2>/dev/null || true
fi
if [ -f "Backend/package-lock.json" ]; then
    git restore Backend/package-lock.json 2>/dev/null || true
fi

# Pull latest main branch
git pull origin main

LATEST_COMMIT=$(git log -n 1 --oneline)
echo "✅ Git pull complete: $LATEST_COMMIT"
echo ""

# 2. Build Frontend
echo "📦 Building Frontend (Vite production bundle)..."
cd Frontend
if [ ! -d "node_modules" ]; then
    echo "⚠️ node_modules missing in Frontend, installing dependencies..."
    npm install
fi
npm run build
cd "$SCRIPT_DIR"
echo "✅ Frontend build completed successfully."
echo ""

# 3. Check Nginx Root & Reload
echo "🌐 Checking Nginx configuration..."
NGINX_ROOT=$(grep -rh "root " /etc/nginx/sites-enabled/ 2>/dev/null | head -n 1 | awk '{print $2}' | tr -d ';' || true)

if [ -n "$NGINX_ROOT" ]; then
    echo "   Nginx document root detected: $NGINX_ROOT"
    # If Nginx document root is different from Frontend/dist, copy built files
    FRONTEND_DIST="$SCRIPT_DIR/Frontend/dist"
    if [ "$NGINX_ROOT" != "$FRONTEND_DIST" ] && [ -d "$NGINX_ROOT" ]; then
        echo "   Syncing Frontend/dist to $NGINX_ROOT..."
        cp -r "$FRONTEND_DIST"/* "$NGINX_ROOT"/
    fi
fi

if command -v nginx >/dev/null 2>&1; then
    nginx -t && (systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || true)
    echo "✅ Nginx reloaded successfully."
else
    echo "ℹ️ Nginx command not found, skipping Nginx reload."
fi
echo ""

# 4. Restart Backend via PM2
echo "⚙️  Restarting Backend with PM2..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 restart Jharkhand-rasoi-backend || pm2 start Backend/server.js --name Jharkhand-rasoi-backend
    if pm2 list | grep -q "Jharkhand-rasoi-socket"; then
        pm2 restart Jharkhand-rasoi-socket || true
    fi
    echo "✅ PM2 process restarted."
else
    echo "⚠️ PM2 not found in PATH."
fi

echo ""
echo "🎉 ======================================================"
echo "   Deployment Finished Successfully!"
echo "   Latest Commit: $LATEST_COMMIT"
echo "=========================================================="
echo ""
