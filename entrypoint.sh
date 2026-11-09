#!/bin/sh
# 港上后端入口：只跑 Bun 后端，不启动任何代理。
# 环境变量：PORT（默认 8080）、DATA_DIR（默认 /srv/app/data）、ADMIN_BACKUP_TOKEN（备份/恢复令牌）。
set -e
PORT="${PORT:-8080}"
export HOME=/tmp
export DATA_DIR="${DATA_DIR:-/srv/app/data}"
mkdir -p "$DATA_DIR"

PORT="$PORT" DATA_DIR="$DATA_DIR" bun /srv/app/src/server.ts &
NPID=$!
while kill -0 $NPID 2>/dev/null; do sleep 5; done
exit 1
