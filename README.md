# 港上资产执行系统 — 独立后端

真实后端（非演示桩）：案件台账、身份核验、聊天协商、还款确认、首页内容管理、
数据统计、链接点击记录、还款意愿与年龄分段、登录手机号/地点记录，全部跑通。
纯后端部署，不含任何代理。

## 来源

- 业务逻辑：从 `gang-shang-zi-chan-guan-li-hou-tai` 空间后端原样移植
  （`src/actions.ts` 约 60 个 action、`src/schema.ts`、drizzle 迁移 0001–0011）。
  只改了两处：① import 从 `@hatch/space-sdk` 换成本地 `src/shim.ts`；
  ② 见下文“与原版的一个修正”。

## 与原版的一个修正（重要）

原版 `guardActions` 把 `verifyIdentity` 与 `getHomepageContent` 放在
`READ_ACTIONS` 而不是 `PUBLIC_ACTIONS`，即要求请求带 `sessionToken`。
但债务人网页（Netlify 前端）在**未登录**状态下直接调这两个接口
（核验登录、加载首页内容），请求里没有 `sessionToken`——按原版守卫，
债务人登录与首页内容加载会被全部拒绝（“未登录或登录已失效”）。
独立部署这里把这两个接口列入 `PUBLIC_ACTIONS`（见 `src/actions.ts`
的注释）。其余管理接口仍需登录 token，不受影响。
原空间 artifact 存在同样的潜在问题，值得单独修一次。

## 本地运行

```bash
bun install
PORT=8080 DATA_DIR=./data ADMIN_BACKUP_TOKEN=自设令牌 bun src/server.ts
```

- `GET /health` → `{"ok":true}`
- `GET /` → 管理后台页（核验测试表单、备份下载）
- `POST /actions` body `{"action":"接口名","args":{...}}` → `{"data":...}` /
  `{"error":"..."}`；公开接口：`getAuthStatus`、`setupPasswords`、`login`、
  `getSession`、`recordLinkClick`、`getSystemName`、`verifyIdentity`、
  `getHomepageContent`；其余接口要在 `args` 里带 `sessionToken`。
- `POST /api/<action>`：body 直接是 args（同上）。
- `POST /api/verify`：`{"idCard","phone"}` → 真核验结果
  `{"ok":true,"found":true,"verified":true,"matchedByIdCard":true,...}`，
  **没有 `demo` 字段**。未匹配返回 `found:false, verified:false`。
- 首次打开先调 `setupPasswords` 设管理员+用户密码（PBKDF2 加盐哈希，
  会话 7 天），之后调 `login` 拿 token。

## 部署（控制台操作）

1. GitHub 建公开仓 `ty128544b/gangshang-backend`，把本目录推上去
   （不要把任何密码/密钥写进仓库；`.gitignore` 已排除 `data/`、
   `node_modules/`、`.env`、`*.db`）。
2. 平台控制台建应用，部署源改成这个 GitHub 仓库，`Dockerfile.backend`
   为入口（构建命令留空，用 Dockerfile 构建；启动命令 `bun src/server.ts`，
   入口在 `entrypoint.sh`）。
3. 环境变量：
   - `PORT=8080`（平台注入的端口，以控制台为准）
   - `ADMIN_BACKUP_TOKEN`：自设一个强令牌（备份/恢复用；留空则禁用）
   - `DATA_DIR`：默认 `/srv/app/data`，一般不用改
4. 重新部署。部署后验证（把 `https://<后端域名>` 换成实际地址）：
   - `GET https://<后端域名>/health` → `{"ok":true}`
   - `GET https://<后端域名>/` → 管理后台页 200
   - `POST https://<后端域名>/api/verify`
     `{"idCard":"<台账里真实身份证号>","phone":"<手机号>"}` →
     `verified:true` 且响应里没有 `demo`

## Netlify 前端改动（改 3 处，同一行）

文件：`gang-shang-zi-chan-guan-li-xi-tong.html`
（`~/workspace/your_files/gang-shang-zi-chan-guan-li-xi-tong/`）

把三处相对路径

```
../gang-shang-zi-chan-guan-li-hou-tai/actions
```

全部改成绝对地址

```
https://<后端域名>/actions
```

三处位置（按当前文件）：约第 441 行（首页内容加载）、约第 971 行
（verifyIdentity 核验）、约第 1104 行（recordLinkClick 点击上报）。
改完重新上传到 Netlify（同名 index.html 覆盖），域名不变。
后端已开 CORS（`Access-Control-Allow-Origin: *`，含 `x-request-id`），
前端无需再改请求头。

## 数据持久化与备份（必读）

- 数据库是 SQLite 单文件 `$DATA_DIR/gangshang.db`（libsql + drizzle），
  启动时自动跑完 11 个迁移。
- **容器文件系统不保证持久**：免费档休眠/重新部署可能丢数据。
  免费 Postgres add-on 已坏（一直 error、删不掉、占着唯一免费名额），
  所以目前不走它；更耐久的办法是接外部免费 Postgres（Supabase/Neon），
  属于后续升级项。
- **备份**：`GET /admin/backup?token=<ADMIN_BACKUP_TOKEN>` 下载当前
  库文件（下载前服务会先做 WAL 检查点，保证文件一致）。
  建议：每次导入台账/改完重要数据后立即下载一份，存在本地。
- **恢复**：`POST /admin/restore?token=<ADMIN_BACKUP_TOKEN>`，body 为
  SQLite 文件二进制；接口校验文件头（`SQLite format 3`）后写入
  `gangshang.db.restored`，随后服务自动退出——平台重启容器时启动
  逻辑会把 `.restored` 文件替换为当前库。重启后核验一条已知案件
  确认恢复成功。
- 恢复接口用错令牌返回 403；传非 SQLite 文件返回 400，不动原库。

## 已知限制（不是缺陷，是待办）

- **聊天分析目前是规则版**：原版 `analyzeChatMessage` 调
  `ctx.inference.complete`（空间内置 LLM）。独立部署没有该服务，
  `src/inference.ts` 用关键词规则产出同样的结构
  （意图/还款意愿/风险点/建议话术），`computeWillingness` 的
  高/中/低推导仍按原逻辑工作。后续接 LLM 时只改 `src/inference.ts`
  一个文件（按 zod schema 校验输出）。
- **React 管理后台未移植**：原版管理界面是空间 React 客户端；这里
  只提供一个轻量管理页（`src/admin.html`：健康状态、核验测试、备份下载）。案件台账的增删改查、Excel 导入、聊天、
  还款确认等操作走 `/actions` 接口（可用 `login` 拿到的 admin
  token 调用）。后续可再移植完整管理 UI。
- 截图上传用本地文件存储（`$DATA_DIR/blobs/`），通过 `/blobs/<key>`
  同源访问；原版走空间 blob 存储，接口语义一致。
- xlsx 不需要：原版 `importCases` 接收客户端已解析好的 `rows`，
  服务端不解析 Excel，所以依赖里没有 xlsx。
