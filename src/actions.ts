import {
  defineAction,
  z,
  type ActionDefinition,
  type ActionsModule,
  type Ctx,
  type SpaceDb,
} from "./shim";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, asc, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import * as schema from "./schema";

const caseFields = {
  debtorName: z.string().min(1, "债务人姓名不能为空"),
  phone: z.string().default(""),
  idCard: z.string().default(""),
  caseNo: z.string().min(1, "案件编号不能为空"),
  totalDueCents: z.number().int().min(0),
  principalCents: z.number().int().min(0).default(0),
  overdueDays: z.number().int().min(0),
  penaltyCents: z.number().int().min(0),
  originalCreditor: z.string().default(""),
  transferAgreementNo: z.string().default(""),
  note: z.string().default(""),
};

const caseOut = z.object({
  id: z.number(),
  debtorName: z.string(),
  phone: z.string(),
  idCard: z.string(),
  caseNo: z.string(),
  totalDueCents: z.number(),
  principalCents: z.number(),
  overdueDays: z.number(),
  penaltyCents: z.number(),
  originalCreditor: z.string(),
  transferAgreementNo: z.string(),
  note: z.string(),
  needsHuman: z.boolean(),
  humanNote: z.string(),
  humanTakeover: z.boolean(),
  muted: z.boolean(),
  mutedBy: z.string(),
  assigneeId: z.number().nullable(),
  assigneeName: z.string(),
  chatCount: z.number(),
  pendingPayments: z.number(),
  status: z.enum(["draft", "sent"]),
  lastSentAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stepTotal: z.number(),
  stepDone: z.number(),
  sendCount: z.number(),
  willingness: z.enum(["high", "mid", "low"]),
  clickCount: z.number(),
  firstClickAt: z.string().nullable(),
  lastClickAt: z.string().nullable(),
});

const stepOut = z.object({
  id: z.number(),
  caseId: z.number(),
  title: z.string(),
  detail: z.string(),
  occurredOn: z.string(),
  status: z.enum(["pending", "done"]),
  sortOrder: z.number(),
});

const sendOut = z.object({
  id: z.number(),
  caseId: z.number(),
  channel: z.string(),
  messageText: z.string(),
  note: z.string(),
  sentAt: z.string(),
});

const chatMessageOut = z.object({
  id: z.number(),
  caseId: z.number(),
  sender: z.enum(["debtor", "agent", "system"]),
  text: z.string(),
  analysis: z.string(),
  actorName: z.string(),
  hasImage: z.boolean(),
  imageUrl: z.string(),
  createdAt: z.string(),
});

// 债务人端（getDebtorChat）看到的聊天消息：不含后台分析字段。
const debtorChatMessageOut = z.object({
  id: z.number(),
  sender: z.enum(["debtor", "agent", "system"]),
  text: z.string(),
  hasImage: z.boolean(),
  imageUrl: z.string(),
  createdAt: z.string(),
});

const agreementOut = z.object({
  id: z.number(),
  caseId: z.number(),
  kind: z.enum(["installment", "waiver", "settlement"]),
  detail: z.string(),
  amountCents: z.number(),
  createdBy: z.string(),
  status: z.enum(["active", "done", "void"]),
  createdAt: z.string(),
});

const paymentOut = z.object({
  id: z.number(),
  caseId: z.number(),
  amountCents: z.number(),
  paidOn: z.string(),
  note: z.string(),
  recordedBy: z.string(),
  hasScreenshot: z.boolean(),
  reconcileStatus: z.enum(["pending", "matched", "mismatch"]),
  createdAt: z.string(),
});

const courtCaseOut = z.object({
  id: z.number(),
  caseNo: z.string(),
  courtName: z.string(),
  debtorLabel: z.string(),
  amountCents: z.number(),
  outcome: z.string(),
  concludedOn: z.string(),
  visible: z.boolean(),
  sortOrder: z.number(),
});

const lawyerUpdateOut = z.object({
  id: z.number(),
  title: z.string(),
  detail: z.string(),
  occurredOn: z.string(),
  visible: z.boolean(),
  sortOrder: z.number(),
});

const preservationSettingsOut = z.object({
  sectionIntro: z.string(),
  freezeTitle: z.string(),
  freezeBody: z.string(),
  freezeCaseSource: z.string(),
  freezeCaseText: z.string(),
  freezeVisible: z.boolean(),
  dishonestNote: z.string(),
});

const chainStepOut = z.object({
  id: z.number(),
  stepLabel: z.string(),
  title: z.string(),
  detail: z.string(),
  sortOrder: z.number(),
});

const feedItemOut = z.object({
  id: z.number(),
  stepNo: z.number(),
  sourceLabel: z.string(),
  tag: z.string(),
  title: z.string(),
  detail: z.string(),
  visible: z.boolean(),
  sortOrder: z.number(),
});

const todayRepaymentOut = z.object({
  id: z.number(),
  nameMasked: z.string(),
  region: z.string(),
  amountCents: z.number(),
  timeText: z.string(),
  kind: z.enum(["full", "installment", "partial"]),
  visible: z.boolean(),
  sortOrder: z.number(),
});

const tickerItemOut = z.object({
  id: z.number(),
  text: z.string(),
  visible: z.boolean(),
  sortOrder: z.number(),
});

const punishmentItemOut = z.object({
  id: z.number(),
  title: z.string(),
  detail: z.string(),
  visible: z.boolean(),
  sortOrder: z.number(),
});

const paymentSettingsOut = z.object({
  payeeName: z.string(),
  bankName: z.string(),
  accountNo: z.string(),
  qrImageUrl: z.string(),
  note: z.string(),
});

/* 首页对公账号（与聊天付款卡分开）：收款户名、开户银行、收款账号、收款二维码。 */
const corporateAccountOut = z.object({
  payeeName: z.string(),
  bankName: z.string(),
  accountNo: z.string(),
  qrImageUrl: z.string(),
});

const demoBillOut = z.object({
  debtorName: z.string(),
  caseNo: z.string(),
  totalDueCents: z.number(),
  principalCents: z.number(),
  penaltyCents: z.number(),
  overdueDays: z.number(),
  originalCreditor: z.string(),
  transferAgreementNo: z.string(),
});

const EMPTY_PAYMENT_SETTINGS: z.infer<typeof paymentSettingsOut> = {
  payeeName: "",
  bankName: "",
  accountNo: "",
  qrImageUrl: "",
  note: "",
};

const EMPTY_CORPORATE_ACCOUNT: z.infer<typeof corporateAccountOut> = {
  payeeName: "",
  bankName: "",
  accountNo: "",
  qrImageUrl: "",
};

/* 律师工作进度（办理进度时间轴）：state 为 done 已完成 / now 进行中 /
   todo 待进行；dateLabel 已完成填日期（如 10-20），进行中填“进行中”，
   待进行填“待进行”。后台未保存过时用这组默认进度：当前在入户调查这一步，
   先入户调查、再单位调查，收入核实待进行。 */
const lawyerProgressStepOut = z.object({
  id: z.number(),
  sortOrder: z.number(),
  title: z.string(),
  description: z.string(),
  dateLabel: z.string(),
  state: z.enum(["done", "now", "todo"]),
});

const DEFAULT_LAWYER_PROGRESS: z.infer<typeof lawyerProgressStepOut>[] = [
  { id: 0, sortOrder: 0, title: "接受委托 · 债权材料核验", description: "转让协议、借款合同、还款记录已归档", dateLabel: "10-20", state: "done" },
  { id: 0, sortOrder: 1, title: "律师函已送达", description: "已通过短信、挂号信双通道送达并留存回执", dateLabel: "10-25", state: "done" },
  { id: 0, sortOrder: 2, title: "律师到户到村入户调查中", description: "正在前往户籍地、村（居）委会核实家庭收入来源与实际居住情况", dateLabel: "进行中", state: "now" },
  { id: 0, sortOrder: 3, title: "律师前往工作单位调查核实", description: "向所在单位核实任职情况与收入发放方式", dateLabel: "待进行", state: "todo" },
  { id: 0, sortOrder: 4, title: "收入核实", description: "入户与单位调查完成后核实月收入与工资代发账户", dateLabel: "待进行", state: "todo" },
  { id: 0, sortOrder: 5, title: "向法院申请财产保全", description: "冻结银行账户、微信及支付宝资金", dateLabel: "待进行", state: "todo" },
  { id: 0, sortOrder: 6, title: "执行扣划 · 列入失信名单", description: "按核实收入执行工资扣划，直至清偿完毕", dateLabel: "待进行", state: "todo" },
];

const EMPTY_DEMO_BILL: z.infer<typeof demoBillOut> = {
  debtorName: "",
  caseNo: "",
  totalDueCents: 0,
  principalCents: 0,
  penaltyCents: 0,
  overdueDays: 0,
  originalCreditor: "",
  transferAgreementNo: "",
};

/* 系统名称：存 system_settings 单例行，管理员在后台改；
   尚无记录时用当前名称作初始值落库，之后一律以库里为准。 */
const DEFAULT_SYSTEM_NAME = "港上资产执行系统";

async function loadSystemName(ctx: Ctx): Promise<string> {
  const db = ctx.db<typeof schema>();
  const rows = await db.select().from(schema.systemSettings);
  const row = rows[0];
  if (row) return row.systemName.trim() ? row.systemName : DEFAULT_SYSTEM_NAME;
  await db
    .insert(schema.systemSettings)
    .values({ systemName: DEFAULT_SYSTEM_NAME });
  return DEFAULT_SYSTEM_NAME;
}

/* ---------------- 真模型端点（generateReply） ----------------
   端点地址存在 system_settings 单例行的 model_endpoint_url 列（迁移
   0023），空串 = 未配，走下面代码默认值。轮换监控负责在端点变化时
   更新这一列，改地址不需要改代码。 */

// 模型端点默认值：Groq 托管 API（qwen/qwen3.8-27b，免费层）。
// 2026-11-11 用户在手机上注册 Groq 成功（ty629526@gmail.com），
// key 已验证可用，3 道催收题全过。Groq 不支持自传模型，14B 只能
// 跑自有 GPU，不走这条线。API key 不进代码/仓库，从环境变量
// GROQ_API_KEY 读（FadeHost 面板 /api/bots/{id}/env 设置）。
// 库里配了端点就以库里为准；旧 serveo/pinggy 死链由管理动作改掉。
const DEFAULT_MODEL_ENDPOINT_URL = "https://api.groq.com/openai";

// Groq API key：只从环境变量读，绝不写进代码（仓库是公开的）。
// 未配时 generateReply 返回 modelAvailable:false，债务人页回落关键词。
const GROQ_API_KEY = (process.env.GROQ_API_KEY ?? "").trim();

async function loadModelEndpointUrl(ctx: Ctx): Promise<string> {
  const db = ctx.db<typeof schema>();
  const rows = await db.select().from(schema.systemSettings);
  const row = rows[0];
  if (row) {
    return row.modelEndpointUrl.trim()
      ? row.modelEndpointUrl.trim()
      : DEFAULT_MODEL_ENDPOINT_URL;
  }
  await db.insert(schema.systemSettings).values({
    systemName: DEFAULT_SYSTEM_NAME,
    modelEndpointUrl: DEFAULT_MODEL_ENDPOINT_URL,
  });
  return DEFAULT_MODEL_ENDPOINT_URL;
}

// 模型 API key：优先读库里 system_settings.model_api_key，
// 库里空串时读环境变量 GROQ_API_KEY，两者都没有返回空串。
async function loadModelApiKey(ctx: Ctx): Promise<string> {
  const db = ctx.db<typeof schema>();
  const rows = await db.select().from(schema.systemSettings);
  const row = rows[0];
  const dbKey = (row?.modelApiKey ?? "").trim();
  if (dbKey) return dbKey;
  return GROQ_API_KEY;
}

/* ---------------- 真模型聊天：SYSTEM 模板（回复铁律生产版） ----------------
   底本是用户自己的“回复铁律”（9 条铁律 + 8 组示范，Kaggle/Colab 笔记
   本里 8/8 通过的那版）。生产版只按用户决定改了五处，不许再私自加
   新规矩：
   ① 写死的数全部换成占位符，由 buildGenerateReplySystem 按本案数值填；
   ② 减免与分期（用户 2026-11-12 亲定，取代旧方案 (c)）：减免、分期一律
      人工，机器人不谈、不报数、不承诺；债务人问减免/分期时只回固定转接
      话术，等专员处理、由专员给方案；
   ③ 截止时间不写死 21:00（没有按案子的截止时间字段），一律说“今天”；
   ④ “先付 2000 锁定”的 2000 是测试案子的数，生产版用 {lockAmount}
      （本案总额约一成取整，最低 100）；
   ⑤ 其余铁律与 8 组示范的场景/回法结构一字不动，只换数字与减免说法。
   另外两处如实说明：测试案的“罚息每天 +¥9.20”没有按案子的来源字段，
   生产版删了这一句（不写死假数字）；“利息/罚息”按案件字段拆成
   罚息 {penalty} + 利息 {interest} 两项（fillTpl 同口径）。
   模板先放后端代码常量；以后可移到 system_settings / 话术设置里由
   管理员改，不要写死在前端。 */
const GENERATE_REPLY_SYSTEM_TEMPLATE = `你是一位经验丰富的催收专员，正在跟债务人协商还款。你说话像真人一样自然、口语化，有商有量但立场坚定，就像一个做了多年催收的老专员在微信上跟人谈事。不要像机器背稿，不要每句都一个套路。案件：欠款总额 ¥{amount}（本金 ¥{principal}、罚息 ¥{penalty}、利息 ¥{interest}），已逾期 {overdueDays} 天。分期方案由专员根据您的情况定。收款：对公账户收款码为主，付完上传截图核验；也有专员减免、专员代入帐的情况。方案只保留到今天。

回复铁律（必须逐条遵守）：
1. 说话像真人专员，不要像机器背稿。每条回复 1-3 句，口语化、自然，别啰嗦。句式长短搭配，不要每句都一样长、一样结构。
2. 首轮只报全额 ¥{amount}，不提减免价；减免一律由专员人工处理，你不谈、不报数、不承诺。债务人问减免时只回“您的减免申请正在由专员处理，专员会尽快与您联系协商减免方案，请您稍候。”
3. 语气坚定但不生硬，有商有量。不要用“您好”“请问”“麻烦您”这类客套话。关键处点一下截止时间或后果就行，不用每句都挂着。
4. 只给选择题，不问是非题。不要问“能还吗”“付清吗”“确认吗”，要问“今天先付 ¥{lockAmount} 锁定，还是直接按 ¥{amount} 结清？”
5. 对方说“下个月”“考虑一下”“没钱”，必须追具体日期 + 今天先付 ¥{lockAmount} 锁定。
6. 核销必须人工操作，你没有核销权限。你看不到图片，也查不到银行流水，永远不要说“到账了”“已核销”“已收到款”“已确认到账”。对方说已付款、发了截图或问“收到了？”时，只回“请稍等，财务核验中，请稍等”；欠款仍按全额 ¥{amount} 算，绝不能按对方说的数减。
7. 对方说还不起、只能还一点、要求分期，分期方案由专员人工给，你不给期数、不报每期数、不承诺。只回“您的分期申请正在由专员处理，专员会尽快与您联系协商分期方案，请您稍候。”
8. 对方前后矛盾当场点破。
9. 对方一旦答应金额 + 时间，立刻逐字复述请对方回“确认”。
10. 绝不重复上一句：上一句已经给过“先付锁定还是结清”的选择，这句必须换个角度（说分期、说后果、追具体时间），不许原样再说一遍。
11. 对方说“人工”“转人工”“找真人”“换个人”“让你们领导来”，只回“好的，已为您转接专员，请稍等”，不要再推付款。
12. 先接对方这句话（他说什么你先回什么），再提付款。不要上来就推付款。

【标准示范由后台话术设置（chat_scripts 表）提供，见下文“后台话术”一节，与关键词规则同一套，不另写。】`;

// 金额格式化：与债务人页 fillTpl 的 yuanStr 同口径（分转元，整数不带
// 小数位，有小数最多 2 位，千分位逗号）。
function yuanForPrompt(cents: number): string {
  const v = (Number(cents) || 0) / 100;
  return v.toLocaleString("zh-CN", {
    minimumFractionDigits: v % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// 按案件行把 SYSTEM 模板的占位符填成真实数值。口径与债务人页 fillTpl
// 一致：{interest} = 总额 - 本金 - 罚息（不小于 0）；{install6/12} =
// 总额 ÷6/÷12 取整；{lockAmount} = 总额约一成取整（最低 100）。
function buildGenerateReplySystem(
  row: typeof schema.cases.$inferSelect,
  learned: string[] = [],
  scripts?: ChatScriptsData | null,
): string {
  const totalYuan = (Number(row.totalDueCents) || 0) / 100;
  const interestCents = Math.max(
    0,
    (Number(row.totalDueCents) || 0) -
      (Number(row.principalCents) || 0) -
      (Number(row.penaltyCents) || 0),
  );
  const map: Record<string, string> = {
    "{amount}": yuanForPrompt(row.totalDueCents),
    "{principal}": yuanForPrompt(row.principalCents),
    "{penalty}": yuanForPrompt(row.penaltyCents),
    "{interest}": yuanForPrompt(interestCents),
    "{overdueDays}": String(Number(row.overdueDays) || 0),
    "{install6}": Math.round(totalYuan / 6).toLocaleString("zh-CN"),
    "{install12}": Math.round(totalYuan / 12).toLocaleString("zh-CN"),
    "{lockAmount}": Math.max(
      100,
      Math.round(totalYuan * 0.1),
    ).toLocaleString("zh-CN"),
    "{caseNo}": row.caseNo ?? "",
    "{agreementNo}": row.transferAgreementNo ?? "",
    "{debtorName}": row.debtorName ?? "",
    "{creditor}": row.originalCreditor ?? "",
  };
  const fill = (t: string) =>
    t.replace(
      /\{[a-zA-Z0-9]+\}/g,
      (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : k),
    );
  let base = GENERATE_REPLY_SYSTEM_TEMPLATE.replace(
    /\{[a-zA-Z0-9]+\}/g,
    (k) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : k),
  );
  // 后台话术（与关键词规则同一套 chat_scripts 表，管理员在后台改完，
  // AI 下次生成即用同一套，不再各说各的）：规则按 pattern→reply 当示范，
  // 开场白与兜底也一并给模型参考。
  if (scripts) {
    const ruleLines = (scripts.rules ?? [])
      .filter((r) => (r.reply ?? "").trim().length > 0)
      .map(
        (r) =>
          `债务人说到“${r.pattern}”时回：“${fill(r.reply)}”`,
      );
    const sections: string[] = [];
    if (ruleLines.length > 0) {
      sections.push(
        `【后台话术（与关键词规则同一套，照这个回）】\n${ruleLines.join("\n")}`,
      );
    }
    const opening = (scripts.opening ?? [])
      .map((s) => s.trim())
      .filter(Boolean);
    if (opening.length > 0) {
      sections.push(`【开场白参考】\n${opening.map((s) => fill(s)).join("\n")}`);
    }
    const fallback = (scripts.fallback?.reply ?? "").trim();
    if (fallback) {
      sections.push(`【兜底回复】${fill(fallback)}`);
    }
    if (sections.length > 0) base += `\n\n${sections.join("\n\n")}`;
  }
  // 已学成功话术（专员平时说话 + 真实催回过款的，整条入库、去重后）：
  // 当示范追加，数字按本案填。这是 AI 口气的标准，优先照着这个风格回。
  if (learned.length === 0) return base;
  const examples = learned
    .map((t) => fill(t))
    .map((t) => `— ${t}`)
    .join("\n");
  return `${base}\n\n【专员说话方式（专员平时真人发的 + 真实催回过款的，照着这个口气回）】\n${examples}`;
}

/* ---------------- 已学成功话术库 ----------------
 * 归一化（去重键）：所有数字→{N}、空白折叠、去首尾。只差金额的两条
 * 回复视为同一条话术，不重复入库。入库时把数字还原成占位符存 text，
 * 生成时按本案数值填（与 buildGenerateReplySystem 同一套占位符）。 */
function normalizeScript(text: string): string {
  return text
    .replace(/[0-9][0-9,，.、]*/g, "{N}")
    .replace(/\s+/g, " ")
    .trim();
}

function deNumberScript(text: string): string {
  return text.replace(/[0-9][0-9,，.、]*/g, "{N}");
}

// 专员发消息时立即学：专员平时说话的口气就是 AI 要学的标准，不用等
// 收款。归一化去重（同 promoteLearnedScripts 口径），失败不影响发消息。
async function learnAgentMessage(
  ctx: Ctx,
  caseId: number,
  text: string,
): Promise<void> {
  const db = ctx.db<typeof schema>();
  const normalized = normalizeScript(text);
  if (!normalized || normalized.length < 4) return;
  try {
    const exists = await db
      .select({ id: schema.learnedScripts.id })
      .from(schema.learnedScripts)
      .where(eq(schema.learnedScripts.normalized, normalized))
      .limit(1);
    if (exists.length > 0) return;
    // 触发语境：该案债务人最近一条消息，供以后按场景参考。
    let trigger = "";
    try {
      const last = await db
        .select({ text: schema.chatMessages.text })
        .from(schema.chatMessages)
        .where(
          and(
            eq(schema.chatMessages.caseId, caseId),
            eq(schema.chatMessages.sender, "debtor"),
          ),
        )
        .orderBy(desc(schema.chatMessages.id))
        .limit(1);
      trigger = last[0]?.text ?? "";
    } catch {
      trigger = "";
    }
    await db.insert(schema.learnedScripts).values({
      text: deNumberScript(text),
      normalized,
      trigger,
      sourceCaseId: caseId,
    });
  } catch {
    // 学习失败不影响发消息本身。
  }
}

// 取已学话术（最新 N 条）拼进提示词当示范；用时 useCount+1。
async function loadLearnedScripts(
  ctx: Ctx,
  limit = 8,
): Promise<string[]> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.learnedScripts)
    .orderBy(desc(schema.learnedScripts.id))
    .limit(limit);
  return rows.map((r) => r.text);
}

// 案件确认收款后调用：把该案最近未提的模型回复提进话术库，归一化去重。
async function promoteLearnedScripts(
  ctx: Ctx,
  caseId: number,
): Promise<number> {
  const db = ctx.db<typeof schema>();
  const replies = await db
    .select()
    .from(schema.modelReplies)
    .where(
      and(
        eq(schema.modelReplies.caseId, caseId),
        eq(schema.modelReplies.promoted, false),
      ),
    )
    .orderBy(desc(schema.modelReplies.id))
    .limit(10);
  let added = 0;
  for (const r of replies) {
    const normalized = normalizeScript(r.reply);
    if (!normalized || normalized.length < 4) continue;
    const exists = await db
      .select({ id: schema.learnedScripts.id })
      .from(schema.learnedScripts)
      .where(eq(schema.learnedScripts.normalized, normalized))
      .limit(1);
    if (exists.length > 0) continue;
    try {
      await db.insert(schema.learnedScripts).values({
        text: deNumberScript(r.reply),
        normalized,
        trigger: r.trigger,
        sourceCaseId: caseId,
      });
      added++;
    } catch {
      // 并发下唯一索引冲突即重复，跳过。
    }
    await db
      .update(schema.modelReplies)
      .set({ promoted: true })
      .where(eq(schema.modelReplies.id, r.id));
  }
  return added;
}

/* ---------------- 操作审计 + 回收站 ----------------
   操作失误的防护：删改操作先记审计（谁、什么时候、改了什么），
   删除案件/还款前先把整条数据（含关联记录）快照进回收站，删错了
   可以单条恢复，不用整库回滚。审计与归档失败不影响主操作本身。 */

// 当前操作人显示名：优先取登录用户的显示名，没有就取 admin。
function auditActor(ctx: Ctx): string {
  const session = currentSession(ctx);
  if (!session) return "admin";
  if (session.role === "admin") return "管理员";
  return (session.displayName || session.username || "操作员").trim();
}

async function logAudit(
  ctx: Ctx,
  action: string,
  targetKind: string,
  targetId: number | null,
  detail: string,
): Promise<void> {
  try {
    const db = ctx.db<typeof schema>();
    await db.insert(schema.auditLogs).values({
      actor: auditActor(ctx),
      action,
      targetKind,
      targetId,
      detail: detail.slice(0, 2000),
    });
  } catch {
    // 审计失败不影响主操作。
  }
}

// 把一个案件及其全部关联记录快照进回收站，返回回收站 id。
async function archiveCase(
  ctx: Ctx,
  caseId: number,
): Promise<number | null> {
  const db = ctx.db<typeof schema>();
  try {
    const caseRows = await db
      .select()
      .from(schema.cases)
      .where(eq(schema.cases.id, caseId))
      .limit(1);
    if (caseRows.length === 0) return null;
    const [steps, sends, chats, agreements, payments] = await Promise.all([
      db.select().from(schema.progressSteps).where(eq(schema.progressSteps.caseId, caseId)),
      db.select().from(schema.sendRecords).where(eq(schema.sendRecords.caseId, caseId)),
      db.select().from(schema.chatMessages).where(eq(schema.chatMessages.caseId, caseId)),
      db.select().from(schema.agreements).where(eq(schema.agreements.caseId, caseId)),
      db.select().from(schema.payments).where(eq(schema.payments.caseId, caseId)),
    ]);
    const snapshot = {
      case: caseRows[0],
      progressSteps: steps,
      sendRecords: sends,
      chatMessages: chats,
      agreements,
      payments,
    };
    const label = `${caseRows[0].caseNo ?? ""} ${caseRows[0].debtorName ?? ""}`.trim();
    const inserted = await db
      .insert(schema.deletedItems)
      .values({
        kind: "case",
        itemId: caseId,
        label,
        data: JSON.stringify(snapshot),
        deletedBy: auditActor(ctx),
      })
      .returning({ id: schema.deletedItems.id });
    return inserted[0]?.id ?? null;
  } catch {
    return null;
  }
}

// 把一条已取到的行快照进回收站（页面信息、步骤、聊天、协议、技巧等通用）。
// 各删除口子先取行、调这个归档、再删；恢复时按 kind 把 row 原样插回对应表。
async function archiveData(
  ctx: Ctx,
  kind: string,
  id: number,
  label: string,
  row: unknown,
): Promise<number | null> {
  const db = ctx.db<typeof schema>();
  try {
    const inserted = await db
      .insert(schema.deletedItems)
      .values({
        kind,
        itemId: id,
        label: label.slice(0, 200),
        data: JSON.stringify({ row }),
        deletedBy: auditActor(ctx),
      })
      .returning({ id: schema.deletedItems.id });
    return inserted[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ---------- 系统快照（一键还原） ----------
// 把当前整库快照成一个备份点，存 blobs（system-snapshots/），只留最近 10 个。
async function createSnapshotRow(
  ctx: Ctx,
  label: string,
): Promise<{ id: number; blobKey: string } | null> {
  const db = ctx.db<typeof schema>();
  try {
    // 先把 WAL 刷回主文件，保证快照自包含。
    try {
      await (db as unknown as { run: (q: string) => Promise<unknown> }).run("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch {
      /* checkpoint 失败也继续，用当前主文件快照 */
    }
    const dataDir = (ctx as unknown as { spaceDir?: string }).spaceDir ?? "";
    const dbFile = join(dataDir, "gangshang.db");
    const buf = readFileSync(dbFile);
    if (buf.length < 100 || buf.subarray(0, 6).toString() !== "SQLite") return null;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const blobKey = `system-snapshots/${stamp}.db`;
    await ctx.blobs.put(blobKey, buf, { contentType: "application/octet-stream" });
    const caseRows = await db.select({ id: schema.cases.id }).from(schema.cases);
    const inserted = await db
      .insert(schema.systemSnapshots)
      .values({
        blobKey,
        label: label.slice(0, 200),
        caseCount: caseRows.length,
        sizeBytes: buf.length,
      })
      .returning({ id: schema.systemSnapshots.id });
    const id = inserted[0]?.id ?? null;
    if (id == null) return null;
    // 只留最近 10 个，删掉更早的快照文件与记录。
    const all = await db
      .select()
      .from(schema.systemSnapshots)
      .orderBy(desc(schema.systemSnapshots.id));
    for (const old of all.slice(10)) {
      try {
        await ctx.blobs.delete(old.blobKey);
      } catch {
        /* 删文件失败不拦 */
      }
      await db.delete(schema.systemSnapshots).where(eq(schema.systemSnapshots.id, old.id));
    }
    return { id, blobKey };
  } catch {
    return null;
  }
}

async function archivePayment(
  ctx: Ctx,
  paymentId: number,
): Promise<number | null> {
  const db = ctx.db<typeof schema>();
  try {
    const rows = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, paymentId))
      .limit(1);
    if (rows.length === 0) return null;
    const label = `还款 ${rows[0].amountCents ?? ""} 分（案件 ${rows[0].caseId ?? ""}）`;
    const inserted = await db
      .insert(schema.deletedItems)
      .values({
        kind: "payment",
        itemId: paymentId,
        label,
        data: JSON.stringify({ payment: rows[0] }),
        deletedBy: auditActor(ctx),
      })
      .returning({ id: schema.deletedItems.id });
    return inserted[0]?.id ?? null;
  } catch {
    return null;
  }
}

/* ---------------- 聊天话术 ----------------
   债务人页协商机器人的整套话术（开场白、协商方案文案、关键词规则、兜底
   回复、快捷按钮、聊天窗口标题/副标题、输入框提示语、分析小字前缀、
   付款卡文案、付款成功消息模板）原先写死在债务人页里；现在后台
   「话术设置」可改，存 chat_scripts 表。表里没有任何行 = 后台从未保存
   过，getChatScripts 返回下面的内置默认话术；保存过就返回保存的版本。
   规则按 sortOrder 顺序匹配，第一条命中即用；第 9 条（核实类）默认没有
   单独分析文案，analysis 为空字符串，表示走兜底分析。话术里的 {…} 是
   占位符，债务人页按核验到的真实案件数据替换：{amount} 应还总额、
   {principal} 本金、{penalty} 罚息、{interest} 利息、{overdueDays} 逾期
   天数、{caseNo} 案件编号、{agreementNo} 转让协议编号、{debtorName} 债务
   人姓名（已脱敏）、{creditor} 原债权方、{install6} 分 6 期每期金额、
   {install12} 分 12 期每期金额。模板里不得写死具体案件的数字。
   paidMessageTemplate 里的 X 是金额占位，债务人页发送时把 X 换成实际
   金额数字。 */

const chatScriptRuleOut = z.object({
  key: z.string(),
  pattern: z.string(),
  analysis: z.string(),
  reply: z.string(),
  sortOrder: z.number(),
});

const chatScriptsOut = z.object({
  rules: z.array(chatScriptRuleOut),
  opening: z.array(z.string()),
  offerLine: z.string(),
  fallback: z.object({ analysis: z.string(), reply: z.string() }),
  chips: z.array(z.object({ label: z.string(), text: z.string() })),
  chatTitle: z.string(),
  chatSubtitle: z.string(),
  inputPlaceholder: z.string(),
  analysisLabel: z.string(),
  payCard: z.object({
    title: z.string(),
    accountName: z.string(),
    method: z.string(),
    remark: z.string(),
    note: z.string(),
    paidButtonText: z.string(),
  }),
  paidMessageTemplate: z.string(),
  // v17 已确认技巧（技巧库里 status=confirmed 的 technique 文本，
  // 按确认时间倒序）：机器人值守时自动回复可照着用；模型接进生产
  // 聊天后也读这份。未确认的待确认技巧不在这里。
  confirmedTechniques: z.array(z.string()),
});

type ChatScriptsData = z.infer<typeof chatScriptsOut>;

const saveChatScriptsResponse = z.object({ ok: z.literal(true) });

const DEFAULT_CHAT_SCRIPTS: ChatScriptsData = {
  opening: [
    "您好，这里是港上资产执行系统还款协商通道。您的欠款是 {amount} 元，已逾期 {overdueDays} 天。",
    "先跟您说明两点：一，债权转让协议编号 {agreementNo}，您可以随时核实，还款可通过公司对公账户办理，也可按协商方案由专员办理减免、代入帐，还清出具结清证明；二，本案律师正在入户调查核实家庭收入情况，之后到工作单位调查核实，再按程序推进财产保全和执行扣划。现在协商，可以分期，方案只保留到今晚 21:00。您看今天能先付多少？",
  ],
  offerLine:
    "现开放协商通道：今日内确认方案，可申请减免或分期偿还（首期今日支付）。方案保留至今晚 21:00，逾期恢复全额并继续推进执行程序。",
  rules: [
    {
      key: "human",
      pattern: "转人工|人工客服|人工",
      analysis:
        "意图：转人工 —— 已转接人工专员，请其留下方便接听电话的时间",
      reply:
        "好的，已经为您转接人工专员了。专员会在工作时间内主动联系您，请您留一个方便接听电话的时间，我这边给您备注上。减免由专员负责，专员接手后会按您的情况和您对接，您不用再重复说明情况。",
      sortOrder: 0,
    },
    {
      key: "distrust",
      pattern: "骗子|假的|不信|诈骗",
      analysis: "意图：质疑真实性 · 情绪：戒备 —— 先亮身份与可核验证据，不争辩",
      reply:
        "理解您的怀疑，这一步应该谨慎。您可以核对三件事：公司对公账户户名、债权转让协议编号 {agreementNo}、原债权方名称，都和页面账单一致。核实完咱们再谈金额，付款方式按协商确认的方案办理。",
      sortOrder: 1,
    },
    {
      key: "hardship",
      pattern: "没钱|没工作|失业|困难",
      analysis: "意图：陈述困难 · 能力信号：待核实 —— 追问每月可拿出的具体金额",
      reply:
        "您的困难我记录下来了。咱们不谈有没有钱，谈一个数：您现在每个月大概能拿出多少？哪怕先说 500、800，我按这个数给您排分期，首期今天付，后面按月走。说不出数，方案就没法帮您锁定。",
      sortOrder: 2,
    },
    {
      key: "installment",
      pattern: "分期|每月|分.+期",
      analysis: "意图：申请分期 —— 转专员人工处理，机器人不给分期方案",
      reply:
        "您的分期申请正在由专员处理，专员会尽快与您联系协商分期方案，请您稍候。",
      sortOrder: 3,
    },
    {
      key: "waiver",
      pattern: "少|减免|优惠|便宜",
      analysis: "意图：要求减免 —— 转专员人工处理，机器人不谈减免",
      reply:
        "您的减免申请正在由专员处理，专员会尽快与您联系协商减免方案，请您稍候。",
      sortOrder: 4,
    },
    {
      key: "delay",
      pattern: "下个月|下周|过几天|发工资|考虑|想想",
      analysis: "意图：拖延 · 信号：时间模糊 —— 锁定具体日期 + 今日小额定金",
      reply:
        "可以，我帮您把方案保留住，但要落到具体：下个月几号？我给您记下来。今天先付 {lockAmount} 元定金锁定方案，剩下的按您定的日期付清——不定日期、不付定金，方案今晚 21:00 就自动失效，案件继续按进度推进。",
      sortOrder: 5,
    },
    {
      key: "partial",
      pattern: "一部分|先还|先付",
      analysis: "意图：部分还款 · 意愿：积极 —— 立即成交，发对公付款信息",
      reply:
        "好，先还一部分就是最实在的态度。您付完这一笔，剩下的分期方案由专员跟您确认，专员会尽快联系您。付款信息发您，备注填案件编号 {caseNo}。",
      sortOrder: 6,
    },
    {
      key: "refuse",
      pattern: "不还|凭什么|告|法院见",
      analysis:
        "意图：拒绝 · 情绪：对抗 —— 平静摆出已审结记录与执行进度，转人工复核",
      reply:
        "是否起诉由您决定，我只把事实摆清楚：本页右侧近期的同类案件都已判决并进入执行，工资扣划、账户冻结都在实际执行。本案收入核实已经完成，继续推进对您只有成本增加。现在协商的减免和分期，到了执行阶段就没有了。",
      sortOrder: 7,
    },
    {
      key: "verify",
      pattern: "核实|转让|合同|依据",
      analysis: "",
      reply:
        "债权依据在您的账单页可以逐项看：借款合同、转让协议编号 {agreementNo}、原债权方名称、历次还款记录。需要纸质材料，我可以安排邮寄到您核验时预留的地址，核实清楚再谈付款。",
      sortOrder: 8,
    },
    {
      key: "settlement",
      pattern: "结清证明|结清",
      analysis:
        "意图：申请结清证明 —— 登记申请，说明出具条件与时限，顺势推进结清付款",
      reply:
        "结清证明的申请我已经帮您登记了，流程是这样：款项全部还清并对账确认到账后，我司出具加盖公章的《结清证明》，写明案件编号 {caseNo}、结清金额与结清日期，电子版先发您，纸质版可邮寄到您预留的地址，一般 1–3 个工作日办好。您目前应还总额 {amount} 元，尚未结清；如果走今天的一次性减免方案付清，同样按结清出具证明。您是先按减免方案结清，还是先还一部分，我帮您把证明申请挂上？",
      sortOrder: 9,
    },
    {
      key: "confirm",
      pattern: "可以|行|好|同意|就这样",
      analysis: "意图：确认方案 —— 立即书面确认并发送付款信息",
      reply:
        "好，我现在按确认的方案为您锁定：请在今晚 21:00 前完成首笔付款，付款信息如下。付完点「我已付款」上传截图，核验对账后立即更新您的账单。",
      sortOrder: 10,
    },
  ],
  fallback: {
    analysis: "意图：一般咨询 —— 保持推进，给出选择题而非是非题",
    reply:
      "我记下了。您是倾向今天一次性结清，还是按月分期？您选一个，我记下来转给专员，由专员给您出书面方案。",
  },
  chips: [
    { label: "申请分期", text: "我想申请分期" },
    { label: "申请减免", text: "能不能少一点" },
    { label: "今天先还一部分", text: "我今天先还一部分" },
    { label: "核实债权转让", text: "我需要核实债权转让" },
    { label: "申请结清证明", text: "我想申请结清证明" },
  ],
  chatTitle: "还款协商专员",
  chatSubtitle: "港上资产执行系统 · 在线",
  inputPlaceholder: "输入您想说的话…",
  analysisLabel: "本句分析 ·",
  payCard: {
    title: "付款信息（对公账户）",
    accountName: "公司对公账户（以聊天内发送的账户信息为准）",
    method: "扫对公收款码或银行转账",
    remark: "请填写案件编号 {caseNo}",
    note: "付款后点下方按钮并上传截图，截图核验与银行流水对账一致后，立即更新欠款并出具结清 / 分期确认文件。",
    paidButtonText: "我已付款 · 上传截图",
  },
  paidMessageTemplate: "我已付款，金额X，已上传截图。",
  // v17：默认无已确认技巧；有确认技巧时 loadChatScripts 从技巧库补上。
  confirmedTechniques: [],
};

function cloneDefaultChatScripts(): ChatScriptsData {
  return JSON.parse(JSON.stringify(DEFAULT_CHAT_SCRIPTS)) as ChatScriptsData;
}

/* v17 技巧提取（只学成功案例）：从一案的聊天记录里，找专员（agent）
   那句起了作用的话。规则：债务人随后回了表示同意/要付款的话
   （好、行、确认、我付、马上付、今天付、同意、就这样、没问题、
   我转、已付、付了），就把紧挨在它前面的那句专员原话当作一条
   候选技巧。只取专员原话，去重、去过短的，每案最多 5 条。 */
async function extractTechniquesFromChat(
  ctx: Ctx,
  caseId: number,
): Promise<string[]> {
  const db = ctx.db<typeof schema>();
  const msgs = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.caseId, caseId))
    .orderBy(asc(schema.chatMessages.id));
  const agreeRe = /好|行|确认|我付|马上付|今天付|同意|就这样|没问题|我转|已付|付了/;
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.sender !== "debtor") continue;
    if (!agreeRe.test(m.text ?? "")) continue;
    for (let j = i - 1; j >= 0; j--) {
      const prev = msgs[j];
      if (prev.sender !== "agent") continue;
      const t = (prev.text ?? "").trim();
      if (t.length < 5) break;
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
      break;
    }
    if (out.length >= 5) break;
  }
  return out;
}

