// 港上后端独立部署入口（Bun + node:http）。
// 路由：
//   GET  /health            健康检查
//   GET  /                  管理后台页（验证版：核验测试、备份下载）
//   POST /actions           空间风格分发：{action, args, actionCallId} -> {data} / {error}
//                          （Netlify 前端现有调用格式，原样兼容）
//   POST /api/<action>      直接分发：body 即 args -> {data} / {error}
//   POST /api/verify        真核验（verifyIdentity 的包装）：{idCard, phone, ...}
//                          -> {ok, found, verified, matchedByIdCard, phoneChanged, case}
//                          （不再是演示桩；无 demo 字段）
//   GET  /blobs/*           还款截图等本地 blob 下载
//   GET  /admin/backup      下载 SQLite 库文件（需 ADMIN_BACKUP_TOKEN）
//   POST /admin/restore     上传 SQLite 库文件，重启后生效（需 ADMIN_BACKUP_TOKEN）
// 跨域：前端在 Netlify、后端在独立服务器，只放行 Netlify 与本后台 artifact
// 域名（含 x-request-id / authorization 请求头），并处理 OPTIONS 预检。
// 无 Origin 头的请求（curl、服务端调用）不做跨域限制。
import { createServer } from "node:http";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
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

// ---------- 安全加固：限流 / 跨域 / 安全头（内存 Map，单进程） ----------

function clientIp(req: import("node:http").IncomingMessage): string {
  const xff = req.headers["x-forwarded-for"];
  const first = Array.isArray(xff) ? xff[0] : xff;
  if (typeof first === "string") {
    const ip = first.split(",")[0]?.trim();
    if (ip) return ip;
  }
  const xri = req.headers["x-real-ip"];
  const real = Array.isArray(xri) ? xri[0] : xri;
  if (typeof real === "string" && real.trim()) return real.trim();
  return req.socket?.remoteAddress || "unknown";
}

function setSecurityHeaders(
  res: import("node:http").ServerResponse,
  noStore = false,
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (noStore) res.setHeader("Cache-Control", "no-store");
}

function isAllowedOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return false;
    if (u.hostname === "candid-treacle-049289.netlify.app") return true;
    if (u.hostname.endsWith(".netlify.app")) return true;
    if (u.hostname.endsWith(".muse.ai")) return true;
    // 备用域名池（债务人页轮换用）：Surge 免费子域名 + 其他常用免费静态托管
    if (u.hostname.endsWith(".surge.sh")) return true;
    if (u.hostname.endsWith(".pages.dev")) return true;
    if (u.hostname.endsWith(".github.io")) return true;
    if (u.hostname.endsWith(".vercel.app")) return true;
    if (u.hostname.endsWith(".onrender.com")) return true;
    return false;
  } catch {
    return false;
  }
}

function setCors(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
): void {
  res.setHeader("Vary", "Origin");
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin) {
    if (isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "content-type, x-request-id, authorization",
      );
    }
  }
}

function applyHeaders(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  noStore = false,
): void {
  setSecurityHeaders(res, noStore);
  setCors(req, res);
}

type RateWindow = { count: number; windowStart: number };

