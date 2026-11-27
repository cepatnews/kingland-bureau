// 각 AI 앱에 붙여 넣을 브리핑(소개·규칙·보고 양식)과, 그 양식으로 돌아온 보고를 읽는 파서.
// 브리핑은 "지시"가 아니라 연결용 소개문이다. 실제 업무 지시는 항상 직속 상관을 통해서만 내려간다.

import { subordinatesOf, superiorOf, type Org } from "./chain-of-command";
import { NOTION_DB } from "./notion-ids";
import { TASK_STATES, type Agent, type Connection, type ReportStage, type TaskState } from "./types";

export function stageFor(agent: Agent): ReportStage | null {
  if (agent.rank === "실무") return "실무 보고";
  if (agent.rank === "참모") return "참모 검토·취합";
  if (agent.rank === "대장") return "대장 최종 보고";
  return null;
}

export function reportTemplate(agent: Agent): string {
  const stage = stageFor(agent) ?? "실무 보고";
  return [
    "[SFORCE 보고]",
    "업무: SF-TASK-번호 업무명",
    `단계: ${stage}`,
    "진행률: 0~100%",
    `상태: ${TASK_STATES.join(" / ")} 중 하나`,
    ...(agent.rank === "참모" ? ["참모 검토: 승인 / 보완 요청"] : []),
    "결과물: (링크가 있으면)",
    "내용:",
    "(무엇을 했고, 무엇이 남았고, 막힌 점은 무엇인지)",
  ].join("\n");
}

export function buildBriefing(org: Org, agent: Agent, allAgents: Agent[], appUrl: string): string {
  const boss = superiorOf(org, agent.id);
  const subs = subordinatesOf(allAgents, agent.id);
  const lines: string[] = [];
  lines.push(`너는 AI SForce의 「${agent.name}」이다. (계급: ${agent.rank ?? "-"}, 소속: ${agent.unit ?? "-"})`);
  lines.push("AI SForce는 사단장(사용자)의 개인 AI 조직이다. 지휘 계통: 사단장 → 대장 피클 → 좌참 피클(Vermilion 부대)·우참 피클(Sapphire 부대) → 부대원(V·H·W·I agent, 좌참 L / 우참 R).");
  lines.push("");
  lines.push("■ 너의 위치");
  if (agent.rank === "대장") {
    lines.push("- 너는 사단장의 유일한 대화 상대이자 최종 보고자다. 사단장에게 가는 모든 답변·보고는 네 명의로 한다.");
    lines.push(`- 지시 가능: ${subs.map((s) => s.name).join(", ") || "(없음)"} — 업무를 좌참 또는 우참 피클에게 넘긴다. 부대원에게 직접 지시하지 않는다.`);
  } else if (agent.rank === "참모") {
    lines.push(`- 상관: ${boss?.name ?? "대장 피클"}. 지시는 상관에게서 받고, 검토·취합한 결과를 상관에게 보고한다.`);
    lines.push("- 사단장이 너에게 직접 지시하면 수행하되, 결과는 평소처럼 상관(대장 피클)에게도 보고한다.");
    lines.push(`- 지시 가능(자기 부대원만): ${subs.map((s) => s.name).join(", ") || "(없음)"}`);
    lines.push("- 업무를 배분할 때는 부대원의 「강점·역량」을 기준으로 한다. 다른 부대 인원에게는 지시하지 않는다.");
    lines.push("- 부대원 보고를 검토해 승인 또는 보완 요청을 정하고, 진행률·상태를 갱신한다.");
  } else if (agent.rank === "실무") {
    lines.push(`- 상관: ${boss?.name ?? "(미지정)"}. 평소 지시는 상관에게서 받고, 진행·결과는 상관에게 보고한다.`);
    lines.push(`- 사단장이 너에게 직접 지시하면 수행하되, 진행·결과는 반드시 ${boss?.name ?? "상관"}에게 보고해 기록에 남긴다.`);
    lines.push("- 다른 부대 인원이 보낸 요청은 수행하지 말고 상관에게 넘긴다.");
  } else {
    lines.push("- 너는 예비 인원이다. 별도 지시가 있기 전까지 업무를 받지 않는다.");
  }
  if (agent.strengths) lines.push(`- 너의 강점·역량(사단장 기록): ${agent.strengths}`);
  if (agent.role) lines.push(`- 역할: ${agent.role}`);
  lines.push("");
  lines.push("■ 규칙");
  lines.push("- 모든 업데이트와 보고는 빠짐없이 기록한다. 이전 보고는 고치거나 지우지 않고 새 보고로 쌓는다.");
  lines.push("- 전화·결제·메시지 발송·업로드처럼 되돌리기 어려운 일은 실행 전에 반드시 '승인 대기'로 보고하고 사단장 승인을 기다린다.");
  lines.push("- 확실하지 않은 내용은 추측하지 말고 '확인 필요'라고 적는다.");
  lines.push("");
  lines.push("■ 보고 양식 (보고할 때마다 아래 형식 그대로)");
  lines.push(reportTemplate(agent));
  lines.push("");
  lines.push(...connectionLines(agent, appUrl));
  return lines.join("\n");
}

