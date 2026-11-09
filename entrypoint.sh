#!/bin/sh
# orkestr 入口：UUID/WS 路径/端口/Cloady 节点/备份令牌全部来自环境变量，不进镜像层；
# xray 配置写到 /tmp（平台以非 root 用户运行容器，/etc 未必可写）。
# 任意一个进程退出即整个容器退出，平台重启后自动恢复。
set -e
: "${XRAY_UUID:?missing XRAY_UUID env}"
: "${XRAY_WS_PATH:?missing XRAY_WS_PATH env}"
PORT="${PORT:-8080}"
export HOME=/tmp
export DATA_DIR="${DATA_DIR:-/srv/app/data}"
mkdir -p "$DATA_DIR" /tmp/xray

sed -e "s#__UUID__#${XRAY_UUID}#g" -e "s#__WS_PATH__#${XRAY_WS_PATH}#g" \
  /etc/xray/config.json.template > /tmp/xray/config.json

xray run -c /tmp/xray/config.json &
XPID=$!
sleep 2
PORT="$PORT" DATA_DIR="$DATA_DIR" bun /srv/app/src/server.ts &
NPID=$!
while kill -0 $XPID 2>/dev/null && kill -0 $NPID 2>/dev/null; do sleep 5; done
exit 1
