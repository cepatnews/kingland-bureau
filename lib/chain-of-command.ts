// 지휘·보고 관계는 이 모듈 한 곳에서만 계산한다.
// 기준은 02 조직도의 `상관` relation. 이름·소속 하드코딩 없이 relation만 따라간다.

import { LEFT_UNIT, RIGHT_UNIT, type Agent, type Recipient, type ReportStage, type Task, type TaskReport } from "./types";

export type Org = {
  byId: Map<string, Agent>;
  commander: Agent | null; // 대장 피클 (계급=대장, 예비 아님)
  staff: Agent[]; // 대장의 직속 참모 (좌참·우참)
  reserves: Agent[];
};

export function buildOrg(agents: Agent[]): Org {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const commander = agents.find((a) => a.rank === "대장") ?? null;
  const staff = commander ? subordinatesOf(agents, commander.id).filter((a) => a.rank === "참모") : [];
  const reserves = agents.filter((a) => a.rank === "예비" || a.unit === "예비");
  return { byId, commander, staff: sortStaff(staff), reserves };
}

/** 좌참 → 우참 순으로 정렬 */
function sortStaff(staff: Agent[]) {
  const order = (a: Agent) => (a.unit === LEFT_UNIT ? 0 : a.unit === RIGHT_UNIT ? 1 : 2);
  return [...staff].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, "ko"));
}

export function superiorOf(org: Org, agentId: string): Agent | null {
  const a = org.byId.get(agentId);
  const sid = a?.superiorIds[0];
  return sid ? org.byId.get(sid) ?? null : null;
}

export function subordinatesOf(agents: Agent[], agentId: string): Agent[] {
  return agents.filter((a) => a.superiorIds.includes(agentId) && a.rank !== "예비");
}

/** from 이 to 에게 지시할 수 있는가: to 의 `상관`이 from 일 때만(직속 한 단계). */
export function canCommand(org: Org, fromId: string, toId: string): boolean {
  const to = org.byId.get(toId);
  if (!to || to.rank === "예비" || to.state === "중지") return false;
  return to.superiorIds.includes(fromId);
}

/**
 * 사단장은 기본적으로 대장 피클에게 지시하지만, 필요하면 누구에게든 직접 지시할 수 있다.
 * 예비 인원과 상태=중지 인원은 제외.
 */
export function userCanCommand(org: Org, toId: string): boolean {
  const to = org.byId.get(toId);
  if (!to || to.rank === "예비" || to.unit === "예비" || to.state === "중지") return false;
  return to.rank === "대장" || to.rank === "참모" || to.rank === "실무";
}

/**
 * 사단장 직접 지시의 배정 경로.
 * - 대장 피클: 담당 AI = 대장
 * - 참모: 담당 참모 = 담당 AI = 그 참모
 * - 실무: 담당 AI = 실무, 담당 참모 = 그의 상관(참모) → 참모가 검토·보고 흐름을 그대로 이어감
 */
export function directOrderRouting(org: Org, toId: string): { assigneeIds: string[]; staffIds: string[] } {
  const to = org.byId.get(toId);
  if (!to) return { assigneeIds: [], staffIds: [] };
  if (to.rank === "참모") return { assigneeIds: [to.id], staffIds: [to.id] };
  if (to.rank === "실무") {
    const boss = superiorOf(org, to.id);
    return { assigneeIds: [to.id], staffIds: boss && boss.rank === "참모" ? [boss.id] : [] };
  }
  return { assigneeIds: [to.id], staffIds: [] };
}

/** 이 에이전트와 관련된 업무 (대화 상대별 현황용) */
export function tasksOf(org: Org, agentId: string, tasks: Task[]): Task[] {
  const a = org.byId.get(agentId);
  if (!a) return [];
  if (a.rank === "대장") return tasks;
  if (a.rank === "참모") return tasks.filter((t) => t.staffIds.includes(a.id) || t.assigneeIds.includes(a.id));
  return tasks.filter((t) => t.assigneeIds.includes(a.id));
}

/** 화면용 그룹: 대장실 / Vermilion(좌참) / Sapphire(우참) (각 참모 → 부대원 순) */
export function commandGroups(org: Org, agents: Agent[]): { label: string; members: { agent: Agent; depth: 0 | 1 }[] }[] {
  const groups: { label: string; members: { agent: Agent; depth: 0 | 1 }[] }[] = [];
  if (org.commander) groups.push({ label: "대장실", members: [{ agent: org.commander, depth: 0 }] });
  for (const s of org.staff) {
    groups.push({
      label: s.unit ?? s.name,
      members: [{ agent: s, depth: 0 }, ...subordinatesOf(agents, s.id).map((m) => ({ agent: m, depth: 1 as const }))],
    });
  }
  return groups;
}

