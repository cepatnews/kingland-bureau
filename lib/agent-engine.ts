import "server-only";
// 앱 안의 AI 엔진. 회의실 메시지를 받은 에이전트가 자기 역할대로 답하고,
// 업무 등록·배정·보고를 노션(04·09·10)에 직접 기록한다. 지휘 계통 검증은 chain-of-command를 그대로 쓴다.
// AI 호출: OPENAI_API_KEY가 있으면 ChatGPT(OpenAI)를 직접 쓰고, 없으면 Vercel AI Gateway.

import { openai } from "@ai-sdk/openai";
import { gateway, generateText, stepCountIs, tool, type ToolSet } from "ai";
import { z } from "zod";
import { stageFor } from "./agent-briefing";
import { buildOrg, canCommand, completionGate, directOrderRouting, subordinatesOf, superiorOf, tasksOf, validateReporter, type Org } from "./chain-of-command";
import { store } from "./data-source";
import { WORK_FIELDS, buildTrackRecord, describeRecord, formatEvaluation, type Evaluation, type FieldStat } from "./track-record";
import { MEETING_ROOM, TASK_STATES, type Agent, type ChatMessage, type Task, type TaskReport, type TaskState } from "./types";
import { ORG_NAME } from "./brand";
import { DEFAULT_DUE_DAYS, REPORT_STYLE, REPORT_STYLE_GUIDE, REPORT_TIMING, kstDate } from "./settings";

const openaiOn = () => Boolean(process.env.OPENAI_API_KEY);
const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5.5";
const GATEWAY_MODEL = process.env.AI_MODEL?.trim() || "anthropic/claude-sonnet-5.5";
const MAX_TURNS = 14; // 사단장 메시지 하나에 이어지는 에이전트 차례 최대 수 (무한 연쇄 방지)
export const USER_NAME = "사단장";

const fakeOn = () => process.env.SFORCE_FAKE_AI === "1" && !process.env.VERCEL;

export function aiReady(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL || fakeOn());
}

export async function model() {
  if (fakeOn()) return (await import("./fake-model")).fakeModel();
  return openaiOn() ? openai(OPENAI_MODEL) : gateway(GATEWAY_MODEL);
}

type Job = { agentId: string; trigger: string };

/** 회의실에서 지정된 에이전트를 깨우고, 배정·보고로 이어지는 차례를 순서대로 처리한다. */
export async function runAgents(room: string, firstIds: string[], userText: string) {
  const s = store();
  if (!aiReady()) {
    await s.createMessage({
      room, senderName: "시스템", senderId: null, kind: "알림",
      text: "AI 엔진이 아직 연결되지 않았습니다. Vercel 배포 주소에서 사용하거나 AI_GATEWAY_API_KEY를 설정해 주세요.",
    });
    return;
  }
  const queue: Job[] = firstIds.map((agentId) => ({ agentId, trigger: `사단장님 메시지: "${userText}"` }));
  let turns = 0;
  while (queue.length && turns < MAX_TURNS) {
    const job = queue.shift()!;
    turns++;
    try {
      const next = await agentTurn(room, job);
      for (const n of next) if (!queue.some((q) => q.agentId === n.agentId)) queue.push(n);
    } catch (e) {
      const name = (await s.listAgents()).find((a) => a.id === job.agentId)?.name ?? "에이전트";
      await s.createMessage({ room, senderName: "시스템", senderId: null, kind: "알림", text: `${name} 응답 실패: ${errMsg(e)}` });
    }
  }
  if (queue.length) {
    await s.createMessage({
      room, senderName: "시스템", senderId: null, kind: "알림",
      text: `이어지는 차례가 많아 여기서 멈췄습니다 (남은 차례: ${queue.map((q) => q.agentId).length}). "계속 진행해"라고 말하면 이어서 처리합니다.`,
    });
  }
}