/* v17 学后删：还款成功（回款对平）时先提炼技巧进库（待确认），
   再删该债务人的全部聊天记录。提炼不到技巧也照删——还款已成功，
   聊天不再用于学习。消息里挂的图片 blob 一并清掉，不留孤儿文件。
   返回提炼入库的技巧条数。 */
async function learnThenDeleteChat(
  ctx: Ctx,
  caseId: number,
): Promise<number> {
  const db = ctx.db<typeof schema>();
  const techniques = await extractTechniquesFromChat(ctx, caseId);
  let inserted = 0;
  for (const t of techniques) {
    await db.insert(schema.techniques).values({
      caseId,
      technique: t,
      source: "auto",
      status: "pending",
    });
    inserted++;
  }
  const msgs = await db
    .select({ imageBlobKey: schema.chatMessages.imageBlobKey })
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.caseId, caseId));
  for (const m of msgs) {
    if (m.imageBlobKey) {
      try {
        await ctx.blobs.delete(m.imageBlobKey);
      } catch {
        /* 删 blob 失败不挡主流程 */
      }
    }
  }
  await db
    .delete(schema.chatMessages)
    .where(eq(schema.chatMessages.caseId, caseId));
  return inserted;
}

// 读当前生效话术：chat_scripts 表无任何行时返回内置默认；有行时按行组装，
// 缺失的部分（理论上保存时整套写入，不会缺）回落到对应默认值兜底。
async function loadChatScripts(ctx: Ctx): Promise<ChatScriptsData> {
  const db = ctx.db<typeof schema>();
  // v17 已确认技巧：不论话术表有没有行，都从技巧库取已确认的，
  // 机器人值守与模型都照着用。按确认时间倒序（新的在前）。
  const confirmedRows = await db
    .select({ technique: schema.techniques.technique })
    .from(schema.techniques)
    .where(eq(schema.techniques.status, "confirmed"))
    .orderBy(desc(schema.techniques.confirmedAt), desc(schema.techniques.id));
  const confirmedTechniques = confirmedRows
    .map((r) => (r.technique ?? "").trim())
    .filter((t) => t.length > 0);
  const rows = await db
    .select()
    .from(schema.chatScripts)
    .orderBy(asc(schema.chatScripts.sortOrder), asc(schema.chatScripts.id));
  if (rows.length === 0) {
    const d = cloneDefaultChatScripts();
    d.confirmedTechniques = confirmedTechniques;
    return d;
  }
  const defaults = cloneDefaultChatScripts();
  const ruleRows = rows.filter((r) => r.kind === "rule");
  const openingRows = rows.filter((r) => r.kind === "opening");
  const offerRow = rows.find((r) => r.kind === "offer");
  const fallbackRow = rows.find((r) => r.kind === "fallback");
  const chipRows = rows.filter((r) => r.kind === "chip");
  const settingMap = new Map(
    rows
      .filter((r) => r.kind === "setting")
      .map((r) => [r.ruleKey, r.reply] as const),
  );
  const setting = (key: string, fallbackValue: string): string =>
    settingMap.get(key) ?? fallbackValue;
  return {
    rules:
      ruleRows.length > 0
        ? ruleRows.map((r, i) => ({
            key: r.ruleKey,
            pattern: r.pattern,
            analysis: r.analysis,
            reply: r.reply,
            sortOrder: i,
          }))
        : defaults.rules,
    opening:
      openingRows.length > 0
        ? openingRows.map((r) => r.reply)
        : defaults.opening,
    offerLine: offerRow ? offerRow.reply : defaults.offerLine,
    fallback: fallbackRow
      ? { analysis: fallbackRow.analysis, reply: fallbackRow.reply }
      : defaults.fallback,
    chips:
      chipRows.length > 0
        ? chipRows.map((r) => ({ label: r.reply, text: r.analysis }))
        : defaults.chips,
    chatTitle: setting("chatTitle", defaults.chatTitle),
    chatSubtitle: setting("chatSubtitle", defaults.chatSubtitle),
    inputPlaceholder: setting("inputPlaceholder", defaults.inputPlaceholder),
    analysisLabel: setting("analysisLabel", defaults.analysisLabel),
    payCard: {
      title: setting("payCard.title", defaults.payCard.title),
      accountName: setting("payCard.accountName", defaults.payCard.accountName),
      method: setting("payCard.method", defaults.payCard.method),
      remark: setting("payCard.remark", defaults.payCard.remark),
      note: setting("payCard.note", defaults.payCard.note),
      paidButtonText: setting(
        "payCard.paidButtonText",
        defaults.payCard.paidButtonText,
      ),
    },
    paidMessageTemplate: setting(
      "paidMessageTemplate",
      defaults.paidMessageTemplate,
    ),
    confirmedTechniques,
  };
}

async function loadHomepageExtras(ctx: Ctx) {
  const db = ctx.db<typeof schema>();
  const tr = await db
    .select()
    .from(schema.todayRepayments)
    .orderBy(asc(schema.todayRepayments.sortOrder), asc(schema.todayRepayments.id));
  const ti = await db
    .select()
    .from(schema.tickerItems)
    .orderBy(asc(schema.tickerItems.sortOrder), asc(schema.tickerItems.id));
  const pu = await db
    .select()
    .from(schema.punishmentItems)
    .orderBy(asc(schema.punishmentItems.sortOrder), asc(schema.punishmentItems.id));
  const ps = await db.select().from(schema.paymentSettings);
  const psRow = ps[0];
  const ca = await db.select().from(schema.corporateAccount);
  const caRow = ca[0];
  const lp = await db
    .select()
    .from(schema.lawyerProgressSteps)
    .orderBy(asc(schema.lawyerProgressSteps.sortOrder), asc(schema.lawyerProgressSteps.id));
  const dbRows = await db.select().from(schema.demoBill);
  const dbRow = dbRows[0];
  return {
    todayRepayments: tr.map((r) => ({
      id: r.id,
      nameMasked: r.nameMasked,
      region: r.region,
      amountCents: r.amountCents,
      timeText: r.timeText,
      kind: r.kind,
      visible: r.visible === 1,
      sortOrder: r.sortOrder,
    })),
    tickerItems: ti.map((r) => ({
      id: r.id,
      text: r.text,
      visible: r.visible === 1,
      sortOrder: r.sortOrder,
    })),
    punishmentItems: pu.map((r) => ({
      id: r.id,
      title: r.title,
      detail: r.detail,
      visible: r.visible === 1,
      sortOrder: r.sortOrder,
    })),
    paymentSettings: psRow
      ? {
          payeeName: psRow.payeeName,
          bankName: psRow.bankName,
          accountNo: psRow.accountNo,
          qrImageUrl: psRow.qrImageUrl,
          note: psRow.note,
        }
      : { ...EMPTY_PAYMENT_SETTINGS },
    corporateAccount: caRow
      ? {
          payeeName: caRow.payeeName,
          bankName: caRow.bankName,
          accountNo: caRow.accountNo,
          qrImageUrl: caRow.qrImageUrl,
        }
      : { ...EMPTY_CORPORATE_ACCOUNT },
    lawyerProgress:
      lp.length > 0
        ? lp.map((r) => ({
            id: r.id,
            sortOrder: r.sortOrder,
            title: r.title,
            description: r.description,
            dateLabel: r.dateLabel,
            state: r.state as "done" | "now" | "todo",
          }))
        : DEFAULT_LAWYER_PROGRESS.map((s) => ({ ...s })),
    demoBill: dbRow
      ? {
          debtorName: dbRow.debtorName,
          caseNo: dbRow.caseNo,
          totalDueCents: dbRow.totalDueCents,
          principalCents: dbRow.principalCents,
          penaltyCents: dbRow.penaltyCents,
          overdueDays: dbRow.overdueDays,
          originalCreditor: dbRow.originalCreditor,
          transferAgreementNo: dbRow.transferAgreementNo,
        }
      : { ...EMPTY_DEMO_BILL },
  };
}

/* 保全划扣板块的初始内容 = 债务人网页现在显示的原文，首次读取时落库，之后以后台编辑为准 */
const PRESERVATION_DEFAULT_SETTINGS = {
  sectionIntro: "判决生效后拒不履行，执行按三步推进，每一步都有真实记录。",
  freezeTitle: "冻结微信、支付宝支付功能",
  freezeBody:
    "法院通过网络执行查控系统，可以直接冻结被执行人的微信支付账户和支付宝账户。冻结后：微信扫码付不出去、收钱收不到、零钱提不出来，支付宝余额同样动不了。还清欠款后，法院才会解除冻结。",
  freezeCaseSource: "陕西省紫阳县人民法院",
  freezeCaseText:
    "胡某欠宋某木地板货款 36,000 元，判决后只付了部分，剩余 22,500 元不付。宋某申请强制执行后，法院通过网络查控系统查到胡某名下银行账户、微信支付账户，第一时间依法冻结其微信支付账户。法官释法后，胡某主动足额支付剩余货款 22,500 元，案件执结，法院随即解除微信账户冻结。",
  dishonestNote:
    "列入失信被执行人后：限制坐飞机、高铁，限制住星级酒店，限制贷款、办卡，子女不得就读高收费私立学校；名单在「信用中国」和中国执行信息公开网公示，任何人都能查到。",
};

const PRESERVATION_DEFAULT_CHAIN = [
  { stepLabel: "第一步", title: "冻结", detail: "银行账户 · 微信 · 支付宝" },
  { stepLabel: "第二步", title: "划扣", detail: "存款 · 工资直接扣划发放" },
  { stepLabel: "第三步", title: "列入失信", detail: "失信被执行人名单 · 限高" },
];

const PRESERVATION_DEFAULT_FEED: {
  stepNo: number;
  sourceLabel: string;
  tag: string;
  title: string;
  detail: string;
}[] = [
  {
    stepNo: 1,
    sourceLabel: "山西岚县人民法院",
    tag: "冻结 + 一日执结",
    title: "民间借贷纠纷 · 标的额 1 万余元",
    detail:
      "立案当日查实被执行人账户有足额存款并立即冻结，被执行人当日将全部案款汇入法院执行专户，立案到案款发放仅用一天。",
  },
  {
    stepNo: 1,
    sourceLabel: "天津市北辰区人民法院",
    tag: "冻结后入账扣划",
    title: "银行卡冻结 · 资金入账即被扣划",
    detail: "被执行人银行卡被冻结，一笔 1 万余元款项入账后，法院第一时间扣划。",
  },
  {
    stepNo: 2,
    sourceLabel: "湖北省武汉市洪山区人民法院",
    tag: "扣划 + 强制执行",
    title: "「荆楚雷霆 2026」执行行动",
    detail:
      "判决赔偿 5 万余元，被执行人拒不履行。执行干警扣划发还 1 万余元，并实地走访锁定行踪，强制执行。",
  },
  {
    stepNo: 2,
    sourceLabel: "江苏省淮安市淮阴区人民法院",
    tag: "扣划担保人账户",
    title: "民间借贷纠纷 · 判令偿还借款 3 万元",
    detail: "案件恢复执行后，担保人账户被扣划对应款项——为他人担保，同样承担清偿责任。",
  },
  {
    stepNo: 2,
    sourceLabel: "最高人民法院指导文件 254 号",
    tag: "执前保全扣划",
    title: "租赁合同纠纷 · 厦门海沧区人民法院",
    detail:
      "法院冻结被保全账户 19 万元；裁判生效后、立案执行前启动执前保全扣划，将被保全账户 7.5 万元扣划发放给债权人。",
  },
  {
    stepNo: 3,
    sourceLabel: "上海市金山区人民法院",
    tag: "失信 + 限高 + 拘留",
    title: "治理欠薪典型执行记录",
    detail:
      "被执行人法定代表人拒不申报财产、拒不履行义务，法院依法将其纳入失信被执行人名单并限制高消费；仍不履行后，执行干警将其拘传至法院，司法拘留 15 天并罚款 1,000 元，最终其主动支付全部欠款和罚款。",
  },
  {
    stepNo: 3,
    sourceLabel: "最高人民法院",
    tag: "拒执罪数据",
    title: "拒不执行判决、裁定罪判处 4,461 人",
    detail:
      "据最高人民法院数据，拒不执行判决、裁定罪已判处 4,461 人。某被执行人谎称就医骗取临时解除限制高消费令，却出境赌博，被依法追究刑事责任。",
  },
  {
    stepNo: 3,
    sourceLabel: "北京市顺义区人民法院",
    tag: "限高 · 机场拦截",
    title: "限高人员购票乘机被拦截",
    detail:
      "被执行人未履行分期付款义务被限制高消费，持护照购票乘机时被机场公安通报拦截，执行法官赶赴现场传唤；经普法教育后其写下检查书，达成新的还款和解，并当场筹措 20 万元执行款。",
  },
];

async function ensurePreservationSeeded(ctx: Ctx) {
  const db = ctx.db<typeof schema>();
  const settings = await db.select().from(schema.preservationSettings);
  if (settings.length === 0) {
    await db.insert(schema.preservationSettings).values({
      ...PRESERVATION_DEFAULT_SETTINGS,
      freezeVisible: 1,
    });
  }
  const chain = await db.select().from(schema.preservationChainSteps);
  if (chain.length === 0) {
    for (const [i, s] of PRESERVATION_DEFAULT_CHAIN.entries()) {
      await db
        .insert(schema.preservationChainSteps)
        .values({ ...s, sortOrder: i });
    }
  }
  const feed = await db.select().from(schema.preservationFeedItems);
  if (feed.length === 0) {
    for (const [i, f] of PRESERVATION_DEFAULT_FEED.entries()) {
      await db
        .insert(schema.preservationFeedItems)
        .values({ ...f, visible: 1, sortOrder: i });
    }
  }
}

async function loadPreservation(ctx: Ctx) {
  const db = ctx.db<typeof schema>();
  const settingsRows = await db.select().from(schema.preservationSettings);
  const s = settingsRows[0];
  const chain = await db
    .select()
    .from(schema.preservationChainSteps)
    .orderBy(
      asc(schema.preservationChainSteps.sortOrder),
      asc(schema.preservationChainSteps.id),
    );
  const feed = await db
    .select()
    .from(schema.preservationFeedItems)
    .orderBy(
      asc(schema.preservationFeedItems.stepNo),
      asc(schema.preservationFeedItems.sortOrder),
      asc(schema.preservationFeedItems.id),
    );
  return {
    settings: {
      sectionIntro: s?.sectionIntro ?? "",
      freezeTitle: s?.freezeTitle ?? "",
      freezeBody: s?.freezeBody ?? "",
      freezeCaseSource: s?.freezeCaseSource ?? "",
      freezeCaseText: s?.freezeCaseText ?? "",
      freezeVisible: (s?.freezeVisible ?? 1) === 1,
      dishonestNote: s?.dishonestNote ?? "",
    },
    chainSteps: chain.map((r) => ({
      id: r.id,
      stepLabel: r.stepLabel,
      title: r.title,
      detail: r.detail,
      sortOrder: r.sortOrder,
    })),
    feedItems: feed.map((r) => ({
      id: r.id,
      stepNo: r.stepNo,
      sourceLabel: r.sourceLabel,
      tag: r.tag,
      title: r.title,
      detail: r.detail,
      visible: r.visible === 1,
      sortOrder: r.sortOrder,
    })),
  };
}

type CaseRow = typeof schema.cases.$inferSelect;

type Willingness = "high" | "mid" | "low";

/* 还款意愿：从聊天协商的真实信号实时推导，不落库。
   优先看行为（回款、协议），其次看最近一条已做协商分析的债务人消息里
   AI 给出的意愿判断，再看是否有协议、是否开口沟通；什么信号都没有为低。 */
function computeWillingness(input: {
  totalDueCents: number;
  matchedRepaidCents: number;
  debtorAnalysesAsc: string[];
  debtorMessageCount: number;
  hasActiveAgreement: boolean;
  hasDoneAgreement: boolean;
}): Willingness {
  if (input.totalDueCents > 0 && input.matchedRepaidCents >= input.totalDueCents)
    return "high";
  if (input.matchedRepaidCents > 0) return "high";
  if (input.hasDoneAgreement) return "high";
  let aiLevel: Willingness | null = null;
  for (let i = input.debtorAnalysesAsc.length - 1; i >= 0; i--) {
    const m = (input.debtorAnalysesAsc[i] ?? "").match(/还款意愿[:：]\s*([高中低])/);
    if (m) {
      aiLevel = m[1] === "高" ? "high" : m[1] === "中" ? "mid" : "low";
      break;
    }
  }
  if (aiLevel) {
    if (aiLevel === "low" && input.hasActiveAgreement) return "mid";
    return aiLevel;
  }
  if (input.hasActiveAgreement) return "high";
  if (input.debtorMessageCount > 0) return "mid";
  return "low";
}

/* 未立即还款原因与应对方案：同样从聊天协商实时推导，不落库。
   先看债务人最近的原话命中哪类原因（怕被骗要核实、想谈减免、要分期、
   等发工资、跟家人商量、说过几天给、资金困难、对金额有异议），
   命中就引用其原话作依据；没有原话命中时，再按行为兜底：
   已结清、已签协议分期履约、已还一部分、协商中未明确、尚未沟通。 */
const HOLD_REASON_RULES: {
  test: RegExp;
  label: string;
  plan: string;
}[] = [
  {
    test: /核实|真的假的|是不是骗|诈骗|骗子|正规吗|凭证|证明一下|授权书|委托书|营业执照|公司全称|对公账户/,
    label: "怕被骗，要先核实身份与债权的真实性",
    plan: "把对公账户信息、债权转让凭证和公司资质发到聊天里供其核实，今天再打电话说明债权来源与依据，打消顾虑后立即锁定还款时间。",
  },
  {
    test: /减免|能不能少|少还|少点|打折|优惠|抹个零|免掉|减点|便宜点/,
    label: "想谈减免，希望少还一部分再结清",
    plan: "债务人已主动提出减免：先核算一次性结清可谈的空间，确认权限后给出结清方案并限定回复期限，避免无限期拖谈。",
  },
  {
    test: /分期|分几期|按月还|每个月还|每月还|慢慢还|分批还|先还一部分|先还一点|先付一部分/,
    label: "一次拿不出全款，想分期或先还一部分",
    plan: "按欠款金额给出分期方案（期数、每期金额、首期还款日）发到聊天里让其确认，确认后落成协议并盯首期到账。",
  },
  {
    test: /发工资|工资|发薪|薪水|月底|月初|到账|等钱到|回款|结账|工程款|货款到/,
    label: "在等发工资或等一笔钱到账，到账后再还",
    plan: "确认其明确的到账日期并记下，到期当天上午先发消息提醒、当天再电话跟进，要求到账当天完成还款，不再顺延。",
  },
  {
    test: /家人|家里人|老婆|老公|父母|商量|跟家里|问问家里/,
    label: "要先跟家人商量，还没有定下来",
    plan: "约定商量后的明确回复时间，到点主动打电话跟进；聊天里留一份金额与还款方式的简明说明，方便其跟家人沟通。",
  },
  {
    test: /过几天|过两天|过段时间|过阵子|下周|下个月再|缓缓|宽限|再等等|等几天|过些天|忙完这阵/,
    label: "只说过几天再还，没有给出确切日期",
    plan: "今天就发还款截止提醒，把最晚还款日定死，并说明逾期后保全、划扣与失信程序继续推进的后果，要求其回复确认日期。",
  },
  {
    test: /没钱|失业|没工作|困难|生病|住院|出事|赔了|亏了|没收入|收入低|实在没/,
    label: "当前资金困难，暂时拿不出钱",
    plan: "先核实困难情况与现有收入，给分期或先还一小部分启动的方案，把单次金额降下来，今天电话谈定首笔金额与日期。",
  },
  {
    test: /金额不对|算错|没借这么多|不是我借|已经还了|还过了|利息太高|罚息太高|不认可|没这么多/,
    label: "对欠款金额或构成有异议，账还没有对清",
    plan: "把本金、罚息与已还记录逐项列成账单明细发到聊天里对账，对清后今天电话确认无异议并锁定还款安排。",
  },
];

const holdDateFmt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "numeric",
  day: "numeric",
});

function deriveHoldReason(input: {
  totalDueCents: number;
  matchedRepaidCents: number;
  debtorMessagesAsc: { text: string; createdAt: Date }[];
  hasActiveAgreement: boolean;
}): { holdReason: string; actionPlan: string } {
  if (
    input.totalDueCents > 0 &&
    input.matchedRepaidCents >= input.totalDueCents
  ) {
    return {
      holdReason: "已全额还清，无未还余额。",
      actionPlan: "无需再催，做一次结清确认并归档。",
    };
  }
  // 债务人原话从新到旧扫，最近说的原因就是当前卡点。
  for (let i = input.debtorMessagesAsc.length - 1; i >= 0; i--) {
    const msg = input.debtorMessagesAsc[i];
    if (!msg) continue;
    for (const rule of HOLD_REASON_RULES) {
      if (rule.test.test(msg.text)) {
        const snippet =
          msg.text.length > 30 ? `${msg.text.slice(0, 30)}…` : msg.text;
        return {
          holdReason: `${rule.label}。债务人 ${holdDateFmt.format(msg.createdAt)} 说：「${snippet}」`,
          actionPlan: rule.plan,
        };
      }
    }
  }
  if (input.hasActiveAgreement) {
    return {
      holdReason: "已达成分期协议，正在按约分批还款，尚未到结清。",
      actionPlan: "按协议盯下一期到期日，提前一天发提醒；到期未还当天电话跟进，不让协议空转。",
    };
  }
  if (input.matchedRepaidCents > 0) {
    return {
      holdReason: "已经还了一部分，剩余金额还没有结清。",
      actionPlan: "今天联系确认剩余金额，给出剩余部分一次结清或分期的安排，并约下下一次还款日期。",
    };
  }
  if (input.debtorMessagesAsc.length > 0) {
    return {
      holdReason: "已在聊天里参与协商，但还没有说清还款时间和方式。",
      actionPlan: "今天打电话推进，把金额、日期和还款方式当场谈定，并让其在聊天里回复确认。",
    };
  }
  return {
    holdReason: "还没有在聊天里沟通过，未说明未还款原因。",
    actionPlan: "今天打电话触达，说明身份与案件要点，引导其在聊天里确认还款安排。",
  };
}

type ClickAgg = { count: number; firstAt: Date | null; lastAt: Date | null };

function aggregateClicks(
  clicks: { caseId: number; createdAt: Date }[],
): Map<number, ClickAgg> {
  const map = new Map<number, ClickAgg>();
  for (const c of clicks) {
    const entry = map.get(c.caseId) ?? { count: 0, firstAt: null, lastAt: null };
    entry.count += 1;
    if (!entry.firstAt || c.createdAt < entry.firstAt) entry.firstAt = c.createdAt;
    if (!entry.lastAt || c.createdAt > entry.lastAt) entry.lastAt = c.createdAt;
    map.set(c.caseId, entry);
  }
  return map;
}

function toCaseOut(
  row: CaseRow,
  stepTotal: number,
  stepDone: number,
  sendCount: number,
  chatCount = 0,
  pendingPayments = 0,
  extra?: { willingness: Willingness; clicks: ClickAgg },
  assigneeName = "",
): z.infer<typeof caseOut> {
  return {
    id: row.id,
    debtorName: row.debtorName,
    phone: row.phone,
    idCard: row.idCard ?? "",
    caseNo: row.caseNo,
    totalDueCents: row.totalDueCents,
    principalCents: row.principalCents,
    overdueDays: row.overdueDays,
    penaltyCents: row.penaltyCents,
    originalCreditor: row.originalCreditor,
    transferAgreementNo: row.transferAgreementNo,
    note: row.note,
    needsHuman: row.needsHuman === 1,
    humanNote: row.humanNote,
    humanTakeover: row.humanTakeoverAt != null,
    muted: row.mutedAt != null,
    mutedBy: row.mutedAt != null ? (row.mutedBy ?? "") : "",
    assigneeId: row.assigneeId ?? null,
    assigneeName,
    chatCount,
    pendingPayments,
    status: row.status,
    lastSentAt: row.lastSentAt ? row.lastSentAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    stepTotal,
    stepDone,
    sendCount,
    willingness: extra?.willingness ?? "low",
    clickCount: extra?.clicks.count ?? 0,
    firstClickAt: extra?.clicks.firstAt ? extra.clicks.firstAt.toISOString() : null,
    lastClickAt: extra?.clicks.lastAt ? extra.clicks.lastAt.toISOString() : null,
  };
}

const bracketOut = z.object({
  label: z.string(),
  count: z.number(),
  amountCents: z.number(),
});

const regionOut = z.object({
  region: z.string(),
  count: z.number(),
  amountCents: z.number(),
});

const trendDayOut = z.object({
  date: z.string(),
  amountCents: z.number(),
  count: z.number(),
});

const statusDistOut = z.object({
  key: z.enum(["pending", "negotiating", "repaid", "settled"]),
  label: z.string(),
  count: z.number(),
  amountCents: z.number(),
});

// 年龄分段：年龄从身份证号出生日期实时计算；每段带人数、欠款、回款，
// 并交叉该段的链接点击与还款意愿分布。
const ageBracketOut = z.object({
  key: z.enum(["u20", "a20s", "a30s", "a40s", "a50s", "o60"]),
  label: z.string(),
  count: z.number(),
  totalDueCents: z.number(),
  repaidCents: z.number(),
  recoveryRate: z.number(),
  clickedCount: z.number(),
  clickRate: z.number(),
  willingnessHigh: z.number(),
  willingnessMid: z.number(),
  willingnessLow: z.number(),
});

// 从身份证号算周岁：18 位取第 7–14 位出生日期，15 位取第 7–12 位（年份补 19）。
// 号码缺失、位数不对或日期不合法时返回 null（归入「年龄未知」单列）。
function ageFromIdCard(idCard: string, now: Date): number | null {
  const t = (idCard ?? "").trim().toUpperCase();
  let y = 0;
  let m = 0;
  let d = 0;
  if (/^\d{17}[\dX]$/.test(t)) {
    y = Number(t.slice(6, 10));
    m = Number(t.slice(10, 12));
    d = Number(t.slice(12, 14));
  } else if (/^\d{15}$/.test(t)) {
    y = 1900 + Number(t.slice(6, 8));
    m = Number(t.slice(8, 10));
    d = Number(t.slice(10, 12));
  } else {
    return null;
  }
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const birth = new Date(y, m - 1, d);
  if (
    birth.getFullYear() !== y ||
    birth.getMonth() !== m - 1 ||
    birth.getDate() !== d
  ) {
    return null;
  }
  let age = now.getFullYear() - y;
  const monthDiff = now.getMonth() - (m - 1);
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) age -= 1;
  if (age < 0 || age > 130) return null;
  return age;
}

const PROVINCE_BY_ID_PREFIX: Record<string, string> = {
  "11": "北京市",
  "12": "天津市",
  "13": "河北省",
  "14": "山西省",
  "15": "内蒙古自治区",
  "21": "辽宁省",
  "22": "吉林省",
  "23": "黑龙江省",
  "31": "上海市",
  "32": "江苏省",
  "33": "浙江省",
  "34": "安徽省",
  "35": "福建省",
  "36": "江西省",
  "37": "山东省",
  "41": "河南省",
  "42": "湖北省",
  "43": "湖南省",
  "44": "广东省",
  "45": "广西壮族自治区",
  "46": "海南省",
  "50": "重庆市",
  "51": "四川省",
  "52": "贵州省",
  "53": "云南省",
  "54": "西藏自治区",
  "61": "陕西省",
  "62": "甘肃省",
  "63": "青海省",
  "64": "宁夏回族自治区",
  "65": "新疆维吾尔自治区",
  "71": "台湾省",
  "81": "香港特别行政区",
  "82": "澳门特别行政区",
};