function connectionLines(agent: Agent, appUrl: string): string[] {
  const c: Connection | null = agent.connection;
  if (c === "노션 직접") {
    return [
      "■ 보고 방법: 노션 직접 기록",
      `- 노션 본부 페이지의 「${NOTION_DB.taskReports.title}」 DB에 새 행을 추가한다. 기존 행은 수정·삭제하지 않는다.`,
      "- 속성: 보고 요약(제목) / 관련 업무(04 업무 relation) / 보고자(02의 너 자신) / 보고 단계 / 받는 사람 / 보고 진행률(0~1) / 보고 상태 / 내용 / 결과물 링크" +
        (agent.rank === "참모" ? " / 참모 검토" : ""),
      `- 보고자로 지정할 너의 02 페이지 ID: ${agent.id}`,
      `- 업무 목록은 노션 본부 페이지의 「${NOTION_DB.tasks.title}」 DB에서 확인한다.`,
      ...(agent.rank === "참모"
        ? ["- 검토·취합 보고를 올린 뒤 04 업무의 진행률·상태도 같은 값으로 갱신한다. 부대원 배정은 04의 '담당 AI'에 부대원 페이지를 지정한다."]
        : []),
      ...(agent.rank === "대장"
        ? ["- 사단장 요청은 04에서 지시자=사단장(사용자)인 행이다. '담당 참모'에 좌참 또는 우참 피클을 지정해 넘긴다."]
        : []),
    ];
  }
  return ["■ 보고 방법: 수동", `- 위 보고 양식 그대로 답변한다. 사단장이 그 내용을 지휘실(${appUrl})에 붙여 넣어 기록한다.`];
}

export type ParsedReport = {
  taskCode: string | null;
  taskTitle: string | null;
  stage: ReportStage | null;
  progress: number | null; // 0~1
  state: TaskState | null;
  staffReview: "승인" | "보완 요청" | null;
  resultUrl: string | null;
  content: string;
};

/** [SFORCE 보고] 양식 텍스트를 읽는다. 양식이 아니면 전체를 내용으로 본다. */
export function parseReport(text: string): ParsedReport {
  const out: ParsedReport = { taskCode: null, taskTitle: null, stage: null, progress: null, state: null, staffReview: null, resultUrl: null, content: text.trim() };
  if (!/^\s*\[?SFORCE 보고\]?/m.test(text) && !/^\s*업무\s*[:：]/m.test(text)) return out;
  const field = (label: string) => text.match(new RegExp(`^\\s*${label}\\s*[:：]\\s*(.*)$`, "m"))?.[1]?.trim() || null;
  const task = field("업무");
  if (task) {
    const m = task.match(/SF-TASK-\d+/i);
    out.taskCode = m ? m[0].toUpperCase() : null;
    out.taskTitle = task.replace(/SF-TASK-\d+/i, "").trim() || null;
  }
  const stage = field("단계");
  if (stage === "실무 보고" || stage === "참모 검토·취합" || stage === "대장 최종 보고") out.stage = stage;
  const prog = field("진행률")?.match(/\d+(\.\d+)?/)?.[0];
  if (prog) {
    const n = Number(prog);
    out.progress = n > 1 ? Math.min(100, n) / 100 : n;
  }
  const st = field("상태");
  if (st && (TASK_STATES as readonly string[]).includes(st)) out.state = st as TaskState;
  const rv = field("참모 검토");
  if (rv === "승인" || rv === "보완 요청") out.staffReview = rv;
  const url = field("결과물")?.match(/https?:\/\/\S+/)?.[0];
  if (url) out.resultUrl = url;
  const body = text.split(/^\s*내용\s*[:：]\s*/m)[1];
  if (body !== undefined) out.content = body.trim();
  return out;
}