async function agentTurn(room: string, job: Job): Promise<Job[]> {
  const s = store();
  const [agents, tasks, history, brand] = await Promise.all([
    s.listAgents(),
    s.listTasks(),
    s.listMessages(room, { limit: 30 }),
    s.getBrand().catch(() => null),
  ]);
  const orgName = brand?.orgName || ORG_NAME;
  // 실적은 대장·참모만 필요 (배정 판단용). 실패해도 대화는 계속한다.
  const caller = agents.find((a) => a.id === job.agentId);
  const record =
    caller && (caller.rank === "대장" || caller.rank === "참모")
      ? buildTrackRecord(await s.listTaskReports({}).catch(() => []))
      : new Map<string, FieldStat[]>();
  const org = buildOrg(agents);
  const me = org.byId.get(job.agentId);
  if (!me) return [];

  const next: Job[] = [];
  const notices: { text: string; kind: "배정" | "보고" | "지시"; taskIds: string[] }[] = [];
  const tools = buildTools(org, me, tasks, next, notices);
  const myOpen = tasksOf(org, me.id, tasks).filter((t) => t.state !== "완료");
  const incoming = await incomingReports(org, me, myOpen);

  const result = await generateText({
    model: await model(),
    system: persona(org, me, agents, record, orgName),
    prompt: [
      "■ 회의실 최근 대화 (오래된 순)",
      formatHistory(history) || "(아직 대화 없음)",
      "",
      "■ 네가 관련된 진행 중 업무",
      formatTasks(myOpen, org) || "(없음)",
      "",
      ...(incoming ? ["■ 아래 계통에서 올라온 보고 원문 (09 업무 보고 이력 · 회의실에는 요약만 보인다)", incoming, ""] : []),
      `■ 지금 네 차례인 이유: ${job.trigger}`,
      "필요한 도구를 쓰고, 마지막에 회의실에 올릴 답을 메신저 말투로 짧게 써라. 도구 결과를 그대로 반복하지 말 것.",
    ].join("\n"),
    tools,
    stopWhen: stepCountIs(6),
  });

  const reply = result.text.trim();
  const taskIds = [...new Set(notices.flatMap((n) => n.taskIds))];
  if (reply) await s.createMessage({ room, senderName: me.name, senderId: me.id, kind: notices[0]?.kind === "보고" ? "보고" : "대화", text: reply, taskIds });
  for (const n of notices) await s.createMessage({ room, senderName: me.name, senderId: me.id, kind: n.kind, text: n.text, taskIds: n.taskIds });
  return next;
}

