import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cases = sqliteTable("cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  debtorName: text("debtor_name").notNull(),
  phone: text("phone").notNull().default(""),
  idCard: text("id_card").notNull().default(""),
  caseNo: text("case_no").notNull(),
  totalDueCents: integer("total_due_cents").notNull().default(0),
  principalCents: integer("principal_cents").notNull().default(0),
  overdueDays: integer("overdue_days").notNull().default(0),
  penaltyCents: integer("penalty_cents").notNull().default(0),
  originalCreditor: text("original_creditor").notNull().default(""),
  transferAgreementNo: text("transfer_agreement_no").notNull().default(""),
  note: text("note").notNull().default(""),
  needsHuman: integer("needs_human").notNull().default(0),
  humanNote: text("human_note").notNull().default(""),
  // 人工接管时间戳：null = 机器人值守（债务人页按话术自动回复），
  // 有值 = 管理员已人工接管（债务人页机器人停答、显示专员在线）。
  humanTakeoverAt: integer("human_takeover_at", { mode: "timestamp_ms" }),
  // 禁言时间戳：null = 未禁言，有值 = 已禁言（债务人发不出消息，
  // sendDebtorMessage 直接拒绝）。禁言只能由管理员手动设置/解除，
  // 没有自动禁言；刷屏由发送限流挡（超限返回限流文案）。
  mutedAt: integer("muted_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["draft", "sent"] })
    .notNull()
    .default("draft"),
  lastSentAt: integer("last_sent_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const progressSteps = sqliteTable("progress_steps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  occurredOn: text("occurred_on").notNull().default(""),
  status: text("status", { enum: ["pending", "done"] })
    .notNull()
    .default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sendRecords = sqliteTable("send_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  channel: text("channel").notNull().default("站内发送"),
  messageText: text("message_text").notNull().default(""),
  note: text("note").notNull().default(""),
  sentAt: integer("sent_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  sender: text("sender", { enum: ["debtor", "agent", "system"] })
    .notNull()
    .default("debtor"),
  text: text("text").notNull(),
  analysis: text("analysis").notNull().default(""),
  // 客服（我方）随消息发送的图片在 blobs 里的键；无图消息为 null。
  imageBlobKey: text("image_blob_key"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const agreements = sqliteTable("agreements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  kind: text("kind", { enum: ["installment", "waiver", "settlement"] })
    .notNull()
    .default("installment"),
  detail: text("detail").notNull().default(""),
  amountCents: integer("amount_cents").notNull().default(0),
  status: text("status", { enum: ["active", "done", "void"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  paidOn: text("paid_on").notNull().default(""),
  note: text("note").notNull().default(""),
  screenshotBlobKey: text("screenshot_blob_key"),
  reconcileStatus: text("reconcile_status", {
    enum: ["pending", "matched", "mismatch"],
  })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const courtCases = sqliteTable("court_cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseNo: text("case_no").notNull(),
  courtName: text("court_name").notNull().default(""),
  debtorLabel: text("debtor_label").notNull().default(""),
  amountCents: integer("amount_cents").notNull().default(0),
  outcome: text("outcome").notNull().default(""),
  concludedOn: text("concluded_on").notNull().default(""),
  visible: integer("visible").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const lawyerUpdates = sqliteTable("lawyer_updates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  occurredOn: text("occurred_on").notNull().default(""),
  visible: integer("visible").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ---------------- 保全划扣（网页首页同名板块） ---------------- */

// 单例设置行：板块说明、冻结支付功能卡、失信说明
export const preservationSettings = sqliteTable("preservation_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sectionIntro: text("section_intro").notNull().default(""),
  freezeTitle: text("freeze_title").notNull().default(""),
  freezeBody: text("freeze_body").notNull().default(""),
  freezeCaseSource: text("freeze_case_source").notNull().default(""),
  freezeCaseText: text("freeze_case_text").notNull().default(""),
  freezeVisible: integer("freeze_visible").notNull().default(1),
  dishonestNote: text("dishonest_note").notNull().default(""),
});

// 三步链：冻结 → 划扣 → 列入失信（固定三步，只编辑内容）
export const preservationChainSteps = sqliteTable("preservation_chain_steps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stepLabel: text("step_label").notNull().default(""),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

// 执行动态：按所属步骤（1 冻结 / 2 划扣 / 3 列入失信）分组的记录条目
export const preservationFeedItems = sqliteTable("preservation_feed_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stepNo: integer("step_no").notNull().default(1),
  sourceLabel: text("source_label").notNull().default(""),
  tag: text("tag").notNull().default(""),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  visible: integer("visible").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ---------------- 今日已还款（网页首页同名板块） ---------------- */

export const todayRepayments = sqliteTable("today_repayments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameMasked: text("name_masked").notNull().default(""),
  region: text("region").notNull().default(""),
  amountCents: integer("amount_cents").notNull().default(0),
  timeText: text("time_text").notNull().default(""),
  kind: text("kind", { enum: ["full", "installment", "partial"] })
    .notNull()
    .default("full"),
  visible: integer("visible").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ---------------- 顶部执行状态滚动条 ---------------- */

export const tickerItems = sqliteTable("ticker_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  visible: integer("visible").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ---------------- 失信惩戒 ---------------- */

export const punishmentItems = sqliteTable("punishment_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  visible: integer("visible").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ---------------- 聊天付款卡设置（单例） ---------------- */

export const paymentSettings = sqliteTable("payment_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  payeeName: text("payee_name").notNull().default(""),
  bankName: text("bank_name").notNull().default(""),
  accountNo: text("account_no").notNull().default(""),
  qrImageUrl: text("qr_image_url").notNull().default(""),
  note: text("note").notNull().default(""),
});

/* ---------------- 短信链接点击记录 ---------------- */

// 债务人点开短信链接时由债务人网页调用 recordLinkClick 记一条；
// 后台按案件汇总点击次数、首次与最近点击时间。
export const linkClicks = sqliteTable("link_clicks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ---------------- 债务人登录记录 ---------------- */

// 债务人每次通过身份核验登录（verifyIdentity 命中案件）时记一条，
// 保存其登录时填写的手机号；与台账手机号不一致时两个都保留、都展示。
// country / province / city 是这次登录按其登录请求 IP 解析出的地理位置
// （省、市、国家），由债务人网页在核验时随请求带入，解析不到时为空，
// 不影响登录本身；province 存归一化后的省级名称（如「广东省」）。
export const debtorLogins = sqliteTable("debtor_logins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  phone: text("phone").notNull().default(""),
  country: text("country").notNull().default(""),
  province: text("province").notNull().default(""),
  city: text("city").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ---------------- 后台登录凭据（单例） ---------------- */

// 管理员 / 用户两个账号的密码哈希（PBKDF2 加盐）与会话签名密钥。
// 密码由使用者首次打开后台时在设置界面设定，只存哈希，不存明文。
export const authCredentials = sqliteTable("auth_credentials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  adminHash: text("admin_hash").notNull().default(""),
  userHash: text("user_hash").notNull().default(""),
  sessionSecret: text("session_secret").notNull().default(""),
  userDisabled: integer("user_disabled").notNull().default(0),
  // 登录防爆破：每个账号连续输错次数与锁定截止时间（epoch 毫秒，0 = 未锁定）。
  // 同一账号连续错 5 次锁 15 分钟，登录成功或管理员改密后清零。
  adminFailCount: integer("admin_fail_count").notNull().default(0),
  adminLockedUntil: integer("admin_locked_until").notNull().default(0),
  userFailCount: integer("user_fail_count").notNull().default(0),
  userLockedUntil: integer("user_locked_until").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ---------------- 债务人核验尝试（限流计数） ---------------- */

// verifyIdentity 每次调用记一条（无论命中与否），按身份证号 / 手机号统计
// 最近 10 分钟内的尝试次数，任一达到 20 次即拒绝并提示稍后再试；
// 窗口外记录由核验流程顺带清理。生产 HTTP 层另有按 IP 的同口径限流。
export const verifyAttempts = sqliteTable("verify_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  idCard: text("id_card").notNull().default(""),
  phone: text("phone").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ---------------- 系统设置（单例） ---------------- */

// 系统名称：管理员在后台可改，债务人网页与后台显示都读这一行；
// 尚无记录时服务端按当前名称「港上资产执行系统」作为初始值落库。
export const systemSettings = sqliteTable("system_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  systemName: text("system_name").notNull().default(""),
});

/* ---------------- 聊天话术（债务人页协商机器人脚本） ---------------- */

// 后台「话术设置」保存的整套话术，一张表统一存六类行：
// kind=rule 关键词规则（rule_key 标识、pattern 正则、analysis 分析备注、
// reply 回复、sort_order 匹配顺序）；kind=opening 开场白（reply 存句子，
// sort_order 区分第几句）；kind=offer 账单页协商方案文案（reply 存文案，
// 单行）；kind=fallback 兜底回复（analysis + reply，单行）；
// kind=chip 快捷按钮（reply 存按钮标签、analysis 存点击后发出的那句话、
// sort_order 区分第几个）；kind=setting 单项文案（rule_key 存字段路径，
// 如 chatTitle、payCard.note，reply 存文案，单字段一行）。
// 表为空 = 后台从未保存过，getChatScripts 返回内置默认话术。
export const chatScripts = sqliteTable("chat_scripts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind", {
    enum: ["rule", "opening", "offer", "fallback", "chip", "setting"],
  })
    .notNull()
    .default("rule"),
  ruleKey: text("rule_key").notNull().default(""),
  pattern: text("pattern").notNull().default(""),
  analysis: text("analysis").notNull().default(""),
  reply: text("reply").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* ---------------- 账单示例 / 演示账单（单例） ---------------- */

export const demoBill = sqliteTable("demo_bill", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  debtorName: text("debtor_name").notNull().default(""),
  caseNo: text("case_no").notNull().default(""),
  totalDueCents: integer("total_due_cents").notNull().default(0),
  principalCents: integer("principal_cents").notNull().default(0),
  penaltyCents: integer("penalty_cents").notNull().default(0),
  overdueDays: integer("overdue_days").notNull().default(0),
  originalCreditor: text("original_creditor").notNull().default(""),
  transferAgreementNo: text("transfer_agreement_no").notNull().default(""),
});
