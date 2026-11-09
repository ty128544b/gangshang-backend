#!/bin/sh
# orkestr 入口：UUID/WS 路径/端口/Cloady 节点/备份令牌全部来自环境变量，不进镜像层；
# xray 配置写到 /tmp（平台以非 root 用户运行容器，/etc 未必可写）。
# XRAY_UUID 与 XRAY_WS_PATH 同时配了才启动 xray（双节点模式）；不配则只跑后端，
# 订阅里只出 Cloady 节点（2026-11-09 用户定：新号只部署后端，不带代理）。
# 任意一个进程退出即整个容器退出，平台重启后自动恢复。
set -e
PORT="${PORT:-8080}"
export HOME=/tmp
export DATA_DIR="${DATA_DIR:-/srv/app/data}"
mkdir -p "$DATA_DIR" /tmp/xray

XPID=""
if [ -n "$XRAY_UUID" ] && [ -n "$XRAY_WS_PATH" ]; then
  sed -e "s#__UUID__#${XRAY_UUID}#g" -e "s#__WS_PATH__#${XRAY_WS_PATH}#g" \
    /etc/xray/config.json.template > /tmp/xray/config.json
  xray run -c /tmp/xray/config.json &
  XPID=$!
  sleep 2
fi
PORT="$PORT" DATA_DIR="$DATA_DIR" bun /srv/app/src/server.ts &
NPID=$!
while kill -0 $NPID 2>/dev/null && { [ -z "$XPID" ] || kill -0 $XPID 2>/dev/null; }; do sleep 5; done
exit 1