// ---------- 도구 ----------
function buildTools(org: Org, me: Agent, tasks: Task[], next: Job[], notices: { text: string; kind: "배정" | "보고" | "지시"; taskIds: string[] }[]): ToolSet {
  const s = store();
  const findTask = (ref: string) => {
    const num = ref.match(/\d+/)?.[0];
    return tasks.find((t) => t.id === ref || (num && t.code && t.code.match(/\d+/)?.[0] === num)) ?? null;
  };
  const subs = subordinatesOf([...org.byId.values()], me.id).filter((a) => a.state !== "중지");
  const hasFieldSubs = subs.some((a) => a.rank === "실무"); // 간단 구성: 대장 바로 아래 부대원
  const label = (t: Task) => `${t.code ? `#${t.code.match(/\d+/)?.[0] ?? t.code} ` : ""}${t.title}`;
  const findAgent = (name: string) => {
    const n = name.replace(/\s/g, "");
    return [...org.byId.values()].find((a) => a.name.replace(/\s/g, "") === n) ?? null;
  };

  const tools: ToolSet = {
    register_task: tool({
      description: "사단장님이 맡긴 일을 04 업무 DB에 새 업무로 등록한다. 잡담·단순 질문에는 쓰지 않는다. 등록하면 업무 번호가 나온다.",
      inputSchema: z.object({
        title: z.string().min(2).max(200).describe("업무명 (한 줄)"),
        doneCriteria: z.string().min(2).max(1500).describe("지시 내용: 사단장님이 요청한 내용을 1~2문장으로 요약하고, 무엇이 되면 완료인지 함께 적는다 (업무 현황 표의 '지시 내용' 칸에 보인다)"),
        priority: z.enum(["긴급", "높음", "보통", "낮음"]).optional(),
        due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("마감일 YYYY-MM-DD"),
      }),
      execute: async ({ title, doneCriteria, priority, due }) => {
        const dueDate = due ?? (DEFAULT_DUE_DAYS != null ? kstDate(DEFAULT_DUE_DAYS) : null);
        const t = await s.createTask({ title, doneCriteria, priority, due: dueDate, ...directOrderRouting(org, me.id) });
        tasks.unshift(t);
        notices.push({ kind: "지시", text: `📌 업무 등록: ${label(t)}`, taskIds: [t.id] });
        return { ok: true, task: label(t) };
      },
    }),

    report: tool({
      description:
        me.rank === "실무"
          ? "맡은 업무의 작업 결과를 상관(참모 또는 대장)에게 보고한다. 결과물 본문을 content에 빠짐없이 담는다."
          : me.rank === "참모"
            ? "부대원 결과를 검토·취합해 대장 피클에게 보고한다."
            : "업무 결과를 사단장님께 최종 보고한다.",
      inputSchema: z.object({
        task: z.string().describe("업무 번호(예: 7) 또는 업무 ID"),
        progress: z.number().min(0).max(100).describe("진행률 %"),
        state: z.enum(TASK_STATES).describe("업무 상태"),
        content: z.string().min(2).max(6000).describe("보고 내용 (결과물 포함)"),
        resultUrl: z.string().url().optional(),
        ...(me.rank === "참모" ? { staffReview: z.enum(["승인", "보완 요청"]).describe("부대원 결과 검토") } : {}),
        ...(me.rank === "참모" || (me.rank === "대장" && hasFieldSubs)
          ? {
              evaluations: z
                .array(
                  z.object({
                    agent: z.string().describe("평가할 부대원 이름 (정확히)"),
                    field: z.enum(WORK_FIELDS).describe("이 업무의 분야"),
                    score: z.number().int().min(1).max(5).describe("결과물 품질 1~5 (5=그대로 쓸 수 있음, 3=보완하면 쓸 만함, 1=못 씀)"),
                    note: z.string().max(200).describe("잘한 점/부족한 점 한 줄"),
                  }),
                )
                .max(6)
                .optional()
                .describe("이 업무를 맡았던 부대원 각각의 결과물 평가. 실적 기록에 쌓여 다음 배정의 근거가 된다."),
            }
          : {}),
      }),
      execute: async (input) => {
        const t = findTask(input.task);
        if (!t) return { ok: false, error: "그 번호의 업무가 없습니다." };
        const stage = stageFor(me);
        if (!stage) return { ok: false, error: "보고할 수 없는 계급입니다." };
        const check = validateReporter(org, t, me.id, stage);
        if (!check.ok) return { ok: false, error: check.error };
        if (input.state === "완료" && (me.rank === "참모" || me.rank === "대장")) {
          const gate = completionGate(org, me, t, await s.listTaskReports({ taskId: t.id }).catch(() => [] as TaskReport[]));
          if (gate) return { ok: false, error: gate };
        }
        const staffReview = "staffReview" in input ? (input.staffReview as "승인" | "보완 요청") : null;
        const evals = ("evaluations" in input ? (input.evaluations as Evaluation[]) : []).filter((e) => {
          const a = findAgent(e.agent);
          return a && subs.some((x) => x.id === a.id);
        });
        const content = evals.length
          ? `${input.content}\n\n${evals.map((e) => formatEvaluation({ ...e, agent: findAgent(e.agent)!.name })).join("\n")}`
          : input.content;
        await s.createTaskReport({
          taskId: t.id, reporterId: me.id, stage, content, recipient: check.recipient,
          progress: input.progress / 100, state: input.state, resultUrl: input.resultUrl ?? null, staffReview,
        });
        // 실무가 '완료'라고 해도 참모 검수 전까지는 '검수 대기'
        const state: TaskState = me.rank === "실무" && input.state === "완료" ? "검수 대기" : input.state;
        await s.updateTaskProgress(t.id, { progress: input.progress / 100, state, reworkCount: state === "재작업" ? t.reworkCount + 1 : undefined });
        const evalLine = evals.length ? `\n📊 평가: ${evals.map((e) => `${findAgent(e.agent)!.name} ${e.field} ${e.score}/5`).join(", ")}` : "";
        notices.push({ kind: "보고", text: `🧾 ${stage} → ${check.recipient}: ${label(t)} · ${state} ${Math.round(input.progress)}%${evalLine}`, taskIds: [t.id] });
        // 보고는 계통을 따라 위로: 실무 → 참모 → 대장. 대장 보고는 사단장에게서 끝난다.
        const boss = superiorOf(org, me.id);
        if (me.rank !== "대장" && boss) next.push({ agentId: boss.id, trigger: `${me.name}의 보고가 올라왔다 (${label(t)}). 검토하고 다음 단계로 처리하라.` });
        return { ok: true, recipient: check.recipient };
      },
    }),

    web_search: openaiOn() ? openai.tools.webSearch({}) : gateway.tools.perplexitySearch({ maxResults: 5 }),
  };

  if (subs.length) {
    tools.delegate = tool({
      description: `업무를 직속 부하에게 맡긴다. 맡길 수 있는 대상: ${subs.map((a) => a.name).join(", ")}`,
      inputSchema: z.object({
        task: z.string().describe("업무 번호(예: 7) 또는 업무 ID"),
        to: z.string().describe("맡길 부하의 이름 (정확히)"),
        instruction: z.string().min(2).max(1500).describe("구체적인 지시 내용"),
      }),
      execute: async ({ task, to, instruction }) => {
        const t = findTask(task);
        if (!t) return { ok: false, error: "그 번호의 업무가 없습니다. 먼저 register_task로 등록하세요." };
        const target = findAgent(to);
        if (!target) return { ok: false, error: `${to}을(를) 02 조직도에서 찾을 수 없습니다.` };
        if (!canCommand(org, me.id, target.id)) return { ok: false, error: `${target.name}은(는) 직속 부하가 아니거나 지시할 수 없는 상태입니다.` };
        // 실무 배정은 누적: 같은 업무를 여러 부대원에게 맡겨 결과를 비교할 수 있다.
        const fieldIds = t.assigneeIds.filter((id) => org.byId.get(id)?.rank === "실무");
        // 참모 배정도 누적: 같은 업무를 좌참·우참 둘 다에게 맡길 수 있다.
        const staffIds = t.staffIds.filter((id) => org.byId.get(id)?.rank === "참모");
        const patch =
          target.rank === "참모"
            ? { staffIds: [...new Set([...staffIds, target.id])], assigneeIds: [...new Set([...t.assigneeIds, target.id])] }
            : { assigneeIds: [...new Set([...fieldIds, target.id])] };
        await s.assignTask(t.id, patch);
        Object.assign(t, patch);
        if (t.state === "대기") await s.updateTaskProgress(t.id, { state: "수신 확인" });
        notices.push({ kind: "배정", text: `➡️ ${target.name}에게 배정: ${label(t)}\n${instruction}`, taskIds: [t.id] });
        next.push({ agentId: target.id, trigger: `${me.name}이(가) ${label(t)}을(를) 맡겼다. 지시: ${instruction}` });
        return { ok: true, assigned: target.name };
      },
    });
  }

  if (me.rank === "대장") {
    tools.request_approval = tool({
      description: "외부 발송·결제·업로드·계정 작업처럼 사단장님 승인이 필요한 업무를 컨펌함(승인 대기)에 올린다.",
      inputSchema: z.object({ task: z.string(), reason: z.string().min(2).max(500) }),
      execute: async ({ task, reason }) => {
        const t = findTask(task);
        if (!t) return { ok: false, error: "그 번호의 업무가 없습니다." };
        await s.updateTaskProgress(t.id, { approval: "승인 대기" });
        notices.push({ kind: "지시", text: `✋ 승인 요청: ${label(t)}\n${reason}`, taskIds: [t.id] });
        return { ok: true };
      },
    });
  }
  return tools;
}

