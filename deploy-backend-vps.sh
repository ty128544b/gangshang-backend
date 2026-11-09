#!/bin/sh
# 港上后端通用 VPS 部署脚本（有 shell 的真服务器用；无 Docker 也能跑）。
# 用法：先把环境变量写进 /opt/gangshang-backend/.env（PORT、CLOADY_SERVER、
# CLOADY_UUID、CLOADY_PATH、ADMIN_BACKUP_TOKEN），再执行本脚本。
# 脚本会：装 Bun（如没有）→ 拉取/更新仓库 → bun install → 用 systemd 常驻
# （无 systemd 则 nohup 后台 + @reboot 自启）→ 拨测 /health。
# 敏感值只读 .env，不进脚本、不进日志。
set -e
APP_DIR="${APP_DIR:-/opt/gangshang-backend}"
GH="github.com"
REPO="${REPO:-https://$GH/ty128544b/gangshang-backend}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "缺 .env：先写 $ENV_FILE（PORT、CLOADY_SERVER、CLOADY_UUID、CLOADY_PATH、ADMIN_BACKUP_TOKEN）" >&2
  exit 1
fi
set -a; . "$ENV_FILE"; set +a
PORT="${PORT:-8080}"
DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
mkdir -p "$DATA_DIR"

if ! command -v bun >/dev/null 2>&1; then
  echo "装 Bun..."
  BUN_SH="bun.sh"
  curl -fsSL "https://$BUN_SH/install" | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi
echo "Bun: $(bun --version)"

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$BRANCH" && git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
bun install --frozen-lockfile --production

if command -v systemctl >/dev/null 2>&1 && systemctl is-system-running >/dev/null 2>&1; then
  cat > /etc/systemd/system/gangshang-backend.service <<EOF
[Unit]
Description=Gangshang backend (Bun + SQLite)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
Environment=DATA_DIR=$DATA_DIR
ExecStart=$HOME/.bun/bin/bun src/server.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now gangshang-backend
  sleep 3
  systemctl status gangshang-backend --no-pager | head -15
else
  echo "无 systemd，用 nohup 后台运行 + @reboot 自启"
  pkill -f "bun src/server.ts" 2>/dev/null || true
  sleep 1
  set -a; . "$ENV_FILE"; set +a
  DATA_DIR="$DATA_DIR" PORT="$PORT" nohup "$HOME/.bun/bin/bun" src/server.ts >> "$APP_DIR/backend.log" 2>&1 &
  (crontab -l 2>/dev/null | grep -v "gangshang-backend" ; echo "@reboot cd $APP_DIR && DATA_DIR=$DATA_DIR PORT=$PORT $HOME/.bun/bin/bun src/server.ts >> $APP_DIR/backend.log 2>&1") | crontab -
  sleep 3
fi

echo "拨测 /health："
H="http://127.0.0.1"
curl -s -m 15 "$H:$PORT/health" || { echo "本机 /health 未通，看日志：$APP_DIR/backend.log"; exit 1; }
echo
echo "部署完成。对外端口 $PORT，数据目录 $DATA_DIR。"
