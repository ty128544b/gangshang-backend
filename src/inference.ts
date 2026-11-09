// 本地规则分析：替代空间的 ctx.inference.complete。
//
// 原后端 analyzeChatMessage 用托管模型分析债务人的一句话，产出
// {intent, willingness, risk, suggestion}，再拼成
// "意图：…\n还款意愿：…\n风险点：…\n建议话术：…" 存回聊天记录；
// 后台的还款意愿推导（computeWillingness）靠正则从该文本里抓
// "还款意愿：高/中/低"。
//
// 独立部署没有托管模型。这里用关键词规则产出同样格式的分析：
// 意愿判断与原后端 HOLD_REASON_RULES 同一套信号词，willingness
// 字段首字固定为 高/中/低，保证下游正则能抓到。
// 这是明确的降级（不是真 AI），README 里有说明；以后接上 LLM
// 端点时，把 LLM_INFERENCE_URL 配上即可替换为真模型。
import type { InferenceClient } from "./shim";

type Level = "高" | "中" | "低";

const RULES: {
  test: RegExp;
  level: Level;
  intent: string;
  risk: string;
  suggestion: string;
}[] = [
  {
    test: /今天.{0,3}还|马上.{0,3}还|立刻.{0,3}还|现在.{0,3}还|明天还|一定还|尽快|我还钱|我还款|一次结清|全额还/,
    level: "高",
    intent: "明确表示要还款，态度积极",
    risk: "无",
    suggestion: "请今天内把款打到对公账户，打完把截图发我，我马上给您出结清确认。",
  },
  {
    test: /减免|能不能少|少还|少点|打折|优惠|抹个零|免掉|减点|便宜点/,
    level: "中",
    intent: "想谈减免，希望少还一部分再结清",
    risk: "减免谈判可能拉长周期，需限定回复期限",
    suggestion: "一次性结清可以谈个方案，我先给您算一下今天结清的金额，您看今天能定下来吗？",
  },
  {
    test: /分期|分几期|按月还|每个月还|每月还|慢慢还|分批还|先还一部分|先还一点/,
    level: "中",
    intent: "一次拿不出全款，想分期或先还一部分",
    risk: "分期方案未落成协议前容易空转",
    suggestion: "我给您一个分期方案，期数和每期金额都列清楚，您确认后我们落成协议，首期今天先付。",
  },
  {
    test: /发工资|工资|发薪|薪水|月底|月初|到账|等钱到|回款|结账|工程款/,
    level: "中",
    intent: "在等发工资或等一笔钱到账，到账后再还",
    risk: "到账日期不明确，可能顺延",
    suggestion: "您工资哪天到账？我们就定那天还款，到期当天我再提醒您一次。",
  },
  {
    test: /家人|家里人|老婆|老公|父母|商量|跟家里|问问家里/,
    level: "中",
    intent: "要先跟家人商量，还没有定下来",
    risk: "商量无明确回复时间，容易拖延",
    suggestion: "您跟家人商量好大概需要多久？我们定个时间，到点我再联系您确认。",
  },
  {
    test: /过几天|过两天|过段时间|过阵子|下周|缓缓|宽限|再等等|等几天|忙完这阵/,
    level: "中",
    intent: "只说过几天再还，没有给出确切日期",
    risk: "只给模糊时间，可能拖延",
    suggestion: "我们把最晚还款日定在 X 月 X 日，您看可以吗？到期前我会再提醒您。",
  },
  {
    test: /没钱|失业|没工作|困难|生病|住院|没收入|收入低|实在没/,
    level: "中",
    intent: "当前资金困难，暂时拿不出钱",
    risk: "困难情况未核实，分期起点需谈定",
    suggestion: "您现在一个月大概能拿出多少？我们先定一个您能承受的首笔金额和日期。",
  },
  {
    test: /核实|真的假的|是不是骗|诈骗|骗子|正规吗|凭证|证明一下|授权书|委托书|营业执照|对公账户/,
    level: "低",
    intent: "怕被骗，要先核实身份与债权的真实性",
    risk: "对债权真实性存疑，可能拖延或拒还",
    suggestion: "我把对公账户信息和债权转让凭证发给您核实，您核实完告诉我，今天我们把还款时间定下来。",
  },
  {
    test: /金额不对|算错|没借这么多|不是我借|已经还了|还过了|利息太高|罚息太高|不认可|没这么多/,
    level: "低",
    intent: "对欠款金额或构成有异议，账还没有对清",
    risk: "对金额有异议，对账未完成前不会还款",
    suggestion: "我把本金、罚息和已还记录逐项列给您对账，对清后我们今天把还款安排定下来。",
  },
  {
    test: /不还|就不给|法院见|起诉我吧|爱咋咋|没钱还你|别烦我/,
    level: "低",
    intent: "明确拒绝还款或对抗",
    risk: "对抗态度，协商可能无效，需走保全与失信程序",
    suggestion: "这笔欠款判决已经生效，拒不履行会冻结支付账户并列入失信。今天把还款方案定下来，对您最有利。",
  },
];

function extractDebtorSentence(prompt: string): string {
  const m = prompt.match(/要分析的这句（债务人）：([\s\S]*)$/);
  if (m) return (m[1] ?? "").trim();
  const lines = prompt.split("\n").filter(Boolean);
  return (lines[lines.length - 1] ?? "").trim();
}

export function analyzeLocally(prompt: string): {
  intent: string;
  willingness: string;
  risk: string;
  suggestion: string;
} {
  const text = extractDebtorSentence(prompt);
  for (const rule of RULES) {
    if (rule.test.test(text)) {
      return {
        intent: rule.intent,
        willingness: `${rule.level}：${rule.intent}`,
        risk: rule.risk,
        suggestion: rule.suggestion,
      };
    }
  }
  return {
    intent: "参与协商，但未明确表态",
    willingness: "中：已参与协商，尚未明确还款时间和方式",
    risk: "无明确信号，需电话跟进确认",
    suggestion: "您看这周内哪天方便把这笔款结清？我们定个具体日期。",
  };
}

export function createLocalInference(): InferenceClient {
  return {
    async complete(prompt, options) {
      const out = analyzeLocally(prompt);
      // 按调用方给的 zod schema 校验，保证返回结构与原托管模型一致。
      return options.schema.parse(out) as never;
    },
  };
}
