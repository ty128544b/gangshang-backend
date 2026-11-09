// 港上后端独立部署入口（Bun + node:http）。
// 路由：
//   GET  /health            健康检查
//   GET  /                  管理后台页（验证版：核验测试、订阅链接、备份下载）
//   GET  /clash-meta.yaml   合并订阅（Cloady + orkestr xray 节点，域名取 Host 头）
//   GET  /sub               小火箭订阅
//   POST /actions           空间风格分发：{action, args, actionCallId} -> {data} / {error}
//                          （Netlify 前端现有调用格式，原样兼容）
//   POST /api/<action>      直接分发：body 即 args -> {data} / {error}
//   POST /api/verify        真核验（verifyIdentity 的包装）：{idCard, phone, ...}
//                          -> {ok, found, verified, matchedByIdCard, phoneChanged, case}
//                          （不再是演示桩；无 demo 字段）
//   GET  /blobs/*           还款截图等本地 blob 下载
//   GET  /admin/backup      下载 SQLite 库文件（需 ADMIN_BACKUP_TOKEN）
//   POST /admin/restore     上传 SQLite 库文件，重启后生效（需 ADMIN_BACKUP_TOKEN）
//   WS   <WS_PATH>          Upgrade 请求裸 TCP 透传给本机 xray(10000)
// 跨域：前端在 Netlify、后端在 orkestr，/actions 与 /api/* 允许任意源
// （含 x-request-id 请求头），并处理 OPTIONS 预检。
import { createServer } from "node:http";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { connect as netConnect } from "node:net";
import { Actions } from "./actions";
import { checkpoint, dbFilePath, openDb, swapRestoredDb } from "./db";
import { LocalBlobStore } from "./blobs";
import { createLocalInference } from "./inference";
import type { Ctx } from "./shim";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const PORT = parseInt(process.env.PORT || "8080", 10);
const DATA_DIR = process.env.DATA_DIR || join(ROOT, "data");
const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR || join(ROOT, "drizzle");
const BLOBS_DIR = join(DATA_DIR, "blobs");
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "";
const BACKUP_TOKEN = process.env.ADMIN_BACKUP_TOKEN || "";

// xray（环境变量，不进代码；orkestr 控制台里配）
const XRAY_UUID = process.env.XRAY_UUID || "";
const WS_PATH = process.env.XRAY_WS_PATH || "";
const CLOADY_SERVER = process.env.CLOADY_SERVER || "";
const CLOADY_UUID = process.env.CLOADY_UUID || "";
const CLOADY_PATH = process.env.CLOADY_PATH || "";

// ---------- 订阅（Cloady + orkestr 双节点；Cloady 未配时只出 orkestr） ----------

function clashYaml(host: string): string {
  const nodes: string[] = [];
  const group: string[] = [];
  if (CLOADY_SERVER && CLOADY_UUID && CLOADY_PATH) {
    nodes.push(`  - name: xray-usw1
    type: vless
    server: ${CLOADY_SERVER}
    port: 443
    uuid: ${CLOADY_UUID}
    alterId: 0
    cipher: auto
    udp: true
    tls: true
    servername: ${CLOADY_SERVER}
    network: ws
    ws-opts:
      path: ${CLOADY_PATH}
      headers:
        Host: ${CLOADY_SERVER}`);
    group.push("      - xray-usw1");
  }
  if (XRAY_UUID && WS_PATH) {
    nodes.push(`  - name: xray-orkestr
    type: vless
    server: ${host}
    port: 443
    uuid: ${XRAY_UUID}
    alterId: 0
    cipher: auto
    udp: true
    tls: true
    servername: ${host}
    network: ws
    ws-opts:
      path: ${WS_PATH}
      headers:
        Host: ${host}`);
    group.push("      - xray-orkestr");
  }
  return `port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info
dns:
  enable: true
  ipv6: false
  listen: 0.0.0.0:1053
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - "*.lan"
    - "*.local"
    - "+.3gppnetwork.org"
  nameserver:
    - 8.8.8.8
    - 1.1.1.1
proxies:
${nodes.join("\n")}
proxy-groups:
  - name: PROXY
    type: select
    proxies:
${group.join("\n")}
      - DIRECT
rules:
  - DOMAIN-SUFFIX,3gppnetwork.org,DIRECT
  - MATCH,PROXY
`;
}

