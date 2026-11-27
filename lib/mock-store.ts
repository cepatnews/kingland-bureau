import "server-only";
// NOTION_TOKEN이 없을 때만 쓰는 목업 저장소 (서버 메모리, 재시작하면 초기화).
// 조직은 실제 노션 02와 같은 구성. 강점·역량은 비워 둔다 (사용자가 직접 입력).

import type { Store } from "./notion-store";
import type { Agent, Brand, ChatMessage, FinalReport, Task, TaskReport } from "./types";

const now = () => new Date().toISOString();
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
let seq = 100;
const brand: Brand = { orgName: null, logo: null };
const newId = (p: string) => `${p}-${++seq}`;

function agent(id: string, name: string, rank: Agent["rank"], unit: Agent["unit"], app: Agent["app"], sup: string | null, state: Agent["state"] = "활성"): Agent {
  return { id, name, rank, unit, app, superiorIds: sup ? [sup] : [], strengths: "", device: "", role: "", activity: "", connection: "노션 직접", state, lastReportAt: ago(30) };
}

type DB = { agents: Agent[]; tasks: Task[]; reports: TaskReport[]; finals: FinalReport[]; messages: ChatMessage[]; taskSeq: number; rptSeq: number };

function seed(): DB {
  // 간단 구성 시험용: SFORCE_MOCK_ORG=simple → 대장 피클 + 직속 에이전트 3 (참모 없음)
  if (process.env.SFORCE_MOCK_ORG === "simple") {
    return {
      agents: [
        agent("cmd", "대장 피클", "대장", "대장실", "Pickle", null),
        agent("wabi", "와비", "실무", "Vermilion", "Wabi", "cmd"),
        agent("vooy", "부이", "실무", "Vermilion", "Vooy", "cmd"),
        agent("keyring", "키링", "실무", "Vermilion", "Keyring" as Agent["app"], "cmd"),
      ],
      tasks: [], reports: [], finals: [], messages: [], taskSeq: 1, rptSeq: 1,
    };
  }
  const agents: Agent[] = [
    agent("cmd", "대장 피클", "대장", "대장실", "Pickle", null),
    agent("left", "좌참 피클", "참모", "Vermilion", "Pickle", "cmd"),
    agent("right", "우참 피클", "참모", "Sapphire", "Pickle", "cmd"),
    agent("vooy1", "VLagent", "실무", "Vermilion", "Vooy", "left"),
    agent("hark1", "HLagent", "실무", "Vermilion", "Hark", "left"),
    agent("wabi1", "WLagent", "실무", "Vermilion", "Wabi", "left"),
    agent("inst1", "ILagent", "실무", "Vermilion", "Instinct", "left"),
    agent("vooy2", "VRagent", "실무", "Sapphire", "Vooy", "right"),
    agent("hark2", "HRagent", "실무", "Sapphire", "Hark", "right"),
    agent("wabi2", "WRagent", "실무", "Sapphire", "Wabi", "right"),
    agent("inst2", "IRagent", "실무", "Sapphire", "Instinct", "right"),
    agent("vooy3", "부이-3", "예비", "예비", "Vooy", null, "중지"),
    agent("muse", "메타뮤즈", "예비", "예비", "Meta Muse", null, "중지"),
    agent("hermes", "로컬 AI 에이전트", "예비", "예비", "Hermes", null, "중지"),
    agent("gpt", "ChatGPT(감시)", "예비", "예비", "ChatGPT", null, "중지"),
    agent("claude", "Claude (시스템 구축 지원)", "예비", "예비", "Claude", null, "활성"),
  ];
  const base = (o: Partial<Task> & Pick<Task, "id" | "title">): Task => ({
    code: null, issuer: "사단장(사용자)", staffIds: [], assigneeIds: ["cmd"], progress: 0, state: "대기", priority: "보통",
    due: null, doneAt: null, doneCriteria: "", resultNext: "", approval: "불필요", resultUrl: null, reviewResult: "미검수",
    rejectReason: "", reworkCount: 0, parentIds: [], childIds: [], updatedAt: ago(10), createdAt: ago(120), ...o,
  });
  const tasks: Task[] = [
    base({ id: "t1", code: "SF-TASK-1", title: "쿠팡 특가 3개 찾아서 정리", state: "진행", progress: 0.6, priority: "높음", staffIds: ["left"], assigneeIds: ["hark1"], issuer: "좌참 피클", due: day(1), parentIds: ["t0"], updatedAt: ago(15) }),
    base({ id: "t2", code: "SF-TASK-2", title: "인스타 DM 확인 및 답장 초안", state: "검수 대기", progress: 0.9, staffIds: ["right"], assigneeIds: ["wabi2"], issuer: "우참 피클", due: day(-1), approval: "승인 대기", updatedAt: ago(40) }),
    base({ id: "t0", code: "SF-TASK-0", title: "이번 주 장보기·생활비 절약 계획", state: "진행", progress: 0.3, staffIds: ["left"], assigneeIds: ["cmd"], childIds: ["t1"], due: day(3), updatedAt: ago(20) }),
    base({ id: "t3", code: "SF-TASK-3", title: "주간 콘텐츠 아이디어 5개", state: "완료", progress: 1, staffIds: ["right"], assigneeIds: ["vooy2"], issuer: "우참 피클", doneAt: day(0), reviewResult: "통과", updatedAt: ago(90) }),
  ];
  const r = (id: string, code: string, task: string, rep: string, stage: TaskReport["stage"], to: TaskReport["recipient"], prog: number, state: TaskReport["state"], content: string, min: number, review: TaskReport["staffReview"] = "미검토"): TaskReport => ({
    id, code, summary: content.slice(0, 40), taskIds: [task], reporterIds: [rep], stage, recipient: to, progress: prog, state, content, resultUrl: null, staffReview: review, reportedAt: ago(min),
  });
  const reports: TaskReport[] = [
    r("r1", "SF-RPT-1", "t1", "hark1", "실무 보고", "좌참 피클", 0.3, "진행", "쿠팡 골드박스 1차 조사 완료. 후보 7개 추렸습니다.", 70),
    r("r2", "SF-RPT-2", "t1", "left", "참모 검토·취합", "대장 피클", 0.6, "진행", "HLagent 후보 7개 중 가격 검증 통과 3개. 링크 확인 중.", 30, "승인"),
    r("r3", "SF-RPT-3", "t2", "wabi2", "실무 보고", "우참 피클", 0.9, "검수 대기", "DM 12건 확인, 답장 초안 5건 작성. 발송 전 승인 필요.", 50),
    r("r4", "SF-RPT-4", "t3", "vooy2", "실무 보고", "우참 피클", 1, "완료", "콘텐츠 아이디어 5개 정리 완료.", 160),
    r("r5", "SF-RPT-5", "t3", "right", "참모 검토·취합", "대장 피클", 1, "완료", "VRagent 결과 검수 통과. 5개 모두 사용 가능.", 120, "승인"),
    r("r6", "SF-RPT-6", "t3", "cmd", "대장 최종 보고", "사단장(사용자)", 1, "완료", "사단장님, 주간 콘텐츠 아이디어 5개 준비됐습니다. Sapphire 부대 검수 통과했습니다.", 100),
  ];
  const finals: FinalReport[] = [
    { id: "f1", title: `${day(0)} 일일 보고`, date: day(0), type: "일일", authorIds: ["cmd"], taskIds: ["t1", "t2", "t3"], summary: "진행 2건, 검수 대기 1건(승인 필요), 완료 1건. 인스타 DM 답장은 사단장님 승인 후 발송합니다.", confirmed: false, createdAt: ago(60) },
  ];
  return { agents, tasks, reports, finals, messages: [], taskSeq: 4, rptSeq: 7 };
}