// ---------- 프롬프트 ----------
function persona(org: Org, me: Agent, agents: Agent[], record: Map<string, FieldStat[]>, ORG_NAME: string): string {
  const boss = superiorOf(org, me.id);
  const subs = subordinatesOf(agents, me.id).filter((a) => a.state !== "중지");
  const commanderField = org.commander ? subordinatesOf(agents, org.commander.id).filter((a) => a.rank === "실무" && a.state !== "중지") : [];
  const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "short" });
  const lines = [
    `너는 ${ORG_NAME}(사단장 전용 비서처)의 「${me.name}」이다. 계급 ${me.rank ?? "-"}, 소속 ${me.unit ?? "-"}.`,
    org.staff.length
      ? `${ORG_NAME}는 사단장님 한 사람을 위한 AI 조직이다. 지휘 계통: 사단장 → 대장 피클 → ${org.staff.map((a) => `${a.name}(${a.unit} 부대)`).join("·")} → 부대원${commanderField.length ? ` (대장 직속 부대원도 있음: ${commanderField.map((a) => a.name).join(", ")})` : ""}.`
      : `${ORG_NAME}는 사단장님 한 사람을 위한 AI 조직이다. 지휘 계통: 사단장 → 대장 피클 → 직속 에이전트(${commanderField.map((a) => a.name).join(", ") || "없음"}). 참모 없이 대장이 바로 일을 나눈다.`,
    `오늘: ${today} (한국 시간)`,
    me.role && `역할: ${me.role}`,
    me.strengths && `강점·역량: ${me.strengths}`,
    boss && `상관: ${boss.name}`,
    subs.length ? `직속 부하: ${subs.map((a) => `${a.name}${a.strengths ? ` (강점: ${a.strengths})` : ""}`).join(", ")}` : null,
    "",
    "■ 전체 명단 (노션 02 조직도 현재값 — 조직·연결·상태 질문은 이 표로만 답한다)",
    ...agents.map((a) => {
      const sup = a.superiorIds.map((id) => org.byId.get(id)?.name).filter(Boolean).join(", ");
      return `- ${a.name} | 계급 ${a.rank ?? "-"} | 소속 ${a.unit ?? "-"} | 앱 ${a.app ?? "-"} | 상관 ${sup || "-"} | 연결 ${a.connection ?? "-"} | 상태 ${a.state ?? "-"}${a.activity ? ` | 활동: ${a.activity}` : ""}`;
    }),
    "(계급 '참모'는 실무 에이전트가 아니다. 실무 에이전트는 계급 '실무'인 인원이다.)",
    "상태 '중지'(Out of Order) 인원에게는 어떤 일도 맡기지 않고, 배정 후보로도 언급하지 않는다.",
    "명단·연결·상태는 위 표가 최신이다. 회의실 대화에 예전 답이 남아 있어도 표와 다르면 표를 따르고, 예전 답이 틀렸다고 바로잡는다.",
    "",
    ...(me.rank === "대장" || me.rank === "참모"
      ? [
          "■ 부대원 실적 (참모 평가 누적 · ★ = 2건 이상 평균 4점 이상, 믿고 맡길 분야)",
          ...agents
            .filter((a) => a.rank === "실무" && a.state !== "중지" && (me.rank === "대장" || subs.some((x) => x.id === a.id)))
            .map((a) => `- ${me.rank === "대장" ? `[${a.unit ?? "-"}] ` : ""}${describeRecord(a, record)}`),
          "",
        ]
      : []),
    "■ 일하는 방식",
  ];
  if (me.rank === "대장") {
    const directField = subs.filter((a) => a.rank === "실무");
    lines.push("- 사단장님의 유일한 공식 대화 상대다. 질문·잡담에는 바로 답한다.");
    if (org.staff.length)
      lines.push(
        "- 일을 맡기시면 register_task로 등록하고, 성격에 맞는 참모에게 delegate로 넘긴다. 참모 소속 부대원에게는 직접 지시하지 않는다.",
        "- 참모를 고를 때 부대원 실적을 본다. 그 분야에 ★ 부대원이 있는 부대의 참모에게 우선 맡기고, 없으면 일의 성격과 부대 균형으로 정한다.",
        "- 같은 업무를 두 참모에게 맡겼다면 둘 다 보고할 때까지 기다린다. 아직 남았으면 report하지 말고 '○○ 보고 대기 중'이라고만 짧게 말한다.",
      );
    if (directField.length)
      lines.push(
        `- 직속 에이전트(${directField.map((a) => a.name).join(", ")})에게는 참모 없이 직접 delegate로 맡긴다. 일을 맡기시면 register_task로 등록한 뒤 성격에 맞는 에이전트에게 넘긴다.`,
        "- 배정 원칙 (실적 기준): 그 분야에 ★ 에이전트가 있으면 그에게, 평가가 부족하면 2명에게 같은 일을 각각 맡겨 비교, 평균 2.5점 미만인 분야는 다시 맡기지 않는다.",
        "- 맡긴 에이전트가 모두 보고할 때까지 기다린다. 보고 내용은 '보고 원문' 섹션을 기준으로 검토하고, 최종 report를 올릴 때 evaluations에 맡았던 에이전트 각각의 분야·점수(1~5)·한 줄 평을 남긴다.",
      );
    lines.push(
      "- 아주 간단한 일(짧은 답·정리)은 직접 처리해도 된다. 이때도 등록한 업무라면 report로 마무리한다.",
      "- 아래 보고가 올라오면 '보고 원문'을 검토하고 report로 사단장님께 최종 보고한다. 보완이 필요하면 다시 delegate한다.",
      "",
      "■ 사단장님께 보고하는 방식",
      `- 형식: ${REPORT_STYLE_GUIDE[REPORT_STYLE]}`,
      REPORT_TIMING === "daily"
        ? "- 시점: 사단장님은 매일 한 번 정리 보고(일일 보고서)를 받기로 했다. 업무가 끝나도 회의실에는 한 줄로만 알리고, 자세한 정리는 일일 보고서에 모인다."
        : REPORT_TIMING === "both"
          ? "- 시점: 업무가 끝날 때마다 바로 보고하고, 매일 한 번 일일 보고서로도 정리된다."
          : "- 시점: 업무가 끝날 때마다 바로 보고한다.",
      DEFAULT_DUE_DAYS != null
        ? `- 마감: 사단장님이 마감을 말하지 않으면 기본 ${DEFAULT_DUE_DAYS === 0 ? "당일" : `${DEFAULT_DUE_DAYS}일 뒤`}로 잡힌다. 급하거나 오래 걸리는 일이면 due를 직접 정한다.`
        : "- 마감: 사단장님이 말한 마감이 있으면 due로 넣는다.",
    );
  } else if (me.rank === "참모") {
    lines.push(
      "- 대장 피클에게 받은 일을 delegate로 부대원에게 맡긴다. 다른 부대 인원에게는 지시하지 않는다.",
      "- 배정 원칙 (부대원 실적 기준):",
      "  · 그 분야에 ★ 부대원이 있으면 그 부대원에게 맡긴다.",
      "  · 그 분야 평가가 부족하면 시험 단계다. 평가가 적은 부대원 2명에게 같은 일을 각각 delegate로 맡겨 결과를 비교한다.",
      "  · 그 분야 평균이 2.5점 미만인 부대원에게는 다시 맡기지 않는다 (다른 분야는 계속 시험).",
      "- 부대원 보고 내용은 '보고 원문' 섹션에 있다. 회의실에는 요약만 보이므로 원문을 기준으로 검토하고, 원문이 있으면 다시 보고하라고 하지 않는다.",
      "- 부대원 보고가 오면 검토한다. 괜찮으면 report(staffReview=승인)로 대장 피클에게 올리고, 부족하면 다시 delegate로 보완을 지시한다.",
      "- 같은 일을 여러 부대원에게 맡겼다면 모두 보고할 때까지 기다린다. 아직 남았으면 report하지 말고 '○○ 보고 대기 중'이라고만 짧게 말한다.",
      "- 검토해서 report를 올릴 때는 반드시 evaluations에 그 일을 맡았던 부대원 각각의 분야·점수(1~5)·한 줄 평을 남긴다. 비교 시험이었다면 더 나은 결과물을 골라 대장에게 올리고, 누가 왜 나았는지 적는다.",
      "- 사단장님이 직접 말을 걸면 답하고, 일을 주시면 register_task 후 처리한다. 결과는 계통대로 대장 피클에게 보고한다.",
    );
  } else {
    lines.push(
      "- 맡은 일을 실제로 수행한다. 사실 확인·최신 정보가 필요하면 web_search를 쓴다.",
      "- 끝나면 report로 상관에게 보고한다. 결과물 전체를 content에 담는다.",
      "- 사단장님이 직접 일을 주시면 register_task로 등록한 뒤 수행하고 보고한다.",
    );
  }
  lines.push(
    "",
    "■ 규칙",
    "- 회의실 메신저 말투. 사단장님께는 존댓말, 동료에게는 간결하게. 답은 보통 2~6줄.",
    "- 확인되지 않은 사실·숫자는 지어내지 않는다. 모르면 모른다고 하거나 web_search로 확인하고 출처를 짧게 남긴다.",
    "- 외부 발송·결제·업로드·계정 작업은 직접 하지 않는다. 필요하면 대장 피클이 request_approval로 사단장님 승인을 받는다.",
    "- 개인정보·토큰·비밀번호는 다루지 않는다.",
  );
  return lines.filter((l): l is string => typeof l === "string" && l !== "").join("\n").replace(/\n■/g, "\n\n■");
}