function subLinks(host: string): string {
  const enc = encodeURIComponent;
  const lines: string[] = [];
  if (CLOADY_SERVER && CLOADY_UUID && CLOADY_PATH) {
    lines.push(
      `vless://${CLOADY_UUID}@${CLOADY_SERVER}:443?encryption=none&security=tls&type=ws&host=${CLOADY_SERVER}&path=${enc(CLOADY_PATH)}#${enc("xray-usw1")}`,
    );
  }
  if (XRAY_UUID && WS_PATH) {
    lines.push(
      `vless://${XRAY_UUID}@${host}:443?encryption=none&security=tls&type=ws&host=${host}&path=${enc(WS_PATH)}#${enc("xray-orkestr")}`,
    );
  }
  return lines.join("\n") + "\n";
}

// ---------- 管理后台页 ----------

function adminPage(): string {
  const p = join(HERE, "admin.html");
  if (existsSync(p)) return readFileSync(p, "utf-8");
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>港上管理后台</title></head><body><h1>港上管理后台</h1><p><a href="/health">健康检查</a></p></body></html>`;
}

// ---------- 启动：数据库 + 上下文 ----------

const restored = swapRestoredDb(DATA_DIR);
if (restored) console.log("[boot] restored DB file swapped in");
const db = await openDb(DATA_DIR, MIGRATIONS_DIR);
const blobs = new LocalBlobStore(BLOBS_DIR, PUBLIC_BASE_URL);
const inference = createLocalInference();

function makeCtx(): Ctx {
  return {
    slug: "gang-shang-zi-chan-guan-li-hou-tai",
    invocationId: randomUUID(),
    spaceDir: DATA_DIR,
    db: (() => db as never) as Ctx["db"],
    blobs,
    inference,
    emit: () => {},
    invalidateQueries: () => {},
  };
}

// ---------- action 分发 ----------

type AnyDef = (typeof Actions)[keyof typeof Actions];

async function dispatch(
  name: string,
  args: unknown,
): Promise<{ status: number; body: unknown }> {
  const def = (Actions as Record<string, AnyDef | undefined>)[name];
  if (!def) return { status: 404, body: { error: `未知接口: ${name}` } };
  let parsed: unknown;
  try {
    parsed = def.request.parse(args ?? {});
  } catch (e) {
    return {
      status: 400,
      body: { error: `请求参数不合法：${(e as Error).message}` },
    };
  }
  try {
    const handler = def.handler as (
      ctx: Ctx,
      args: unknown,
    ) => Promise<unknown>;
    const result = await handler(makeCtx(), parsed);
    const checked = def.response.parse(result);
    return { status: 200, body: { data: checked } };
  } catch (e) {
    const msg = (e as Error).message || "接口执行失败";
    const status = msg.includes("未登录") ? 401 : 500;
    return { status, body: { error: msg } };
  }
}

function readBody(
  req: import("node:http").IncomingMessage,
  limitBytes: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function cors(res: import("node:http").ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "content-type, x-request-id, authorization",
  );
}

function json(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
): void {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const host = (req.headers.host || "").split(":")[0];
  const url = new URL(req.url || "/", "http://x");
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && path === "/health") {
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && path === "/") {
    cors(res);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(adminPage());
    return;
  }
  if (req.method === "GET" && path === "/clash-meta.yaml") {
    cors(res);
    res.writeHead(200, { "Content-Type": "text/yaml; charset=utf-8" });
    res.end(clashYaml(host));
    return;
  }
  if (req.method === "GET" && path === "/sub") {
    cors(res);
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(subLinks(host));
    return;
  }
  if (req.method === "GET" && path.startsWith("/blobs/")) {
    const key = decodeURIComponent(path.slice("/blobs/".length));
    const file = await blobs.read(key);
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found\n");
      return;
    }
    cors(res);
    res.writeHead(200, {
      "Content-Type": file.contentType,
      "Content-Length": file.buffer.length,
    });
    res.end(file.buffer);
    return;
  }
  if (req.method === "GET" && path === "/admin/backup") {
    const token = url.searchParams.get("token") || "";
    if (!BACKUP_TOKEN || token !== BACKUP_TOKEN) {
      json(res, 403, { error: "备份未启用或令牌不正确（配 ADMIN_BACKUP_TOKEN 环境变量）" });
      return;
    }
    try {
      await checkpoint(db);
    } catch {
      /* 忽略 checkpoint 失败，继续导出 */
    }
    const file = dbFilePath(DATA_DIR);
    try {
      const buf = readFileSync(file);
      cors(res);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="gangshang-${new Date().toISOString().slice(0, 10)}.db"`,
        "Content-Length": buf.length,
      });
      res.end(buf);
    } catch (e) {
      json(res, 500, { error: `读取库文件失败：${(e as Error).message}` });
    }
    return;
  }
  if (req.method === "POST" && path === "/admin/restore") {
    const token = url.searchParams.get("token") || "";
    if (!BACKUP_TOKEN || token !== BACKUP_TOKEN) {
      json(res, 403, { error: "恢复未启用或令牌不正确（配 ADMIN_BACKUP_TOKEN 环境变量）" });
      return;
    }
    try {
      const buf = await readBody(req, 200 * 1024 * 1024);
      if (buf.length < 100 || buf.subarray(0, 6).toString() !== "SQLite") {
        json(res, 400, { error: "上传的文件不是 SQLite 库文件" });
        return;
      }
      writeFileSync(join(DATA_DIR, "gangshang.db.restored"), buf);
      json(res, 200, {
        ok: true,
        note: "已接收，服务即将重启，重启后自动用上传的库文件替换当前库。",
      });
      setTimeout(() => process.exit(0), 500);
    } catch (e) {
      json(res, 500, { error: `恢复失败：${(e as Error).message}` });
    }
    return;
  }

  // POST /actions：空间风格 {action, args, actionCallId}
  if (req.method === "POST" && path === "/actions") {
    try {
      const raw = await readBody(req, 10 * 1024 * 1024);
      const body = JSON.parse(raw.toString("utf-8") || "{}") as {
        action?: unknown;
        args?: unknown;
      };
      const name = typeof body.action === "string" ? body.action : "";
      if (!name) {
        json(res, 400, { error: "缺少 action 字段" });
        return;
      }
      const out = await dispatch(name, body.args ?? {});
      json(res, out.status, out.body);
    } catch (e) {
      json(res, 400, { error: `请求解析失败：${(e as Error).message}` });
    }
    return;
  }

  // POST /api/verify：真核验（verifyIdentity 包装），兼容脚手架的旧端点。
  if (req.method === "POST" && path === "/api/verify") {
    try {
      const raw = await readBody(req, 1 * 1024 * 1024);
      const body = JSON.parse(raw.toString("utf-8") || "{}") as Record<
        string,
        unknown
      >;
      const idCard = typeof body.idCard === "string" ? body.idCard : "";
      if (!idCard.trim()) {
        json(res, 400, {
          error: "请提供身份证号（idCard）进行核验",
        });
        return;
      }
      const out = await dispatch("verifyIdentity", {
        idCard,
        phone: typeof body.phone === "string" ? body.phone : "",
        loginCountry:
          typeof body.loginCountry === "string" ? body.loginCountry : "",
        loginProvince:
          typeof body.loginProvince === "string" ? body.loginProvince : "",
        loginCity: typeof body.loginCity === "string" ? body.loginCity : "",
      });
      if (out.status !== 200) {
        json(res, out.status, out.body);
        return;
      }
      const data = (out.body as { data: Record<string, unknown> }).data;
      json(res, 200, {
        ok: true,
        found: data.found === true,
        verified: data.found === true,
        matchedByIdCard: data.matchedByIdCard === true,
        phoneChanged: data.phoneChanged === true,
        case: data.case ?? null,
      });
    } catch (e) {
      json(res, 400, { error: `请求解析失败：${(e as Error).message}` });
    }
    return;
  }

  // POST /api/<action>：body 即 args。
  if (req.method === "POST" && path.startsWith("/api/")) {
    const name = decodeURIComponent(path.slice("/api/".length));
    if (!name || name.includes("/")) {
      json(res, 404, { error: "未知接口" });
      return;
    }
    try {
      const raw = await readBody(req, 10 * 1024 * 1024);
      const args = raw.length ? JSON.parse(raw.toString("utf-8")) : {};
      const out = await dispatch(name, args);
      json(res, out.status, out.body);
    } catch (e) {
      json(res, 400, { error: `请求解析失败：${(e as Error).message}` });
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found\n");
});

// VLESS+WS：把 Upgrade 请求原样重建后裸 TCP 透传给本机 xray(10000)，
// 由 xray 自己完成 WebSocket 握手（与原脚手架 server.js 同一套做法）。
server.on("upgrade", (req, socket, head) => {
  let pathname = "";
  try {
    pathname = new URL(req.url || "", "http://x").pathname;
  } catch {
    /* ignore */
  }
  if (pathname !== WS_PATH || !WS_PATH) {
    socket.destroy();
    return;
  }
  const upstream = netConnect(10000, "127.0.0.1", () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    upstream.write(lines.join("\r\n") + "\r\n\r\n");
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  const kill = () => {
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
    try {
      upstream.destroy();
    } catch {
      /* ignore */
    }
  };
  upstream.on("error", kill);
  socket.on("error", kill);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`gangshang backend listening on 0.0.0.0:${PORT}`);
  console.log(`data dir: ${DATA_DIR}`);
});

// 优雅退出（平台休眠/重启时）：先关 HTTP 再退出。
function shutdown(signal: string): void {
  console.log(`[shutdown] ${signal}`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