// 窗口内计数，超限返回 true；窗口过期重置；条目过多时清过期条目。
function hitWindow(
  map: Map<string, RateWindow>,
  key: string,
  windowMs: number,
  max: number,
): boolean {
  const now = Date.now();
  if (map.size > 5000) {
    for (const [k, v] of map) {
      if (now - v.windowStart > windowMs) map.delete(k);
    }
  }
  const entry = map.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    map.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

const genericLimits = new Map<string, RateWindow>();
const verifyLimits = new Map<string, RateWindow>();
const backupFailLimits = new Map<string, RateWindow>();
const loginFailures = new Map<
  string,
  { failures: number; lockedUntil: number }
>();

function checkGenericLimit(ip: string): boolean {
  return hitWindow(genericLimits, ip, 60_000, 300);
}

function checkVerifyLimit(ip: string): boolean {
  return hitWindow(verifyLimits, ip, 10 * 60_000, 20);
}

function checkBackupFailLimit(ip: string): boolean {
  return hitWindow(backupFailLimits, ip, 15 * 60_000, 5);
}

function isLoginLocked(ip: string, role: string): boolean {
  const entry = loginFailures.get(`${ip}:${role}`);
  if (!entry) return false;
  // lockedUntil 为 0 表示尚未上锁（仅累计失败次数），不能按过期清理。
  if (entry.lockedUntil === 0) return false;
  if (Date.now() >= entry.lockedUntil) {
    loginFailures.delete(`${ip}:${role}`);
    return false;
  }
  return entry.failures >= 5;
}

function recordLoginFailure(ip: string, role: string): void {
  const key = `${ip}:${role}`;
  const entry = loginFailures.get(key) ?? { failures: 0, lockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= 5) entry.lockedUntil = Date.now() + 15 * 60_000;
  loginFailures.set(key, entry);
}

function clearLoginFailures(ip: string, role: string): void {
  loginFailures.delete(`${ip}:${role}`);
}

// dispatch 返回后按登录结果维护失败计数；返回原 dispatch 结果。
function trackLoginResult(
  ip: string,
  role: string,
  out: { status: number; body: unknown },
): { status: number; body: unknown } {
  const data = (out.body as { data?: { ok?: boolean } } | null)?.data;
  if (data?.ok === true) clearLoginFailures(ip, role);
  else if (data?.ok === false) recordLoginFailure(ip, role);
  return out;
}

function backupToken(
  req: import("node:http").IncomingMessage,
  url: URL,
): string {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  return url.searchParams.get("token") || "";
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
    // handler 抛 "HTTP400:..." 表示请求有误（案件不存在、证件不匹配、
    // 文件过大等），去掉前缀后按 400 返回，不当作服务器内部错误。
    if (msg.startsWith("HTTP400:")) {
      return { status: 400, body: { error: msg.slice("HTTP400:".length) } };
    }
    const status = msg.includes("未登录")
      ? 401
      : msg.includes("只认管理员")
        ? 403
        : msg.includes("稍后再试")
          ? 429
          : 500;
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

function json(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
  noStore = false,
): void {
  applyHeaders(req, res, noStore);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function tooManyRequests(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  message = "尝试次数过多，请15分钟后再试",
): void {
  json(req, res, 429, { error: message }, true);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://x");
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    applyHeaders(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && path === "/health") {
    json(req, res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && path === "/") {
    applyHeaders(req, res);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(adminPage());
    return;
  }
  if (req.method === "GET" && path.startsWith("/blobs/")) {
    const key = decodeURIComponent(path.slice("/blobs/".length));
    const file = await blobs.read(key);
    if (!file) {
      applyHeaders(req, res);
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("not found\n");
      return;
    }
    applyHeaders(req, res);
    res.writeHead(200, {
      "Content-Type": file.contentType,
      "Content-Length": file.buffer.length,
    });
    res.end(file.buffer);
    return;
  }
  if (req.method === "GET" && path === "/admin/backup") {
    const token = backupToken(req, url);
    if (!BACKUP_TOKEN || token !== BACKUP_TOKEN) {
      if (checkBackupFailLimit(clientIp(req))) {
        tooManyRequests(req, res);
        return;
      }
      json(req, res, 403, { error: "备份未启用或令牌不正确（配 ADMIN_BACKUP_TOKEN 环境变量）" });
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
      applyHeaders(req, res);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="gangshang-${new Date().toISOString().slice(0, 10)}.db"`,
        "Content-Length": buf.length,
      });
      res.end(buf);
    } catch (e) {
      json(req, res, 500, { error: `读取库文件失败：${(e as Error).message}` });
    }
    return;
  }
  if (req.method === "POST" && path === "/admin/restore") {
    const token = backupToken(req, url);
    if (!BACKUP_TOKEN || token !== BACKUP_TOKEN) {
      if (checkBackupFailLimit(clientIp(req))) {
        tooManyRequests(req, res);
        return;
      }
      json(req, res, 403, { error: "恢复未启用或令牌不正确（配 ADMIN_BACKUP_TOKEN 环境变量）" });
      return;
    }
    try {
      const buf = await readBody(req, 200 * 1024 * 1024);
      if (buf.length < 100 || buf.subarray(0, 6).toString() !== "SQLite") {
        json(req, res, 400, { error: "上传的文件不是 SQLite 库文件" });
        return;
      }
      writeFileSync(join(DATA_DIR, "gangshang.db.restored"), buf);
      json(req, res, 200, {
        ok: true,
        note: "已接收，服务即将重启，重启后自动用上传的库文件替换当前库。",
      });
      setTimeout(() => process.exit(0), 500);
    } catch (e) {
      json(req, res, 500, { error: `恢复失败：${(e as Error).message}` });
    }
    return;
  }

  // POST /actions：空间风格 {action, args, actionCallId}
  if (req.method === "POST" && path === "/actions") {
    const ip = clientIp(req);
    if (checkGenericLimit(ip)) {
      tooManyRequests(req, res, "请求过于频繁，请1分钟后再试");
      return;
    }
    try {
      const raw = await readBody(req, 10 * 1024 * 1024);
      const body = JSON.parse(raw.toString("utf-8") || "{}") as {
        action?: unknown;
        args?: unknown;
      };
      const name = typeof body.action === "string" ? body.action : "";
      if (!name) {
        json(req, res, 400, { error: "缺少 action 字段" }, true);
        return;
      }
      const argsObj =
        typeof body.args === "object" && body.args !== null
          ? (body.args as Record<string, unknown>)
          : {};
      // 核验与传截图共用同一 IP 限流窗口（同一 IP 每 10 分钟 20 次），
      // 防身份证枚举与截图接口滥用。聊天（getDebtorChat 拉取、sendDebtorMessage
      // 发送）不限流（用户 2026-11-10 亲定：聊天不设频繁限制，只认手动禁言）。
      if (
        (name === "verifyIdentity" || name === "submitPaymentScreenshot") &&
        checkVerifyLimit(ip)
      ) {
        tooManyRequests(req, res, "核验尝试次数过多，请10分钟后再试");
        return;
      }
      const loginRole =
        name === "login" && typeof argsObj.role === "string"
          ? argsObj.role
          : "";
      if (loginRole && isLoginLocked(ip, loginRole)) {
        tooManyRequests(req, res);
        return;
      }
      // 服务端定位（v16）：核验的真实 IP 由分发层注入，覆盖客户端传来的同名字段，防伪造；取不到 IP 时传空串。
      const dispatchArgs =
        name === "verifyIdentity"
          ? { ...argsObj, clientIp: ip === "unknown" ? "" : ip }
          : (body.args ?? {});
      let out = await dispatch(name, dispatchArgs);
      if (loginRole) out = trackLoginResult(ip, loginRole, out);
      json(req, res, out.status, out.body, true);
    } catch (e) {
      json(req, res, 400, { error: `请求解析失败：${(e as Error).message}` }, true);
    }
    return;
  }

  // POST /api/verify：真核验（verifyIdentity 包装），兼容脚手架的旧端点。
  if (req.method === "POST" && path === "/api/verify") {
    const ip = clientIp(req);
    if (checkGenericLimit(ip)) {
      tooManyRequests(req, res, "请求过于频繁，请1分钟后再试");
      return;
    }
    if (checkVerifyLimit(ip)) {
      tooManyRequests(req, res, "核验尝试次数过多，请10分钟后再试");
      return;
    }
    try {
      const raw = await readBody(req, 1 * 1024 * 1024);
      const body = JSON.parse(raw.toString("utf-8") || "{}") as Record<
        string,
        unknown
      >;
      const idCard = typeof body.idCard === "string" ? body.idCard : "";
      if (!idCard.trim()) {
        json(req, res, 400, {
          error: "请提供身份证号（idCard）进行核验",
        }, true);
        return;
      }
      const out = await dispatch("verifyIdentity", {
        idCard,
        phone: typeof body.phone === "string" ? body.phone : "",
        clientIp: ip === "unknown" ? "" : ip,
        loginCountry:
          typeof body.loginCountry === "string" ? body.loginCountry : "",
        loginProvince:
          typeof body.loginProvince === "string" ? body.loginProvince : "",
        loginCity: typeof body.loginCity === "string" ? body.loginCity : "",
      });
      if (out.status !== 200) {
        json(req, res, out.status, out.body, true);
        return;
      }
      const data = (out.body as { data: Record<string, unknown> }).data;
      json(req, res, 200, {
        ok: true,
        found: data.found === true,
        verified: data.found === true,
        matchedByIdCard: data.matchedByIdCard === true,
        phoneChanged: data.phoneChanged === true,
        case: data.case ?? null,
      }, true);
    } catch (e) {
      json(req, res, 400, { error: `请求解析失败：${(e as Error).message}` }, true);
    }
    return;
  }

  // POST /api/<action>：body 即 args。
  if (req.method === "POST" && path.startsWith("/api/")) {
    const ip = clientIp(req);
    if (checkGenericLimit(ip)) {
      tooManyRequests(req, res, "请求过于频繁，请1分钟后再试");
      return;
    }
    const name = decodeURIComponent(path.slice("/api/".length));
    if (!name || name.includes("/")) {
      json(req, res, 404, { error: "未知接口" }, true);
      return;
    }
    try {
      const raw = await readBody(req, 10 * 1024 * 1024);
      const args = raw.length ? JSON.parse(raw.toString("utf-8")) : {};
      const argsObj =
        typeof args === "object" && args !== null
          ? (args as Record<string, unknown>)
          : {};
      // 核验与传截图共用同一 IP 限流窗口（同一 IP 每 10 分钟 20 次），
      // 防身份证枚举与截图接口滥用。聊天（getDebtorChat 拉取、sendDebtorMessage
      // 发送）不限流（用户 2026-11-10 亲定：聊天不设频繁限制，只认手动禁言）。
      if (
        (name === "verifyIdentity" || name === "submitPaymentScreenshot") &&
        checkVerifyLimit(ip)
      ) {
        tooManyRequests(req, res, "核验尝试次数过多，请10分钟后再试");
        return;
      }
      const loginRole =
        name === "login" && typeof argsObj.role === "string"
          ? argsObj.role
          : "";
      if (loginRole && isLoginLocked(ip, loginRole)) {
        tooManyRequests(req, res);
        return;
      }
      // 服务端定位（v16）：核验的真实 IP 由分发层注入，覆盖客户端传来的同名字段，防伪造；取不到 IP 时传空串。
      const dispatchArgs =
        name === "verifyIdentity"
          ? { ...argsObj, clientIp: ip === "unknown" ? "" : ip }
          : args;
      let out = await dispatch(name, dispatchArgs);
      if (loginRole) out = trackLoginResult(ip, loginRole, out);
      json(req, res, out.status, out.body, true);
    } catch (e) {
      json(req, res, 400, { error: `请求解析失败：${(e as Error).message}` }, true);
    }
    return;
  }

  applyHeaders(req, res);
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found\n");
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
