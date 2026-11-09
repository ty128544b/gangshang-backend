import {
  defineAction,
  z,
  type ActionDefinition,
  type ActionsModule,
  type Ctx,
  type SpaceDb,
} from "./shim";
import { asc, desc, eq, gt, lt, sql } from "drizzle-orm";
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
  hasImage: z.boolean(),
  imageUrl: z.string().nullable(),
  createdAt: z.string(),
});

/** 债务人端聊天记录：不含案件 id 与分析，只含展示所需字段。 */
const debtorChatMessageOut = z.object({
  id: z.number(),
  sender: z.enum(["debtor", "agent", "system"]),
  text: z.string(),
  hasImage: z.boolean(),
  imageUrl: z.string().nullable(),
  createdAt: z.string(),
});

/** 聊天消息行转出参：有图时解析 blob 查看地址，无图时 imageUrl 为 null。 */
async function chatMessageToOut(
  ctx: Ctx,
  m: typeof schema.chatMessages.$inferSelect,
) {
  const hasImage = !!m.imageBlobKey;
  return {
    id: m.id,
    caseId: m.caseId,
    sender: m.sender,
    text: m.text,
    analysis: m.analysis,
    hasImage,
    imageUrl: hasImage
      ? await ctx.blobs.getUrl(m.imageBlobKey as string)
      : null,
    createdAt: m.createdAt.toISOString(),
  };
}

const agreementOut = z.object({
  id: z.number(),
  caseId: z.number(),
  kind: z.enum(["installment", "waiver", "settlement"]),
  detail: z.string(),
  amountCents: z.number(),
  status: z.enum(["active", "done", "void"]),
  createdAt: z.string(),
});