const g = globalThis as unknown as { __sforceMock?: DB };
const db = () => (g.__sforceMock ??= seed());
const clone = <T,>(v: T): T => structuredClone(v);
function mustTask(id: string) {
  const t = db().tasks.find((x) => x.id === id);
  if (!t) throw new Error("업무를 찾을 수 없습니다.");
  return t;
}

export const mockStore: Store = {
  async listAgents() { return clone(db().agents); },
  async updateAgent(id, patch) {
    const a = db().agents.find((x) => x.id === id);
    if (!a) throw new Error("에이전트를 찾을 수 없습니다.");
    if (patch.strengths !== undefined) a.strengths = patch.strengths;
    if (patch.state !== undefined) a.state = patch.state;
    if (patch.connection !== undefined) a.connection = patch.connection;
    if (patch.device !== undefined) a.device = patch.device;
    if (patch.role !== undefined) a.role = patch.role;
    if (patch.activity !== undefined) a.activity = patch.activity;
    a.lastReportAt = now();
    return clone(a);
  },
  async listTasks() { return clone([...db().tasks].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))); },
  async getTask(id) { return clone(mustTask(id)); },
  async createTask(input) {
    const d = db();
    const t: Task = {
      id: newId("t"), code: `SF-TASK-${d.taskSeq++}`, title: input.title, issuer: "사단장(사용자)", staffIds: input.staffIds, assigneeIds: input.assigneeIds,
      progress: 0, state: "대기", priority: input.priority ?? "보통", due: input.due ?? null, doneAt: null, doneCriteria: input.doneCriteria ?? "",
      resultNext: "", approval: "불필요", resultUrl: null, reviewResult: "미검수", rejectReason: "", reworkCount: 0, parentIds: [], childIds: [],
      updatedAt: now(), createdAt: now(),
    };
    d.tasks.unshift(t);
    return clone(t);
  },
  async updateTaskProgress(id, patch) {
    const t = mustTask(id);
    if (patch.progress != null) t.progress = patch.progress;
    if (patch.state) t.state = patch.state;
    if (patch.state === "완료") t.doneAt = now().slice(0, 10);
    if (patch.reworkCount != null) t.reworkCount = patch.reworkCount;
    if (patch.approval) t.approval = patch.approval as Task["approval"];
    t.updatedAt = now();
    return clone(t);
  },
  async assignTask(id, patch) {
    const t = mustTask(id);
    if (patch.staffIds) t.staffIds = patch.staffIds;
    if (patch.assigneeIds) t.assigneeIds = patch.assigneeIds;
    t.updatedAt = now();
    return clone(t);
  },
  async listTaskReports({ taskId, stage, reporterId }) {
    return clone(
      db().reports
        .filter((r) => (!taskId || r.taskIds.includes(taskId)) && (!stage || r.stage === stage) && (!reporterId || r.reporterIds.includes(reporterId)))
        .sort((a, b) => a.reportedAt.localeCompare(b.reportedAt)),
    );
  },
  async createTaskReport(input) {
    const d = db();
    const r: TaskReport = {
      id: newId("r"), code: `SF-RPT-${d.rptSeq++}`, summary: input.summary?.trim() || input.content.split("\n")[0].slice(0, 80),
      taskIds: [input.taskId], reporterIds: [input.reporterId], stage: input.stage, recipient: input.recipient,
      progress: input.progress ?? null, state: input.state ?? null, content: input.content, resultUrl: input.resultUrl ?? null,
      staffReview: input.staffReview ?? "미검토", reportedAt: now(),
    };
    d.reports.push(r);
    return clone(r);
  },
  async listMessages(room, opts = {}) {
    const list = db().messages.filter((m) => m.room === room && (!opts.since || m.at >= opts.since));
    return clone(list.slice(-(opts.limit ?? 60)));
  },
  async createMessage(input) {
    const m: ChatMessage = { id: newId("m"), room: input.room, senderName: input.senderName, senderId: input.senderId, kind: input.kind, text: input.text, taskIds: input.taskIds ?? [], at: now() };
    db().messages.push(m);
    return clone(m);
  },
  async getBrand() { return { ...brand }; },
  async setBrand(patch) {
    if (patch.orgName !== undefined) brand.orgName = patch.orgName || null;
    if (patch.logo !== undefined) brand.logo = patch.logo || null;
    return { ...brand };
  },
  async listFinalReports() { return clone(db().finals); },
  async createFinalReport(input) {
    const f: FinalReport = { id: newId("f"), title: input.title, date: input.date, type: input.type, authorIds: input.authorIds, taskIds: input.taskIds, summary: input.summary, confirmed: false, createdAt: now() };
    db().finals.unshift(f);
    return clone(f);
  },
  async setFinalReportConfirmed(id, confirmed) {
    const f = db().finals.find((x) => x.id === id);
    if (!f) throw new Error("보고서를 찾을 수 없습니다.");
    f.confirmed = confirmed;
    return clone(f);
  },
};
