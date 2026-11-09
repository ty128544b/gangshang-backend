# syntax=docker/dockerfile:1
# 港上后端独立部署：xray (VLESS+WS) + Bun 港上后端，二合一容器
# 入口由 $PORT 环境变量决定（orkestr 控制台设 PORT=8080）。
# Node 直接监听 $PORT 并透传 WS 升级请求给本机 xray（去掉 nginx：平台以
# 非 root 用户运行容器，nginx 读配置前 chown 临时目录会报 Operation not
# permitted；Node 透传方案已在真实拨测验证通过）。
# 敏感值一律走环境变量，不进镜像层：XRAY_UUID / XRAY_WS_PATH（必填），
# CLOADY_SERVER / CLOADY_UUID / CLOADY_PATH（合并订阅用，可空），
# ADMIN_BACKUP_TOKEN（备份/恢复令牌，可空=禁用），DATA_DIR（默认 /srv/app/data）。
FROM ghcr.io/xtls/xray-core:latest AS xray

FROM oven/bun:1.4.4
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /tmp/xray /srv/app/data \
 && chmod 777 /tmp/xray /srv/app/data
COPY --from=xray /usr/local/bin/xray /usr/local/bin/xray
COPY --from=xray /usr/local/share/xray/geoip.dat /usr/local/share/xray/geoip.dat
COPY --from=xray /usr/local/share/xray/geosite.dat /usr/local/share/xray/geosite.dat
WORKDIR /srv/app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY config.json.template /etc/xray/config.json.template
COPY drizzle ./drizzle
COPY src ./src
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod a+x /usr/local/bin/entrypoint.sh \
 && chgrp -R 0 /srv/app /etc/xray /usr/local/bin \
 && chmod -R g=u /srv/app /etc/xray /usr/local/bin
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