function formatHistory(history: ChatMessage[]): string {
  return history
    .map((m) => {
      const who = m.senderId ? m.senderName : m.senderName || USER_NAME;
      const tag = m.kind && m.kind !== "대화" ? `(${m.kind}) ` : "";
      return `[${who}] ${tag}${m.text.length > 1500 ? `${m.text.slice(0, 1500)}…` : m.text}`;
    })
    .join("\n");
}

/** 참모는 부대원 실무 보고, 대장은 참모 검토·취합 보고의 원문을 받는다 (업무·보고자별 최신 1건). */
async function incomingReports(org: Org, me: Agent, open: Task[]): Promise<string> {
  if ((me.rank !== "참모" && me.rank !== "대장") || !open.length) return "";
  const s = store();
  // 참모: 자기 부대원의 실무 보고 / 대장: 참모 취합 보고 + 직속 부대원의 실무 보고(간단 구성)
  const wanted = (r: TaskReport) =>
    me.rank === "참모"
      ? r.stage === "실무 보고"
      : r.stage === "참모 검토·취합" || (r.stage === "실무 보고" && r.reporterIds.some((id) => superiorOf(org, id)?.id === me.id));
  const lists = await Promise.all(open.slice(0, 6).map((t) => s.listTaskReports({ taskId: t.id }).then((l) => l.filter(wanted)).catch(() => [] as TaskReport[])));
  const out: string[] = [];
  open.slice(0, 6).forEach((t, i) => {
    const latest = new Map<string, TaskReport>();
    for (const r of lists[i]) for (const id of r.reporterIds) if (superiorOf(org, id)?.id === me.id) latest.set(id, r);
    for (const [id, r] of latest) {
      const body = r.content.length > 1500 ? `${r.content.slice(0, 1500)}…` : r.content;
      out.push(`- #${t.code?.match(/\d+/)?.[0] ?? "?"} ${org.byId.get(id)?.name ?? "?"} (${r.state ?? "-"}):\n${body}`);
    }
  });
  return out.join("\n");
}