const paymentOut = z.object({
  id: z.number(),
  caseId: z.number(),
  amountCents: z.number(),
  paidOn: z.string(),
  note: z.string(),
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

const loginOut = z.object({
  ok: z.boolean(),
  token: z.string().nullable(),
  role: z.enum(["admin", "user"]).nullable(),
  error: z.string(),
});

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
      const rows = await db
        .select()
        .from(schema.cases)
        .orderBy(desc(schema.cases.updatedAt));
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
          );
        }),
        totalCases: rows.length,
        totalDueCents: rows.reduce((sum, r) => sum + r.totalDueCents, 0),
        pendingSendCount: rows.filter((r) => r.status === "draft").length,
        sentCount: rows.filter((r) => r.status === "sent").length,
      };
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
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const caseRows = await db.select().from(schema.cases);
      const payRows = await db.select().from(schema.payments);
      const agreementRows = await db.select().from(schema.agreements);
      const chatRows = await db.select().from(schema.chatMessages);
      const clickRows = await db.select().from(schema.linkClicks);
      const loginRows = await db.select().from(schema.debtorLogins);

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
      await db.insert(schema.linkClicks).values({ caseId: row.id });
      return { ok: true };
    },
  }),

  verifyIdentity: defineAction({
    description:
      "债务人登录身份核验：以身份证号为核验依据匹配案件记录，手机号必填（现用手机号即可，不要求与台账手机号一致；换了手机号时，只要身份证号与案件记录一致即可认出其案件）。身份证号未命中时不返回任何案件信息。核验成功时记一条该案件的登录记录（debtor_logins）：保存本次登录填写的手机号（与台账手机号不一致也照记，两个都保留），以及债务人网页按本次登录请求 IP 解析出的地理位置（loginCountry/loginProvince/loginCity，国家/省/市，可空——网页静默解析、不要求债务人授权定位，解析不到就不带，核验流程不受影响），供后台名单展示登录地点并与台账地区比对。",
    request: z.object({
      idCard: z.string().min(1, "身份证号不能为空"),
      phone: z.string().trim().min(1, "请填写手机号"),
      loginCountry: z.string().default(""),
      loginProvince: z.string().default(""),
      loginCity: z.string().default(""),
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
      // 本次登录按请求 IP 解析出的地理位置（网页带入，可能为空）：归一化后随登录记录落库。
      const loginLoc = {
        country: normalizeCountry(args.loginCountry ?? ""),
        province: normalizeProvince(args.loginProvince ?? ""),
        city: (args.loginCity ?? "").trim(),
      };
      const hasLoginLoc = !!(loginLoc.country || loginLoc.province || loginLoc.city);
      if (!idCardNorm) {
        return { found: false, matchedByIdCard: false, phoneChanged: false, case: null };
      }
      // 核验限流（库表持久化，防身份证号爆破/扫描）：先数最近 10 分钟的尝试
      // 再决定放不放行；被限流的尝试不再记入，避免窗口被堵后无限延长；
      // 顺带清理窗口外旧记录。同一身份证号或手机号 10 分钟内最多 20 次，
      // 全站 10 分钟 600 次兜底。生产 HTTP 层另有按 IP 的同口径限流。
      await checkVerifyRateLimit(db, idCardNorm, phoneNorm);
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
        // 核验成功即记一次登录：保存本次登录填写的手机号（与台账号不一致也照记）
        // 与本次登录的 IP 归属地；两者都为空时不记空行。
        if (phoneNorm || hasLoginLoc) {
          await db.insert(schema.debtorLogins).values({
            caseId: fallback.id,
            phone: phoneNorm,
            ...loginLoc,
          });
        }
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
      // 核验成功即记一次登录：保存本次登录填写的手机号（与台账号不一致也照记）
      // 与本次登录的 IP 归属地；两者都为空时不记空行。
      if (phoneNorm || hasLoginLoc) {
        await db.insert(schema.debtorLogins).values({
          caseId: row.id,
          phone: phoneNorm,
          ...loginLoc,
        });
      }
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
      const result = await db
        .insert(schema.cases)
        .values({ ...args, idCard: args.idCard.trim().toUpperCase() })
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
        const inserted = await db
          .insert(schema.cases)
          .values({ ...fields, idCard: fields.idCard.trim().toUpperCase() })
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
    description: "保存一个案件的欠款内容（债务人、金额、逾期、罚息、债权方等）。",
    request: z.object({ id: z.number().int().positive(), ...caseFields }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const { id, ...fields } = args;
      await db
        .update(schema.cases)
        .set({ ...fields, idCard: fields.idCard.trim().toUpperCase(), updatedAt: new Date() })
        .where(eq(schema.cases.id, id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteCase: defineAction({
    description: "删除一个案件及其全部进度步骤与发送记录。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db.batch([
        db.delete(schema.progressSteps).where(eq(schema.progressSteps.caseId, args.id)),
        db.delete(schema.sendRecords).where(eq(schema.sendRecords.caseId, args.id)),
        db.delete(schema.chatMessages).where(eq(schema.chatMessages.caseId, args.id)),
        db.delete(schema.agreements).where(eq(schema.agreements.caseId, args.id)),
        db.delete(schema.payments).where(eq(schema.payments.caseId, args.id)),
        db.delete(schema.cases).where(eq(schema.cases.id, args.id)),
      ]);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteAllCases: defineAction({
    description:
      "一键删除全部案件及其全部进度、发送记录、聊天、协议、还款记录、链接点击与登录记录，不可恢复。管理员与用户账号均可用。",
    request: z.object({}),
    response: z.object({ ok: z.boolean(), deletedCount: z.number() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select({ id: schema.cases.id })
        .from(schema.cases);
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
      await db
        .delete(schema.progressSteps)
        .where(eq(schema.progressSteps.id, args.id));
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
          messages.map((m) => chatMessageToOut(ctx, m)),
        ),
        agreements: agreements.map((a) => ({
          id: a.id,
          caseId: a.caseId,
          kind: a.kind,
          detail: a.detail,
          amountCents: a.amountCents,
          status: a.status,
          createdAt: a.createdAt.toISOString(),
        })),
      };
    },
  }),

  addChatMessage: defineAction({
    description:
      "往案件的聊天协商里记一条消息（债务人的话或我方回复），与网页聊天同一条记录。文字与图片至少要有一个：只发文字、只发图片、图文一起发都可以。",
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
      // 图片先解码校验大小，超 5MB 直接拒绝，不留空消息行。
      let bytes: Buffer | null = null;
      if (args.image) {
        bytes = Buffer.from(args.image.dataBase64, "base64");
        if (bytes.length > 5 * 1024 * 1024) {
          throw new Error("HTTP400:图片文件过大，请上传 5MB 以内的图片");
        }
      }
      const result = await db
        .insert(schema.chatMessages)
        .values({ caseId: args.caseId, sender: args.sender, text: args.text })
        .returning({ id: schema.chatMessages.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addChatMessage: insert returned no rows");
      if (args.image && bytes) {
        const randomHex = Array.from(
          crypto.getRandomValues(new Uint8Array(16)),
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const key = `chat-images/${inserted.id}-${randomHex}`;
        await ctx.blobs.put(key, bytes, {
          contentType: args.image.mimeType,
        });
        await db
          .update(schema.chatMessages)
          .set({ imageBlobKey: key })
          .where(eq(schema.chatMessages.id, inserted.id));
      }
      ctx.invalidateQueries();
      return { id: inserted.id };
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
      // 纯图片消息（没有文字）无法逐句分析，直接返回空，不编造分析。
      if (!msg.text.trim()) return { ok: false, analysis: "" };
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
        .where(eq(schema.chatMessages.id, args.messageId));
      ctx.invalidateQueries();
      return { ok: true, analysis };
    },
  }),

  deleteChatMessage: defineAction({
    description: "删除一条聊天协商消息，消息带图片时一并删掉图片文件。",
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
      if (row?.imageBlobKey) {
        try {
          await ctx.blobs.delete(row.imageBlobKey);
        } catch {
          /* 图片文件已不在也不拦删除 */
        }
      }
      await db
        .delete(schema.chatMessages)
        .where(eq(schema.chatMessages.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  getChatImage: defineAction({
    description: "取一条聊天消息的图片查看地址，没有图片时返回 null，需登录。",
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
      const url = await ctx.blobs.getUrl(row.imageBlobKey);
      return { url: url ?? null };
    },
  }),

  getDebtorChat: defineAction({
    description:
      "债务人公开读取自己案件的聊天记录：凭案件 id 与身份证号双重校验，不需登录令牌；返回该案件的全部聊天消息，含图片查看地址。",
    request: z.object({
      caseId: z.number().int().positive(),
      idCard: z
        .string()
        .trim()
        .min(18, "身份证号必须为18位")
        .max(18, "身份证号必须为18位"),
    }),
    response: z.object({ messages: z.array(debtorChatMessageOut) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const idCardNorm = args.idCard.trim().toUpperCase();
      // 限流与核验同口径（库表持久化）：先数最近 10 分钟同一身份证号的尝试
      // 再决定放不放行；被限流的尝试不再记入；顺带清理窗口外旧记录。
      await checkVerifyRateLimit(db, idCardNorm, "");
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.id, args.caseId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error("HTTP400:未找到匹配的案件记录");
      if ((row.idCard ?? "").trim().toUpperCase() !== idCardNorm) {
        throw new Error("HTTP400:身份证号与案件不匹配");
      }
      const messages = await db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.caseId, args.caseId))
        .orderBy(asc(schema.chatMessages.id));
      return {
        messages: await Promise.all(
          messages.map(async (m) => {
            const hasImage = !!m.imageBlobKey;
            return {
              id: m.id,
              sender: m.sender,
              text: m.text,
              hasImage,
              imageUrl: hasImage
                ? await ctx.blobs.getUrl(m.imageBlobKey as string)
                : null,
              createdAt: m.createdAt.toISOString(),
            };
          }),
        ),
      };
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
      const result = await db
        .insert(schema.agreements)
        .values({ ...args, status: "active" })
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
      await db
        .delete(schema.agreements)
        .where(eq(schema.agreements.id, args.id));
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
      const result = await db
        .insert(schema.payments)
        .values({
          caseId: args.caseId,
          amountCents: args.amountCents,
          paidOn: args.paidOn,
          note: args.note,
        })
        .returning({ id: schema.payments.id });
      const inserted = result[0];
      if (!inserted) throw new Error("addPayment: insert returned no rows");
      if (args.screenshot) {
        const randomHex = Array.from(
          crypto.getRandomValues(new Uint8Array(16)),
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const key = `payment-screenshots/${inserted.id}-${randomHex}`;
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
      return { id: inserted.id };
    },
  }),

  submitPaymentScreenshot: defineAction({
    description:
      "债务人公开上传付款截图：凭案件 id 与身份证号双重校验后登记一笔待对账还款并存截图，不需登录令牌。",
    request: z.object({
      caseId: z.number().int().positive(),
      idCard: z.string().trim().min(18, "身份证号必须为18位").max(18, "身份证号必须为18位"),
      amountCents: z.number().int().min(1, "还款金额必须大于 0"),
      paidOn: z.string().min(1, "请填写还款日期"),
      note: z.string().default(""),
      screenshot: z.object({
        dataBase64: z.string().min(1, "请上传付款截图"),
        mimeType: z
          .string()
          .regex(/^image\//, "截图必须是图片"),
      }),
    }),
    response: z.object({ id: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const idCardNorm = args.idCard.trim().toUpperCase();
      // 限流与核验同口径（库表持久化）：先数最近 10 分钟同一身份证号的尝试
      // 再决定放不放行；被限流的尝试不再记入；顺带清理窗口外旧记录。
      await checkVerifyRateLimit(db, idCardNorm, "");
      const rows = await db
        .select()
        .from(schema.cases)
        .where(eq(schema.cases.id, args.caseId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error("HTTP400:未找到匹配的案件记录");
      if ((row.idCard ?? "").trim().toUpperCase() !== idCardNorm) {
        throw new Error("HTTP400:身份证号与案件不匹配");
      }
      const bytes = Buffer.from(args.screenshot.dataBase64, "base64");
      if (bytes.length > 5 * 1024 * 1024) {
        throw new Error("HTTP400:截图文件过大，请上传 5MB 以内的图片");
      }
      const result = await db
        .insert(schema.payments)
        .values({
          caseId: args.caseId,
          amountCents: args.amountCents,
          paidOn: args.paidOn,
          note: args.note,
        })
        .returning({ id: schema.payments.id });
      const inserted = result[0];
      if (!inserted) throw new Error("submitPaymentScreenshot: insert returned no rows");
      const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const key = `payment-screenshots/${inserted.id}-${randomHex}`;
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
    description: "给一笔还款做银行对账标记：待对账、已对平或对不上。",
    request: z.object({
      id: z.number().int().positive(),
      status: z.enum(["pending", "matched", "mismatch"]),
    }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .update(schema.payments)
        .set({ reconcileStatus: args.status })
        .where(eq(schema.payments.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deletePayment: defineAction({
    description: "删除一笔还款记录。",
    request: z.object({ id: z.number().int().positive() }),
    response: z.object({ ok: z.boolean() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.payments)
        .where(eq(schema.payments.id, args.id));
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
      const url = await ctx.blobs.getUrl(row.screenshotBlobKey);
      return { url: url ?? null };
    },
  }),

  /* ---------------- 首页内容：审结案件 + 律师动态 ---------------- */

  getHomepageContent: defineAction({
    description: "读取债务人网页首页展示的全部内容：系统名称、近期法院审结案件、律师工作动态、保全划扣板块、今日已还款、顶部执行状态滚动条、失信惩戒、聊天付款卡设置与账单示例（后台改动即网页同步；新板块后端无数据时返回空列表/空对象，网页按现有占位显示）。",
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
      await db
        .delete(schema.courtCases)
        .where(eq(schema.courtCases.id, args.id));
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
      await db
        .delete(schema.lawyerUpdates)
        .where(eq(schema.lawyerUpdates.id, args.id));
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
      await db
        .delete(schema.preservationFeedItems)
        .where(eq(schema.preservationFeedItems.id, args.id));
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
      await db
        .delete(schema.todayRepayments)
        .where(eq(schema.todayRepayments.id, args.id));
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
      await db
        .delete(schema.tickerItems)
        .where(eq(schema.tickerItems.id, args.id));
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
      await db
        .delete(schema.punishmentItems)
        .where(eq(schema.punishmentItems.id, args.id));
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
      "首次打开后台时设置管理员密码与用户密码（仅在尚未设置时可用），设置成功后直接以管理员身份进入后台。",
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
          error: "密码已经设置过了，请直接登录。",
        };
      }
      const secret = randomBytesBase64Url(32);
      await db.insert(schema.authCredentials).values({
        adminHash: await hashPassword(args.adminPassword),
        userHash: await hashPassword(args.userPassword),
        sessionSecret: secret,
        userDisabled: 0,
      });
      ctx.invalidateQueries();
      return {
        ok: true,
        token: await signToken(secret, "admin"),
        role: "admin",
        error: "",
      };
    },
  }),

  login: defineAction({
    description:
      "后台登录：选择管理员或用户账号并输入对应密码，成功返回会话令牌。防爆破：同一账号连续输错 5 次锁定 15 分钟，锁定期间输对密码也进不来；登录成功清零失败计数。",
    request: z.object({
      role: z.enum(["admin", "user"]),
      password: z.string().min(1, "请输入密码"),
    }),
    response: loginOut,
    async handler(ctx, args): Promise<z.infer<typeof loginOut>> {
      const db = ctx.db<typeof schema>();
      const row = await loadCredentials(ctx);
      if (!row) {
        return {
          ok: false,
          token: null,
          role: null,
          error: "尚未设置密码，请先完成首次设置。",
        };
      }
      if (args.role === "user" && row.userDisabled === 1) {
        return {
          ok: false,
          token: null,
          role: null,
          error: "用户账号已被管理员停用，无法登录。",
        };
      }
      const failCount =
        args.role === "admin" ? row.adminFailCount : row.userFailCount;
      const lockedUntil =
        args.role === "admin" ? row.adminLockedUntil : row.userLockedUntil;
      const now = Date.now();
      if (lockedUntil > now) {
        const mins = Math.max(1, Math.ceil((lockedUntil - now) / 60_000));
        return {
          ok: false,
          token: null,
          role: null,
          error: `连续输错密码次数过多，该账号已锁定，请 ${mins} 分钟后再试。`,
        };
      }
      const stored = args.role === "admin" ? row.adminHash : row.userHash;
      if (!(await verifyPassword(args.password, stored))) {
        // 原子递增：并发下多次输错也不会互相覆盖计数（SQL 层 +1，再读回最新值定夺）。
        // 先查后写在这里是错的——PBKDF2 验密耗时几十毫秒，并发请求会全读到旧计数。
        if (args.role === "admin") {
          await db
            .update(schema.authCredentials)
            .set({
              adminFailCount: sql`${schema.authCredentials.adminFailCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(schema.authCredentials.id, row.id));
        } else {
          await db
            .update(schema.authCredentials)
            .set({
              userFailCount: sql`${schema.authCredentials.userFailCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(schema.authCredentials.id, row.id));
        }
        const fresh = await loadCredentials(ctx);
        const next = fresh
          ? args.role === "admin"
            ? fresh.adminFailCount
            : fresh.userFailCount
          : 0;
        if (next >= LOGIN_MAX_FAILURES) {
          await updateLoginLockState(ctx, row.id, args.role, 0, now + LOGIN_LOCK_MS);
          return {
            ok: false,
            token: null,
            role: null,
            error: "密码不正确。已连续输错 5 次，该账号锁定 15 分钟，请稍后再试。",
          };
        }
        return { ok: false, token: null, role: null, error: "密码不正确，请重新输入。" };
      }
      if (failCount !== 0 || lockedUntil !== 0) {
        await updateLoginLockState(ctx, row.id, args.role, 0, 0);
      }
      return {
        ok: true,
        token: await signToken(row.sessionSecret, args.role),
        role: args.role,
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

  getSession: defineAction({
    description: "校验会话令牌，返回当前登录身份；未登录、已过期或账号被停用时身份为空。",
    request: z.object({ token: z.string().default("") }),
    response: z.object({ role: z.enum(["admin", "user"]).nullable() }),
    async handler(ctx, args) {
      const role = await roleForToken(ctx, args.token);
      return { role };
    },
  }),

  changePasswords: defineAction({
    description:
      "管理员修改登录密码：可改管理员密码、用户密码或两者一起改，留空的项不改。仅管理员可用。",
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
      if (args.userPassword) {
        if (args.userPassword.length < 4) throw new Error("用户密码至少 4 位。");
        patch.userHash = await hashPassword(args.userPassword);
        patch.userFailCount = 0;
        patch.userLockedUntil = 0;
      }
      if (!patch.adminHash && !patch.userHash) throw new Error("没有要修改的密码。");
      await db
        .update(schema.authCredentials)
        .set(patch)
        .where(eq(schema.authCredentials.id, row.id));
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
} satisfies ActionsModule;

/* 限流拒绝文案与 429 的契约（与 401/403 契约同一套机制）：
   一切库表限流拒绝统一用这条文案——含「稍后再试」、不含「未登录」「只认管理员」。
   分发层按文案定状态码：含「稍后再试」→ 429。 */
const RATE_LIMIT_MESSAGE = "操作过于频繁，请稍后再试。";

/* 债务人核验限流口径（库表持久化，verify_attempts 表计数）：
   同一身份证号或同一手机号，10 分钟内最多核验 20 次；
   全站 10 分钟总量上限 600 次兜底防扫描。
   生产 HTTP 层另按 IP 做同口径（同 IP 10 分钟 20 次）限流。 */
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_MAX_PER_WINDOW = 20;
const VERIFY_GLOBAL_MAX_PER_WINDOW = 600;

// 核验限流（库表持久化）：先数最近 10 分钟的尝试再决定放不放行；
// 被限流的尝试不再记入，避免窗口被堵后无限延长；顺带清理窗口外旧记录。
// 身份证号归一化比对（去全部空格、转大写）；手机号有值时也按手机号计数。
// 检查+记入必须串行：并发下先查后插会互相看不到计数，导致同一窗口内超发
//（单容器部署，进程内互斥即够用；计数本身仍落库表，重启不丢）。
let verifyLimitQueue: Promise<void> = Promise.resolve();
function checkVerifyRateLimit(
  db: SpaceDb<typeof schema>,
  idCardNorm: string,
  phoneNorm: string,
): Promise<void> {
  const run = verifyLimitQueue.then(() =>
    checkVerifyRateLimitInner(db, idCardNorm, phoneNorm),
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
): Promise<void> {
  const windowStart = new Date(Date.now() - VERIFY_WINDOW_MS);
  const recentAttempts = await db
    .select()
    .from(schema.verifyAttempts)
    .where(gt(schema.verifyAttempts.createdAt, windowStart));
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
    idAttempts >= VERIFY_MAX_PER_WINDOW ||
    phoneAttempts >= VERIFY_MAX_PER_WINDOW ||
    recentAttempts.length >= VERIFY_GLOBAL_MAX_PER_WINDOW
  ) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
  await db
    .insert(schema.verifyAttempts)
    .values({ idCard: norm(idCardNorm), phone: phoneNorm });
  await db
    .delete(schema.verifyAttempts)
    .where(lt(schema.verifyAttempts.createdAt, windowStart));
}

/* 登录防爆破（库表持久化，auth_credentials 表的锁定列）：
   同一账号连续输错 5 次锁定 15 分钟，按账号计，不依赖请求 IP；
   生产 HTTP 层另有按 IP+账号 的同口径拦截）。
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

async function signToken(secret: string, role: AuthRole): Promise<string> {
  const payload = bytesToBase64Url(
    textEncoder.encode(
      JSON.stringify({ role, exp: Date.now() + SESSION_TTL_MS }),
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

async function roleForToken(ctx: Ctx, token: string): Promise<AuthRole | null> {
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
  // 用户账号被管理员停用后，其已有会话立即失效
  if (role === "user" && row.userDisabled === 1) return null;
  return role;
}

/* ---------------- 权限守卫 ---------------- */

// 登录相关接口与债务人端点击记录不守卫（内部自行校验）。
// 注意：verifyIdentity 与 getHomepageContent 必须是公开的——债务人网页
// （Netlify 前端）在未登录状态下直接调它们（核验登录、首页内容），请求里
// 不带 sessionToken；如果把它们留在守卫里，债务人登录与首页内容加载会
// 被 guardActions 以“未登录”全部拒绝。原空间 artifact 的守卫把这两
// 个放在 READ_ACTIONS 而非 PUBLIC_ACTIONS，债务人端同样会被拦，这是
// 原实现的一个潜在问题；独立部署这里按前端实际调用方式修正。
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
]);

// 只读查看：管理员与用户都能用
const READ_ACTIONS: ReadonlySet<string> = new Set([
  "listCases",
  "getStats",
  "verifyIdentity",
  "getCase",
  "getChat",
  "getChatImage",
  "getPayments",
  "getPaymentScreenshot",
  "getHomepageContent",
]);

// 案件台账写入：管理员与用户都能建、改、删、导案件
//（新建 / Excel 导入 / 修改 / 删除单个 / 删除全部 / 进度步骤 / 发送登记）。
// 仍只认管理员的：聊天发送与分析、协议、还款登记与对账、改密码、停用账号。
const CASE_WRITE_ACTIONS: ReadonlySet<string> = new Set([
  "createCase",
  "importCases",
  "updateCase",
  "deleteCase",
  "deleteAllCases",
  "addStep",
  "updateStep",
  "deleteStep",
  "registerSend",
]);

// 网页首页内容（页面信息）编辑：管理员与用户都能改
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
  "updateDemoBill",
  "updateSystemName",
]);

type AnyActionDef = ActionDefinition<z.ZodType, z.ZodType>;

// 给每个业务接口套上登录与角色校验：请求里多收一个 sessionToken（本地会话令牌），
// 未登录一律拒绝；只读查看、案件台账写入与网页首页内容编辑管理员与用户都能用，
// 聊天发送、还款登记、改密码、停用账号只认管理员。
function guardActions<T extends Record<string, AnyActionDef>>(defs: T): T {
  const out: Record<string, AnyActionDef> = {};
  for (const [name, def] of Object.entries(defs)) {
    if (PUBLIC_ACTIONS.has(name)) {
      out[name] = def;
      continue;
    }
    const userAllowed =
      READ_ACTIONS.has(name) ||
      PAGE_EDIT_ACTIONS.has(name) ||
      CASE_WRITE_ACTIONS.has(name);
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
        const role = await roleForToken(ctx, token);
        if (!role) throw new Error("未登录或登录已失效，请重新登录后再操作。");
        if (role !== "admin" && !userAllowed) {
          throw new Error(
            "用户账号不能发送聊天、登记还款或管理账号，该操作只认管理员。",
          );
        }
        return def.handler(ctx, rec);
      },
    };
  }
  return out as unknown as T;
}

export const Actions = guardActions(baseActions);