/* ---------------- 登录地理位置（按登录请求 IP 解析） ----------------
   债务人网页在核验登录时，按债务人本次请求的公网 IP 查归属地，
   把国家 / 省 / 市随核验请求带进来（loginCountry / loginProvince /
   loginCity），服务端归一化后存进 debtor_logins。IP 归属地服务返回的
   省级名称可能是英文（如 Guangdong）或不带后缀的中文（如 广东），
   这里统一归一到与台账地区（身份证省份）相同的中文全称，才能比对
   「登录地点与台账地区是否一致」。解析不到时字段为空，不影响登录。 */

const PROVINCE_BY_EN_NAME: Record<string, string> = {
  beijing: "北京市",
  tianjin: "天津市",
  shanghai: "上海市",
  chongqing: "重庆市",
  hebei: "河北省",
  shanxi: "山西省",
  "inner mongolia": "内蒙古自治区",
  liaoning: "辽宁省",
  jilin: "吉林省",
  heilongjiang: "黑龙江省",
  jiangsu: "江苏省",
  zhejiang: "浙江省",
  anhui: "安徽省",
  fujian: "福建省",
  jiangxi: "江西省",
  shandong: "山东省",
  henan: "河南省",
  hubei: "湖北省",
  hunan: "湖南省",
  guangdong: "广东省",
  guangxi: "广西壮族自治区",
  hainan: "海南省",
  sichuan: "四川省",
  guizhou: "贵州省",
  yunnan: "云南省",
  tibet: "西藏自治区",
  xizang: "西藏自治区",
  shaanxi: "陕西省",
  gansu: "甘肃省",
  qinghai: "青海省",
  ningxia: "宁夏回族自治区",
  xinjiang: "新疆维吾尔自治区",
  taiwan: "台湾省",
  "hong kong": "香港特别行政区",
  macao: "澳门特别行政区",
  macau: "澳门特别行政区",
};

const PROVINCE_BY_CORE: Record<string, string> = {
  北京: "北京市",
  天津: "天津市",
  上海: "上海市",
  重庆: "重庆市",
  河北: "河北省",
  山西: "山西省",
  内蒙古: "内蒙古自治区",
  辽宁: "辽宁省",
  吉林: "吉林省",
  黑龙江: "黑龙江省",
  江苏: "江苏省",
  浙江: "浙江省",
  安徽: "安徽省",
  福建: "福建省",
  江西: "江西省",
  山东: "山东省",
  河南: "河南省",
  湖北: "湖北省",
  湖南: "湖南省",
  广东: "广东省",
  广西: "广西壮族自治区",
  海南: "海南省",
  四川: "四川省",
  贵州: "贵州省",
  云南: "云南省",
  西藏: "西藏自治区",
  陕西: "陕西省",
  甘肃: "甘肃省",
  青海: "青海省",
  宁夏: "宁夏回族自治区",
  新疆: "新疆维吾尔自治区",
  台湾: "台湾省",
  香港: "香港特别行政区",
  澳门: "澳门特别行政区",
};

const PROVINCE_CANONICAL = new Set(Object.values(PROVINCE_BY_ID_PREFIX));

function normalizeProvince(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (PROVINCE_CANONICAL.has(t)) return t;
  const en = PROVINCE_BY_EN_NAME[t.toLowerCase()];
  if (en) return en;
  const core = t.replace(
    /(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市)$/,
    "",
  );
  return PROVINCE_BY_CORE[core] ?? t;
}

function normalizeCountry(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (lower === "china" || lower === "cn" || lower === "chn") return "中国";
  return t;
}

// 台账地区：按身份证号前两位对应的省份（与地区统计同一口径）；无有效身份证号时为空。
function ledgerRegionOf(idCard: string): string {
  const t = (idCard ?? "").trim();
  if (t.length < 2) return "";
  return PROVINCE_BY_ID_PREFIX[t.slice(0, 2)] ?? "";
}

// 一次登录的地点展示文本：国家 + 省 + 市拼接，省市同名（直辖市）时不重复。
function loginLocationText(loc: {
  country: string;
  province: string;
  city: string;
}): string {
  const parts: string[] = [];
  if (loc.country) parts.push(loc.country);
  if (loc.province) parts.push(loc.province);
  if (loc.city && loc.city !== loc.province) parts.push(loc.city);
  return parts.join(" ");
}

/* ---------------- 服务端 IP 归属地解析（v16） ----------------
   债务人登录地点不再由前端查、随请求带入（不可信且已被审计指出），
   改由服务端按核验请求的真实 IP 解析：IP 由可信 HTTP 分发层从请求头
   取（X-Forwarded-For 第一跳，无则 X-Real-IP）后经 verifyIdentity 的
   内部字段 clientIp 注入。解析异步进行：登录记录先落行，解析出结果
   后回填 country/province/city，不阻塞核验响应。私网/保留地址不查，
   查不到或服务不可用时地点留空，都不影响登录本身。 */

function isPublicIp(ip: string): boolean {
  const t = ip.trim();
  if (!t) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) {
    const parts = t.split(".").map(Number);
    const [a = 0, b = 0] = parts;
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    return true;
  }
  const lower = t.toLowerCase();
  if (lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) {
    return false;
  }
  return t.includes(":");
}