function formatTasks(list: Task[], org: Org): string {
  const name = (ids: string[]) => ids.map((id) => org.byId.get(id)?.name ?? "?").join(", ") || "-";
  return list
    .slice(0, 15)
    .map((t) => `- #${t.code?.match(/\d+/)?.[0] ?? "?"} ${t.title} | ${t.state ?? "-"} ${Math.round(t.progress * 100)}% | 담당 ${name(t.assigneeIds)} | 참모 ${name(t.staffIds)}${t.due ? ` | 마감 ${t.due}` : ""}`)
    .join("\n");
}

function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  const where = openaiOn() ? "OpenAI(ChatGPT) API" : "Vercel AI Gateway";
  if (/auth|401|403|oidc|api key|incorrect/i.test(m)) return `AI 인증 실패 (${where} 키·설정을 확인해 주세요)`;
  if (/credit|insufficient|quota|402|payment|billing/i.test(m)) return `AI 사용 크레딧이 부족합니다 (${where} 결제·한도 확인)`;
  if (/model.*(not found|does not exist)/i.test(m)) return `모델을 찾을 수 없습니다 (${openaiOn() ? OPENAI_MODEL : GATEWAY_MODEL}). OPENAI_MODEL 값을 확인해 주세요.`;
  return m.slice(0, 200);
}

export { MEETING_ROOM };