/** 보고 단계별로 보고자가 맞는지, 받는 사람이 누구인지 계산 */
export function validateReporter(
  org: Org,
  task: Task,
  reporterId: string,
  stage: ReportStage,
): { ok: true; recipient: Recipient } | { ok: false; error: string } {
  const reporter = org.byId.get(reporterId);
  if (!reporter) return { ok: false, error: "보고자를 02 조직도에서 찾을 수 없습니다." };

  if (stage === "실무 보고") {
    if (reporter.rank !== "실무") return { ok: false, error: "실무 보고는 실무 AI만 올릴 수 있습니다." };
    const boss = superiorOf(org, reporterId);
    if (!boss || boss.rank !== "참모") return { ok: false, error: `${reporter.name}의 상관(참모)이 지정돼 있지 않습니다.` };
    if (task.staffIds.length && !task.staffIds.includes(boss.id))
      return { ok: false, error: `${reporter.name}은(는) 이 업무의 담당 참모 소속이 아닙니다.` };
    return { ok: true, recipient: staffRecipient(boss) };
  }

  if (stage === "참모 검토·취합") {
    if (reporter.rank !== "참모") return { ok: false, error: "참모 검토·취합은 좌참·우참 피클만 올릴 수 있습니다." };
    if (task.staffIds.length && !task.staffIds.includes(reporterId))
      return { ok: false, error: `${reporter.name}은(는) 이 업무의 담당 참모가 아닙니다.` };
    return { ok: true, recipient: "대장 피클" };
  }

  // 대장 최종 보고
  if (reporter.rank !== "대장") return { ok: false, error: "대장 최종 보고는 대장 피클만 올릴 수 있습니다." };
  return { ok: true, recipient: "사단장(사용자)" };
}

function staffRecipient(staff: Agent): Recipient {
  return staff.unit === RIGHT_UNIT ? "우참 피클" : "좌참 피클";
}

/** 업무가 어느 부대 소속인지 (담당 참모 기준) */
export function taskUnit(org: Org, task: Task): typeof LEFT_UNIT | typeof RIGHT_UNIT | null {
  for (const id of [...task.staffIds, ...task.assigneeIds]) {
    const u = org.byId.get(id)?.unit;
    if (u === LEFT_UNIT || u === RIGHT_UNIT) return u;
  }
  return null;
}

/**
 * 읽음 표시용 약칭. 대장 = GC(General Commander), 좌참 = LC(Left Commander), 우참 = RC(Right Commander),
 * 부대원 = 이름 앞 글자 (VLagent → VL). 그 밖에는 이름 앞 두 글자.
 */
export function agentAbbr(a: Agent): string {
  if (a.rank === "대장") return "GC";
  if (a.rank === "참모") return a.unit === LEFT_UNIT ? "LC" : a.unit === RIGHT_UNIT ? "RC" : "SC";
  const m = a.name.match(/^([A-Za-z]{1,3})agent$/i);
  if (m) return m[1].toUpperCase();
  return a.name.replace(/\s/g, "").slice(0, 2).toUpperCase();
}

export function namesOf(org: Org, ids: string[]): string {
  return ids.map((id) => org.byId.get(id)?.name ?? "알 수 없음").join(", ");
}

export function isDelayed(task: Task, today = new Date()): boolean {
  if (!task.due || task.state === "완료" || task.state === "보류") return false;
  const d = new Date(task.due.length <= 10 ? `${task.due}T23:59:59` : task.due);
  return d.getTime() < today.getTime();
}

/**
 * 완료 보고 전 확인 (코드로 강제):
 *  - 참모: 이 업무를 맡은 자기 부대원이 모두 실무 보고를 올렸는가
 *  - 대장: 이 업무의 담당 참모가 모두 취합 보고를 올렸는가
 *  - 둘 다: 이미 완료 보고를 했다면, 그 뒤에 새 하위 보고가 들어왔는가 (중복 보고·중복 평가 방지)
 * 문제가 있으면 에이전트에게 돌려줄 오류 문구, 없으면 null.
 */
export function completionGate(org: Org, me: Agent, t: Task, reports: TaskReport[]): string | null {
  const lowerStage = me.rank === "참모" ? "실무 보고" : "참모 검토·취합";
  const myStage = me.rank === "참모" ? "참모 검토·취합" : "대장 최종 보고";
  const expected =
    me.rank === "참모"
      ? t.assigneeIds.filter((id) => org.byId.get(id)?.rank === "실무" && superiorOf(org, id)?.id === me.id)
      : t.staffIds.filter((id) => org.byId.get(id)?.rank === "참모");
  const lower = reports.filter((r) => r.stage === lowerStage);
  const missing = expected.filter((id) => !lower.some((r) => r.reporterIds.includes(id)));
  if (missing.length)
    return `아직 보고하지 않은 인원이 있습니다: ${missing.map((id) => org.byId.get(id)?.name ?? "?").join(", ")}. 완료 보고하지 말고 기다린다고만 말하세요.`;
  const mine = reports.filter((r) => r.stage === myStage && r.reporterIds.includes(me.id) && r.state === "완료");
  const lastMine = mine.at(-1);
  if (lastMine && !lower.some((r) => r.reportedAt > lastMine.reportedAt))
    return "이미 이 업무의 완료 보고를 올렸고, 그 뒤 새 보고가 없습니다. 같은 보고를 다시 올리지 마세요.";
  return null;
}