async function lookupIpLocation(
  ip: string,
): Promise<{ country: string; province: string; city: string } | null> {
  // 主：ipwho.is（与原前端解析同一服务，字段口径一致）；备：ipapi.co。
  try {
    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?lang=zh-CN`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      if (data && data.success !== false) {
        const country = normalizeCountry(
          typeof data.country === "string" ? data.country : "",
        );
        const province = normalizeProvince(
          typeof data.region === "string" ? data.region : "",
        );
        const city =
          typeof data.city === "string" ? data.city.trim() : "";
        if (country || province || city) return { country, province, city };
      }
    }
  } catch {
    /* 主服务不可用时走备用 */
  }
  try {
    const res = await fetch(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      const country = normalizeCountry(
        typeof data?.country_name === "string" ? data.country_name : "",
      );
      const province = normalizeProvince(
        typeof data?.region === "string" ? data.region : "",
      );
      const city = typeof data?.city === "string" ? data.city.trim() : "";
      if (country || province || city) return { country, province, city };
    }
  } catch {
    /* 备用也不可用：地点留空 */
  }
  return null;
}

// 后台任务：解析 IP 归属地并回填到指定的登录记录行。失败静默（地点
// 留空即可），绝不让解析问题影响已经完成的核验。
async function resolveAndStoreLoginLocation(
  ctx: Ctx,
  loginId: number,
  ip: string,
): Promise<void> {
  try {
    if (!isPublicIp(ip)) return;
    const loc = await lookupIpLocation(ip);
    if (!loc) return;
    const db = ctx.db<typeof schema>();
    await db
      .update(schema.debtorLogins)
      .set({
        country: loc.country,
        province: loc.province,
        city: loc.city,
      })
      .where(eq(schema.debtorLogins.id, loginId));
  } catch {
    /* 地点只是附加信息，解析失败不留痕也不报错 */
  }
}

const loginOut = z.object({
  ok: z.boolean(),
  token: z.string().nullable(),
  role: z.enum(["admin", "user"]).nullable(),
  username: z.string(),
  displayName: z.string(),
  error: z.string(),
});

// 人工聊天收件箱一行：一个有债务人消息的案件，按最后一条消息倒序展示。
// lastDebtorMessageId 是该案最后一条债务人消息的 id，前端与本机记录的
// 每案已看最大消息 id 比对，大于它就是未读（标红点）。
const chatInboxItemOut = z.object({
  caseId: z.number(),
  debtorName: z.string(),
  debtorAvatarUrl: z.string(),
  caseNo: z.string(),
  totalDueCents: z.number(),
  overdueDays: z.number(),
  willingness: z.enum(["high", "mid", "low"]),
  humanTakeover: z.boolean(),
  needsHuman: z.boolean(),
  muted: z.boolean(),
  assigneeId: z.number().nullable(),
  assigneeName: z.string(),
  lastMessageId: z.number(),
  lastSender: z.enum(["debtor", "agent", "system"]),
  lastText: z.string(),
  lastHasImage: z.boolean(),
  lastAt: z.string(),
  lastDebtorMessageId: z.number(),
  debtorMessageCount: z.number(),
  debtorMessageIds: z.array(z.number()),
});

// 待确认回款一行：一笔对账状态为待确认的还款登记（多为债务人自己在
// 网页点「我已付款」传截图提交的），带所属案件的姓名与编号、金额、
// 提交时间与截图地址，供后台角标计数、提醒与待确认回款列表展示。
const pendingPaymentItemOut = z.object({
  paymentId: z.number(),
  caseId: z.number(),
  debtorName: z.string(),
  caseNo: z.string(),
  assigneeId: z.number().nullable(),
  amountCents: z.number(),
  paidOn: z.string(),
  note: z.string(),
  recordedBy: z.string(),
  createdAt: z.string(),
  hasScreenshot: z.boolean(),
  screenshotUrl: z.string(),
});

/* 协商分析：对一条债务人发言调模型给出意图 / 还款意愿 / 风险点 / 建议
   话术，结果按固定格式存回该消息的 analysis，还款意愿由
   computeWillingness 从分析文本里解析。analyzeChatMessage（管理员手动
   点「分析这句」）与 sendDebtorMessage（新消息到达自动分析）共用这一个
   口径。无文字内容（纯图片消息）不分析、返回 null；模型失败时抛错，
   由调用方决定是报错还是静默跳过。 */
async function runDebtorMessageAnalysis(
  ctx: Ctx,
  msg: { id: number; caseId: number; text: string },
): Promise<string | null> {
  if (!msg.text.trim()) return null;
  const db = ctx.db<typeof schema>();
  const caseRows = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.id, msg.caseId))
    .limit(1);
  const c = caseRows[0];
  const history = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.caseId, msg.caseId))
    .orderBy(asc(schema.chatMessages.id));
  const context = history
    .filter((m) => m.id < msg.id)
    .slice(-6)
    .map(
      (m) =>
        `${m.sender === "debtor" ? "债务人" : m.sender === "agent" ? "我方" : "系统"}：${m.text}`,
    )
    .join("\n");
  const analysisSchema = z.object({
    intent: z.string().describe("这句话的真实意图，一句话"),
    willingness: z
      .string()
      .describe("还款意愿判断：高/中/低，并说明依据"),
    risk: z.string().describe("风险点或异常信号，没有则写无"),
    suggestion: z.string().describe("建议的下一句回复话术，可直接使用"),
  });
  const result = await ctx.inference.complete(
    [
      "你是债务协商分析员。结合案件背景与对话上下文，只分析指定的这一句债务人发言，给出意图、还款意愿、风险点和一句可直接使用的建议回复。不要编造案件里没有的事实。",
      c
        ? `案件背景：应还总额 ${(c.totalDueCents / 100).toFixed(2)} 元，本金 ${(c.principalCents / 100).toFixed(2)} 元，罚息 ${(c.penaltyCents / 100).toFixed(2)} 元，已逾期 ${c.overdueDays} 天。`
        : "",
      context ? `此前对话：\n${context}` : "此前对话：无",
      `要分析的这句（债务人）：${msg.text}`,
    ]
      .filter(Boolean)
      .join("\n"),
    { schema: analysisSchema },
  );
  const analysis = [
    `意图：${result.intent}`,
    `还款意愿：${result.willingness}`,
    `风险点：${result.risk}`,
    `建议话术：${result.suggestion}`,
  ].join("\n");
  await db
    .update(schema.chatMessages)
    .set({ analysis })
    .where(eq(schema.chatMessages.id, msg.id));
  return analysis;
}

/* ---------------- 多用户会话、权限与案件可见范围 ----------------
   v16：后台从「管理员 + 一个用户账号」升级为「管理员 + 多个操作员」。
   管理员管账号密码、权限开关与网页维护；日常催收（聊天、接管、禁言、
   登记还款等）归操作员账号，每人一个用户名密码，各自登录，权限按人
   开关（默认全开，管理员可回收）。案件带负责人（分案）：普通操作员
   只能看到分给自己的案件，未分配的也看不到——服务端强制过滤，调
   别人案件的接口直接 403；含「分案」权限的操作员即分案主管，与
   管理员一样看全部案件、能分案改派，但不管账号与权限开关。

   会话对象由权限守卫在调用业务 handler 前解析好放进 sessionStore，
   handler 里用 currentSession(ctx) 取。管理员会话的 operatorId 为
   null；操作员会话带其账号 id、用户名、显示名与权限集合。 */

const PERMISSION_DEFS = [
  { key: "chat", label: "发聊天" },
  { key: "analysis", label: "分析" },
  { key: "agreement", label: "协议" },
  { key: "payment", label: "登记 / 对账还款" },
  { key: "takeover", label: "接管" },
  { key: "mute", label: "禁言" },
  { key: "cases", label: "案件" },
  { key: "content", label: "内容" },
  { key: "scripts", label: "话术" },
  { key: "assign", label: "分案（分案主管）" },
] as const;

type PermissionKey = (typeof PERMISSION_DEFS)[number]["key"];

const PERMISSION_KEYS: ReadonlySet<string> = new Set(
  PERMISSION_DEFS.map((d) => d.key),
);

// 新建操作员的默认权限：业务权限全开；「分案」默认不开——授予哪个
// 操作员，哪个就是分案主管，属于管理员的刻意授权。
const DEFAULT_OPERATOR_PERMISSIONS: PermissionKey[] = [
  "chat",
  "analysis",
  "agreement",
  "payment",
  "takeover",
  "mute",
  "cases",
  "content",
  "scripts",
];

type Session = {
  role: "admin" | "user";
  operatorId: number | null;
  username: string;
  displayName: string;
  permissions: ReadonlySet<string>;
  // 看全部案件：管理员，或有分案权限的操作员（分案主管）。
  scopeAll: boolean;
  canAssign: boolean;
};

const sessionStore = new WeakMap<object, Session>();

function currentSession(ctx: Ctx): Session | null {
  return sessionStore.get(ctx) ?? null;
}

// 经手人显示名：聊天发送、禁言、登记还款等操作落库时记这个名字。
function sessionActorName(session: Session | null): string {
  if (!session) return "";
  if (session.role === "admin") return "管理员";
  return session.displayName || session.username;
}

function parsePermissions(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is string => typeof p === "string" && PERMISSION_KEYS.has(p),
    );
  } catch {
    return [];
  }
}

type OperatorRow = typeof schema.operators.$inferSelect;

async function loadOperators(ctx: Ctx): Promise<OperatorRow[]> {
  const db = ctx.db<typeof schema>();
  return db
    .select()
    .from(schema.operators)
    .orderBy(asc(schema.operators.id));
}

/* 平滑过渡：operators 表为空、且旧的单用户密码已经设置过时，用旧
   用户密码哈希作种子生成第一个操作员账号（用户名 user、显示名
   「用户」），原密码继续能登录。已生成过就不再重复生成。 */
async function ensureOperatorSeed(ctx: Ctx): Promise<void> {
  const db = ctx.db<typeof schema>();
  const existing = await db
    .select({ id: schema.operators.id })
    .from(schema.operators)
    .limit(1);
  if (existing.length > 0) return;
  const cred = await loadCredentials(ctx);
  if (!cred || !cred.userHash) return;
  await db.insert(schema.operators).values({
    username: "user",
    displayName: "用户",
    passwordHash: cred.userHash,
    permissions: JSON.stringify(DEFAULT_OPERATOR_PERMISSIONS),
    disabled: 0,
  });
}

async function loadAssigneeNames(
  ctx: Ctx,
): Promise<Map<number, string>> {
  const ops = await loadOperators(ctx);
  return new Map(
    ops.map((o) => [o.id, o.displayName || o.username] as const),
  );
}

/* 当前会话能看的案件 id 集合：null = 全部可见（管理员 / 分案主管）；
   普通操作员只能看分给自己的案件（未分配的 assigneeId 为 null，
   不在集合里，天然不可见）。 */
async function visibleCaseIds(ctx: Ctx): Promise<Set<number> | null> {
  const session = currentSession(ctx);
  if (!session || session.scopeAll) return null;
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select({ id: schema.cases.id })
    .from(schema.cases)
    .where(eq(schema.cases.assigneeId, session.operatorId ?? -1));
  return new Set(rows.map((r) => r.id));
}

/* 单案件接口的服务端强制范围校验：普通操作员调不属于自己的案件
   直接拒绝（文案含「只认管理员」标记，生产分发层据此定 403）。 */
async function assertCaseVisible(ctx: Ctx, caseId: number): Promise<void> {
  const visible = await visibleCaseIds(ctx);
  if (visible && !visible.has(caseId)) {
    throw new Error(SCOPE_DENIED_MESSAGE);
  }
}

/* 操作员回款能力分析一行：以该操作员负责的案件为范围，数字来自案件
   台账与已确认回款；沟通信号来自其名下案件的聊天记录（回复及时性、
   高意愿未跟进、拖延信号抓取）；建议由服务端按规则生成。普通操作员
   只看得到自己这一行（服务端过滤），管理员与分案主管看全部。 */
const operatorPerfOut = z.object({
  operatorId: z.number(),
  username: z.string(),
  displayName: z.string(),
  disabled: z.boolean(),
  isSupervisor: z.boolean(),
  caseCount: z.number(),
  totalDueCents: z.number(),
  repaidCents: z.number(),
  recoveryRate: z.number(),
  avgRepayDays: z.number().nullable(),
  highUnpaidCount: z.number(),
  debtorMessageCount: z.number(),
  agentMessageCount: z.number(),
  avgReplyHours: z.number().nullable(),
  highUnfollowedCount: z.number(),
  delaySignalTotal: z.number(),
  delaySignalCaught: z.number(),
  suggestions: z.array(z.string()),
});

// 债务人拖延信号：与话术规则同口径的时间模糊/推迟表述。
const DELAY_SIGNAL_RE =
  /下个月|下周|下星期|过几天|过两天|过段时间|过阵子|发工资|工资发|等钱到|到账再|考虑|想想|缓缓|再等等|等几天|忙完这阵/;

async function computeOperatorPerformance(
  ctx: Ctx,
): Promise<z.infer<typeof operatorPerfOut>[]> {
  const db = ctx.db<typeof schema>();
  const session = currentSession(ctx);
  const ops = await loadOperators(ctx);
  const caseRows = await db.select().from(schema.cases);
  const payRows = await db.select().from(schema.payments);
  const agreementRows = await db.select().from(schema.agreements);
  const chatRows = await db
    .select()
    .from(schema.chatMessages)
    .orderBy(asc(schema.chatMessages.id));

  const matchedByCase = new Map<number, number>();
  const firstMatchedAtByCase = new Map<number, Date>();
  for (const p of payRows) {
    if (p.reconcileStatus !== "matched") continue;
    matchedByCase.set(
      p.caseId,
      (matchedByCase.get(p.caseId) ?? 0) + p.amountCents,
    );
    const prev = firstMatchedAtByCase.get(p.caseId);
    if (!prev || p.createdAt < prev) firstMatchedAtByCase.set(p.caseId, p.createdAt);
  }
  const willingnessByCase = new Map<number, Willingness>();
  for (const r of caseRows) {
    const debtorChats = chatRows.filter(
      (m) => m.caseId === r.id && m.sender === "debtor",
    );
    willingnessByCase.set(
      r.id,
      computeWillingness({
        totalDueCents: r.totalDueCents,
        matchedRepaidCents: matchedByCase.get(r.id) ?? 0,
        debtorAnalysesAsc: debtorChats.map((m) => m.analysis),
        debtorMessageCount: debtorChats.length,
        hasActiveAgreement: agreementRows.some(
          (a) => a.caseId === r.id && a.status === "active",
        ),
        hasDoneAgreement: agreementRows.some(
          (a) => a.caseId === r.id && a.status === "done",
        ),
      }),
    );
  }

  type Raw = {
    op: OperatorRow;
    caseCount: number;
    totalDueCents: number;
    repaidCents: number;
    recoveryRate: number;
    avgRepayDays: number | null;
    highUnpaidCount: number;
    debtorMessageCount: number;
    agentMessageCount: number;
    avgReplyHours: number | null;
    highUnfollowedCount: number;
    delaySignalTotal: number;
    delaySignalCaught: number;
  };
  const raws: Raw[] = [];
  for (const op of ops) {
    const myCases = caseRows.filter((r) => r.assigneeId === op.id);
    const myCaseIds = new Set(myCases.map((r) => r.id));
    const totalDueCents = myCases.reduce((s, r) => s + r.totalDueCents, 0);
    const repaidCents = myCases.reduce(
      (s, r) => s + (matchedByCase.get(r.id) ?? 0),
      0,
    );
    // 平均回款天数：有已确认回款的案件，案件建档到第一笔确认回款的天数均值。
    const repayDaySamples: number[] = [];
    for (const r of myCases) {
      const first = firstMatchedAtByCase.get(r.id);
      if (first) {
        repayDaySamples.push(
          Math.max(
            0,
            (first.getTime() - r.createdAt.getTime()) / 86_400_000,
          ),
        );
      }
    }
    const myChats = chatRows.filter((m) => myCaseIds.has(m.caseId));
    const debtorMsgs = myChats.filter((m) => m.sender === "debtor");
    const agentMsgs = myChats.filter((m) => m.sender === "agent");
    // 回复及时性：每条债务人消息之后第一条我方消息与它的时间差（小时）均值。
    const replyHours: number[] = [];
    const byCase = new Map<number, typeof myChats>();
    for (const m of myChats) {
      const arr = byCase.get(m.caseId) ?? [];
      arr.push(m);
      byCase.set(m.caseId, arr);
    }
    let highUnfollowedCount = 0;
    for (const r of myCases) {
      const msgs = byCase.get(r.id) ?? [];
      let pendingSince: Date | null = null;
      for (const m of msgs) {
        if (m.sender === "debtor") {
          if (!pendingSince) pendingSince = m.createdAt;
        } else if (m.sender === "agent" && pendingSince) {
          replyHours.push(
            (m.createdAt.getTime() - pendingSince.getTime()) / 3_600_000,
          );
          pendingSince = null;
        }
      }
      const w = willingnessByCase.get(r.id) ?? "low";
      const repaid = matchedByCase.get(r.id) ?? 0;
      if (
        w === "high" &&
        r.totalDueCents > 0 &&
        repaid < r.totalDueCents &&
        pendingSince !== null
      ) {
        highUnfollowedCount += 1;
      }
    }
    let delaySignalTotal = 0;
    let delaySignalCaught = 0;
    for (const m of debtorMsgs) {
      if (!DELAY_SIGNAL_RE.test(m.text)) continue;
      delaySignalTotal += 1;
      const caught = myChats.some(
        (a) => a.caseId === m.caseId && a.sender === "agent" && a.id > m.id,
      );
      if (caught) delaySignalCaught += 1;
    }
    raws.push({
      op,
      caseCount: myCases.length,
      totalDueCents,
      repaidCents,
      recoveryRate: totalDueCents > 0 ? repaidCents / totalDueCents : 0,
      avgRepayDays:
        repayDaySamples.length > 0
          ? Math.round(
              (repayDaySamples.reduce((s, v) => s + v, 0) /
                repayDaySamples.length) *
                10,
            ) / 10
          : null,
      highUnpaidCount: myCases.filter((r) => {
        const w = willingnessByCase.get(r.id) ?? "low";
        const repaid = matchedByCase.get(r.id) ?? 0;
        return w === "high" && r.totalDueCents > 0 && repaid < r.totalDueCents;
      }).length,
      debtorMessageCount: debtorMsgs.length,
      agentMessageCount: agentMsgs.length,
      avgReplyHours:
        replyHours.length > 0
          ? Math.round(
              (replyHours.reduce((s, v) => s + v, 0) / replyHours.length) *
                10,
            ) / 10
          : null,
      highUnfollowedCount,
      delaySignalTotal,
      delaySignalCaught,
    });
  }

  const withCases = raws.filter((r) => r.caseCount > 0);
  const teamAvgRate =
    withCases.length > 0
      ? withCases.reduce((s, r) => s + r.recoveryRate, 0) / withCases.length
      : 0;
  const maxCaseCount = Math.max(0, ...raws.map((r) => r.caseCount));
  const avgCaseCount =
    withCases.length > 0
      ? withCases.reduce((s, r) => s + r.caseCount, 0) / withCases.length
      : 0;

  const rows = raws.map((r) => {
    const suggestions: string[] = [];
    if (r.caseCount > 0 && r.recoveryRate < teamAvgRate) {
      suggestions.push(
        `回款率 ${(r.recoveryRate * 100).toFixed(1)}% 低于团队平均 ${(teamAvgRate * 100).toFixed(1)}%，建议优先跟进名下的高意愿名单，先把有意愿的转成回款。`,
      );
    }
    if (
      r.caseCount > 0 &&
      r.caseCount === maxCaseCount &&
      r.caseCount > avgCaseCount
    ) {
      suggestions.push(
        `手头 ${r.caseCount} 个案件是团队最多，积压风险高，建议请分案主管分流一部分案件，避免跟进不过来。`,
      );
    }
    if (r.highUnfollowedCount > 0) {
      suggestions.push(
        `有 ${r.highUnfollowedCount} 个高意愿债务人发来消息后还没跟进回复，建议立即跟进，别让意愿凉下来。`,
      );
    }
    if (r.delaySignalTotal > r.delaySignalCaught) {
      suggestions.push(
        `债务人的拖延信号共 ${r.delaySignalTotal} 次，其中 ${r.delaySignalTotal - r.delaySignalCaught} 次没有接住，建议回复时按话术当场锁定具体日期与定金，不给模糊拖延留口子。`,
      );
    }
    if (r.avgReplyHours !== null && r.avgReplyHours > 24) {
      suggestions.push(
        `回复不够及时：债务人消息平均 ${r.avgReplyHours} 小时才得到回复，建议压到当天内，意愿热的时候回得越快越容易成交。`,
      );
    }
    if (suggestions.length === 0) {
      suggestions.push("表现稳定，各项指标正常，继续保持。");
    }
    return {
      operatorId: r.op.id,
      username: r.op.username,
      displayName: r.op.displayName || r.op.username,
      disabled: r.op.disabled === 1,
      isSupervisor: parsePermissions(r.op.permissions).includes("assign"),
      caseCount: r.caseCount,
      totalDueCents: r.totalDueCents,
      repaidCents: r.repaidCents,
      recoveryRate: r.recoveryRate,
      avgRepayDays: r.avgRepayDays,
      highUnpaidCount: r.highUnpaidCount,
      debtorMessageCount: r.debtorMessageCount,
      agentMessageCount: r.agentMessageCount,
      avgReplyHours: r.avgReplyHours,
      highUnfollowedCount: r.highUnfollowedCount,
      delaySignalTotal: r.delaySignalTotal,
      delaySignalCaught: r.delaySignalCaught,
      suggestions,
    };
  });

  // 普通操作员只看自己一行；管理员与分案主管看全部。
  if (session && !session.scopeAll && session.operatorId != null) {
    return rows.filter((r) => r.operatorId === session.operatorId);
  }
  return rows;
}

const baseActions = {
  listCases: defineAction({
    description: "列出全部债务人案件（含进度完成数与发送次数）及汇总数据。",
    request: z.object({ query: z.string().default("") }),
    response: z.object({
      cases: z.array(caseOut),
      totalCases: z.number(),
      totalDueCents: z.number(),
      pendingSendCount: z.number(),
      sentCount: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const allRows = await db
        .select()
        .from(schema.cases)
        .orderBy(desc(schema.cases.updatedAt));
      // 分案可见范围（服务端强制）：普通操作员只看分给自己的案件，
      // 汇总数字也只算他名下的；管理员与分案主管看全部。
      const visible = await visibleCaseIds(ctx);
      const rows = visible
        ? allRows.filter((r) => visible.has(r.id))
        : allRows;
      const assigneeNames = await loadAssigneeNames(ctx);
      const steps = await db.select().from(schema.progressSteps);
      const sends = await db.select().from(schema.sendRecords);
      const chats = await db.select().from(schema.chatMessages);
      const pays = await db.select().from(schema.payments);
      const agreements = await db.select().from(schema.agreements);
      const clicks = await db.select().from(schema.linkClicks);
      const clickAgg = aggregateClicks(clicks);
      const q = args.query.trim().toLowerCase();
      const filtered = q
        ? rows.filter(
            (r) =>
              r.debtorName.toLowerCase().includes(q) ||
              r.caseNo.toLowerCase().includes(q) ||
              r.phone.toLowerCase().includes(q) ||
              (r.idCard ?? "").toLowerCase().includes(q),
          )
        : rows;
      return {
        cases: filtered.map((r) => {
          const cs = steps.filter((s) => s.caseId === r.id);
          const caseChats = chats.filter((m) => m.caseId === r.id);
          const debtorChats = caseChats.filter((m) => m.sender === "debtor");
          const caseAgreements = agreements.filter((a) => a.caseId === r.id);
          return toCaseOut(
            r,
            cs.length,
            cs.filter((s) => s.status === "done").length,
            sends.filter((s) => s.caseId === r.id).length,
            caseChats.length,
            pays.filter(
              (p) => p.caseId === r.id && p.reconcileStatus === "pending",
            ).length,
            {
              willingness: computeWillingness({
                totalDueCents: r.totalDueCents,
                matchedRepaidCents: pays
                  .filter(
                    (p) => p.caseId === r.id && p.reconcileStatus === "matched",
                  )
                  .reduce((s, p) => s + p.amountCents, 0),
                debtorAnalysesAsc: debtorChats.map((m) => m.analysis),
                debtorMessageCount: debtorChats.length,
                hasActiveAgreement: caseAgreements.some(
                  (a) => a.status === "active",
                ),
                hasDoneAgreement: caseAgreements.some((a) => a.status === "done"),
              }),
              clicks: clickAgg.get(r.id) ?? { count: 0, firstAt: null, lastAt: null },
            },
            r.assigneeId != null
              ? (assigneeNames.get(r.assigneeId) ?? "")
              : "",
          );
        }),
        totalCases: rows.length,
        totalDueCents: rows.reduce((sum, r) => sum + r.totalDueCents, 0),
        pendingSendCount: rows.filter((r) => r.status === "draft").length,
        sentCount: rows.filter((r) => r.status === "sent").length,
      };
    },
  }),

  listChatInbox: defineAction({
    description:
      "人工聊天收件箱：所有有债务人消息的案件，按最后一条消息时间倒序（以消息 id 倒序为准），每行带债务人姓名、案件编号、欠款金额、逾期天数、最后一条消息的发送方/内容/时间/是否带图、最后一条债务人消息 id（前端按本机已读记录算未读红点）、还款意愿与人工接管状态。没有债务人消息的案件不进收件箱。",
    request: z.object({}),
    response: z.object({ items: z.array(chatInboxItemOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const allCases = await db.select().from(schema.cases);
      // 分案可见范围（服务端强制）：普通操作员的收件箱只有自己名下的
      // 案件，新消息提示音也只会为这些案件响；管理员与分案主管看全部。
      const visible = await visibleCaseIds(ctx);
      const rows = visible
        ? allCases.filter((r) => visible.has(r.id))
        : allCases;
      const assigneeNames = await loadAssigneeNames(ctx);
      const chats = await db
        .select()
        .from(schema.chatMessages)
        .orderBy(asc(schema.chatMessages.id));
      const pays = await db.select().from(schema.payments);
      const agreements = await db.select().from(schema.agreements);
      const items: z.infer<typeof chatInboxItemOut>[] = [];
      for (const r of rows) {
        const caseChats = chats.filter((m) => m.caseId === r.id);
        const debtorChats = caseChats.filter((m) => m.sender === "debtor");
        if (debtorChats.length === 0) continue;
        const last = caseChats.at(-1);
        const lastDebtor = debtorChats.at(-1);
        if (!last || !lastDebtor) continue;
        const caseAgreements = agreements.filter((a) => a.caseId === r.id);
        items.push({
          caseId: r.id,
          debtorName: r.debtorName,
          debtorAvatarUrl: r.avatarBlobKey
            ? ((await ctx.blobs.getUrl(r.avatarBlobKey)) ?? "")
            : "",
          caseNo: r.caseNo,
          totalDueCents: r.totalDueCents,
          overdueDays: r.overdueDays,
          willingness: computeWillingness({
            totalDueCents: r.totalDueCents,
            matchedRepaidCents: pays
              .filter(
                (p) => p.caseId === r.id && p.reconcileStatus === "matched",
              )
              .reduce((s, p) => s + p.amountCents, 0),
            debtorAnalysesAsc: debtorChats.map((m) => m.analysis),
            debtorMessageCount: debtorChats.length,
            hasActiveAgreement: caseAgreements.some(
              (a) => a.status === "active",
            ),
            hasDoneAgreement: caseAgreements.some((a) => a.status === "done"),
          }),
          humanTakeover: r.humanTakeoverAt != null,
          needsHuman: r.needsHuman === 1,
          muted: r.mutedAt != null,
          assigneeId: r.assigneeId ?? null,
          assigneeName:
            r.assigneeId != null
              ? (assigneeNames.get(r.assigneeId) ?? "")
              : "",
          lastMessageId: last.id,
          lastSender: last.sender,
          lastText: last.text,
          lastHasImage: last.imageBlobKey != null,
          lastAt: last.createdAt.toISOString(),
          lastDebtorMessageId: lastDebtor.id,
          debtorMessageCount: debtorChats.length,
          debtorMessageIds: debtorChats.map((m) => m.id),
        });
      }
      // 消息 id 随写入单调递增，按最后一条消息 id 倒序 = 按最后消息时间倒序。
      items.sort((a, b) => b.lastMessageId - a.lastMessageId);
      return { items };
    },
  }),

  listPendingPayments: defineAction({
    description:
      "待确认回款列表：全部对账状态为待确认（pending）的还款登记——主要是债务人自己在网页点「我已付款」上传截图提交的——按登记 id 倒序（最新提交置顶），每行带所属案件的债务人姓名、案件编号、金额、还款日期、备注、提交时间与截图地址（无截图为空串）。供后台导航角标计数、新增提醒与待确认回款页展示；点开案件在「还款确认」页签里对账（对账操作仍只认管理员，本接口只读、两账号可用）。所属案件已删除的登记不返回（删案件时其还款登记一并删除，正常不会出现）。",
    request: z.object({}),
    response: z.object({ items: z.array(pendingPaymentItemOut) }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const pays = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.reconcileStatus, "pending"))
        .orderBy(desc(schema.payments.id));
      const caseRowsAll = await db.select().from(schema.cases);
      // 分案可见范围（服务端强制）：普通操作员只看自己名下案件的待确认
      // 回款，导航角标与第三种提示音也只针对这些；管理员与分案主管看全部。
      const visible = await visibleCaseIds(ctx);
      const caseRows = visible
        ? caseRowsAll.filter((c) => visible.has(c.id))
        : caseRowsAll;
      const caseById = new Map(caseRows.map((c) => [c.id, c]));
      const items: z.infer<typeof pendingPaymentItemOut>[] = [];
      for (const p of pays) {
        const c = caseById.get(p.caseId);
        if (!c) continue;
        items.push({
          paymentId: p.id,
          caseId: p.caseId,
          debtorName: c.debtorName,
          caseNo: c.caseNo,
          assigneeId: c.assigneeId ?? null,
          amountCents: p.amountCents,
          paidOn: p.paidOn,
          note: p.note,
          recordedBy: p.recordedBy ?? "",
          createdAt: p.createdAt.toISOString(),
          hasScreenshot: p.screenshotBlobKey != null,
          screenshotUrl: p.screenshotBlobKey
            ? ((await ctx.blobs.getUrl(p.screenshotBlobKey)) ?? "")
            : "",
        });
      }
      return { items };
    },
  }),

  getStats: defineAction({
    description:
      "大数据统计：从案件台账、还款登记、协议与聊天记录实时汇总债务人总数、欠款与回款、逾期、金额/逾期天数分段、地区分布、近30天回款趋势与案件状态分布。已回款按对账状态为已确认的还款登记计算。链接点击的已点击/未点击名单每行都带债务人姓名、案件编号、手机号、欠款金额、逾期天数与还款意愿，方便直接跟进。另按身份证号出生日期实时计算年龄分段（20岁以下至60岁以上六段），每段带人数、欠款总额、已回款、回款率、链接点击率与高/中/低意愿人数；无有效身份证号的案件计入年龄未知数单列。另附有还款意愿名单：意愿为高、中的债务人按意愿从高到低排列，每行带姓名、案件编号、手机号、欠款金额、逾期天数、还款意愿、点击次数、首次与最近点击时间和年龄，并实时推导每人未立即还款的原因（扫其聊天原话判类并引用原话，无原话命中时按已结清/协议履约/已还部分/协商中/未沟通兜底）与针对该原因的下一步应对方案。点击名单（已点击/未点击）与有还款意愿名单每行还带债务人登录地点：取其登录记录里按登录请求 IP 解析的国家/省/市（最近的在前），并与台账地区（身份证省份）比对，不一致时 loginLocationMismatch 为 true、同时给出 ledgerRegion 供标注。",
    request: z.object({}),
    response: z.object({
      totalCases: z.number(),
      totalDueCents: z.number(),
      repaidCents: z.number(),
      pendingRepayCents: z.number(),
      recoveryRate: z.number(),
      overdueCount: z.number(),
      overdueAmountCents: z.number(),
      amountBrackets: z.array(bracketOut),
      overdueBrackets: z.array(bracketOut),
      regions: z.array(regionOut),
      trend30: z.array(trendDayOut),
      statusDist: z.array(statusDistOut),
      clicks: z.object({
        totalClickers: z.number(),
        totalClicks: z.number(),
        clickRate: z.number(),
        clicked: z.array(
          z.object({
            caseId: z.number(),
            debtorName: z.string(),
            caseNo: z.string(),
            phone: z.string(),
            totalDueCents: z.number(),
            overdueDays: z.number(),
            willingness: z.enum(["high", "mid", "low"]),
            clickCount: z.number(),
            firstClickAt: z.string(),
            lastClickAt: z.string(),
            loginPhones: z.array(z.string()),
            loginCount: z.number(),
            lastLoginAt: z.string(),
            loginLocations: z.array(z.string()),
            ledgerRegion: z.string(),
            loginLocationMismatch: z.boolean(),
          }),
        ),
        notClicked: z.array(
          z.object({
            caseId: z.number(),
            debtorName: z.string(),
            caseNo: z.string(),
            phone: z.string(),
            totalDueCents: z.number(),
            overdueDays: z.number(),
            willingness: z.enum(["high", "mid", "low"]),
            loginPhones: z.array(z.string()),
            loginCount: z.number(),
            lastLoginAt: z.string(),
            loginLocations: z.array(z.string()),
            ledgerRegion: z.string(),
            loginLocationMismatch: z.boolean(),
          }),
        ),
      }),
      willingnessDist: z.array(
        z.object({
          key: z.enum(["high", "mid", "low"]),
          label: z.string(),
          count: z.number(),
          amountCents: z.number(),
        }),
      ),
      ageBrackets: z.array(ageBracketOut),
      ageUnknownCount: z.number(),
      willingList: z.array(
        z.object({
          caseId: z.number(),
          debtorName: z.string(),
          caseNo: z.string(),
          phone: z.string(),
          totalDueCents: z.number(),
          overdueDays: z.number(),
          willingness: z.enum(["high", "mid"]),
          clickCount: z.number(),
          firstClickAt: z.string(),
          lastClickAt: z.string(),
          age: z.number().nullable(),
          loginPhones: z.array(z.string()),
          loginCount: z.number(),
          lastLoginAt: z.string(),
          loginLocations: z.array(z.string()),
          ledgerRegion: z.string(),
          loginLocationMismatch: z.boolean(),
          holdReason: z.string(),
          actionPlan: z.string(),
        }),
      ),
      operatorPerformance: z.array(operatorPerfOut),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const allCaseRows = await db.select().from(schema.cases);
      const allPayRows = await db.select().from(schema.payments);
      const allClickRows = await db.select().from(schema.linkClicks);
      // 分案可见范围（服务端强制）：普通操作员的统计与名单只算自己
      // 名下的案件（总览、趋势、分布、名单全部按负责人过滤）；管理员
      // 与分案主管看全部。
      const visible = await visibleCaseIds(ctx);
      const caseRows = visible
        ? allCaseRows.filter((r) => visible.has(r.id))
        : allCaseRows;
      const payRows = visible
        ? allPayRows.filter((p) => visible.has(p.caseId))
        : allPayRows;
      const clickRows = visible
        ? allClickRows.filter((c) => visible.has(c.caseId))
        : allClickRows;
      const agreementRows = await db.select().from(schema.agreements);
      const chatRows = await db.select().from(schema.chatMessages);
      const loginRowsAll = await db.select().from(schema.debtorLogins);
      const loginRows = visible
        ? loginRowsAll.filter((l) => visible.has(l.caseId))
        : loginRowsAll;

      const matchedByCase = new Map<number, number>();
      let repaidCents = 0;
      let pendingRepayCents = 0;
      for (const p of payRows) {
        if (p.reconcileStatus === "matched") {
          repaidCents += p.amountCents;
          matchedByCase.set(
            p.caseId,
            (matchedByCase.get(p.caseId) ?? 0) + p.amountCents,
          );
        } else if (p.reconcileStatus === "pending") {
          pendingRepayCents += p.amountCents;
        }
      }
      const totalDueCents = caseRows.reduce((s, r) => s + r.totalDueCents, 0);
      const recoveryRate = totalDueCents > 0 ? repaidCents / totalDueCents : 0;

      const overdueRows = caseRows.filter((r) => r.overdueDays > 0);
      const overdueAmountCents = overdueRows.reduce(
        (s, r) => s + r.totalDueCents,
        0,
      );

      const amountDefs = [
        { label: "5 千元以下", test: (v: number) => v < 500_000 },
        { label: "5 千 – 1 万", test: (v: number) => v >= 500_000 && v < 1_000_000 },
        { label: "1 万 – 2 万", test: (v: number) => v >= 1_000_000 && v < 2_000_000 },
        { label: "2 万 – 5 万", test: (v: number) => v >= 2_000_000 && v < 5_000_000 },
        { label: "5 万元以上", test: (v: number) => v >= 5_000_000 },
      ];
      const amountBrackets = amountDefs.map((d) => {
        const rows = caseRows.filter((r) => d.test(r.totalDueCents));
        return {
          label: d.label,
          count: rows.length,
          amountCents: rows.reduce((s, r) => s + r.totalDueCents, 0),
        };
      });

      const overdueDefs = [
        { label: "未逾期", test: (v: number) => v === 0 },
        { label: "1 – 30 天", test: (v: number) => v >= 1 && v <= 30 },
        { label: "31 – 90 天", test: (v: number) => v >= 31 && v <= 90 },
        { label: "91 – 180 天", test: (v: number) => v >= 91 && v <= 180 },
        { label: "181 – 365 天", test: (v: number) => v >= 181 && v <= 365 },
        { label: "365 天以上", test: (v: number) => v > 365 },
      ];
      const overdueBrackets = overdueDefs.map((d) => {
        const rows = caseRows.filter((r) => d.test(r.overdueDays));
        return {
          label: d.label,
          count: rows.length,
          amountCents: rows.reduce((s, r) => s + r.totalDueCents, 0),
        };
      });

      const regionMap = new Map<string, { count: number; amountCents: number }>();
      for (const r of caseRows) {
        const idCard = (r.idCard ?? "").trim();
        const region =
          idCard.length >= 2
            ? (PROVINCE_BY_ID_PREFIX[idCard.slice(0, 2)] ?? "其他地区")
            : "未录身份证号";
        const entry = regionMap.get(region) ?? { count: 0, amountCents: 0 };
        entry.count += 1;
        entry.amountCents += r.totalDueCents;
        regionMap.set(region, entry);
      }
      const regions = [...regionMap.entries()]
        .map(([region, v]) => ({ region, count: v.count, amountCents: v.amountCents }))
        .sort((a, b) => b.count - a.count || b.amountCents - a.amountCents);

      const byDate = new Map<string, { amountCents: number; count: number }>();
      for (const p of payRows) {
        if (p.reconcileStatus !== "matched") continue;
        const date = (p.paidOn ?? "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const entry = byDate.get(date) ?? { amountCents: 0, count: 0 };
        entry.amountCents += p.amountCents;
        entry.count += 1;
        byDate.set(date, entry);
      }
      const pad = (n: number) => String(n).padStart(2, "0");
      const today = new Date();
      const trend30: z.infer<typeof trendDayOut>[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const entry = byDate.get(key);
        trend30.push({
          date: key,
          amountCents: entry?.amountCents ?? 0,
          count: entry?.count ?? 0,
        });
      }

      const activeAgreementCases = new Set(
        agreementRows.filter((a) => a.status === "active").map((a) => a.caseId),
      );
      const chatCases = new Set(chatRows.map((m) => m.caseId));
      const distMap = new Map<
        z.infer<typeof statusDistOut>["key"],
        { count: number; amountCents: number }
      >([
        ["pending", { count: 0, amountCents: 0 }],
        ["negotiating", { count: 0, amountCents: 0 }],
        ["repaid", { count: 0, amountCents: 0 }],
        ["settled", { count: 0, amountCents: 0 }],
      ]);
      for (const r of caseRows) {
        const repaid = matchedByCase.get(r.id) ?? 0;
        let key: z.infer<typeof statusDistOut>["key"];
        if (r.totalDueCents > 0 && repaid >= r.totalDueCents) key = "settled";
        else if (repaid > 0) key = "repaid";
        else if (activeAgreementCases.has(r.id) || chatCases.has(r.id))
          key = "negotiating";
        else key = "pending";
        const entry = distMap.get(key);
        if (entry) {
          entry.count += 1;
          entry.amountCents += r.totalDueCents;
        }
      }
      const statusLabels: Record<z.infer<typeof statusDistOut>["key"], string> = {
        pending: "待催收",
        negotiating: "协商中",
        repaid: "已还款",
        settled: "已结清",
      };
      const statusDist = (
        ["pending", "negotiating", "repaid", "settled"] as const
      ).map((key) => {
        const entry = distMap.get(key) ?? { count: 0, amountCents: 0 };
        return {
          key,
          label: statusLabels[key],
          count: entry.count,
          amountCents: entry.amountCents,
        };
      });

      // 每个案件的还款意愿先算好，点击名单和意愿分布共用同一份结果。
      const willingnessByCase = new Map<number, Willingness>();
      for (const r of caseRows) {
        const debtorChats = chatRows.filter(
          (m) => m.caseId === r.id && m.sender === "debtor",
        );
        willingnessByCase.set(
          r.id,
          computeWillingness({
            totalDueCents: r.totalDueCents,
            matchedRepaidCents: matchedByCase.get(r.id) ?? 0,
            debtorAnalysesAsc: debtorChats.map((m) => m.analysis),
            debtorMessageCount: debtorChats.length,
            hasActiveAgreement: agreementRows.some(
              (a) => a.caseId === r.id && a.status === "active",
            ),
            hasDoneAgreement: agreementRows.some(
              (a) => a.caseId === r.id && a.status === "done",
            ),
          }),
        );
      }

      // 每个案件的债务人登录汇总：手机号与登录地点都去重，最近登录的排前面；
      // latestProvince 取最近一次带省的登录地点，用于跟台账地区比对。
      type LoginAgg = {
        phones: string[];
        locations: string[];
        latestProvince: string;
        count: number;
        lastAt: Date | null;
      };
      const loginAgg = new Map<number, LoginAgg>();
      const loginRowsDesc = [...loginRows].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      for (const l of loginRowsDesc) {
        const entry = loginAgg.get(l.caseId) ?? {
          phones: [],
          locations: [],
          latestProvince: "",
          count: 0,
          lastAt: null,
        };
        entry.count += 1;
        if (!entry.lastAt) entry.lastAt = l.createdAt;
        if (l.phone && !entry.phones.includes(l.phone)) entry.phones.push(l.phone);
        const locText = loginLocationText({
          country: l.country ?? "",
          province: l.province ?? "",
          city: l.city ?? "",
        });
        if (locText && !entry.locations.includes(locText))
          entry.locations.push(locText);
        if (!entry.latestProvince && (l.province ?? ""))
          entry.latestProvince = l.province;
        loginAgg.set(l.caseId, entry);
      }
      const loginOf = (caseId: number): LoginAgg =>
        loginAgg.get(caseId) ?? {
          phones: [],
          locations: [],
          latestProvince: "",
          count: 0,
          lastAt: null,
        };
      // 某案件的登录地点展示字段：地点列表 + 台账地区 + 最近登录省份与台账省份不一致标记。
      const loginLocationOf = (r: (typeof caseRows)[number]) => {
        const lg = loginOf(r.id);
        const ledgerRegion = ledgerRegionOf(r.idCard ?? "");
        return {
          loginLocations: lg.locations,
          ledgerRegion,
          loginLocationMismatch:
            !!lg.latestProvince &&
            !!ledgerRegion &&
            lg.latestProvince !== ledgerRegion,
        };
      };

      const clickAgg = aggregateClicks(clickRows);
      const clicked = caseRows
        .filter((r) => (clickAgg.get(r.id)?.count ?? 0) > 0)
        .map((r) => {
          const agg = clickAgg.get(r.id) ?? { count: 0, firstAt: null, lastAt: null };
          const lg = loginOf(r.id);
          return {
            caseId: r.id,
            debtorName: r.debtorName,
            caseNo: r.caseNo,
            phone: r.phone,
            totalDueCents: r.totalDueCents,
            overdueDays: r.overdueDays,
            willingness: willingnessByCase.get(r.id) ?? ("low" as Willingness),
            clickCount: agg.count,
            firstClickAt: agg.firstAt ? agg.firstAt.toISOString() : "",
            lastClickAt: agg.lastAt ? agg.lastAt.toISOString() : "",
            loginPhones: lg.phones,
            loginCount: lg.count,
            lastLoginAt: lg.lastAt ? lg.lastAt.toISOString() : "",
            ...loginLocationOf(r),
          };
        })
        .sort((a, b) => b.lastClickAt.localeCompare(a.lastClickAt));
      const notClicked = caseRows
        .filter((r) => (clickAgg.get(r.id)?.count ?? 0) === 0)
        .map((r) => {
          const lg = loginOf(r.id);
          return {
            caseId: r.id,
            debtorName: r.debtorName,
            caseNo: r.caseNo,
            phone: r.phone,
            totalDueCents: r.totalDueCents,
            overdueDays: r.overdueDays,
            willingness: willingnessByCase.get(r.id) ?? ("low" as Willingness),
            loginPhones: lg.phones,
            loginCount: lg.count,
            lastLoginAt: lg.lastAt ? lg.lastAt.toISOString() : "",
            ...loginLocationOf(r),
          };
        })
        .sort((a, b) => b.totalDueCents - a.totalDueCents);
      const clicks = {
        totalClickers: clicked.length,
        totalClicks: clickRows.length,
        clickRate: caseRows.length > 0 ? clicked.length / caseRows.length : 0,
        clicked,
        notClicked,
      };

      const willingnessLabels: Record<Willingness, string> = {
        high: "意愿高",
        mid: "意愿中",
        low: "意愿低",
      };
      const willingnessMap = new Map<
        Willingness,
        { count: number; amountCents: number }
      >([
        ["high", { count: 0, amountCents: 0 }],
        ["mid", { count: 0, amountCents: 0 }],
        ["low", { count: 0, amountCents: 0 }],
      ]);
      for (const r of caseRows) {
        const w = willingnessByCase.get(r.id) ?? "low";
        const entry = willingnessMap.get(w);
        if (entry) {
          entry.count += 1;
          entry.amountCents += r.totalDueCents;
        }
      }
      const willingnessDist = (["high", "mid", "low"] as const).map((key) => {
        const entry = willingnessMap.get(key) ?? { count: 0, amountCents: 0 };
        return {
          key,
          label: willingnessLabels[key],
          count: entry.count,
          amountCents: entry.amountCents,
        };
      });

      // 年龄分段：年龄从身份证号实时算；点击与意愿交叉复用前面算好的结果。
      const ageDefs = [
        { key: "u20", label: "20 岁以下", test: (a: number) => a < 20 },
        { key: "a20s", label: "20–30 岁", test: (a: number) => a >= 20 && a < 30 },
        { key: "a30s", label: "30–40 岁", test: (a: number) => a >= 30 && a < 40 },
        { key: "a40s", label: "40–50 岁", test: (a: number) => a >= 40 && a < 50 },
        { key: "a50s", label: "50–60 岁", test: (a: number) => a >= 50 && a < 60 },
        { key: "o60", label: "60 岁以上", test: (a: number) => a >= 60 },
      ] as const;
      const nowForAge = new Date();
      const ageAcc = new Map<
        string,
        {
          count: number;
          totalDueCents: number;
          repaidCents: number;
          clickedCount: number;
          willingnessHigh: number;
          willingnessMid: number;
          willingnessLow: number;
        }
      >(
        ageDefs.map((def) => [
          def.key,
          {
            count: 0,
            totalDueCents: 0,
            repaidCents: 0,
            clickedCount: 0,
            willingnessHigh: 0,
            willingnessMid: 0,
            willingnessLow: 0,
          },
        ]),
      );
      let ageUnknownCount = 0;
      for (const r of caseRows) {
        const age = ageFromIdCard(r.idCard ?? "", nowForAge);
        if (age === null) {
          ageUnknownCount += 1;
          continue;
        }
        const def = ageDefs.find((d) => d.test(age));
        if (!def) continue;
        const acc = ageAcc.get(def.key);
        if (!acc) continue;
        acc.count += 1;
        acc.totalDueCents += r.totalDueCents;
        acc.repaidCents += matchedByCase.get(r.id) ?? 0;
        if ((clickAgg.get(r.id)?.count ?? 0) > 0) acc.clickedCount += 1;
        const w = willingnessByCase.get(r.id) ?? "low";
        if (w === "high") acc.willingnessHigh += 1;
        else if (w === "mid") acc.willingnessMid += 1;
        else acc.willingnessLow += 1;
      }
      const ageBrackets = ageDefs.map((def) => {
        const acc = ageAcc.get(def.key) ?? {
          count: 0,
          totalDueCents: 0,
          repaidCents: 0,
          clickedCount: 0,
          willingnessHigh: 0,
          willingnessMid: 0,
          willingnessLow: 0,
        };
        return {
          key: def.key,
          label: def.label,
          count: acc.count,
          totalDueCents: acc.totalDueCents,
          repaidCents: acc.repaidCents,
          recoveryRate:
            acc.totalDueCents > 0 ? acc.repaidCents / acc.totalDueCents : 0,
          clickedCount: acc.clickedCount,
          clickRate: acc.count > 0 ? acc.clickedCount / acc.count : 0,
          willingnessHigh: acc.willingnessHigh,
          willingnessMid: acc.willingnessMid,
          willingnessLow: acc.willingnessLow,
        };
      });

      // 有还款意愿名单：意愿高、中两档全部列出，高在前、同档按欠款额从大到小，
      // 每行带年龄（身份证实时算）与链接点击详情，供按名单直接跟进。
      const willingList = caseRows
        .filter((r) => {
          const w = willingnessByCase.get(r.id) ?? "low";
          return w === "high" || w === "mid";
        })
        .map((r) => {
          const agg = clickAgg.get(r.id) ?? { count: 0, firstAt: null, lastAt: null };
          const lg = loginOf(r.id);
          const debtorMessagesAsc = chatRows
            .filter((m) => m.caseId === r.id && m.sender === "debtor")
            .sort((a, b) => a.id - b.id)
            .map((m) => ({ text: m.text, createdAt: m.createdAt }));
          const hold = deriveHoldReason({
            totalDueCents: r.totalDueCents,
            matchedRepaidCents: matchedByCase.get(r.id) ?? 0,
            debtorMessagesAsc,
            hasActiveAgreement: agreementRows.some(
              (a) => a.caseId === r.id && a.status === "active",
            ),
          });
          return {
            caseId: r.id,
            debtorName: r.debtorName,
            caseNo: r.caseNo,
            phone: r.phone,
            totalDueCents: r.totalDueCents,
            overdueDays: r.overdueDays,
            willingness: (willingnessByCase.get(r.id) ?? "mid") as "high" | "mid",
            clickCount: agg.count,
            firstClickAt: agg.firstAt ? agg.firstAt.toISOString() : "",
            lastClickAt: agg.lastAt ? agg.lastAt.toISOString() : "",
            age: ageFromIdCard(r.idCard ?? "", nowForAge),
            loginPhones: lg.phones,
            loginCount: lg.count,
            lastLoginAt: lg.lastAt ? lg.lastAt.toISOString() : "",
            ...loginLocationOf(r),
            holdReason: hold.holdReason,
            actionPlan: hold.actionPlan,
          };
        })
        .sort((a, b) => {
          const rank = (w: "high" | "mid") => (w === "high" ? 0 : 1);
          const byWillingness = rank(a.willingness) - rank(b.willingness);
          if (byWillingness !== 0) return byWillingness;
          return b.totalDueCents - a.totalDueCents;
        });

      return {
        totalCases: caseRows.length,
        totalDueCents,
        repaidCents,
        pendingRepayCents,
        recoveryRate,
        overdueCount: overdueRows.length,
        overdueAmountCents,
        amountBrackets,
        overdueBrackets,
        regions,
        trend30,
        statusDist,
        clicks,
        willingnessDist,
        ageBrackets,
        ageUnknownCount,
        willingList,
        operatorPerformance: await computeOperatorPerformance(ctx),
      };
    },
  }),

  recordLinkClick: defineAction({
    description:
      "债务人端记录短信链接点击：债务人点开链接进入页面时由债务人网页按案件编号调用，记一次点击；后台据此汇总每个债务人的点击次数、首次与最近点击时间。",
    request: z.object({ caseNo: z.string().min(1) }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const caseNo = args.caseNo.trim();
      if (!caseNo) return { ok: false };
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.caseNo, caseNo));
      const row = rows[0];
      if (!row) return { ok: false };
      // 防刷点击数：同一案件每分钟最多记 30 次，超了静默不记（页面流程不受影响）
      if (hitRateLimit(`click:${row.id}`, 30, 60_000)) return { ok: true };
      await db.insert(schema.linkClicks).values({ caseId: row.id });
      return { ok: true };
    },
  }),

  verifyIdentity: defineAction({
    description:
      "债务人登录身份核验：以身份证号为查找键匹配案件记录，手机号必填（填现用手机号即可，不要求与台账一致；债务人换了手机号，只要身份证号与案件记录一致即可认出其案件）。身份证号未命中时不返回任何案件信息。防爆破：同一身份证号或同一手机号 10 分钟内最多核验 20 次，超限直接拒绝并提示稍后再试。核验成功时记一条该案件的登录记录（debtor_logins）：保存本次登录填写的手机号（与台账手机号不一致也照记，两个都保留）。登录地点改服务端解析（v16）：不再信任客户端传来的定位字段（loginCountry/loginProvince/loginCity 仅为兼容旧客户端保留、服务端一律忽略）；地点由服务端按本次请求的真实 IP 解析——IP 由可信 HTTP 分发层从请求头 X-Forwarded-For 第一跳（无则 X-Real-IP）取到后经内部字段 clientIp 注入，债务人网页自己不传、也改不了；服务端拿到 IP 后异步查归属地回填登录记录（解析在后台进行，不等结果、不拖慢登录），没有 IP、私网 IP 或查不到时地点留空，不影响核验本身。登录省份与台账地区（身份证省份）不一致的标记口径不变（getStats 里比对）。",
    request: z.object({
      idCard: z.string().min(1, "身份证号不能为空"),
      phone: z.string().trim().min(1, "请填写手机号"),
      // 旧客户端曾带入的定位字段：仅为兼容保留，服务端不再采用。
      loginCountry: z.string().default(""),
      loginProvince: z.string().default(""),
      loginCity: z.string().default(""),
      // 本次请求的真实 IP：只能由可信 HTTP 分发层按请求头注入
      // （X-Forwarded-For 第一跳，无则 X-Real-IP）；动作层拿不到请求头，
      // 债务人网页不传此字段。为空时地点留空，核验照常进行。
      clientIp: z.string().default(""),
    }),
    response: z.object({
      found: z.boolean(),
      matchedByIdCard: z.boolean(),
      phoneChanged: z.boolean(),
      case: caseOut.nullable(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const idCardNorm = args.idCard.trim().toUpperCase();
      const phoneNorm = args.phone.trim();
      // 登录地点改服务端解析：客户端传来的定位字段一律不采用；只认
      // 可信分发层注入的 clientIp（请求真实 IP）。分发层一般已取
      // X-Forwarded-For 第一跳，这里再防御性地截一次逗号前第一段。
      const clientIp = (args.clientIp ?? "").split(",")[0]?.trim() ?? "";
      // 记一次登录：先按手机号落行、地点留空，IP 归属地在后台异步
      // 解析后回填这一行，核验响应不等解析结果（不拖慢登录）。
      const recordLogin = async (caseId: number): Promise<void> => {
        if (!phoneNorm && !clientIp) return;
        const insertedLogin = await db
          .insert(schema.debtorLogins)
          .values({ caseId, phone: phoneNorm })
          .returning({ id: schema.debtorLogins.id });
        const loginId = insertedLogin[0]?.id;
        if (loginId && clientIp) {
          void resolveAndStoreLoginLocation(ctx, loginId, clientIp);
        }
      };
      if (!idCardNorm) {
        return { found: false, matchedByIdCard: false, phoneChanged: false, case: null };
      }
      // 核验限流（库表持久化，串行检查+记入，防并发超发）。
      await checkVerifyRateLimit(db, idCardNorm, phoneNorm, "verify");
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.idCard, idCardNorm));
      const row = rows[0];
      if (!row) {
        // 兼容历史数据里身份证号带空格或小写 x 的情况，再做一次归一化全表比对
        const all = await db.select().from(schema.cases);
        const fallback = all.find(
          (r) => (r.idCard ?? "").trim().toUpperCase() === idCardNorm,
        );
        if (!fallback) {
          return { found: false, matchedByIdCard: false, phoneChanged: false, case: null };
        }
        // 核验成功即记一次登录：保存本次登录填写的手机号（与台账号
        // 不一致也照记）；登录地点由服务端按请求 IP 异步解析回填。
        await recordLogin(fallback.id);
        const steps = await db.select().from(schema.progressSteps);
        const sends = await db.select().from(schema.sendRecords);
        const cs = steps.filter((s) => s.caseId === fallback.id);
        return {
          found: true,
          matchedByIdCard: true,
          phoneChanged: phoneNorm !== "" && fallback.phone !== "" && fallback.phone !== phoneNorm,
          case: toCaseOut(
            fallback,
            cs.length,
            cs.filter((s) => s.status === "done").length,
            sends.filter((s) => s.caseId === fallback.id).length,
          ),
        };
      }
      // 核验成功即记一次登录：保存本次登录填写的手机号（与台账号
      // 不一致也照记）；登录地点由服务端按请求 IP 异步解析回填。
      await recordLogin(row.id);
      const steps = await db.select().from(schema.progressSteps);
      const sends = await db.select().from(schema.sendRecords);
      const cs = steps.filter((s) => s.caseId === row.id);
      return {
        found: true,
        matchedByIdCard: true,
        phoneChanged: phoneNorm !== "" && row.phone !== "" && row.phone !== phoneNorm,
        case: toCaseOut(
          row,
          cs.length,
          cs.filter((s) => s.status === "done").length,
          sends.filter((s) => s.caseId === row.id).length,
        ),
      };
    },
  }),

  getCase: defineAction({
    description: "读取单个案件的欠款内容、进度时间线与发送记录。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({
      found: z.boolean(),
      case: caseOut.nullable(),
      steps: z.array(stepOut),
      sends: z.array(sendOut),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.id, args.id))
        .limit(1);
      const row = rows[0];
      if (!row) return { found: false, case: null, steps: [], sends: [] };
      // 分案可见范围：普通操作员调别人案件的详情直接 403。
      await assertCaseVisible(ctx, args.id);
      const assigneeNames = await loadAssigneeNames(ctx);
      const steps = await db
        .select()
        .from(schema.progressSteps)
        .where(eq(schema.progressSteps.caseId, args.id))
        .orderBy(asc(schema.progressSteps.sortOrder), asc(schema.progressSteps.id));
      const sends = await db
        .select()
        .from(schema.sendRecords)
        .where(eq(schema.sendRecords.caseId, args.id))
        .orderBy(desc(schema.sendRecords.sentAt));
      const caseChats = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.caseId, args.id))
        .orderBy(asc(schema.chatMessages.id));
      const caseAgreements = await db
        .select()
        .from(schema.agreements)
        .where(eq(schema.agreements.caseId, args.id));
      const casePays = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.caseId, args.id));
      const caseClicks = await db
        .select()
        .from(schema.linkClicks)
        .where(eq(schema.linkClicks.caseId, args.id));
      const debtorChats = caseChats.filter((m) => m.sender === "debtor");
      return {
        found: true,
        case: toCaseOut(
          row,
          steps.length,
          steps.filter((s) => s.status === "done").length,
          sends.length,
          0,
          0,
          {
            willingness: computeWillingness({
              totalDueCents: row.totalDueCents,
              matchedRepaidCents: casePays
                .filter((p) => p.reconcileStatus === "matched")
                .reduce((s, p) => s + p.amountCents, 0),
              debtorAnalysesAsc: debtorChats.map((m) => m.analysis),
              debtorMessageCount: debtorChats.length,
              hasActiveAgreement: caseAgreements.some((a) => a.status === "active"),
              hasDoneAgreement: caseAgreements.some((a) => a.status === "done"),
            }),
            clicks: aggregateClicks(caseClicks).get(args.id) ?? {
              count: 0,
              firstAt: null,
              lastAt: null,
            },
          },
          row.assigneeId != null
            ? (assigneeNames.get(row.assigneeId) ?? "")
            : "",
        ),
        steps: steps.map((s) => ({
          id: s.id,
          caseId: s.caseId,
          title: s.title,
          detail: s.detail,
          occurredOn: s.occurredOn,
          status: s.status,
          sortOrder: s.sortOrder,
        })),
        sends: sends.map((s) => ({
          id: s.id,
          caseId: s.caseId,
          channel: s.channel,
          messageText: s.messageText,
          note: s.note,
          sentAt: s.sentAt.toISOString(),
        })),
      };
    },
  }),

  createCase: defineAction({
    description: "新建一个债务人案件并返回其 id。",
    request: z.object(caseFields),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      // 操作员新建的案件自动归到自己名下（他就是经办人）；管理员建的
      // 保持未分配，等管理员或分案主管手动分案。
      const session = currentSession(ctx);
      const creatorAssigneeId =
        session && session.role === "user" ? session.operatorId : null;
      const result = await db
        .insert(schema.cases)
        .values({
          ...args,
          idCard: args.idCard.trim().toUpperCase(),
          assigneeId: creatorAssigneeId,
        })
        .returning({ id: schema.cases.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createCase: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  importCases: defineAction({
    description:
      "批量导入案件（Excel 预览确认后调用）：逐行写入，案件编号与台账已有或本批重复的行判失败，返回每行成败与失败原因。",
    request: z.object({
      rows: z
        .array(
          z.object({
            rowNumber: z.number().int().positive(),
            ...caseFields,
          }),
        )
        .min(1, "没有可导入的行")
        .max(5000),
    }),
    response: z.object({
      results: z.array(
        z.object({
          rowNumber: z.number(),
          ok: z.boolean(),
          error: z.string(),
          id: z.number().nullable(),
        }),
      ),
      successCount: z.number(),
      failureCount: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select({ caseNo: schema.cases.caseNo })
        .from(schema.cases);
      const existingNos = new Set(existing.map((r) => r.caseNo));
      const batchSeen = new Map<string, number>();
      const results: {
        rowNumber: number;
        ok: boolean;
        error: string;
        id: number | null;
      }[] = [];
      for (const row of args.rows) {
        const { rowNumber, ...fields } = row;
        if (existingNos.has(fields.caseNo)) {
          results.push({
            rowNumber,
            ok: false,
            error: "案件编号已存在（台账中已有此编号）",
            id: null,
          });
          continue;
        }
        const firstRow = batchSeen.get(fields.caseNo);
        if (firstRow != null) {
          results.push({
            rowNumber,
            ok: false,
            error: `案件编号与第 ${firstRow} 行重复`,
            id: null,
          });
          continue;
        }
        batchSeen.set(fields.caseNo, rowNumber);
        // 操作员导入的案件自动归到自己名下；管理员导入的保持未分配。
        const session = currentSession(ctx);
        const inserted = await db
          .insert(schema.cases)
          .values({
            ...fields,
            idCard: fields.idCard.trim().toUpperCase(),
            assigneeId:
              session && session.role === "user" ? session.operatorId : null,
          })
          .returning({ id: schema.cases.id });
        const rec = inserted[0];
        if (!rec) {
          results.push({
            rowNumber,
            ok: false,
            error: "写入失败，请重试",
            id: null,
          });
          continue;
        }
        results.push({ rowNumber, ok: true, error: "", id: rec.id });
      }
      ctx.invalidateQueries();
      return {
        results,
        successCount: results.filter((r) => r.ok).length,
        failureCount: results.filter((r) => !r.ok).length,
      };
    },
  }),

  updateCase: defineAction({
    description: "保存一个案件的欠款内容（债务人、金额、逾期、罚息、债权方等）。修改记审计日志（改前改后关键字段）。",
    request: z.object({ id: z.number().int().positive(), ...caseFields }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, ...fields } = args;
      await assertCaseVisible(ctx, id);
      // 改前快照关键字段，记审计，改错了能查到原来是多少。
      const before = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.id, id))
        .limit(1);
      await db
        .update(schema.cases)
        .set({ ...fields, idCard: fields.idCard.trim().toUpperCase(), updatedAt: new Date() })
        .where(eq(schema.cases.id, id));
      const b = before[0];
      if (b) {
        const changed: string[] = [];
        const watch: [string, unknown, unknown][] = [
          ["总额", b.totalDueCents, fields.totalDueCents],
          ["本金", b.principalCents, fields.principalCents],
          ["罚息", b.penaltyCents, fields.penaltyCents],
          ["逾期天数", b.overdueDays, fields.overdueDays],
          ["债务人", b.debtorName, fields.debtorName],
          ["案号", b.caseNo, fields.caseNo],
        ];
        for (const [name, oldV, newV] of watch) {
          if (String(oldV ?? "") !== String(newV ?? "")) {
            changed.push(`${name}: ${oldV} → ${newV}`);
          }
        }
        await logAudit(ctx, "update_case", "case", id, changed.length > 0 ? changed.join("; ") : "保存案件（无关键字段变化）");
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteCase: defineAction({
    description: "删除一个案件及其全部进度步骤与发送记录。删除前先把整条案件（含进度、发送、聊天、协议、还款）快照进回收站，删错了可以从回收站恢复。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await assertCaseVisible(ctx, args.id);
      // 先归档进回收站，再删；归档失败也不拦删除（审计里会记）。
      const archiveId = await archiveCase(ctx, args.id);
      await db.batch([
        db.delete(schema.progressSteps).where(eq(schema.progressSteps.caseId, args.id)),
        db.delete(schema.sendRecords).where(eq(schema.sendRecords.caseId, args.id)),
        db.delete(schema.chatMessages).where(eq(schema.chatMessages.caseId, args.id)),
        db.delete(schema.agreements).where(eq(schema.agreements.caseId, args.id)),
        db.delete(schema.payments).where(eq(schema.payments.caseId, args.id)),
        db.delete(schema.cases).where(eq(schema.cases.id, args.id)),
      ]);
      await logAudit(ctx, "delete_case", "case", args.id, `删除案件 ${args.id}，回收站 ${archiveId ?? "归档失败"}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  // 回收站：列出已删除的案件/还款，可单条恢复。
  listDeletedItems: defineAction({
    description: "列出回收站里的已删除项（案件与还款），最新在前。",
    request: z.object({}),
    response: z.object({
      items: z.array(
        z.object({
          id: z.number(),
          kind: z.string(),
          itemId: z.number().nullable(),
          label: z.string(),
          deletedBy: z.string(),
          deletedAt: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.deletedItems)
        .orderBy(desc(schema.deletedItems.id))
        .limit(100);
      return {
        items: rows.map((r) => ({
          id: r.id,
          kind: r.kind,
          itemId: r.itemId,
          label: r.label,
          deletedBy: r.deletedBy,
          deletedAt: (r.deletedAt as Date).toISOString(),
        })),
      };
    },
  }),

  restoreDeletedItem: defineAction({
    description: "从回收站恢复一条已删除的案件或还款（把快照原样插回）。仅管理员可用。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const session = currentSession(ctx);
      if (!session || session.role !== "admin") {
        throw new Error("HTTP403:仅管理员可以从回收站恢复");
      }
      const rows = await db
        .select()
        .from(schema.deletedItems)
        .where(eq(schema.deletedItems.id, args.id))
        .limit(1);
      if (rows.length === 0) throw new Error("HTTP404:回收站里没有这一条");
      const item = rows[0];
      const snapshot = JSON.parse(item.data) as Record<string, unknown>;
      if (item.kind === "case") {
        const s = snapshot as {
          case: Record<string, unknown>;
          progressSteps: Record<string, unknown>[];
          sendRecords: Record<string, unknown>[];
          chatMessages: Record<string, unknown>[];
          agreements: Record<string, unknown>[];
          payments: Record<string, unknown>[];
        };
        // 原 id 已删，直接按快照插回（含原 id）。
        const stripId = (r: Record<string, unknown>): Record<string, unknown> => {
          const { id: _id, ...rest } = r;
          return rest;
        };
        await db.insert(schema.cases).values({ ...(stripId(s.case) as Record<string, unknown>), id: s.case.id as number } as never);
        for (const r of s.progressSteps ?? []) await db.insert(schema.progressSteps).values(stripId(r) as never);
        for (const r of s.sendRecords ?? []) await db.insert(schema.sendRecords).values(stripId(r) as never);
        for (const r of s.chatMessages ?? []) await db.insert(schema.chatMessages).values(stripId(r) as never);
        for (const r of s.agreements ?? []) await db.insert(schema.agreements).values(stripId(r) as never);
        for (const r of s.payments ?? []) await db.insert(schema.payments).values(stripId(r) as never);
      } else if (item.kind === "payment") {
        const s = snapshot as { payment: Record<string, unknown> };
        const { id: _id, ...rest } = s.payment;
        await db.insert(schema.payments).values({ ...(rest as Record<string, unknown>), id: s.payment.id as number } as never);
      } else {
        // 通用单行恢复（页面信息、步骤、聊天、协议、技巧等）：按 kind 找表插回。
        const singleTables: Record<string, unknown> = {
          court_case: schema.courtCases,
          lawyer_update: schema.lawyerUpdates,
          feed_item: schema.preservationFeedItems,
          today_repayment: schema.todayRepayments,
          ticker_item: schema.tickerItems,
          punishment_item: schema.punishmentItems,
          step: schema.progressSteps,
          chat_message: schema.chatMessages,
          agreement: schema.agreements,
          technique: schema.techniques,
        };
        const table = singleTables[item.kind];
        if (!table) throw new Error("HTTP400:这种类型不支持恢复");
        const s = snapshot as { row: Record<string, unknown> };
        const { id: _id, ...rest } = s.row;
        await db.insert(table as never).values({ ...(rest as Record<string, unknown>), id: s.row.id as number } as never);
      }
      await db.delete(schema.deletedItems).where(eq(schema.deletedItems.id, args.id));
      await logAudit(ctx, "restore_deleted", item.kind, item.itemId, `从回收站恢复 ${item.kind} ${item.label}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  // 审计日志：列出最近的操作记录，最新在前。
  listAuditLogs: defineAction({
    description: "列出最近的操作审计记录（谁、什么时候、做了什么）。",
    request: z.object({ limit: z.number().int().min(1).max(200).optional() }),
    response: z.object({
      logs: z.array(
        z.object({
          id: z.number(),
          actor: z.string(),
          action: z.string(),
          targetKind: z.string(),
          targetId: z.number().nullable(),
          detail: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.auditLogs)
        .orderBy(desc(schema.auditLogs.id))
        .limit(args.limit ?? 100);
      return {
        logs: rows.map((r) => ({
          id: r.id,
          actor: r.actor,
          action: r.action,
          targetKind: r.targetKind,
          targetId: r.targetId,
          detail: r.detail,
          createdAt: (r.createdAt as Date).toISOString(),
        })),
      };
    },
  }),

  // 系统快照：一键还原用的整库备份点。仅管理员可用。
  createSystemSnapshot: defineAction({
    description: "立即给当前整个系统（案件、聊天、还款、页面内容、话术、已学话术）拍一个快照备份点。仅管理员可用。",
    request: z.object({ label: z.string().max(200).optional() }),
    response: z.object({ ok: z.boolean(), id: z.number().nullable() }),
    async handler(ctx, args) {
      const session = currentSession(ctx);
      if (!session || session.role !== "admin") {
        throw new Error("HTTP403:仅管理员可以备份系统");
      }
      const snap = await createSnapshotRow(ctx, args.label?.trim() || "手动备份");
      if (!snap) throw new Error("HTTP500:备份失败");
      await logAudit(ctx, "create_snapshot", "system", snap.id, `创建系统快照 ${snap.id}`);
      return { ok: true, id: snap.id };
    },
  }),

  listSystemSnapshots: defineAction({
    description: "列出系统快照备份点，最新在前。仅管理员可用。",
    request: z.object({}),
    response: z.object({
      snapshots: z.array(
        z.object({
          id: z.number(),
          label: z.string(),
          caseCount: z.number(),
          sizeBytes: z.number(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      const session = currentSession(ctx);
      if (!session || session.role !== "admin") {
        throw new Error("HTTP403:仅管理员可以查看系统快照");
      }
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.systemSnapshots)
        .orderBy(desc(schema.systemSnapshots.id))
        .limit(20);
      return {
        snapshots: rows.map((r) => ({
          id: r.id,
          label: r.label,
          caseCount: r.caseCount,
          sizeBytes: r.sizeBytes,
          createdAt: (r.createdAt as Date).toISOString(),
        })),
      };
    },
  }),

  restoreSystemSnapshot: defineAction({
    description: "一键还原：把整个系统（案件、聊天、还款、页面内容、话术、已学话术）还原到指定快照。还原前先自动备份当前系统，还原后服务重启生效。仅管理员可用。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const session = currentSession(ctx);
      if (!session || session.role !== "admin") {
        throw new Error("HTTP403:仅管理员可以还原系统");
      }
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.systemSnapshots)
        .where(eq(schema.systemSnapshots.id, args.id))
        .limit(1);
      if (rows.length === 0) throw new Error("HTTP404:没有这个快照");
      const snap = rows[0];
      // 还原前先自动备份当前系统，还原本身也可反悔。
      await createSnapshotRow(ctx, "还原前自动备份");
      const dataDir = (ctx as unknown as { spaceDir?: string }).spaceDir ?? "";
      // 快照文件存在 blobs 目录下（system-snapshots/…），直接读文件。
      const snapFile = join(dataDir, "blobs", snap.blobKey);
      const buf = readFileSync(snapFile);
      if (buf.length < 100 || buf.subarray(0, 6).toString() !== "SQLite") {
        throw new Error("HTTP500:快照文件损坏，无法还原");
      }
      writeFileSync(join(dataDir, "gangshang.db.restored"), buf);
      await logAudit(ctx, "restore_system", "system", snap.id, `一键还原到快照 ${snap.id}（${snap.label}）`);
      // 写盘后退出，启动时自动用还原文件替换当前库。
      setTimeout(() => process.exit(0), 500);
      return { ok: true };
    },
  }),

  deleteAllCases: defineAction({
    description:
      "一键删除全部可见案件及其全部进度、发送记录、聊天、协议、还款记录、链接点击与登录记录。仅管理员可用；删除前每个案件先快照进回收站，删错了可以单条恢复。",
    request: z.object({}),
    response: z.object({ ok: z.boolean(), deletedCount: z.number() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      // 仅管理员可用：普通操作员误点「删除全部」是最大的误删风险。
      const session = currentSession(ctx);
      if (!session || session.role !== "admin") {
        throw new Error("HTTP403:仅管理员可以删除全部案件");
      }
      const visible = await visibleCaseIds(ctx);
      const existing = await db
        .select({ id: schema.cases.id })
        .from(schema.cases);
      const targetIds = visible
        ? existing.map((r) => r.id).filter((id) => visible.has(id))
        : existing.map((r) => r.id);
      // 先把每个案件快照进回收站，再删。
      for (const id of targetIds) {
        await archiveCase(ctx, id);
      }
      if (visible) {
        if (targetIds.length > 0) {
          await db.batch([
            db.delete(schema.progressSteps).where(inArray(schema.progressSteps.caseId, targetIds)),
            db.delete(schema.sendRecords).where(inArray(schema.sendRecords.caseId, targetIds)),
            db.delete(schema.chatMessages).where(inArray(schema.chatMessages.caseId, targetIds)),
            db.delete(schema.agreements).where(inArray(schema.agreements.caseId, targetIds)),
            db.delete(schema.payments).where(inArray(schema.payments.caseId, targetIds)),
            db.delete(schema.linkClicks).where(inArray(schema.linkClicks.caseId, targetIds)),
            db.delete(schema.debtorLogins).where(inArray(schema.debtorLogins.caseId, targetIds)),
            db.delete(schema.cases).where(inArray(schema.cases.id, targetIds)),
          ]);
        }
        await logAudit(ctx, "delete_all_cases", "case", null, `删除全部案件 ${targetIds.length} 个，已进回收站`);
        ctx.invalidateQueries();
        return { ok: true, deletedCount: targetIds.length };
      }
      await db.batch([
        db.delete(schema.progressSteps),
        db.delete(schema.sendRecords),
        db.delete(schema.chatMessages),
        db.delete(schema.agreements),
        db.delete(schema.payments),
        db.delete(schema.linkClicks),
        db.delete(schema.debtorLogins),
        db.delete(schema.cases),
      ]);
      await logAudit(ctx, "delete_all_cases", "case", null, `删除全部案件 ${existing.length} 个，已进回收站`);
      ctx.invalidateQueries();
      return { ok: true, deletedCount: existing.length };
    },
  }),

  addStep: defineAction({
    description: "给案件进度时间线新增一个步骤。",
    request: z.object({
      caseId: z.number().int().positive(),
      title: z.string().min(1, "步骤名称不能为空"),
      detail: z.string().default(""),
      occurredOn: z.string().default(""),
      status: z.enum(["pending", "done"]).default("pending"),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await assertCaseVisible(ctx, args.caseId);
      const existing = await db
        .select()
        .from(schema.progressSteps)
        .where(eq(schema.progressSteps.caseId, args.caseId));
      const result = await db
        .insert(schema.progressSteps)
        .values({ ...args, sortOrder: existing.length })
        .returning({ id: schema.progressSteps.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addStep: insert returned no rows");
      await db
        .update(schema.cases)
        .set({ updatedAt: new Date() })
        .where(eq(schema.cases.id, args.caseId));
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateStep: defineAction({
    description: "编辑一个进度步骤的名称、说明、日期与完成状态。",
    request: z.object({
      id: z.number().int().positive(),
      title: z.string().min(1, "步骤名称不能为空"),
      detail: z.string().default(""),
      occurredOn: z.string().default(""),
      status: z.enum(["pending", "done"]),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, ...fields } = args;
      const stepRows = await db
        .select()
        .from(schema.progressSteps)
        .where(eq(schema.progressSteps.id, id))
        .limit(1);
      if (stepRows[0]) await assertCaseVisible(ctx, stepRows[0].caseId);
      await db
        .update(schema.progressSteps)
        .set(fields)
        .where(eq(schema.progressSteps.id, id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteStep: defineAction({
    description: "删除一个进度步骤。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const stepRows = await db
        .select()
        .from(schema.progressSteps)
        .where(eq(schema.progressSteps.id, args.id))
        .limit(1);
      if (stepRows[0]) await assertCaseVisible(ctx, stepRows[0].caseId);
      const archiveId = stepRows[0] ? await archiveData(ctx, "step", args.id, String((stepRows[0] as Record<string, unknown>).title ?? (stepRows[0] as Record<string, unknown>).content ?? ""), stepRows[0]) : null;
      await db
        .delete(schema.progressSteps)
        .where(eq(schema.progressSteps.id, args.id));
      await logAudit(ctx, "delete_step", "step", args.id, `删除进度步骤 ${args.id}，回收站 ${archiveId ?? "归档失败"}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  registerSend: defineAction({
    description:
      "登记一次私下发送：后台不发送短信，只把用户私下发给债务人的短信文案、时间与备注存入发送记录留痕。",
    request: z.object({
      caseId: z.number().int().positive(),
      channel: z.string().default("私下发送（后台仅登记）"),
      messageText: z.string().default(""),
      note: z.string().default(""),
    }),
    response: z.object({ ok: z.boolean(), sentAt: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await assertCaseVisible(ctx, args.caseId);
      const now = new Date();
      await db.batch([
        db.insert(schema.sendRecords).values({
          caseId: args.caseId,
          channel: args.channel,
          messageText: args.messageText,
          note: args.note,
          sentAt: now,
        }),
        db
          .update(schema.cases)
          .set({ status: "sent", lastSentAt: now, updatedAt: now })
          .where(eq(schema.cases.id, args.caseId)),
      ]);
      ctx.invalidateQueries();
      return { ok: true, sentAt: now.toISOString() };
    },
  }),

  /* ---------------- 聊天协商 ---------------- */

  getChat: defineAction({
    description: "读取一个案件的聊天协商记录（网页聊天同步到后台的全部消息）与协商事项。",
    request: z.object({ caseId: z.number().int().positive() }),
    response: z.object({
      messages: z.array(chatMessageOut),
      agreements: z.array(agreementOut),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await assertCaseVisible(ctx, args.caseId);
      const messages = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.caseId, args.caseId))
        .orderBy(asc(schema.chatMessages.id));
      const agreements = await db
        .select()
        .from(schema.agreements)
        .where(eq(schema.agreements.caseId, args.caseId))
        .orderBy(desc(schema.agreements.id));
      return {
        messages: await Promise.all(
          messages.map(async (m) => ({
            id: m.id,
            caseId: m.caseId,
            sender: m.sender,
            text: m.text,
            analysis: m.analysis,
            actorName: m.actorName ?? "",
            hasImage: m.imageBlobKey != null,
            imageUrl: m.imageBlobKey
              ? ((await ctx.blobs.getUrl(m.imageBlobKey)) ?? "")
              : "",
            createdAt: m.createdAt.toISOString(),
          })),
        ),
        agreements: agreements.map((a) => ({
          id: a.id,
          caseId: a.caseId,
          kind: a.kind,
          detail: a.detail,
          amountCents: a.amountCents,
          createdBy: a.createdBy ?? "",
          status: a.status,
          createdAt: a.createdAt.toISOString(),
        })),
      };
    },
  }),

  addChatMessage: defineAction({
    description:
      "往案件的聊天协商里记一条消息（债务人的话或我方回复），与网页聊天同一条记录。可随消息附一张图片（image，可选，我方发凭证/通知截图等）：只收图片、解码后不超过 5MB；文字可空，但文字和图片不能同时为空。图片按与付款截图相同的随机键规则存入 blobs（chat-images/<消息ID>-<32 位随机十六进制>），返回消息 id。接管联动：以我方（sender=agent）身份发出一条消息即视为人工接管——该案尚未接管时自动写入 humanTakeoverAt，不必先拨接管开关；记债务人消息不触发接管；接管开关仍可用于不发消息直接接管或关掉接管。",
    request: z
      .object({
        caseId: z.number().int().positive(),
        sender: z.enum(["debtor", "agent", "system"]),
        text: z.string().default(""),
        image: z
          .object({
            dataBase64: z.string().min(1, "请上传图片"),
            mimeType: z.string().regex(/^image\//, "图片必须是图片文件"),
          })
          .optional(),
      })
      .superRefine((args, ctx) => {
        if (!args.text.trim() && !args.image) {
          ctx.addIssue({ code: "custom", message: "消息内容不能为空" });
        }
      }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await assertCaseVisible(ctx, args.caseId);
      const text = args.text ?? "";
      if (!text.trim() && !args.image) {
        throw new Error("消息内容不能为空");
      }
      let imageBytes: Buffer | null = null;
      if (args.image) {
        if (!args.image.mimeType.toLowerCase().startsWith("image/")) {
          throw new Error("只支持发送图片，请重新选择。");
        }
        imageBytes = Buffer.from(args.image.dataBase64, "base64");
        if (imageBytes.length === 0) {
          throw new Error("图片内容为空，请重新选择。");
        }
        if (imageBytes.length > 5 * 1024 * 1024) {
          throw new Error("HTTP400:图片文件过大，请上传 5MB 以内的图片");
        }
      }
      const result = await db
        .insert(schema.chatMessages)
        .values({
          caseId: args.caseId,
          sender: args.sender,
          text,
          // 经手人：我方消息记发送人的显示名（管理员/操作员），事后能
          // 看出每句话是谁发的；代记的债务人消息记债务人本人。
          actorName:
            args.sender === "agent"
              ? sessionActorName(currentSession(ctx))
              : args.sender === "debtor"
                ? "债务人"
                : "",
        })
        .returning({ id: schema.chatMessages.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addChatMessage: insert returned no rows");
      if (args.image && imageBytes) {
        // 键名 = 消息ID + 32 位随机十六进制，与付款截图同规则，地址不可枚举猜出。
        const key = `chat-images/${inserted.id}-${randomHex(16)}`;
        await ctx.blobs.put(key, imageBytes, {
          contentType: args.image.mimeType,
        });
        await db
          .update(schema.chatMessages)
          .set({ imageBlobKey: key })
          .where(eq(schema.chatMessages.id, inserted.id));
      }
      // 人工接管联动：管理员在面板以我方（agent）身份发出一条消息，即
      // 视为已接管该案——尚未接管时自动写入接管时间（债务人页机器人
      // 停答、显示专员在线），不必先拨接管开关。接管开关仍保留：可
      // 不发消息直接接管，也可关掉接管回到机器人值守。记债务人消息
      // （sender=debtor）不触发接管。
      if (args.sender === "agent") {
        const caseRows = await db
          .select()
          .from(schema.cases)
          .where(eq(schema.cases.id, args.caseId))
          .limit(1);
        if (caseRows[0] && caseRows[0].humanTakeoverAt == null) {
          await db
            .update(schema.cases)
            .set({ humanTakeoverAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.cases.id, args.caseId));
        }
        // 专员发消息即学口气：AI 以后照着专员平时说话的方式回。
        if ((args.text ?? "").trim().length > 0) {
          await learnAgentMessage(ctx, args.caseId, args.text);
        }
      }
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  getChatImage: defineAction({
    description: "取一条聊天消息附带图片的查看地址（需登录），没有图片时返回 null。",
    request: z.object({ messageId: z.number().int().positive() }),
    response: z.object({ url: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.id, args.messageId))
        .limit(1);
      const row = rows[0];
      if (!row?.imageBlobKey) return { url: null };
      await assertCaseVisible(ctx, row.caseId);
      const url = await ctx.blobs.getUrl(row.imageBlobKey);
      return { url: url ?? null };
    },
  }),

  getDebtorChat: defineAction({
    description:
      "债务人端读取某案件的聊天记录（公开接口，无需登录令牌，债务人网页在身份核验通过后调用）：后端校验案件存在，且该案件台账上的身份证号与传来的 idCard 归一化后（去空格、转大写）一致，不一致直接拒绝；返回该案件的全部聊天消息（含客服发送的图片地址），不含后台分析字段，并带 humanTakeover（是否已人工接管，接管时债务人页机器人停答）。限流与核验同口径：同一身份证号 10 分钟内最多 20 次（verify_attempts 表计数，被限流时抛限流文案，生产分发层按文案映射 429），全站 10 分钟 600 次兜底；生产 HTTP 层另按 IP 做同口径限流。",
    request: z.object({
      caseId: z.number().int().positive(),
      idCard: z.string().trim().min(18, "身份证号必须为18位").max(18, "身份证号必须为18位"),
    }),
    response: z.object({
      messages: z.array(debtorChatMessageOut),
      humanTakeover: z.boolean(),
      muted: z.boolean(),
      // 聊天头用：债务人名字（前端脱敏后显示）、债务人头像、我方头像
      //（负责人头像，无负责人时用主专员 user 的头像；未上传为空串）。
      debtorName: z.string(),
      debtorAvatarUrl: z.string(),
      agentAvatarUrl: z.string(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      // 身份证号归一化：去全部空格、转大写，与台账比对时大小写和空格不敏感。
      const idCardNorm = (args.idCard ?? "").replace(/\s+/g, "").toUpperCase();

      // 校验：案件必须存在，且台账身份证号与传来的身份证号归一化后一致。
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.id, args.caseId));
      const row = rows[0];
      if (!row) {
        throw new Error("HTTP400:未找到匹配的案件记录");
      }
      const ledgerNorm = (row.idCard ?? "").replace(/\s+/g, "").toUpperCase();
      if (!ledgerNorm || ledgerNorm !== idCardNorm) {
        throw new Error("HTTP400:身份证号与案件不匹配");
      }
      const messages = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.caseId, row.id))
        .orderBy(asc(schema.chatMessages.id));
      // 我方头像：负责人（assignee）的头像；未分案时用主专员 user 的头像。
      let agentKey: string | null = null;
      if (row.assigneeId != null) {
        const ops = await db
          .select({ avatarBlobKey: schema.operators.avatarBlobKey })
          .from(schema.operators)
          .where(eq(schema.operators.id, row.assigneeId));
        agentKey = ops[0]?.avatarBlobKey ?? null;
      }
      if (!agentKey) {
        const ops = await db
          .select({ avatarBlobKey: schema.operators.avatarBlobKey })
          .from(schema.operators)
          .where(eq(schema.operators.username, "user"));
        agentKey = ops[0]?.avatarBlobKey ?? null;
      }
      const debtorAvatarUrl = row.avatarBlobKey
        ? ((await ctx.blobs.getUrl(row.avatarBlobKey)) ?? "")
        : "";
      const agentAvatarUrl = agentKey
        ? ((await ctx.blobs.getUrl(agentKey)) ?? "")
        : "";
      return {
        humanTakeover: row.humanTakeoverAt != null,
        muted: row.mutedAt != null,
        debtorName: row.debtorName ?? "",
        debtorAvatarUrl,
        agentAvatarUrl,
        messages: await Promise.all(
          messages.map(async (m) => ({
            id: m.id,
            sender: m.sender,
            text: m.text,
            hasImage: m.imageBlobKey != null,
            imageUrl: m.imageBlobKey
              ? ((await ctx.blobs.getUrl(m.imageBlobKey)) ?? "")
              : "",
            createdAt: m.createdAt.toISOString(),
          })),
        ),
      };
    },
  }),

  sendDebtorMessage: defineAction({
    description:
      "债务人端发送一条聊天消息（公开接口，无需登录令牌，债务人网页在身份核验通过后调用）：后端校验案件存在，且该案件台账上的身份证号与传来的 idCard 归一化后（去空格、转大写）一致，不一致直接拒绝；text 1–2000 字；可随消息附一张图片（image，可选，债务人发凭证/截图等）：只收图片、解码后不超过 5MB；文字与图片不能同时为空（纯图消息跳过自动分析）；写入 chat_messages（sender=debtor），后台聊天面板立即可见。限流与核验同口径：同一身份证号 10 分钟内最多 20 次（verify_attempts 表计数，被限流时抛限流文案，生产分发层按文案映射 429），全站 10 分钟 600 次兜底；生产 HTTP 层另按 IP 做同口径限流。返回新消息 id、创建时间与当前是否人工接管（humanTakeover，接管时债务人页本地机器人应停答）。写入后立即按 analyzeChatMessage 同一口径自动分析这条新消息（runDebtorMessageAnalysis，结果存回该消息的 analysis，该案还款意愿随之更新，管理员不必再手动点分析；收件箱轮询刷新即可看到新意愿），返回里同时带 analysis 与按 computeWillingness 口径算出的该案当前还款意愿 willingness；自动分析失败（模型不可用等）不影响消息发送本身，analysis 留空、willingness 按其余信号计算。",
    request: z.object({
      caseId: z.number().int().positive(),
      idCard: z.string().min(1, "身份证号不能为空"),
      text: z
        .string()
        .trim()
        .max(2000, "消息最长 2000 字")
        .default(""),
      image: z
        .object({
          dataBase64: z.string().min(1, "请上传图片"),
          mimeType: z.string().regex(/^image\//, "图片必须是图片文件"),
        })
        .optional(),
    }),
    response: z.object({
      id: z.number(),
      createdAt: z.string(),
      humanTakeover: z.boolean(),
      muted: z.boolean(),
      analysis: z.string(),
      willingness: z.enum(["high", "mid", "low"]),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      // 身份证号归一化：去全部空格、转大写，与台账比对时大小写和空格不敏感。
      const idCardNorm = (args.idCard ?? "").replace(/\s+/g, "").toUpperCase();

      // 校验：案件必须存在，且台账身份证号与传来的身份证号归一化后一致。
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.id, args.caseId));
      const row = rows[0];
      if (!row) {
        throw new Error("HTTP400:未找到匹配的案件记录");
      }
      const ledgerNorm = (row.idCard ?? "").replace(/\s+/g, "").toUpperCase();
      if (!ledgerNorm || ledgerNorm !== idCardNorm) {
        throw new Error("HTTP400:身份证号与案件不匹配");
      }
      // 禁言：管理员手动禁言的案件直接拒绝发送（文案与债务人页约定一致，
      // 债务人页据此禁用输入框并提示）。禁言只能手动设置/解除，没有自动
      // 禁言；刷屏由上面的发送限流挡（超限抛限流文案）。
      if (row.mutedAt != null) {
        throw new Error("该账号已被禁言");
      }
      // 文字与图片不能同时为空（与专员发消息同口径）；有图时文字可空。
      const text = args.text ?? "";
      if (!text.trim() && !args.image) {
        throw new Error("消息内容不能为空");
      }
      let imageBytes: Buffer | null = null;
      if (args.image) {
        if (!args.image.mimeType.toLowerCase().startsWith("image/")) {
          throw new Error("只支持发送图片，请重新选择。");
        }
        imageBytes = Buffer.from(args.image.dataBase64, "base64");
        if (imageBytes.length === 0) {
          throw new Error("图片内容为空，请重新选择。");
        }
        if (imageBytes.length > 5 * 1024 * 1024) {
          throw new Error("HTTP400:图片文件过大，请上传 5MB 以内的图片");
        }
      }
      const result = await db
        .insert(schema.chatMessages)
        .values({ caseId: row.id, sender: "debtor", text })
        .returning({
          id: schema.chatMessages.id,
          createdAt: schema.chatMessages.createdAt,
        });
      const inserted = result[0];
      if (!inserted) {
        throw new Error("sendDebtorMessage: insert returned no rows");
      }
      if (args.image && imageBytes) {
        // 键名 = 消息ID + 32 位随机十六进制，与专员发图/付款截图同规则。
        const key = `chat-images/${inserted.id}-${randomHex(16)}`;
        await ctx.blobs.put(key, imageBytes, {
          contentType: args.image.mimeType,
        });
        await db
          .update(schema.chatMessages)
          .set({ imageBlobKey: key })
          .where(eq(schema.chatMessages.id, inserted.id));
      }
      // 新消息自动分析：与管理员手动「分析这句」同一口径，分析写回消息后
      // 该案还款意愿（computeWillingness 解析分析文本）随之更新。分析失败
      // 不影响消息发送本身，analysis 留空，管理员仍可在面板手动补分析。
      // 纯图消息无文字可分析，直接跳过。
      let analysis = "";
      try {
        analysis =
          text.trim()
            ? (await runDebtorMessageAnalysis(ctx, {
                id: inserted.id,
                caseId: row.id,
                text,
              })) ?? ""
            : "";
      } catch {
        analysis = "";
      }
      // 按最新分析、已确认回款与协议现状，算该案当前还款意愿一并返回。
      const casePays = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.caseId, row.id));
      const caseAgreements = await db
        .select()
        .from(schema.agreements)
        .where(eq(schema.agreements.caseId, row.id));
      const caseChats = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.caseId, row.id))
        .orderBy(asc(schema.chatMessages.id));
      const debtorChats = caseChats.filter((m) => m.sender === "debtor");
      const willingness = computeWillingness({
        totalDueCents: row.totalDueCents,
        matchedRepaidCents: casePays
          .filter((p) => p.reconcileStatus === "matched")
          .reduce((s, p) => s + p.amountCents, 0),
        debtorAnalysesAsc: debtorChats.map((m) => m.analysis),
        debtorMessageCount: debtorChats.length,
        hasActiveAgreement: caseAgreements.some((a) => a.status === "active"),
        hasDoneAgreement: caseAgreements.some((a) => a.status === "done"),
      });
      ctx.invalidateQueries();
      return {
        id: inserted.id,
        createdAt: inserted.createdAt.toISOString(),
        humanTakeover: row.humanTakeoverAt != null,
        muted: false,
        analysis,
        willingness,
      };
    },
  }),

  /* ---------------- 真模型聊天（generateReply） ----------------
     债务人页机器人用真模型（Qwen2.5-14B）生成回复。端点地址存在
     system_settings 单例行的 model_endpoint_url 列（迁移 0023），
     空串 = 未配，走代码默认值（当前长期线 serveo）；轮换监控负责在
     端点变化时更新这一列。模型不可用时一律返回 modelAvailable:false、
     reply:null，不抛错，债务人页回落到关键词规则；机器人回复不写库。
     SYSTEM 模板见模块级常量 GENERATE_REPLY_SYSTEM_TEMPLATE（用户
     自己的回复铁律生产版）。 */

  generateReply: defineAction({
    description:
      "债务人端机器人用真模型生成回复（公开接口，无需登录令牌，债务人页在身份核验通过后调用）：校验案件存在、身份证号归一化一致；禁言案件直接拒绝；人工接管时不调模型、返回 modelAvailable:false。按案件数据拼 SYSTEM 提示词（回复铁律生产版，占位符按本案数值填），调 modelEndpointUrl 的 /v1/chat/completions（Groq qwen/qwen3.8-27b，temperature=0，max_tokens=100，30 秒超时；API key 从环境变量 GROQ_API_KEY 读）。模型不可用（未配端点/超时/非 2xx/解析失败）时返回 modelAvailable:false、reply:null，不抛错，债务人页回落到关键词规则。机器人回复不写库。",
    request: z.object({
      caseId: z.number().int().positive(),
      idCard: z.string().trim().min(18, "身份证号必须为18位").max(18, "身份证号必须为18位"),
      text: z.string().trim().min(1, "消息内容不能为空").max(2000, "消息最长 2000 字"),
      history: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().max(2000),
          }),
        )
        .max(20)
        .default([]),
    }),
    response: z.object({
      reply: z.string().nullable(),
      modelAvailable: z.boolean(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      // 身份证号归一化：去全部空格、转大写，与台账比对时大小写和空格不敏感。
      const idCardNorm = (args.idCard ?? "").replace(/\s+/g, "").toUpperCase();

      // 校验：案件必须存在，且台账身份证号与传来的身份证号归一化后一致。
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.id, args.caseId));
      const row = rows[0];
      if (!row) {
        throw new Error("HTTP400:未找到匹配的案件记录");
      }
      const ledgerNorm = (row.idCard ?? "").replace(/\s+/g, "").toUpperCase();
      if (!ledgerNorm || ledgerNorm !== idCardNorm) {
        throw new Error("HTTP400:身份证号与案件不匹配");
      }
      // 禁言案件直接拒绝（与 sendDebtorMessage 同口径）。
      if (row.mutedAt != null) {
        throw new Error("HTTP400:该账号已被禁言");
      }
      // 人工接管时不调模型，返回不可用，债务人页机器人本来就停答。
      if (row.humanTakeoverAt != null) {
        return { reply: null, modelAvailable: false };
      }
      // 付款核销防线（人工核验入帐，AI 不核验）：模型是纯文本，看不到图片、
      // 查不到银行流水，绝不能让它自行确认到账。债务人最新一条消息带图片，
      // 或本条文字声称已付款/发了截图/问是否收到，一律不调模型，只回固定
      // 转接话术，并把案件标为待人工处理（needsHuman），等专员拿银行流水
      // 在后台对账确认。否则模型会像 2026-11-12 实测那样，对着一张非付款
      // 截图也敢说“到账了，400 元已核销”。
      const PAYMENT_CLAIM_RE =
        /查收|截图|已付|付了|付完|我付|支付了|转了|转过去|打过去|汇过去|已转|已付款|付款了|收到了|收到没|到账了吗|到账了没|到账没|到账了/;
      // 近 3 条里有图只决定回话的措辞，不单独触发：触发条件只有两个——
      // 本条就是带图消息，或本条文字在说付款/追问到账。否则发图后债务人
      // 再说别的（比如“我没钱”），也会被错当成付款消息回“截图已收到”。
      let latestHasImage = false;
      let hasRecentImage = false;
      try {
        const recentDebtor = await db
          .select({ imageBlobKey: schema.chatMessages.imageBlobKey })
          .from(schema.chatMessages)
          .where(
            and(
              eq(schema.chatMessages.caseId, args.caseId),
              eq(schema.chatMessages.sender, "debtor"),
            ),
          )
          .orderBy(desc(schema.chatMessages.id))
          .limit(3);
        latestHasImage = recentDebtor[0]?.imageBlobKey != null;
        hasRecentImage = recentDebtor.some((m) => m.imageBlobKey != null);
      } catch {
        latestHasImage = false;
        hasRecentImage = false;
      }
      if (latestHasImage || PAYMENT_CLAIM_RE.test(args.text)) {
        try {
          await db
            .update(schema.cases)
            .set({ needsHuman: 1 })
            .where(eq(schema.cases.id, args.caseId));
        } catch {
          // 忽略
        }
        if (hasRecentImage) {
          return {
            reply: "请稍等，财务核验中，请稍等。",
            modelAvailable: true,
          };
        }
        return {
          reply: "请上传付款截图，专员核对银行流水后会回复您确认。",
          modelAvailable: true,
        };
      }
      // 减免防线（用户 2026-11-12 亲定：减免也得人工）：债务人一提减免，
      // 不调模型，只回固定转接话术，并把案件标为待人工处理，等专员谈。
      // 正则只认减免说法（“多少”不触发），与消息分析的减免意图同口径。
      const WAIVER_ASK_RE =
        /减免|优惠|便宜|打折|能不能少|能减|少还|少付|少一?点|减点|抹个零|免掉/;
      if (WAIVER_ASK_RE.test(args.text)) {
        try {
          await db
            .update(schema.cases)
            .set({ needsHuman: 1 })
            .where(eq(schema.cases.id, args.caseId));
        } catch {
          // 忽略
        }
        return {
          reply:
            "您的减免申请正在由专员处理，专员会尽快与您联系协商减免方案，请您稍候。",
          modelAvailable: true,
        };
      }
      // 分期防线（用户 2026-11-12 亲定：分期也得人工，方案由专员给）：
      // 债务人一提分期，不调模型，只回固定转接话术，并把案件标为待人工
      // 处理，等专员谈方案。机器人不再报 6 期/12 期每期数。
      const INSTALLMENT_ASK_RE = /分期|每月|按月|月供|分几期|分期付款|月还/;
      if (INSTALLMENT_ASK_RE.test(args.text)) {
        try {
          await db
            .update(schema.cases)
            .set({ needsHuman: 1 })
            .where(eq(schema.cases.id, args.caseId));
        } catch {
          // 忽略
        }
        return {
          reply:
            "您的分期申请正在由专员处理，专员会尽快与您联系协商分期方案，请您稍候。",
          modelAvailable: true,
        };
      }
      // 端点地址：库里配了用库里的，没配用代码默认值。
      const endpoint = (await loadModelEndpointUrl(ctx)).trim();
      if (!endpoint) {
        return { reply: null, modelAvailable: false };
      }
      // API key：库里 model_api_key 优先，没有读环境变量 GROQ_API_KEY。
      const apiKey = await loadModelApiKey(ctx);
      // SYSTEM 提示词按本案数值填好；history 只取最近 6 条当上下文。
      // 已学成功话术一并拼进提示词当示范。
      // 后台话术与关键词规则同一套 chat_scripts 表：后台改完，AI 即用同一套。
      const learned = await loadLearnedScripts(ctx);
      let scripts: ChatScriptsData | null = null;
      try {
        scripts = await loadChatScripts(ctx);
      } catch {
        scripts = null;
      }
      const system = buildGenerateReplySystem(row, learned, scripts);
      const history = (args.history ?? []).slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const messages = [
        { role: "system", content: system },
        ...history,
        { role: "user", content: args.text },
      ];
      // 调模型：任何失败（超时/非 2xx/解析失败/空回复）都返回不可用，
      // 不抛错，让债务人页回落到关键词规则。免费隧道（pinggy/serveo）
      // 偶发连接重置（ECONNRESET，Bun fetch 瞬间抛错，curl 不复现），
      // 瞬间失败（<5 秒）时等 1 秒重试一次；慢失败（模型真超时）不重试，
      // 前端 30 秒超时在即，重试也来不及。另：强制 Connection: close，
      // 隧道重启后旧 keep-alive 连接会半死（复用即挂 30 秒或 RST），
      // 每次新建连接可避开这个问题（与 curl 每次新建连接同理）。
      const url = `${endpoint.replace(/\/+$/, "")}/v1/chat/completions`;
      const body = JSON.stringify({
        model: "qwen/qwen3.8-27b",
        messages,
        temperature: 0.5,
        max_tokens: 200,
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        const startedAt = Date.now();
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
              Connection: "close",
            },
            body,
            signal: AbortSignal.timeout(30000),
          });
          if (!res.ok) {
            if (attempt === 0 && Date.now() - startedAt < 5000) {
              await new Promise((r) => setTimeout(r, 1000));
              continue;
            }
            return { reply: null, modelAvailable: false };
          }
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: unknown } }>;
          };
          const content = data?.choices?.[0]?.message?.content;
          if (typeof content !== "string" || !content.trim()) {
            return { reply: null, modelAvailable: false };
          }
          const replyText = content.trim();
          // 记模型回复流水：付款后凭它提进成功话术库。写库失败不影响回话。
          try {
            await db.insert(schema.modelReplies).values({
              caseId: args.caseId,
              trigger: args.text,
              reply: replyText,
            });
          } catch {
            // 忽略
          }
          return { reply: replyText, modelAvailable: true };
        } catch {
          if (attempt === 0 && Date.now() - startedAt < 5000) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          return { reply: null, modelAvailable: false };
        }
      }
      return { reply: null, modelAvailable: false };
    },
  }),

  setHumanTakeover: defineAction({
    description:
      "设置案件聊天的人工接管状态（需「接管」权限，操作员默认有、管理员可在权限管理里回收：未登录 401、无此权限 403）：takeover=true 写入接管时间（债务人页机器人停答、显示专员在线），false 清除回到机器人值守。返回切换后的接管状态。",
    request: z.object({
      caseId: z.number().int().positive(),
      takeover: z.boolean(),
    }),
    response: z.object({ ok: z.boolean(), humanTakeover: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await assertCaseVisible(ctx, args.caseId);
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.id, args.caseId))
        .limit(1);
      if (!rows[0]) throw new Error("未找到对应案件。");
      await db
        .update(schema.cases)
        .set({
          humanTakeoverAt: args.takeover ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.cases.id, args.caseId));
      ctx.invalidateQueries();
      return { ok: true, humanTakeover: args.takeover };
    },
  }),

  setCaseMuted: defineAction({
    description:
      "设置案件债务人的禁言状态（需「禁言」权限，管理员与操作员默认都有、管理员可在权限管理里按人回收：未登录 401、无此权限 403）：muted=true 写入禁言时间并记经手人显示名，之后该债务人通过 sendDebtorMessage 发消息会被直接拒绝（文案「该账号已被禁言」），债务人页据 getDebtorChat 返回的 muted 禁用输入框；muted=false 清除禁言恢复发送。禁言只能手动设置/解除，本系统没有自动禁言。返回切换后的禁言状态。",
    request: z.object({
      caseId: z.number().int().positive(),
      muted: z.boolean(),
    }),
    response: z.object({ ok: z.boolean(), muted: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await assertCaseVisible(ctx, args.caseId);
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.id, args.caseId))
        .limit(1);
      if (!rows[0]) throw new Error("未找到对应案件。");
      await db
        .update(schema.cases)
        .set({
          mutedAt: args.muted ? new Date() : null,
          mutedBy: args.muted ? sessionActorName(currentSession(ctx)) : "",
          updatedAt: new Date(),
        })
        .where(eq(schema.cases.id, args.caseId));
      ctx.invalidateQueries();
      return { ok: true, muted: args.muted };
    },
  }),

  analyzeChatMessage: defineAction({
    description: "对债务人的一句话做协商分析：还款意愿、态度信号、风险点与建议话术，结果存回这条消息。",
    request: z.object({ messageId: z.number().int().positive() }),
    response: z.object({ ok: z.boolean(), analysis: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.id, args.messageId))
        .limit(1);
      const msg = rows[0];
      if (!msg) return { ok: false, analysis: "" };
      await assertCaseVisible(ctx, msg.caseId);
      // 纯图片消息（无文字）没有可分析的发言内容：不调模型、不编造，直接返回空。
      if (!msg.text.trim()) return { ok: false, analysis: "" };
      const analysis = await runDebtorMessageAnalysis(ctx, msg);
      if (!analysis) return { ok: false, analysis: "" };
      ctx.invalidateQueries();
      return { ok: true, analysis };
    },
  }),

  deleteChatMessage: defineAction({
    description: "删除一条聊天协商消息；消息带图片时一并删除 blobs 里的图片。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.id, args.id))
        .limit(1);
      const row = rows[0];
      if (row) await assertCaseVisible(ctx, row.caseId);
      const archiveId = row ? await archiveData(ctx, "chat_message", args.id, String((row as Record<string, unknown>).text ?? ""), row) : null;
      await db
        .delete(schema.chatMessages)
        .where(eq(schema.chatMessages.id, args.id));
      await logAudit(ctx, "delete_chat_message", "chat_message", args.id, `删除聊天消息 ${args.id}，回收站 ${archiveId ?? "归档失败"}`);
      if (row?.imageBlobKey) {
        try {
          await ctx.blobs.delete(row.imageBlobKey);
        } catch {
          /* 图片文件已不在也不拦删除 */
        }
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setNeedsHuman: defineAction({
    description: "把案件聊天标记为转人工（或取消转人工），并记录转人工原因。",
    request: z.object({
      caseId: z.number().int().positive(),
      needsHuman: z.boolean(),
      humanNote: z.string().default(""),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await assertCaseVisible(ctx, args.caseId);
      await db
        .update(schema.cases)
        .set({
          needsHuman: args.needsHuman ? 1 : 0,
          humanNote: args.humanNote,
          updatedAt: new Date(),
        })
        .where(eq(schema.cases.id, args.caseId));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addAgreement: defineAction({
    description: "给案件新增一条协商事项：分期方案、减免方案或结清证明。",
    request: z.object({
      caseId: z.number().int().positive(),
      kind: z.enum(["installment", "waiver", "settlement"]),
      detail: z.string().min(1, "内容不能为空"),
      amountCents: z.number().int().min(0).default(0),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await assertCaseVisible(ctx, args.caseId);
      const result = await db
        .insert(schema.agreements)
        .values({
          ...args,
          status: "active",
          createdBy: sessionActorName(currentSession(ctx)),
        })
        .returning({ id: schema.agreements.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addAgreement: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateAgreementStatus: defineAction({
    description: "更新协商事项状态：生效中、已办结或已作废（结清证明办结即代表已出具）。",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["active", "done", "void"]),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const agRows = await db
        .select()
        .from(schema.agreements)
        .where(eq(schema.agreements.id, args.id))
        .limit(1);
      if (agRows[0]) await assertCaseVisible(ctx, agRows[0].caseId);
      await db
        .update(schema.agreements)
        .set({ status: args.status })
        .where(eq(schema.agreements.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteAgreement: defineAction({
    description: "删除一条协商事项。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const agRows = await db
        .select()
        .from(schema.agreements)
        .where(eq(schema.agreements.id, args.id))
        .limit(1);
      if (agRows[0]) await assertCaseVisible(ctx, agRows[0].caseId);
      const archiveId = agRows[0] ? await archiveData(ctx, "agreement", args.id, String((agRows[0] as Record<string, unknown>).title ?? (agRows[0] as Record<string, unknown>).content ?? ""), agRows[0]) : null;
      await db
        .delete(schema.agreements)
        .where(eq(schema.agreements.id, args.id));
      await logAudit(ctx, "delete_agreement", "agreement", args.id, `删除协商事项 ${args.id}，回收站 ${archiveId ?? "归档失败"}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---------------- 还款确认 ---------------- */

  getPayments: defineAction({
    description: "读取一个案件的全部还款记录及累计已对平金额。",
    request: z.object({ caseId: z.number().int().positive() }),
    response: z.object({
      payments: z.array(paymentOut),
      matchedTotalCents: z.number(),
      recordedTotalCents: z.number(),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await assertCaseVisible(ctx, args.caseId);
      const rows = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.caseId, args.caseId))
        .orderBy(desc(schema.payments.id));
      return {
        payments: rows.map((p) => ({
          id: p.id,
          caseId: p.caseId,
          amountCents: p.amountCents,
          paidOn: p.paidOn,
          note: p.note,
          recordedBy: p.recordedBy ?? "",
          hasScreenshot: p.screenshotBlobKey != null,
          reconcileStatus: p.reconcileStatus,
          createdAt: p.createdAt.toISOString(),
        })),
        matchedTotalCents: rows
          .filter((p) => p.reconcileStatus === "matched")
          .reduce((s, p) => s + p.amountCents, 0),
        recordedTotalCents: rows.reduce((s, p) => s + p.amountCents, 0),
      };
    },
  }),

  addPayment: defineAction({
    description: "登记一笔还款：金额、还款日期、备注，并可附债务人上传的付款截图。",
    request: z.object({
      caseId: z.number().int().positive(),
      amountCents: z.number().int().min(1, "还款金额必须大于 0"),
      paidOn: z.string().default(""),
      note: z.string().default(""),
      screenshot: z
        .object({ dataBase64: z.string(), mimeType: z.string() })
        .optional(),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await assertCaseVisible(ctx, args.caseId);
      const result = await db
        .insert(schema.payments)
        .values({
          caseId: args.caseId,
          amountCents: args.amountCents,
          paidOn: args.paidOn,
          note: args.note,
          recordedBy: sessionActorName(currentSession(ctx)),
        })
        .returning({ id: schema.payments.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addPayment: insert returned no rows");
      if (args.screenshot) {
        // 键名 = 付款ID + 随机串：旧格式只有自增 ID、可被逐个枚举猜出，
        // 加 16 字节随机串后地址不可猜；键只存 payments.screenshot_blob_key，
        // 查看仍走需登录的 getPaymentScreenshot。
        const key = `payment-screenshots/${inserted.id}-${randomBytesBase64Url(16)}`;
        const bytes = Buffer.from(args.screenshot.dataBase64, "base64");
        await ctx.blobs.put(key, bytes, {
          contentType: args.screenshot.mimeType,
        });
        await db
          .update(schema.payments)
          .set({ screenshotBlobKey: key })
          .where(eq(schema.payments.id, inserted.id));
      }
      ctx.invalidateQueries();
      // 登记还款 = 成功信号：把该案近期模型回复提进成功话术库（去重）。
      try {
        await promoteLearnedScripts(ctx, args.caseId);
      } catch {
        // 忽略
      }
      return { id: inserted.id };
    },
  }),

  submitPaymentScreenshot: defineAction({
    description:
      "债务人公开上传付款截图（无需登录令牌，债务人端调用）：债务人核验通过后在聊天里点「我已付款」，选图、填金额上传。后端双重校验——caseId 对应的案件必须存在，且该案件台账上的身份证号与传来的 idCard 归一化后（去空格、转大写）一致，不一致直接拒绝；金额必须大于 0，截图必填且只收图片。校验通过后往还款记录插入一笔（状态默认待对账），截图按与 addPayment 相同的「付款ID + 随机串」规则存入 blobs，返回新付款记录 id。限流与核验同口径：同一身份证号 10 分钟内最多 20 次（verify_attempts 表计数，被限流时抛限流文案，生产分发层按文案映射 429），全站 10 分钟 600 次兜底；生产 HTTP 层另按 IP 做同口径限流。",
    request: z.object({
      caseId: z.number().int().positive(),
      idCard: z.string().trim().min(18, "身份证号必须为18位").max(18, "身份证号必须为18位"),
      amountCents: z.number().int().min(1, "还款金额必须大于 0"),
      paidOn: z.string().min(1, "请填写还款日期"),
      note: z.string().default(""),
      screenshot: z.object({
        dataBase64: z.string().min(1, "付款截图不能为空"),
        mimeType: z.string().regex(/^image\//, "截图必须是图片"),
      }),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      // 身份证号归一化：去全部空格、转大写，与台账比对时大小写和空格不敏感。
      const idCardNorm = (args.idCard ?? "").replace(/\s+/g, "").toUpperCase();
      if (!/^\d{17}[0-9X]$/.test(idCardNorm)) {
        throw new Error("身份证号格式不正确，请核对后重试。");
      }
      if (!args.screenshot.mimeType.toLowerCase().startsWith("image/")) {
        throw new Error("只支持上传图片，请重新选择付款截图。");
      }
      // 限流与核验同口径（库表持久化，串行检查+记入，防并发超发）。
      await checkVerifyRateLimit(db, idCardNorm, "", "payment");
      // 双重校验：案件必须存在，且台账身份证号与传来的身份证号归一化后一致。
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.id, args.caseId));
      const row = rows[0];
      if (!row) {
        throw new Error("HTTP400:未找到匹配的案件记录");
      }
      const ledgerNorm = (row.idCard ?? "").replace(/\s+/g, "").toUpperCase();
      if (!ledgerNorm || ledgerNorm !== idCardNorm) {
        throw new Error("HTTP400:身份证号与案件不匹配");
      }
      // 先校验截图大小再插行：超大拒收不留孤儿待确认记录。
      const bytes = Buffer.from(args.screenshot.dataBase64, "base64");
      if (bytes.length > 5 * 1024 * 1024) {
        throw new Error("HTTP400:截图文件过大，请上传 5MB 以内的图片");
      }
      const result = await db
        .insert(schema.payments)
        .values({
          caseId: row.id,
          amountCents: args.amountCents,
          paidOn: args.paidOn,
          note: args.note,
          recordedBy: "债务人自助提交",
        })
        .returning({ id: schema.payments.id });
      const inserted = result[0];
      if (!inserted) throw new Error("submitPaymentScreenshot: insert returned no rows");
      // 截图键与 addPayment 同规则：付款ID + 16 字节随机串，地址不可枚举猜出。
      const key = `payment-screenshots/${inserted.id}-${randomBytesBase64Url(16)}`;
      await ctx.blobs.put(key, bytes, {
        contentType: args.screenshot.mimeType,
      });
      await db
        .update(schema.payments)
        .set({ screenshotBlobKey: key })
        .where(eq(schema.payments.id, inserted.id));
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  setPaymentReconcile: defineAction({
    description: "给一笔还款做银行对账标记：待对账、已对平或对不上。v17：状态首次变为 matched（回款对平、还款成功）时，先从该案聊天提炼技巧进库（待确认），再删该债务人的全部聊天记录（先提炼后删）；已是 matched 时重复标记不再触发。",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["pending", "matched", "mismatch"]),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const payRows = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, args.id))
        .limit(1);
      if (payRows[0]) await assertCaseVisible(ctx, payRows[0].caseId);
      const prevStatus = payRows[0]?.reconcileStatus;
      await db
        .update(schema.payments)
        .set({ reconcileStatus: args.status })
        .where(eq(schema.payments.id, args.id));
      // v17 学后删：首次对平才触发（重复标记 matched 不重复提炼/删聊）。
      if (
        args.status === "matched" &&
        prevStatus !== "matched" &&
        payRows[0]
      ) {
        await learnThenDeleteChat(ctx, payRows[0].caseId);
        // 对平 = 成功信号：把该案近期模型回复提进成功话术库（去重）。
        try {
          await promoteLearnedScripts(ctx, payRows[0].caseId);
        } catch {
          // 忽略
        }
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deletePayment: defineAction({
    description: "删除一笔还款记录。删除前先快照进回收站，删错了可以恢复。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const payRows = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, args.id))
        .limit(1);
      if (payRows[0]) await assertCaseVisible(ctx, payRows[0].caseId);
      const archiveId = await archivePayment(ctx, args.id);
      await db
        .delete(schema.payments)
        .where(eq(schema.payments.id, args.id));
      await logAudit(ctx, "delete_payment", "payment", args.id, `删除还款记录 ${args.id}（案件 ${payRows[0]?.caseId ?? ""}），回收站 ${archiveId ?? "归档失败"}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getPaymentScreenshot: defineAction({
    description: "取一笔还款的付款截图查看地址，没有截图时返回 null。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ url: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.id, args.id))
        .limit(1);
      const row = rows[0];
      if (!row?.screenshotBlobKey) return { url: null };
      await assertCaseVisible(ctx, row.caseId);
      const url = await ctx.blobs.getUrl(row.screenshotBlobKey);
      return { url: url ?? null };
    },
  }),

  /* ---------------- 首页内容：审结案件 + 律师动态 ---------------- */

  getHomepageContent: defineAction({
    description: "读取债务人网页首页展示的全部内容：系统名称、近期法院审结案件、律师工作动态、保全划扣板块、今日已还款、顶部执行状态滚动条、失信惩戒、聊天付款卡设置（专员收款方式）、首页对公账号设置、律师工作进度（办理进度时间轴）与账单示例（后台改动即网页同步；新板块后端无数据时返回空列表/空对象，网页按现有占位显示）。",
    request: z.object({}),
    response: z.object({
      systemName: z.string(),
      courtCases: z.array(courtCaseOut),
      lawyerUpdates: z.array(lawyerUpdateOut),
      preservation: z.object({
        settings: preservationSettingsOut,
        chainSteps: z.array(chainStepOut),
        feedItems: z.array(feedItemOut),
      }),
      todayRepayments: z.array(todayRepaymentOut),
      tickerItems: z.array(tickerItemOut),
      punishmentItems: z.array(punishmentItemOut),
      paymentSettings: paymentSettingsOut,
      corporateAccount: corporateAccountOut,
      lawyerProgress: z.array(lawyerProgressStepOut),
      demoBill: demoBillOut,
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      await ensurePreservationSeeded(ctx);
      const cc = await db
        .select()
        .from(schema.courtCases)
        .orderBy(asc(schema.courtCases.sortOrder), desc(schema.courtCases.id));
      const lu = await db
        .select()
        .from(schema.lawyerUpdates)
        .orderBy(asc(schema.lawyerUpdates.sortOrder), desc(schema.lawyerUpdates.id));
      return {
        systemName: await loadSystemName(ctx),
        courtCases: cc.map((r) => ({
          id: r.id,
          caseNo: r.caseNo,
          courtName: r.courtName,
          debtorLabel: r.debtorLabel,
          amountCents: r.amountCents,
          outcome: r.outcome,
          concludedOn: r.concludedOn,
          visible: r.visible === 1,
          sortOrder: r.sortOrder,
        })),
        lawyerUpdates: lu.map((r) => ({
          id: r.id,
          title: r.title,
          detail: r.detail,
          occurredOn: r.occurredOn,
          visible: r.visible === 1,
          sortOrder: r.sortOrder,
        })),
        preservation: await loadPreservation(ctx),
        ...(await loadHomepageExtras(ctx)),
      };
    },
  }),

  addCourtCase: defineAction({
    description: "往网页首页「近期法院审结」新增一条审结案件，保存后网页即显示。",
    request: z.object({
      caseNo: z.string().min(1, "案号不能为空"),
      courtName: z.string().default(""),
      debtorLabel: z.string().default(""),
      amountCents: z.number().int().min(0).default(0),
      outcome: z.string().default(""),
      concludedOn: z.string().default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.courtCases);
      const result = await db
        .insert(schema.courtCases)
        .values({ ...args, visible: 1, sortOrder: existing.length })
        .returning({ id: schema.courtCases.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addCourtCase: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateCourtCase: defineAction({
    description: "编辑一条首页审结案件的内容或显示开关。",
    request: z.object({
      id: z.number().int().positive(),
      caseNo: z.string().min(1, "案号不能为空"),
      courtName: z.string().default(""),
      debtorLabel: z.string().default(""),
      amountCents: z.number().int().min(0).default(0),
      outcome: z.string().default(""),
      concludedOn: z.string().default(""),
      visible: z.boolean(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, visible, ...fields } = args;
      await db
        .update(schema.courtCases)
        .set({ ...fields, visible: visible ? 1 : 0 })
        .where(eq(schema.courtCases.id, id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteCourtCase: defineAction({
    description: "删除一条首页审结案件，网页随即不再显示。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.courtCases).where(eq(schema.courtCases.id, args.id)).limit(1);
      const row = rows[0] as Record<string, unknown> | undefined;
      const archiveId = row ? await archiveData(ctx, "court_case", args.id, String(row?.caseNo ?? row?.title ?? ''), row) : null;
      await db.delete(schema.courtCases).where(eq(schema.courtCases.id, args.id));
      await logAudit(ctx, "delete_court_case", "court_case", args.id, `删除 court_case ${args.id}，回收站 ${archiveId ?? "归档失败"}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addLawyerUpdate: defineAction({
    description: "往网页首页「律师工作动态」新增一条动态，保存后网页即显示。",
    request: z.object({
      title: z.string().min(1, "标题不能为空"),
      detail: z.string().default(""),
      occurredOn: z.string().default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.lawyerUpdates);
      const result = await db
        .insert(schema.lawyerUpdates)
        .values({ ...args, visible: 1, sortOrder: existing.length })
        .returning({ id: schema.lawyerUpdates.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addLawyerUpdate: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateLawyerUpdate: defineAction({
    description: "编辑一条律师工作动态的内容或显示开关。",
    request: z.object({
      id: z.number().int().positive(),
      title: z.string().min(1, "标题不能为空"),
      detail: z.string().default(""),
      occurredOn: z.string().default(""),
      visible: z.boolean(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, visible, ...fields } = args;
      await db
        .update(schema.lawyerUpdates)
        .set({ ...fields, visible: visible ? 1 : 0 })
        .where(eq(schema.lawyerUpdates.id, id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteLawyerUpdate: defineAction({
    description: "删除一条律师工作动态，网页随即不再显示。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.lawyerUpdates).where(eq(schema.lawyerUpdates.id, args.id)).limit(1);
      const row = rows[0] as Record<string, unknown> | undefined;
      const archiveId = row ? await archiveData(ctx, "lawyer_update", args.id, String(row?.title ?? row?.content ?? ''), row) : null;
      await db.delete(schema.lawyerUpdates).where(eq(schema.lawyerUpdates.id, args.id));
      await logAudit(ctx, "delete_lawyer_update", "lawyer_update", args.id, `删除 lawyer_update ${args.id}，回收站 ${archiveId ?? "归档失败"}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---------------- 首页内容：保全划扣 ---------------- */

  updatePreservationSettings: defineAction({
    description:
      "保存保全划扣板块设置：板块说明、冻结微信/支付宝支付功能卡（标题、正文、卡内记录）与失信说明，保存后网页即同步。",
    request: z.object({
      sectionIntro: z.string().default(""),
      freezeTitle: z.string().min(1, "冻结卡标题不能为空"),
      freezeBody: z.string().default(""),
      freezeCaseSource: z.string().default(""),
      freezeCaseText: z.string().default(""),
      freezeVisible: z.boolean(),
      dishonestNote: z.string().default(""),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await ensurePreservationSeeded(ctx);
      const rows = await db.select().from(schema.preservationSettings);
      const row = rows[0];
      const values = {
        sectionIntro: args.sectionIntro,
        freezeTitle: args.freezeTitle,
        freezeBody: args.freezeBody,
        freezeCaseSource: args.freezeCaseSource,
        freezeCaseText: args.freezeCaseText,
        freezeVisible: args.freezeVisible ? 1 : 0,
        dishonestNote: args.dishonestNote,
      };
      if (row) {
        await db
          .update(schema.preservationSettings)
          .set(values)
          .where(eq(schema.preservationSettings.id, row.id));
      } else {
        await db.insert(schema.preservationSettings).values(values);
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  updateChainStep: defineAction({
    description: "编辑保全划扣三步链中的一步（步骤名、标题、说明），保存后网页即同步。",
    request: z.object({
      id: z.number().int().positive(),
      stepLabel: z.string().default(""),
      title: z.string().min(1, "步骤标题不能为空"),
      detail: z.string().default(""),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, ...fields } = args;
      await db
        .update(schema.preservationChainSteps)
        .set(fields)
        .where(eq(schema.preservationChainSteps.id, id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addFeedItem: defineAction({
    description: "往保全划扣「执行动态」新增一条记录（选择所属步骤：冻结/划扣/列入失信），保存后网页即显示。",
    request: z.object({
      stepNo: z.number().int().min(1).max(3),
      sourceLabel: z.string().default(""),
      tag: z.string().default(""),
      title: z.string().min(1, "标题不能为空"),
      detail: z.string().default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.preservationFeedItems)
        .where(eq(schema.preservationFeedItems.stepNo, args.stepNo));
      const result = await db
        .insert(schema.preservationFeedItems)
        .values({ ...args, visible: 1, sortOrder: existing.length })
        .returning({ id: schema.preservationFeedItems.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addFeedItem: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateFeedItem: defineAction({
    description: "编辑一条保全划扣执行动态的内容、所属步骤或显示开关，保存后网页即同步。",
    request: z.object({
      id: z.number().int().positive(),
      stepNo: z.number().int().min(1).max(3),
      sourceLabel: z.string().default(""),
      tag: z.string().default(""),
      title: z.string().min(1, "标题不能为空"),
      detail: z.string().default(""),
      visible: z.boolean(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, visible, ...fields } = args;
      await db
        .update(schema.preservationFeedItems)
        .set({ ...fields, visible: visible ? 1 : 0 })
        .where(eq(schema.preservationFeedItems.id, id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteFeedItem: defineAction({
    description: "删除一条保全划扣执行动态，网页随即不再显示。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.preservationFeedItems).where(eq(schema.preservationFeedItems.id, args.id)).limit(1);
      const row = rows[0] as Record<string, unknown> | undefined;
      const archiveId = row ? await archiveData(ctx, "feed_item", args.id, String(row?.title ?? row?.content ?? ''), row) : null;
      await db.delete(schema.preservationFeedItems).where(eq(schema.preservationFeedItems.id, args.id));
      await logAudit(ctx, "delete_feed_item", "feed_item", args.id, `删除 feed_item ${args.id}，回收站 ${archiveId ?? "归档失败"}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---------------- 首页内容：今日已还款 ---------------- */

  addTodayRepayment: defineAction({
    description: "往网页首页「今日已还款」新增一条还款记录（脱敏姓名、地区、金额、时间、结清方式），保存后网页即显示。",
    request: z.object({
      nameMasked: z.string().min(1, "姓名不能为空"),
      region: z.string().default(""),
      amountCents: z.number().int().min(0).default(0),
      timeText: z.string().default(""),
      kind: z.enum(["full", "installment", "partial"]).default("full"),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.todayRepayments);
      const result = await db
        .insert(schema.todayRepayments)
        .values({ ...args, visible: 1, sortOrder: existing.length })
        .returning({ id: schema.todayRepayments.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addTodayRepayment: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateTodayRepayment: defineAction({
    description: "编辑一条「今日已还款」记录的内容或显示开关，保存后网页即同步。",
    request: z.object({
      id: z.number().int().positive(),
      nameMasked: z.string().min(1, "姓名不能为空"),
      region: z.string().default(""),
      amountCents: z.number().int().min(0).default(0),
      timeText: z.string().default(""),
      kind: z.enum(["full", "installment", "partial"]),
      visible: z.boolean(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, visible, ...fields } = args;
      await db
        .update(schema.todayRepayments)
        .set({ ...fields, visible: visible ? 1 : 0 })
        .where(eq(schema.todayRepayments.id, id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteTodayRepayment: defineAction({
    description: "删除一条「今日已还款」记录，网页随即不再显示。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.todayRepayments).where(eq(schema.todayRepayments.id, args.id)).limit(1);
      const row = rows[0] as Record<string, unknown> | undefined;
      const archiveId = row ? await archiveData(ctx, "today_repayment", args.id, String(row?.debtorName ?? row?.name ?? ''), row) : null;
      await db.delete(schema.todayRepayments).where(eq(schema.todayRepayments.id, args.id));
      await logAudit(ctx, "delete_today_repayment", "today_repayment", args.id, `删除 today_repayment ${args.id}，回收站 ${archiveId ?? "归档失败"}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---------------- 首页内容：顶部执行状态滚动条 ---------------- */

  addTickerItem: defineAction({
    description: "往网页顶部执行状态滚动条新增一条播报文本，保存后网页即显示。",
    request: z.object({
      text: z.string().min(1, "播报文本不能为空"),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.tickerItems);
      const result = await db
        .insert(schema.tickerItems)
        .values({ ...args, visible: 1, sortOrder: existing.length })
        .returning({ id: schema.tickerItems.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addTickerItem: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateTickerItem: defineAction({
    description: "编辑一条顶部执行状态滚动条播报文本或显示开关，保存后网页即同步。",
    request: z.object({
      id: z.number().int().positive(),
      text: z.string().min(1, "播报文本不能为空"),
      visible: z.boolean(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, visible, ...fields } = args;
      await db
        .update(schema.tickerItems)
        .set({ ...fields, visible: visible ? 1 : 0 })
        .where(eq(schema.tickerItems.id, id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteTickerItem: defineAction({
    description: "删除一条顶部执行状态滚动条播报，网页随即不再显示。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.tickerItems).where(eq(schema.tickerItems.id, args.id)).limit(1);
      const row = rows[0] as Record<string, unknown> | undefined;
      const archiveId = row ? await archiveData(ctx, "ticker_item", args.id, String(row?.text ?? row?.content ?? ''), row) : null;
      await db.delete(schema.tickerItems).where(eq(schema.tickerItems.id, args.id));
      await logAudit(ctx, "delete_ticker_item", "ticker_item", args.id, `删除 ticker_item ${args.id}，回收站 ${archiveId ?? "归档失败"}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---------------- 首页内容：失信惩戒 ---------------- */

  addPunishmentItem: defineAction({
    description: "往网页「失信惩戒」新增一条惩戒内容（标题+说明），保存后网页即显示。",
    request: z.object({
      title: z.string().min(1, "标题不能为空"),
      detail: z.string().default(""),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.punishmentItems);
      const result = await db
        .insert(schema.punishmentItems)
        .values({ ...args, visible: 1, sortOrder: existing.length })
        .returning({ id: schema.punishmentItems.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addPunishmentItem: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updatePunishmentItem: defineAction({
    description: "编辑一条失信惩戒内容（标题、说明）或显示开关，保存后网页即同步。",
    request: z.object({
      id: z.number().int().positive(),
      title: z.string().min(1, "标题不能为空"),
      detail: z.string().default(""),
      visible: z.boolean(),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, visible, ...fields } = args;
      await db
        .update(schema.punishmentItems)
        .set({ ...fields, visible: visible ? 1 : 0 })
        .where(eq(schema.punishmentItems.id, id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deletePunishmentItem: defineAction({
    description: "删除一条失信惩戒内容，网页随即不再显示。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.punishmentItems).where(eq(schema.punishmentItems.id, args.id)).limit(1);
      const row = rows[0] as Record<string, unknown> | undefined;
      const archiveId = row ? await archiveData(ctx, "punishment_item", args.id, String(row?.title ?? row?.content ?? ''), row) : null;
      await db.delete(schema.punishmentItems).where(eq(schema.punishmentItems.id, args.id));
      await logAudit(ctx, "delete_punishment_item", "punishment_item", args.id, `删除 punishment_item ${args.id}，回收站 ${archiveId ?? "归档失败"}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---------------- 首页内容：聊天付款卡设置 ---------------- */

  updatePaymentSettings: defineAction({
    description:
      "保存聊天付款卡设置整组内容：收款人、开户行、账号、收款二维码图片地址与付款说明文字，保存后网页聊天即同步。",
    request: z.object({
      payeeName: z.string().default(""),
      bankName: z.string().default(""),
      accountNo: z.string().default(""),
      qrImageUrl: z.string().default(""),
      note: z.string().default(""),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.paymentSettings);
      const row = rows[0];
      if (row) {
        await db
          .update(schema.paymentSettings)
          .set({ ...args })
          .where(eq(schema.paymentSettings.id, row.id));
      } else {
        await db.insert(schema.paymentSettings).values({ ...args });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---------------- 首页内容：对公账号设置 ---------------- */
  /* 首页收款区填公司对公账号，与聊天付款卡（专员收款方式）分开设置、
     分开保存。保存后债务人页首页收款户名/开户银行/收款账号/收款二维码即同步。 */

  updateCorporateAccount: defineAction({
    description:
      "保存首页对公账号设置整组内容：收款户名、开户银行、收款账号、收款二维码图片地址，保存后债务人页首页收款区即同步。",
    request: z.object({
      payeeName: z.string().default(""),
      bankName: z.string().default(""),
      accountNo: z.string().default(""),
      qrImageUrl: z.string().default(""),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.corporateAccount);
      const row = rows[0];
      if (row) {
        await db
          .update(schema.corporateAccount)
          .set({ ...args })
          .where(eq(schema.corporateAccount.id, row.id));
      } else {
        await db.insert(schema.corporateAccount).values({ ...args });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---------------- 首页内容：律师工作进度（办理进度时间轴） ---------------- */

  updateLawyerProgress: defineAction({
    description:
      "保存律师工作进度（办理进度时间轴）整组步骤：每步标题、说明、日期标注与状态（done 已完成 / now 进行中 / todo 待进行），按列表顺序保存，保存后债务人页办理进度即同步。未保存过时网页用默认进度（当前在入户调查这一步）。",
    request: z.object({
      steps: z
        .array(
          z.object({
            title: z.string().trim().min(1, "步骤标题不能为空").max(60),
            description: z.string().max(200).default(""),
            dateLabel: z.string().max(20).default(""),
            state: z.enum(["done", "now", "todo"]),
          }),
        )
        .min(1, "至少保留一个步骤")
        .max(20),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db.delete(schema.lawyerProgressSteps);
      await db.insert(schema.lawyerProgressSteps).values(
        args.steps.map((s, i) => ({
          sortOrder: i,
          title: s.title,
          description: s.description,
          dateLabel: s.dateLabel,
          state: s.state,
        })),
      );
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---------------- 首页内容：账单示例（演示账单） ---------------- */

  updateDemoBill: defineAction({
    description:
      "保存账单示例（演示账单）整组内容：债务人姓名、案件编号、应还总额、本金、罚息、逾期天数、原债权方与转让协议编号，保存后网页即同步。",
    request: z.object({
      debtorName: z.string().default(""),
      caseNo: z.string().default(""),
      totalDueCents: z.number().int().min(0).default(0),
      principalCents: z.number().int().min(0).default(0),
      penaltyCents: z.number().int().min(0).default(0),
      overdueDays: z.number().int().min(0).default(0),
      originalCreditor: z.string().default(""),
      transferAgreementNo: z.string().default(""),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.demoBill);
      const row = rows[0];
      if (row) {
        await db
          .update(schema.demoBill)
          .set({ ...args })
          .where(eq(schema.demoBill.id, row.id));
      } else {
        await db.insert(schema.demoBill).values({ ...args });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ---------------- 后台登录 ---------------- */

  getAuthStatus: defineAction({
    description: "查询后台登录设置状态：密码是否已经设置、用户账号是否被管理员停用。",
    request: z.object({}),
    response: z.object({ configured: z.boolean(), userDisabled: z.boolean() }),
    async handler(ctx) {
      const row = await loadCredentials(ctx);
      return { configured: !!row, userDisabled: row?.userDisabled === 1 };
    },
  }),

  setupPasswords: defineAction({
    description:
      "首次打开后台时设置管理员密码与用户密码（仅在尚未设置时可用），设置成功后直接以管理员身份进入后台。用户密码同时成为第一个操作员账号（用户名 user）的密码——多用户登录自此开始，原密码继续能登录。",
    request: z.object({
      adminPassword: z.string().min(4, "管理员密码至少 4 位"),
      userPassword: z.string().min(4, "用户密码至少 4 位"),
    }),
    response: loginOut,
    async handler(ctx, args): Promise<z.infer<typeof loginOut>> {
      const db = ctx.db<typeof schema>();
      const existing = await loadCredentials(ctx);
      if (existing) {
        return {
          ok: false,
          token: null,
          role: null,
          username: "",
          displayName: "",
          error: "密码已经设置过了，请直接登录。",
        };
      }
      const secret = randomBytesBase64Url(32);
      const userHash = await hashPassword(args.userPassword);
      await db.insert(schema.authCredentials).values({
        adminHash: await hashPassword(args.adminPassword),
        userHash,
        sessionSecret: secret,
        userDisabled: 0,
      });
      // 第一个操作员账号与旧单用户账号同密码种子（用户名 user）。
      await ensureOperatorSeed(ctx);
      ctx.invalidateQueries();
      return {
        ok: true,
        token: await signToken(secret, "admin", null),
        role: "admin",
        username: "admin",
        displayName: "管理员",
        error: "",
      };
    },
  }),

  login: defineAction({
    description: "后台登录：管理员用管理员密码登录；操作员用管理员分配的用户名 + 密码登录（role=user 时传 username，不传时按第一个操作员账号 user 处理，兼容旧登录页）。成功返回会话令牌与身份信息（用户名、显示名）。防爆破：同一账号连续输错 5 次锁定 15 分钟（管理员与每个操作员各自计数，存各自的表行），锁定期间输对密码也进不来；登录成功清零失败计数。用户账号被管理员整体停用（旧开关）或单个操作员被停用时，都无法登录。",
    request: z.object({
      role: z.enum(["admin", "user"]),
      username: z.string().default(""),
      password: z.string().min(1, "请输入密码"),
    }),
    response: loginOut,
    async handler(ctx, args): Promise<z.infer<typeof loginOut>> {
      const fail = (error: string): z.infer<typeof loginOut> => ({
        ok: false,
        token: null,
        role: null,
        username: "",
        displayName: "",
        error,
      });
      const row = await loadCredentials(ctx);
      if (!row) {
        return fail("尚未设置密码，请先完成首次设置。");
      }
      const now = Date.now();
      if (args.role === "admin") {
        if (row.adminLockedUntil > now) {
          const mins = Math.max(
            1,
            Math.ceil((row.adminLockedUntil - now) / 60_000),
          );
          return fail(
            `连续输错密码次数过多，该账号已锁定，请 ${mins} 分钟后再试。`,
          );
        }
        if (!(await verifyPassword(args.password, row.adminHash))) {
          // 原子递增：并发下多次输错也不会互相覆盖计数（SQL 层 +1，再读回最新值定夺）。
          const db = ctx.db<typeof schema>();
          await db
            .update(schema.authCredentials)
            .set({
              adminFailCount: sql`${schema.authCredentials.adminFailCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(schema.authCredentials.id, row.id));
          const fresh = await loadCredentials(ctx);
          const next = fresh ? fresh.adminFailCount : 0;
          if (next >= LOGIN_MAX_FAILURES) {
            await updateLoginLockState(ctx, row.id, "admin", 0, now + LOGIN_LOCK_MS);
            return fail("密码不正确。已连续输错 5 次，该账号锁定 15 分钟，请稍后再试。");
          }
          return fail("密码不正确，请重新输入。");
        }
        if (row.adminFailCount !== 0 || row.adminLockedUntil !== 0) {
          await updateLoginLockState(ctx, row.id, "admin", 0, 0);
        }
        return {
          ok: true,
          token: await signToken(row.sessionSecret, "admin", null),
          role: "admin",
          username: "admin",
          displayName: "管理员",
          error: "",
        };
      }
      // 操作员登录：旧的整体停用开关仍然有效（停用后所有操作员都登不进）。
      if (row.userDisabled === 1) {
        return fail("用户账号已被管理员停用，无法登录。");
      }
      await ensureOperatorSeed(ctx);
      const db = ctx.db<typeof schema>();
      const usernameNorm = (args.username ?? "").trim().toLowerCase();
      const ops = await loadOperators(ctx);
      const op = usernameNorm
        ? ops.find((o) => o.username.toLowerCase() === usernameNorm)
        : ops.find((o) => o.username.toLowerCase() === "user") ?? ops[0];
      if (!op) {
        return fail("用户名或密码不正确，请重新输入。");
      }
      if (op.disabled === 1) {
        return fail("该操作员账号已被管理员停用，无法登录。");
      }
      if (op.lockedUntil > now) {
        const mins = Math.max(1, Math.ceil((op.lockedUntil - now) / 60_000));
        return fail(
          `连续输错密码次数过多，该账号已锁定，请 ${mins} 分钟后再试。`,
        );
      }
      if (!(await verifyPassword(args.password, op.passwordHash))) {
        // 原子递增：并发下多次输错也不会互相覆盖计数（SQL 层 +1，再读回最新值定夺）。
        await db
          .update(schema.operators)
          .set({
            failCount: sql`${schema.operators.failCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.operators.id, op.id));
        const freshOps = await loadOperators(ctx);
        const freshOp = freshOps.find((o) => o.id === op.id);
        const next = freshOp ? freshOp.failCount : 0;
        if (next >= LOGIN_MAX_FAILURES) {
          await db
            .update(schema.operators)
            .set({ failCount: 0, lockedUntil: now + LOGIN_LOCK_MS, updatedAt: new Date() })
            .where(eq(schema.operators.id, op.id));
          return fail("密码不正确。已连续输错 5 次，该账号锁定 15 分钟，请稍后再试。");
        }
        return fail("用户名或密码不正确，请重新输入。");
      }
      if (op.failCount !== 0 || op.lockedUntil !== 0) {
        await db
          .update(schema.operators)
          .set({ failCount: 0, lockedUntil: 0, updatedAt: new Date() })
          .where(eq(schema.operators.id, op.id));
      }
      return {
        ok: true,
        token: await signToken(row.sessionSecret, "user", op.id),
        role: "user",
        username: op.username,
        displayName: op.displayName || op.username,
        error: "",
      };
    },
  }),

  getSystemName: defineAction({
    description:
      "读取系统名称（后台与债务人网页显示的名字）；名称存在后端 system_settings 单例行里，尚无记录时以当前名称为初始值落库。登录前也可读，供登录页显示。",
    request: z.object({}),
    response: z.object({ systemName: z.string() }),
    async handler(ctx) {
      return { systemName: await loadSystemName(ctx) };
    },
  }),

  updateSystemName: defineAction({
    description:
      "修改系统名称：保存后后台与债务人网页显示的名字都跟着变。管理员与用户账号都可用（属于网页首页内容编辑）。",
    request: z.object({
      systemName: z.string().trim().min(1, "系统名称不能为空").max(50, "系统名称最长 50 个字"),
    }),
    response: z.object({ ok: z.boolean(), systemName: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.systemSettings);
      const row = rows[0];
      if (row) {
        await db
          .update(schema.systemSettings)
          .set({ systemName: args.systemName })
          .where(eq(schema.systemSettings.id, row.id));
      } else {
        await db
          .insert(schema.systemSettings)
          .values({ systemName: args.systemName });
      }
      ctx.invalidateQueries();
      return { ok: true, systemName: args.systemName };
    },
  }),

  updateModelEndpointUrl: defineAction({
    description:
      "修改真模型端点地址（generateReply 调用的模型服务地址）：轮换监控在隧道重起、端点地址变化时调它更新 system_settings 单例行的 model_endpoint_url，之后 generateReply 即按新地址调模型，不用改代码。管理员与用户账号都可用（属于网页首页内容编辑）。地址须为 https 开头的合法 URL，最长 500 字；传空串表示清空（generateReply 未配端点时返回 modelAvailable:false，债务人页回落到关键词规则）。",
    request: z.object({
      modelEndpointUrl: z
        .string()
        .trim()
        .max(500, "端点地址最长 500 字")
        .refine(
          (v) => v === "" || /^https:\/\/[A-Za-z0-9.-]+(:\d+)?(\/.*)?$/.test(v),
          "端点地址须为 https 开头的合法 URL，传空串表示清空",
        ),
    }),
    response: z.object({ ok: z.boolean(), modelEndpointUrl: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.systemSettings);
      const row = rows[0];
      if (row) {
        await db
          .update(schema.systemSettings)
          .set({ modelEndpointUrl: args.modelEndpointUrl })
          .where(eq(schema.systemSettings.id, row.id));
      } else {
        await db
          .insert(schema.systemSettings)
          .values({ modelEndpointUrl: args.modelEndpointUrl });
      }
      ctx.invalidateQueries();
      return { ok: true, modelEndpointUrl: args.modelEndpointUrl };
    },
  }),

  getChatScripts: defineAction({
    description:
      "读取债务人页协商机器人的整套话术（开场白两句、账单页协商方案文案、关键词规则、兜底回复、快捷按钮 chips、聊天窗口标题 chatTitle 与副标题 chatSubtitle、输入框提示语 inputPlaceholder、分析小字前缀 analysisLabel、付款卡文案 payCard、付款成功消息模板 paidMessageTemplate，其中模板里的 X 是金额占位），供债务人网页直接调用，不用登录。后台从未在「话术设置」保存过时返回内置默认话术（模板里的 {amount}、{caseNo}、{overdueDays}、{agreementNo} 等占位符由债务人页按核验案件真实数据替换，模板里不写死具体案件的数字）；保存过就返回保存的版本。规则按 sortOrder 顺序匹配、第一条命中即用；规则 analysis 为空表示无单独分析文案、走兜底分析。限流与身份核验同口径：全站 10 分钟最多 600 次，超限拒绝并提示稍后再试。",
    request: z.object({}),
    response: chatScriptsOut,
    async handler(ctx): Promise<ChatScriptsData> {
      // 与 verifyIdentity 同口径的全站兜底限流（进程内滑动窗口）
      if (
        hitRateLimit(
          "chatScripts:global",
          600,
          VERIFY_WINDOW_MS,
        )
      ) {
        throw new Error(RATE_LIMIT_MESSAGE);
      }
      return loadChatScripts(ctx);
    },
  }),

  saveChatScripts: defineAction({
    description:
      "保存债务人页协商机器人的整套话术：关键词规则（触发正则、分析备注、回复、顺序）、开场白两句、账单页协商方案文案、兜底回复、快捷按钮（标签 + 点击后发出的句子）、聊天窗口标题与副标题、输入框提示语、分析小字前缀、付款卡六项文案、付款成功消息模板（X 为金额占位）；回复与文案里的 {amount}、{caseNo}、{overdueDays}、{agreementNo}、{install6}、{install12} 等占位符由债务人页按核验案件真实数据替换，模板里不要写死具体案件的数字，整套覆盖保存，保存后债务人页立即按新话术走。管理员与用户账号都可用（与网页首页内容同权限）。保存前逐项校验：触发关键词必须是合法正则、回复与各项文案不能为空，不合法直接拒绝且不落库。",
    request: z.object({
      rules: z
        .array(
          z.object({
            key: z.string().trim().min(1, "规则标识不能为空"),
            pattern: z.string(),
            analysis: z.string(),
            reply: z.string(),
            sortOrder: z.number().int().min(0),
          }),
        )
        .min(1, "至少要有一条关键词规则"),
      opening: z.array(z.string()).length(2, "开场白固定两句"),
      offerLine: z.string(),
      fallback: z.object({ analysis: z.string(), reply: z.string() }),
      chips: z
        .array(z.object({ label: z.string(), text: z.string() }))
        .min(1, "至少要有一个快捷按钮"),
      chatTitle: z.string(),
      chatSubtitle: z.string(),
      inputPlaceholder: z.string(),
      analysisLabel: z.string(),
      payCard: z.object({
        title: z.string(),
        accountName: z.string(),
        method: z.string(),
        remark: z.string(),
        note: z.string(),
        paidButtonText: z.string(),
      }),
      paidMessageTemplate: z.string(),
    }),
    response: saveChatScriptsResponse,
    handler: async (
      ctx,
      args,
    ): Promise<z.infer<typeof saveChatScriptsResponse>> => {
      // 逐条校验：pattern 必须是合法正则，reply 不能为空（任一不过整单拒绝）
      const rules = [...args.rules].sort((a, b) => a.sortOrder - b.sortOrder);
      rules.forEach((rule, i) => {
        if (!rule.pattern.trim()) {
          throw new Error(`第 ${i + 1} 条规则的触发关键词不能为空。`);
        }
        try {
          new RegExp(rule.pattern);
        } catch {
          throw new Error(
            `第 ${i + 1} 条规则的触发关键词不是合法的正则表达式，请修改后再保存。`,
          );
        }
        if (!rule.reply.trim()) {
          throw new Error(`第 ${i + 1} 条规则的回复不能为空。`);
        }
      });
      const opening = args.opening.map((line) => line.trim());
      opening.forEach((line, i) => {
        if (!line) throw new Error(`开场白第 ${i + 1} 句不能为空。`);
      });
      if (!args.offerLine.trim()) {
        throw new Error("协商方案文案不能为空。");
      }
      if (!args.fallback.reply.trim()) {
        throw new Error("兜底回复不能为空。");
      }
      args.chips.forEach((chip, i) => {
        if (!chip.label.trim()) {
          throw new Error(`第 ${i + 1} 个快捷按钮的标签不能为空。`);
        }
        if (!chip.text.trim()) {
          throw new Error(
            `第 ${i + 1} 个快捷按钮点击后发出的句子不能为空。`,
          );
        }
      });
      const textFields: Array<[string, string]> = [
        ["聊天窗口标题", args.chatTitle],
        ["聊天窗口副标题", args.chatSubtitle],
        ["输入框提示语", args.inputPlaceholder],
        ["分析小字前缀", args.analysisLabel],
        ["付款卡标题", args.payCard.title],
        ["付款卡户名", args.payCard.accountName],
        ["付款卡方式", args.payCard.method],
        ["付款卡备注", args.payCard.remark],
        ["付款卡说明", args.payCard.note],
        ["付款卡按钮文案", args.payCard.paidButtonText],
        ["付款成功消息模板", args.paidMessageTemplate],
      ];
      for (const [label, value] of textFields) {
        if (!value.trim()) throw new Error(`${label}不能为空。`);
      }
      const db = ctx.db<typeof schema>();
      // 整套覆盖：先清掉旧行，再按 kind 分行写入（规则、开场白两行、
      // 协商方案文案一行、兜底一行、快捷按钮、单项文案），
      // 取值口径与 loadChatScripts 一致。
      await db.delete(schema.chatScripts);
      for (const [i, rule] of rules.entries()) {
        await db.insert(schema.chatScripts).values({
          kind: "rule",
          ruleKey: rule.key,
          pattern: rule.pattern,
          analysis: rule.analysis,
          reply: rule.reply,
          sortOrder: i,
        });
      }
      for (const [i, line] of opening.entries()) {
        await db.insert(schema.chatScripts).values({
          kind: "opening",
          reply: line,
          sortOrder: i,
        });
      }
      await db.insert(schema.chatScripts).values({
        kind: "offer",
        reply: args.offerLine,
        sortOrder: 0,
      });
      await db.insert(schema.chatScripts).values({
        kind: "fallback",
        analysis: args.fallback.analysis,
        reply: args.fallback.reply,
        sortOrder: 0,
      });
      const chipKeys = ["installment", "waiver", "partial", "verify", "settlement"];
      for (const [i, chip] of args.chips.entries()) {
        await db.insert(schema.chatScripts).values({
          kind: "chip",
          ruleKey: chipKeys[i] ?? `chip-${i + 1}`,
          reply: chip.label,
          analysis: chip.text,
          sortOrder: i,
        });
      }
      const settingRows: Array<[string, string]> = [
        ["chatTitle", args.chatTitle],
        ["chatSubtitle", args.chatSubtitle],
        ["inputPlaceholder", args.inputPlaceholder],
        ["analysisLabel", args.analysisLabel],
        ["payCard.title", args.payCard.title],
        ["payCard.accountName", args.payCard.accountName],
        ["payCard.method", args.payCard.method],
        ["payCard.remark", args.payCard.remark],
        ["payCard.note", args.payCard.note],
        ["payCard.paidButtonText", args.payCard.paidButtonText],
        ["paidMessageTemplate", args.paidMessageTemplate],
      ];
      for (const [key, value] of settingRows) {
        await db.insert(schema.chatScripts).values({
          kind: "setting",
          ruleKey: key,
          reply: value,
          sortOrder: 0,
        });
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  /* ============ v17 技巧库（学习能力） ============ */

  listTechniques: defineAction({
    description:
      "v17 技巧库列表：按状态（pending 待确认 / confirmed 已确认 / rejected 已驳回 / all 全部）列出技巧，含来源案件、来源方式、确认人与确认时间；新的在前。",
    request: z.object({
      status: z
        .enum(["pending", "confirmed", "rejected", "all"])
        .default("all"),
    }),
    response: z.object({
      items: z.array(
        z.object({
          id: z.number(),
          caseId: z.number().nullable(),
          technique: z.string(),
          source: z.string(),
          status: z.string(),
          confirmedBy: z.string(),
          confirmedAt: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const cond =
        args.status === "all"
          ? undefined
          : eq(schema.techniques.status, args.status);
      const rows = await db
        .select()
        .from(schema.techniques)
        .where(cond)
        .orderBy(
          desc(schema.techniques.createdAt),
          desc(schema.techniques.id),
        );
      return {
        items: rows.map((r) => ({
          id: r.id,
          caseId: r.caseId,
          technique: r.technique,
          source: r.source,
          status: r.status,
          confirmedBy: r.confirmedBy,
          confirmedAt: r.confirmedAt
            ? new Date(r.confirmedAt).toISOString()
            : null,
          createdAt: new Date(r.createdAt).toISOString(),
        })),
      };
    },
  }),

  confirmTechnique: defineAction({
    description:
      "v17 确认一条技巧：状态 pending → confirmed，记确认人与确认时间；确认后机器人值守与模型都会用它。已确认/已驳回的再确认直接返回。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const session = currentSession(ctx);
      await db
        .update(schema.techniques)
        .set({
          status: "confirmed",
          confirmedBy: sessionActorName(session),
          confirmedAt: new Date(),
        })
        .where(eq(schema.techniques.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  rejectTechnique: defineAction({
    description:
      "v17 驳回一条技巧：状态 pending → rejected，不会再被机器人/模型使用。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.techniques)
        .set({ status: "rejected" })
        .where(eq(schema.techniques.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  addTechnique: defineAction({
    description:
      "v17 手动添加一条技巧：管理员把自己观察到的有效话术直接写进库，默认待确认（走同一确认流程），也可直接确认。",
    request: z.object({
      technique: z.string().trim().min(1, "技巧内容不能为空"),
      caseId: z.number().int().positive().optional(),
      confirmed: z.boolean().default(false),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const session = currentSession(ctx);
      const result = await db
        .insert(schema.techniques)
        .values({
          caseId: args.caseId ?? null,
          technique: args.technique,
          source: "manual",
          status: args.confirmed ? "confirmed" : "pending",
          confirmedBy: args.confirmed ? sessionActorName(session) : "",
          confirmedAt: args.confirmed ? new Date() : null,
        })
        .returning({ id: schema.techniques.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addTechnique: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  extractTechniques: defineAction({
    description:
      "v17 手动为一案提炼技巧：从该案聊天记录里按成功案例规则提炼专员有效话术，进库待确认；已在库里的相同话术不重复进。用于还款成功后自动提炼漏掉时补提，或管理员想再提一次。",
    request: z.object({ caseId: z.number().int().positive() }),
    response: z.object({ inserted: z.number() }),
    async handler(ctx, args) {
      await assertCaseVisible(ctx, args.caseId);
      const db = ctx.db<typeof schema>();
      const techniques = await extractTechniquesFromChat(ctx, args.caseId);
      let inserted = 0;
      for (const t of techniques) {
        const dup = await db
          .select({ id: schema.techniques.id })
          .from(schema.techniques)
          .where(
            and(
              eq(schema.techniques.caseId, args.caseId),
              eq(schema.techniques.technique, t),
            ),
          )
          .limit(1);
        if (dup.length > 0) continue;
        await db.insert(schema.techniques).values({
          caseId: args.caseId,
          technique: t,
          source: "auto",
          status: "pending",
        });
        inserted++;
      }
      ctx.invalidateQueries();
      return { inserted };
    },
  }),

  deleteTechnique: defineAction({
    description: "v17 删除一条技巧（待确认/已确认/已驳回均可删）。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.techniques).where(eq(schema.techniques.id, args.id)).limit(1);
      const row = rows[0] as Record<string, unknown> | undefined;
      const archiveId = row ? await archiveData(ctx, "technique", args.id, String(row?.technique ?? ''), row) : null;
      await db.delete(schema.techniques).where(eq(schema.techniques.id, args.id));
      await logAudit(ctx, "delete_technique", "technique", args.id, `删除 technique ${args.id}，回收站 ${archiveId ?? "归档失败"}`);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  // ---- 头像（2026-11-10）：专员与债务人各自可上传头像，聊天里显示 ----
  // 专员头像挂在 operators 行上；管理员没有专员行，头像挂在 username="user"
  // 的主专员行名下（管理员不聊天，聊天里显示的就是这张）。债务人头像挂在
  // cases 行上。头像只收图片、2MB 以内，存 blobs：avatars/operator-<id>-<随机>
  // 与 avatars/debtor-<caseId>-<随机>；旧头像文件不删除（键带随机串，不会覆盖）。
  uploadMyAvatar: defineAction({
    description:
      "当前登录的专员/管理员上传自己的头像（只收图片、2MB 以内）：专员写自己的 operators 行，管理员写 username=user 的主专员行；返回新头像地址，聊天里我方消息即用这张。未登录、账号不存在时拒绝。",
    request: z.object({
      image: z.object({
        dataBase64: z.string().min(1, "请上传图片"),
        mimeType: z.string().regex(/^image\//, "图片必须是图片文件"),
      }),
    }),
    response: z.object({ avatarUrl: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const session = currentSession(ctx);
      if (!session) throw new Error(NOT_LOGGED_IN_MESSAGE);
      let row: { id: number } | null = null;
      if (session.operatorId != null) {
        const rows = await db
          .select({ id: schema.operators.id })
          .from(schema.operators)
          .where(eq(schema.operators.id, session.operatorId));
        row = rows[0] ?? null;
      } else {
        // 管理员：头像挂主专员行。
        const rows = await db
          .select({ id: schema.operators.id })
          .from(schema.operators)
          .where(eq(schema.operators.username, "user"));
        row = rows[0] ?? null;
      }
      if (!row) throw new Error("HTTP400:未找到当前账号，无法上传头像");
      if (!args.image.mimeType.toLowerCase().startsWith("image/")) {
        throw new Error("HTTP400:图片必须是图片文件");
      }
      const imageBytes = Buffer.from(args.image.dataBase64, "base64");
      if (imageBytes.length > 2 * 1024 * 1024) {
        throw new Error("HTTP400:图片文件过大，请上传 2MB 以内的图片");
      }
      const key = `avatars/operator-${row.id}-${randomHex(16)}`;
      await ctx.blobs.put(key, imageBytes, {
        contentType: args.image.mimeType,
      });
      await db
        .update(schema.operators)
        .set({ avatarBlobKey: key })
        .where(eq(schema.operators.id, row.id));
      ctx.invalidateQueries();
      return { avatarUrl: (await ctx.blobs.getUrl(key)) ?? "" };
    },
  }),

  getMyAvatar: defineAction({
    description:
      "返回当前登录账号的头像地址：专员读自己的 operators 行，管理员读 username=user 的主专员行；未上传返回空串，前端显示姓名首字。",
    request: z.object({}),
    response: z.object({ avatarUrl: z.string() }),
    async handler(ctx, _args) {
      const db = ctx.db<typeof schema>();
      const session = currentSession(ctx);
      if (!session) throw new Error(NOT_LOGGED_IN_MESSAGE);
      let key: string | null = null;
      if (session.operatorId != null) {
        const rows = await db
          .select({ avatarBlobKey: schema.operators.avatarBlobKey })
          .from(schema.operators)
          .where(eq(schema.operators.id, session.operatorId));
        key = rows[0]?.avatarBlobKey ?? null;
      } else {
        const rows = await db
          .select({ avatarBlobKey: schema.operators.avatarBlobKey })
          .from(schema.operators)
          .where(eq(schema.operators.username, "user"));
        key = rows[0]?.avatarBlobKey ?? null;
      }
      return { avatarUrl: key ? ((await ctx.blobs.getUrl(key)) ?? "") : "" };
    },
  }),

  uploadDebtorAvatar: defineAction({
    description:
      "债务人端上传自己的头像（公开接口，无需登录令牌，债务人页核验通过后调用）：校验案件存在且台账身份证号与传来的 idCard 归一化后一致；只收图片、2MB 以内；写 cases 行的 avatar_blob_key，返回新头像地址，聊天里债务人消息即用这张。",
    request: z.object({
      caseId: z.number().int().positive(),
      idCard: z.string().min(1, "身份证号不能为空"),
      image: z.object({
        dataBase64: z.string().min(1, "请上传图片"),
        mimeType: z.string().regex(/^image\//, "图片必须是图片文件"),
      }),
    }),
    response: z.object({ avatarUrl: z.string() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const idCardNorm = (args.idCard ?? "").replace(/\s+/g, "").toUpperCase();
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.id, args.caseId));
      const row = rows[0];
      if (!row) {
        throw new Error("HTTP400:未找到匹配的案件记录");
      }
      const ledgerNorm = (row.idCard ?? "").replace(/\s+/g, "").toUpperCase();
      if (!ledgerNorm || ledgerNorm !== idCardNorm) {
        throw new Error("HTTP400:身份证号与案件不匹配");
      }
      if (!args.image.mimeType.toLowerCase().startsWith("image/")) {
        throw new Error("HTTP400:图片必须是图片文件");
      }
      const imageBytes = Buffer.from(args.image.dataBase64, "base64");
      if (imageBytes.length > 2 * 1024 * 1024) {
        throw new Error("HTTP400:图片文件过大，请上传 2MB 以内的图片");
      }
      const key = `avatars/debtor-${row.id}-${randomHex(16)}`;
      await ctx.blobs.put(key, imageBytes, {
        contentType: args.image.mimeType,
      });
      await db
        .update(schema.cases)
        .set({ avatarBlobKey: key })
        .where(eq(schema.cases.id, row.id));
      ctx.invalidateQueries();
      return { avatarUrl: (await ctx.blobs.getUrl(key)) ?? "" };
    },
  }),

  getSession: defineAction({
    description: "校验会话令牌，返回当前登录身份：角色、操作员 id、用户名、显示名、权限键列表、是否分案主管（canAssign）与是否看全部案件（scopeAll）；未登录、已过期或账号被停用时身份为空、其余字段为空值。前端据此渲染权限管理入口、按权限启用功能、收件箱「我的/全部」切换与负责人显示。",
    request: z.object({ token: z.string().default("") }),
    response: z.object({
      role: z.enum(["admin", "user"]).nullable(),
      operatorId: z.number().nullable(),
      username: z.string(),
      displayName: z.string(),
      permissions: z.array(z.string()),
      canAssign: z.boolean(),
      scopeAll: z.boolean(),
    }),
    async handler(ctx, args) {
      const session = await sessionForToken(ctx, args.token);
      if (!session) {
        return {
          role: null,
          operatorId: null,
          username: "",
          displayName: "",
          permissions: [],
          canAssign: false,
          scopeAll: false,
        };
      }
      return {
        role: session.role,
        operatorId: session.operatorId,
        username: session.username,
        displayName: session.displayName,
        permissions: [...session.permissions],
        canAssign: session.canAssign,
        scopeAll: session.scopeAll,
      };
    },
  }),

  changePasswords: defineAction({
    description:
      "管理员修改登录密码：可改管理员密码、第一个操作员账号（用户名 user）的密码或两者一起改，留空的项不改。仅管理员可用。单个操作员的密码在「权限管理」里按人改（updateOperator）。",
    request: z.object({
      adminPassword: z.string().default(""),
      userPassword: z.string().default(""),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const row = await loadCredentials(ctx);
      if (!row) throw new Error("尚未设置密码。");
      const patch: {
        adminHash?: string;
        userHash?: string;
        adminFailCount?: number;
        adminLockedUntil?: number;
        userFailCount?: number;
        userLockedUntil?: number;
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };
      if (args.adminPassword) {
        if (args.adminPassword.length < 4) throw new Error("管理员密码至少 4 位。");
        patch.adminHash = await hashPassword(args.adminPassword);
        // 改密即解锁：清掉该账号的输错计数与锁定
        patch.adminFailCount = 0;
        patch.adminLockedUntil = 0;
      }
      let userHashNew: string | null = null;
      if (args.userPassword) {
        if (args.userPassword.length < 4) throw new Error("用户密码至少 4 位。");
        userHashNew = await hashPassword(args.userPassword);
        patch.userHash = userHashNew;
        patch.userFailCount = 0;
        patch.userLockedUntil = 0;
      }
      if (!patch.adminHash && !patch.userHash) throw new Error("没有要修改的密码。");
      await db
        .update(schema.authCredentials)
        .set(patch)
        .where(eq(schema.authCredentials.id, row.id));
      // 「用户密码」现在对应第一个操作员账号（用户名 user）：同步改它的
      // 密码哈希并解锁，保持旧改密入口语义不变。
      if (userHashNew) {
        await ensureOperatorSeed(ctx);
        const ops = await loadOperators(ctx);
        const seed = ops.find((o) => o.username.toLowerCase() === "user");
        if (seed) {
          await db
            .update(schema.operators)
            .set({ passwordHash: userHashNew, failCount: 0, lockedUntil: 0, updatedAt: new Date() })
            .where(eq(schema.operators.id, seed.id));
        }
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setUserDisabled: defineAction({
    description:
      "管理员停用或恢复用户账号：停用后用户账号无法再登录，已登录的用户会话立即失效。仅管理员可用。",
    request: z.object({ disabled: z.boolean() }),
    response: z.object({ ok: z.boolean(), userDisabled: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const row = await loadCredentials(ctx);
      if (!row) return { ok: false, userDisabled: false };
      await db
        .update(schema.authCredentials)
        .set({ userDisabled: args.disabled ? 1 : 0, updatedAt: new Date() })
        .where(eq(schema.authCredentials.id, row.id));
      ctx.invalidateQueries();
      return { ok: true, userDisabled: args.disabled };
    },
  }),

  /* ---------------- 操作员账号与权限管理（仅管理员） ---------------- */

  listOperators: defineAction({
    description:
      "列出全部操作员账号（仅管理员）：用户名、显示名、是否停用、权限键列表、是否是分案主管（含分案权限）、当前负责案件数，并附全部可开关的权限项定义（键 + 中文名）供权限管理页渲染。首次调用时若还没有操作员账号，会先用旧用户密码种子生成第一个操作员账号（用户名 user）。",
    request: z.object({}),
    response: z.object({
      operators: z.array(
        z.object({
          id: z.number(),
          username: z.string(),
          displayName: z.string(),
          disabled: z.boolean(),
          permissions: z.array(z.string()),
          isSupervisor: z.boolean(),
          caseCount: z.number(),
        }),
      ),
      permissionDefs: z.array(
        z.object({ key: z.string(), label: z.string() }),
      ),
    }),
    async handler(ctx) {
      await ensureOperatorSeed(ctx);
      const db = ctx.db<typeof schema>();
      const ops = await loadOperators(ctx);
      const caseRows = await db
        .select({ assigneeId: schema.cases.assigneeId })
        .from(schema.cases);
      const counts = new Map<number, number>();
      for (const r of caseRows) {
        if (r.assigneeId != null) {
          counts.set(r.assigneeId, (counts.get(r.assigneeId) ?? 0) + 1);
        }
      }
      return {
        operators: ops.map((o) => {
          const perms = parsePermissions(o.permissions);
          return {
            id: o.id,
            username: o.username,
            displayName: o.displayName || o.username,
            disabled: o.disabled === 1,
            permissions: perms,
            isSupervisor: perms.includes("assign"),
            caseCount: counts.get(o.id) ?? 0,
          };
        }),
        permissionDefs: PERMISSION_DEFS.map((d) => ({
          key: d.key as string,
          label: d.label as string,
        })),
      };
    },
  }),

  createOperator: defineAction({
    description:
      "新建一个操作员账号（仅管理员）：用户名（登录用，全站唯一、忽略大小写）、显示名（显示在经手人与负责人处）、初始密码（至少 4 位）都由管理员设定。新账号默认业务权限全开、「分案」权限不开（在权限管理里授予后即为分案主管）。",
    request: z.object({
      username: z.string().trim().min(1, "用户名不能为空").max(32, "用户名最长 32 个字符"),
      displayName: z.string().trim().min(1, "显示名不能为空").max(32, "显示名最长 32 个字符"),
      password: z.string().min(4, "密码至少 4 位"),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      await ensureOperatorSeed(ctx);
      const db = ctx.db<typeof schema>();
      const ops = await loadOperators(ctx);
      const usernameNorm = args.username.toLowerCase();
      if (usernameNorm === "admin") {
        throw new Error("用户名不能用 admin（管理员专用）。");
      }
      if (ops.some((o) => o.username.toLowerCase() === usernameNorm)) {
        throw new Error("该用户名已被使用，请换一个。");
      }
      const result = await db
        .insert(schema.operators)
        .values({
          username: args.username,
          displayName: args.displayName,
          passwordHash: await hashPassword(args.password),
          permissions: JSON.stringify(DEFAULT_OPERATOR_PERMISSIONS),
          disabled: 0,
        })
        .returning({ id: schema.operators.id });
      const inserted = result[0];
      if (!inserted) throw new Error("createOperator: insert returned no rows");
      ctx.invalidateQueries();
      return { id: inserted.id };
    },
  }),

  updateOperator: defineAction({
    description:
      "修改一个操作员账号（仅管理员）：可改显示名、重置密码（至少 4 位，同时清掉登录失败计数与锁定）、停用或恢复（停用后该账号无法登录、已有会话立即失效）。留空/不传的项不改。用户名是登录标识，不可改。",
    request: z.object({
      id: z.number().int().positive(),
      displayName: z.string().trim().max(32, "显示名最长 32 个字符").default(""),
      password: z.string().default(""),
      disabled: z.boolean().nullable().default(null),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const ops = await loadOperators(ctx);
      const op = ops.find((o) => o.id === args.id);
      if (!op) throw new Error("未找到该操作员账号。");
      const patch: {
        displayName?: string;
        passwordHash?: string;
        failCount?: number;
        lockedUntil?: number;
        disabled?: number;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (args.displayName) patch.displayName = args.displayName;
      if (args.password) {
        if (args.password.length < 4) throw new Error("密码至少 4 位。");
        patch.passwordHash = await hashPassword(args.password);
        patch.failCount = 0;
        patch.lockedUntil = 0;
      }
      if (args.disabled !== null) patch.disabled = args.disabled ? 1 : 0;
      await db
        .update(schema.operators)
        .set(patch)
        .where(eq(schema.operators.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setOperatorPermissions: defineAction({
    description:
      "设置一个操作员的权限集合（仅管理员）：传入完整的权限键列表整单覆盖，改完立即生效（该账号下一次调用接口即按新权限校验，已打开的页面下一次刷新生效）。权限键：chat 发聊天、analysis 分析、agreement 协议、payment 登记/对账还款、takeover 接管、mute 禁言、cases 案件、content 内容、scripts 话术、assign 分案（授予即分案主管：看全部案件并可分案改派）。改密码、停用账号与本接口本身只认管理员，不在可授予之列。",
    request: z.object({
      id: z.number().int().positive(),
      permissions: z.array(z.string()),
    }),
    response: z.object({ ok: z.boolean(), permissions: z.array(z.string()) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const ops = await loadOperators(ctx);
      const op = ops.find((o) => o.id === args.id);
      if (!op) throw new Error("未找到该操作员账号。");
      const perms = [...new Set(args.permissions)].filter((p) =>
        PERMISSION_KEYS.has(p),
      );
      await db
        .update(schema.operators)
        .set({ permissions: JSON.stringify(perms), updatedAt: new Date() })
        .where(eq(schema.operators.id, args.id));
      ctx.invalidateQueries();
      return { ok: true, permissions: perms };
    },
  }),

  listAssignees: defineAction({
    description:
      "负责人候选列表（登录即可读）：全部未停用的操作员账号（id、用户名、显示名），供分案界面选择负责人、案件行与收件箱显示负责人名字。",
    request: z.object({}),
    response: z.object({
      assignees: z.array(
        z.object({
          id: z.number(),
          username: z.string(),
          displayName: z.string(),
        }),
      ),
    }),
    async handler(ctx) {
      await ensureOperatorSeed(ctx);
      const ops = await loadOperators(ctx);
      return {
        assignees: ops
          .filter((o) => o.disabled !== 1)
          .map((o) => ({
            id: o.id,
            username: o.username,
            displayName: o.displayName || o.username,
          })),
      };
    },
  }),

  assignCases: defineAction({
    description:
      "分案：把一批案件手动指定给某个负责人（操作员），或取消分配（assigneeId 传 null 回到未分配）；随时可改派。只有管理员与有「分案」权限的操作员（分案主管）能调用，普通操作员调用返回 403。分配结果立即影响各操作员的可见范围（案件、收件箱、统计、名单）。",
    request: z.object({
      caseIds: z.array(z.number().int().positive()).min(1, "至少选择一个案件"),
      assigneeId: z.number().int().positive().nullable(),
    }),
    response: z.object({ ok: z.boolean(), updated: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      if (args.assigneeId !== null) {
        const ops = await loadOperators(ctx);
        const target = ops.find((o) => o.id === args.assigneeId);
        if (!target) throw new Error("未找到要分配的操作员账号。");
        if (target.disabled === 1) {
          throw new Error("该操作员账号已停用，不能再分案给他。");
        }
      }
      await db
        .update(schema.cases)
        .set({ assigneeId: args.assigneeId, updatedAt: new Date() })
        .where(inArray(schema.cases.id, args.caseIds));
      ctx.invalidateQueries();
      return { ok: true, updated: args.caseIds.length };
    },
  }),

  getOperatorPerformance: defineAction({
    description:
      "操作员回款能力分析（大数据统计页版块）：每个操作员一行——负责案件数、总欠款、已回款、回款率、平均回款天数（建档到第一笔确认回款）、高意愿未回款数；沟通信号来自其名下案件的聊天记录：债务人消息数、我方回复数、平均回复时长（小时）、高意愿未跟进数（高意愿且未结清、最后一条债务人消息后还没有我方回复的案件）、拖延信号总次数与抓到（其后有我方回复跟进）次数；建议由服务端按规则生成（回款率低于团队平均、积压最多、高意愿未跟进、拖延信号没抓到、回复不及时，无问题时为表现稳定）。管理员与分案主管看全部操作员，普通操作员只返回自己一行。",
    request: z.object({}),
    response: z.object({ rows: z.array(operatorPerfOut) }),
    async handler(ctx) {
      return { rows: await computeOperatorPerformance(ctx) };
    },
  }),
} satisfies ActionsModule;

/* ---------------- 登录凭据与会话 ---------------- */

type AuthRole = "admin" | "user";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 100_000;

const textEncoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomBytesBase64Url(count: number): string {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

// 聊天图片键用的随机串：count 字节 → 2*count 位十六进制（16 字节 = 32 位）。
function randomHex(count: number): string {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2Base64(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2Base64(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${hash}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const saltText = parts[2] ?? "";
  const expected = parts[3] ?? "";
  if (!saltText || !expected) return false;
  let salt: Uint8Array;
  try {
    salt = base64ToBytes(saltText);
  } catch {
    return false;
  }
  const actual = await pbkdf2Base64(password, salt, iterations);
  return timingSafeEqualStr(actual, expected);
}

async function hmacBase64Url(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return bytesToBase64Url(new Uint8Array(sig));
}

async function signToken(
  secret: string,
  role: AuthRole,
  operatorId: number | null,
): Promise<string> {
  const payload = bytesToBase64Url(
    textEncoder.encode(
      JSON.stringify({
        role,
        op: operatorId,
        exp: Date.now() + SESSION_TTL_MS,
      }),
    ),
  );
  const sig = await hmacBase64Url(secret, payload);
  return `${payload}.${sig}`;
}

async function loadCredentials(ctx: Ctx) {
  const db = ctx.db<typeof schema>();
  const rows = await db.select().from(schema.authCredentials);
  return rows[0];
}

/* ---------------- 登录防爆破 ----------------
   同一账号连续输错 5 次锁定 15 分钟（计数与锁定截止存 auth_credentials 行，
   按账号计，不依赖请求 IP；生产 HTTP 层另有按 IP+账号 的同口径拦截）。
   登录成功、或管理员给该账号改了密码，计数与锁定一并清零。 */

const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

async function updateLoginLockState(
  ctx: Ctx,
  rowId: number,
  role: AuthRole,
  failCount: number,
  lockedUntil: number,
): Promise<void> {
  const db = ctx.db<typeof schema>();
  const patch =
    role === "admin"
      ? {
          adminFailCount: failCount,
          adminLockedUntil: lockedUntil,
          updatedAt: new Date(),
        }
      : {
          userFailCount: failCount,
          userLockedUntil: lockedUntil,
          updatedAt: new Date(),
        };
  await db
    .update(schema.authCredentials)
    .set(patch)
    .where(eq(schema.authCredentials.id, rowId));
}

/* 解析会话令牌为完整会话：管理员，或某个操作员（带其权限集合）。
   令牌载荷 {role, op, exp}：op 是操作员 id（管理员为 null）。旧版
   令牌没有 op 字段——按第一个操作员账号（种子 user）解析，平滑过渡。
   操作员被停用、或用户账号被整体停用后，其已有会话立即失效；
   操作员被删除式停用以外的变更（改权限）下一次调用即按新权限走。 */
async function sessionForToken(
  ctx: Ctx,
  token: string,
): Promise<Session | null> {
  if (!token) return null;
  const row = await loadCredentials(ctx);
  if (!row || !row.sessionSecret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacBase64Url(row.sessionSecret, payload);
  if (!timingSafeEqualStr(sig, expected)) return null;
  let parsed: unknown;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(base64)));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const rec = parsed as Record<string, unknown>;
  const role: AuthRole | null =
    rec.role === "admin" ? "admin" : rec.role === "user" ? "user" : null;
  const exp = typeof rec.exp === "number" ? rec.exp : 0;
  if (!role || exp < Date.now()) return null;
  if (role === "admin") {
    return {
      role: "admin",
      operatorId: null,
      username: "admin",
      displayName: "管理员",
      permissions: new Set(PERMISSION_KEYS),
      scopeAll: true,
      canAssign: true,
    };
  }
  // 用户账号被管理员整体停用后，所有操作员会话立即失效
  if (row.userDisabled === 1) return null;
  await ensureOperatorSeed(ctx);
  const ops = await loadOperators(ctx);
  const opId = typeof rec.op === "number" ? rec.op : null;
  const op =
    (opId != null ? ops.find((o) => o.id === opId) : undefined) ??
    ops.find((o) => o.username.toLowerCase() === "user") ??
    ops[0];
  if (!op || op.disabled === 1) return null;
  const permissions = new Set(parsePermissions(op.permissions));
  const canAssign = permissions.has("assign");
  return {
    role: "user",
    operatorId: op.id,
    username: op.username,
    displayName: op.displayName || op.username,
    permissions,
    scopeAll: canAssign,
    canAssign,
  };
}

/* ---------------- 权限守卫 ---------------- */

// 登录相关接口与债务人端公开接口不守卫（内部自行校验/限流）：
// 债务人网页没有后台登录令牌，verifyIdentity 必须公开可达——它只
// 受自身的核验限流约束（verify_attempts 表：同身份证/同手机号
// 10 分钟 20 次、全站 600 次兜底），与生产后端行为一致。
const PUBLIC_ACTIONS: ReadonlySet<string> = new Set([
  "getAuthStatus",
  "setupPasswords",
  "login",
  "getSession",
  "recordLinkClick",
  "getSystemName",
  "verifyIdentity",
  "getHomepageContent",
  "submitPaymentScreenshot",
  "getDebtorChat",
  "sendDebtorMessage",
  "generateReply",
  "uploadDebtorAvatar",
  "getChatScripts",
]);

// 只读查看：管理员与任何操作员都能用（数据按分案范围在 handler 里过滤）
const READ_ACTIONS: ReadonlySet<string> = new Set([
  "listCases",
  "listChatInbox",
  "listPendingPayments",
  "getStats",
  "getCase",
  "getChat",
  "getChatImage",
  "getPayments",
  "getPaymentScreenshot",
  "getHomepageContent",
  "listAssignees",
  "getMyAvatar",
  "getOperatorPerformance",
]);

// 案件台账写入（案件权限）：新建 / Excel 导入 / 修改 / 删除单个 /
// 删除全部 / 进度步骤 / 发送登记。
const CASE_WRITE_ACTIONS: ReadonlySet<string> = new Set([
  "createCase",
  "importCases",
  "updateCase",
  "deleteCase",
  "deleteAllCases",
  "listDeletedItems",
  "restoreDeletedItem",
  "listAuditLogs",
  "createSystemSnapshot",
  "listSystemSnapshots",
  "restoreSystemSnapshot",
  "addStep",
  "updateStep",
  "deleteStep",
  "registerSend",
]);

// 网页首页内容编辑（内容权限）：审结案件、律师动态、保全划扣、今日
// 已还款、滚动条、失信惩戒、付款卡、对公账号、律师工作进度、账单示例与系统名称。
const PAGE_EDIT_ACTIONS: ReadonlySet<string> = new Set([
  "addCourtCase",
  "updateCourtCase",
  "deleteCourtCase",
  "addLawyerUpdate",
  "updateLawyerUpdate",
  "deleteLawyerUpdate",
  "updatePreservationSettings",
  "updateChainStep",
  "addFeedItem",
  "updateFeedItem",
  "deleteFeedItem",
  "addTodayRepayment",
  "updateTodayRepayment",
  "deleteTodayRepayment",
  "addTickerItem",
  "updateTickerItem",
  "deleteTickerItem",
  "addPunishmentItem",
  "updatePunishmentItem",
  "deletePunishmentItem",
  "updatePaymentSettings",
  "updateCorporateAccount",
  "updateLawyerProgress",
  "updateDemoBill",
  "updateSystemName",
]);

/* 操作员权限 → 接口映射（v16）：业务动作按项授权，管理员可在
   「权限管理」里按人开关，关掉即刻 403、打开即刻恢复。管理员本人
   不受此表约束（全通）。改密码、停用账号、操作员与权限管理本身
   不在此表——只认管理员（ADMIN_ONLY_ACTIONS）。 */
const ACTION_PERMISSIONS: ReadonlyMap<string, PermissionKey> = new Map<
  string,
  PermissionKey
>([
  // 发聊天：发/删聊天消息、转人工标记
  ["addChatMessage", "chat"],
  ["deleteChatMessage", "chat"],
  ["setNeedsHuman", "chat"],
  // 分析：手动分析债务人的一句话
  ["analyzeChatMessage", "analysis"],
  // 协议：协商事项的增改删
  ["addAgreement", "agreement"],
  ["updateAgreementStatus", "agreement"],
  ["deleteAgreement", "agreement"],
  // 登记 / 对账还款
  ["addPayment", "payment"],
  ["setPaymentReconcile", "payment"],
  ["deletePayment", "payment"],
  // 接管
  ["setHumanTakeover", "takeover"],
  // 禁言
  ["setCaseMuted", "mute"],
  // 话术
  ["saveChatScripts", "scripts"],
  // v17 技巧库：列表/确认/驳回/手动添加/提炼/删除
  ["listTechniques", "scripts"],
  ["confirmTechnique", "scripts"],
  ["rejectTechnique", "scripts"],
  ["addTechnique", "scripts"],
  ["extractTechniques", "scripts"],
  ["deleteTechnique", "scripts"],
  // 头像：我方头像用聊天权限（头像显示在聊天里）。
  ["uploadMyAvatar", "chat"],
  // 分案
  ["assignCases", "assign"],
  ...[...CASE_WRITE_ACTIONS].map(
    (name) => [name, "cases"] as [string, PermissionKey],
  ),
  ...[...PAGE_EDIT_ACTIONS].map(
    (name) => [name, "content"] as [string, PermissionKey],
  ),
]);

// 只认管理员：账号与权限管理本身、改密码、整体停用开关。
const ADMIN_ONLY_ACTIONS: ReadonlySet<string> = new Set([
  "changePasswords",
  "setUserDisabled",
  "listOperators",
  "createOperator",
  "updateOperator",
  "setOperatorPermissions",
]);

type AnyActionDef = ActionDefinition<z.ZodType, z.ZodType>;

/* 守卫拒绝文案与 HTTP 状态码的契约（文案一字不可改）：
   前端实际调用的生产后端（独立部署的 gangshang-backend，其 src/actions.ts
   与本文件同步）在分发层按错误文案给这两类拒绝定状态码——含「未登录」→ 401，
   含「只认管理员」→ 403，其余错误 → 500。因此未登录文案必须含且只含
   「未登录」标记、权限不足文案必须含且只含「只认管理员」标记，两条文案
   都不得混入对方的标记词，否则状态码会定错。改文案先改这条契约。 */
const NOT_LOGGED_IN_MESSAGE = "未登录或登录已失效，请重新登录后再操作。";
const ADMIN_ONLY_MESSAGE =
  "用户账号不能发送聊天、登记还款或管理账号，该操作只认管理员。";
/* v16 新增的两类 403 拒绝（文案含且只含「只认管理员」标记，与上面的
   契约同一套状态码映射规则）：
   - PERMISSION_DENIED：操作员的这项权限被管理员在权限管理里关掉了；
   - SCOPE_DENIED：普通操作员访问不属于自己负责范围的案件。 */
const PERMISSION_DENIED_MESSAGE =
  "你的这项操作权限已被管理员关闭，该操作只认管理员在「权限管理」里重新开通后才能使用。";
const SCOPE_DENIED_MESSAGE =
  "该案件不在你的负责范围内，你只能查看和操作分给自己的案件；全部案件只认管理员与分案主管。";

/* 限流拒绝文案与 429 的契约（与上面的 401/403 契约同一套机制）：
   一切限流拒绝统一用这条文案——含「稍后再试」、不含「未登录」「只认管理员」。
   生产后端分发层同步时须在 500 兜底之前加一条规则：含「稍后再试」→ 429。 */
const RATE_LIMIT_MESSAGE = "操作过于频繁，请稍后再试。";

/* ---------------- 通用限流（进程内滑动窗口） ----------------
   action 运行环境拿不到请求 IP，这里按会话令牌（公开接口按业务键）
   做进程内限流作为兜底；按 IP 的限流在生产 HTTP 层执行（见 DATA-PLAN）。 */

/* 债务人限流口径（用户 2026-11-10 亲定：债务人跟用户聊天不应该出现频繁
   限制，除非用户禁言债务人）：
   - 聊天（发消息 sendDebtorMessage、拉取聊天 getDebtorChat）不做任何频率
     限制，不调 checkVerifyRateLimit；唯一的管控是管理员/用户手动禁言
     （setCaseMuted，禁言后发送直接拒绝「该账号已被禁言」）。
   - 只剩两类动作还限流（按 kind 分桶，互不抢额度）：
     verify：核验身份，同一身份证号或同一手机号 10 分钟 20 次（防爆破身份证号）；
     payment：传付款截图，同一身份证号 10 分钟 20 次。
   全站总量上限按 kind 各算（600 次/10 分钟，防扫描）。生产 HTTP 层另按 IP
   做同口径限流（核验与传截图）。 */
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMITS = {
  verify: { max: 20, globalMax: 600 },
  payment: { max: 20, globalMax: 600 },
} as const;
type RateLimitKind = keyof typeof RATE_LIMITS;

// 核验限流（库表持久化）：先数最近 10 分钟同 kind 的尝试再决定放不放行；
// 被限流的尝试不再记入，避免窗口被堵后无限延长；顺带清理窗口外旧记录。
// 身份证号归一化比对（去全部空格、转大写）；手机号有值时也按手机号计数。
// 检查+记入必须串行：并发下先查后插会互相看不到计数，导致同一窗口内超发
//（单容器部署，进程内互斥即够用；计数本身仍落库表，重启不丢）。
let verifyLimitQueue: Promise<void> = Promise.resolve();
function checkVerifyRateLimit(
  db: SpaceDb<typeof schema>,
  idCardNorm: string,
  phoneNorm: string,
  kind: RateLimitKind,
): Promise<void> {
  const run = verifyLimitQueue.then(() =>
    checkVerifyRateLimitInner(db, idCardNorm, phoneNorm, kind),
  );
  verifyLimitQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function checkVerifyRateLimitInner(
  db: SpaceDb<typeof schema>,
  idCardNorm: string,
  phoneNorm: string,
  kind: RateLimitKind,
): Promise<void> {
  const limits = RATE_LIMITS[kind];
  const windowStart = new Date(Date.now() - VERIFY_WINDOW_MS);
  const recentAttempts = await db
    .select()
    .from(schema.verifyAttempts)
    .where(
      and(
        gt(schema.verifyAttempts.createdAt, windowStart),
        eq(schema.verifyAttempts.kind, kind),
      ),
    );
  const norm = (v: string | null | undefined) =>
    (v ?? "").replace(/\s+/g, "").toUpperCase();
  const idAttempts = recentAttempts.filter(
    (a) => norm(a.idCard) === norm(idCardNorm),
  ).length;
  const phoneAttempts =
    phoneNorm !== ""
      ? recentAttempts.filter((a) => (a.phone ?? "") === phoneNorm).length
      : 0;
  if (
    idAttempts >= limits.max ||
    phoneAttempts >= limits.max ||
    recentAttempts.length >= limits.globalMax
  ) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
  await db
    .insert(schema.verifyAttempts)
    .values({ idCard: norm(idCardNorm), phone: phoneNorm, kind });
  await db
    .delete(schema.verifyAttempts)
    .where(lt(schema.verifyAttempts.createdAt, windowStart));
}

const rateBuckets = new Map<string, number[]>();

// 记一次访问并返回是否已超限。超限时不记入，避免窗口被堵死后无限延长。
function hitRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    rateBuckets.set(key, arr);
    return true;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return false;
}

// 给每个业务接口套上登录与权限校验：请求里多收一个 sessionToken
// （本地会话令牌），未登录一律拒绝（401 文案）；管理员全通；操作员
// 按「权限管理」里授予他的权限逐项放行（关掉即 403），账号与权限
// 管理本身只认管理员。会话解析后放进 sessionStore，handler 里据此
// 做分案范围过滤与经手人记录。
function guardActions<T extends Record<string, AnyActionDef>>(defs: T): T {
  const out: Record<string, AnyActionDef> = {};
  for (const [name, def] of Object.entries(defs)) {
    if (PUBLIC_ACTIONS.has(name)) {
      out[name] = def;
      continue;
    }
    const request = (def.request as z.ZodObject<z.ZodRawShape>).passthrough();
    out[name] = {
      ...def,
      request,
      handler: async (ctx: Ctx, args: unknown) => {
        const rec: Record<string, unknown> =
          typeof args === "object" && args !== null
            ? (args as Record<string, unknown>)
            : {};
        const token =
          typeof rec.sessionToken === "string" ? rec.sessionToken : "";
        // 通用限流：同一会话每分钟最多 300 次调用，正常使用与批量导入
        // （单次请求提交整批）都远低于此线，只挡脚本式狂刷。
        if (
          hitRateLimit(`guard:${token ? token.slice(-16) : "anon"}`, 300, 60_000)
        ) {
          throw new Error(RATE_LIMIT_MESSAGE);
        }
        const session = await sessionForToken(ctx, token);
        if (!session) throw new Error(NOT_LOGGED_IN_MESSAGE);
        if (session.role !== "admin") {
          if (ADMIN_ONLY_ACTIONS.has(name)) {
            throw new Error(ADMIN_ONLY_MESSAGE);
          }
          const required = ACTION_PERMISSIONS.get(name);
          if (required) {
            if (!session.permissions.has(required)) {
              throw new Error(PERMISSION_DENIED_MESSAGE);
            }
          } else if (!READ_ACTIONS.has(name)) {
            // 未登记的业务动作默认只认管理员，防新接口漏配权限。
            throw new Error(ADMIN_ONLY_MESSAGE);
          }
        }
        sessionStore.set(ctx, session);
        try {
          return await def.handler(ctx, rec);
        } finally {
          sessionStore.delete(ctx);
        }
      },
    };
  }
  return out as unknown as T;
}

export const Actions = guardActions(baseActions);
