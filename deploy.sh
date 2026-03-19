#!/usr/bin/env bash
set -euo pipefail

# Mycarium deploy script — run on the server from the repo root (~/mycarium).
# Usage:
#   ./deploy.sh          Deploy both app and server
#   ./deploy.sh app      Deploy only the PWA
#   ./deploy.sh server   Deploy only the persistence service

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$REPO_DIR/app"
SERVER_DIR="$REPO_DIR/server"
WWW_DIR="/var/www/mycarium"

deploy_app() {
  echo "==> Deploying app..."
  cd "$APP_DIR"
  pnpm install --frozen-lockfile
  pnpm build
  sudo cp -r dist/* "$WWW_DIR/"
  sudo chown -R www-data:www-data "$WWW_DIR"
  echo "==> App deployed to $WWW_DIR"
}

deploy_server() {
  echo "==> Deploying server..."
  cd "$SERVER_DIR"
  pnpm install --frozen-lockfile
  pnpm build
  sudo systemctl restart mycarium-server
  echo "==> Server restarted"
  sudo systemctl status mycarium-server --no-pager
}

target="${1:-all}"

echo "==> Pulling latest code..."
cd "$REPO_DIR"
git pull

case "$target" in
  app)    deploy_app ;;
  server) deploy_server ;;
  all)    deploy_app; deploy_server ;;
  *)      echo "Usage: $0 [app|server|all]"; exit 1 ;;
esac

echo "==> Done."
