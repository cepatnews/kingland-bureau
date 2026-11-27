import "server-only";
// 노션 REST API 어댑터. 속성명은 노션 DB와 정확히 같아야 한다 (코드를 노션에 맞춘다).
// 토큰 값은 절대 로그·응답에 넣지 않는다.

import type {
  Agent,
  AgentPatch,
  ChatMessage,
  NewChatMessage,
  FinalReport,
  NewTaskInput,
  NewTaskReportInput,
  Recipient,
  Task,
  TaskReport,
  TaskState,
} from "./types";
import { NOTION_DB, type NotionDbKey } from "./notion-ids";

const NOTION_VERSION = "2022-06-28";
const API = "https://api.notion.com/v1";

// DB ID: 환경변수(NOTION_*_DB_ID)가 있으면 그것을, 없으면 NOTION_ROOT_PAGE_ID 페이지 아래에서
// 이름이 "02 ", "04 " … 로 시작하는 DB를 찾아 쓴다 (서버 인스턴스마다 한 번만 찾고 기억).
const DB = {
  agents: () => dbId("agents"),
  tasks: () => dbId("tasks"),
  reports: () => dbId("reports"),
  taskReports: () => dbId("taskReports"),
  chat: () => dbId("chat"),
};

let discovered: Promise<Map<string, string>> | null = null;

function rootPageId(): string {
  const raw = process.env.NOTION_ROOT_PAGE_ID?.trim() ?? "";
  // 페이지 링크를 그대로 넣어도 된다: 끝의 32자리 ID만 뽑는다
  const m = raw.replace(/-/g, "").match(/([0-9a-f]{32})(?:\?.*)?$/i);
  if (!m) throw new NotionError("NOTION_ROOT_PAGE_ID(노션 본부 페이지 ID 또는 링크)가 설정되지 않았습니다.", 500);
  return m[1];
}

async function discover(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const res = await notion<{ results: { id: string; type: string; child_database?: { title: string } }[]; has_more: boolean; next_cursor: string | null }>(
      `/blocks/${rootPageId()}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`,
    );
    for (const b of res.results) {
      const title = b.type === "child_database" ? b.child_database?.title ?? "" : "";
      const prefix = title.match(/^(\d{2})\s/)?.[1];
      if (prefix && !map.has(prefix)) map.set(prefix, b.id);
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return map;
}

async function dbId(key: NotionDbKey): Promise<string> {
  const def = NOTION_DB[key];
  const fromEnv = process.env[def.env]?.trim();
  if (fromEnv) return fromEnv;
  discovered ??= discover().catch((e) => {
    discovered = null; // 실패하면 다음 요청에서 다시 찾는다
    throw e;
  });
  const id = (await discovered).get(def.prefix);
  if (!id) {
    discovered = null;
    throw new NotionError(`노션 본부 페이지 아래에서 「${def.title}」 DB를 찾지 못했습니다. npm run setup:notion 으로 만들었는지, 통합 연결 권한이 있는지 확인하세요.`, 500);
  }
  return id;
}

export class NotionError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

async function notion<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new NotionError("NOTION_TOKEN이 설정되지 않았습니다.", 500);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new NotionError("노션 서버에 연결하지 못했습니다.");
  }
  if (!res.ok) {
    let msg = `노션 오류 (${res.status})`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) msg += `: ${j.message}`;
    } catch {}
    throw new NotionError(msg, res.status === 404 || res.status === 400 ? res.status : 502);
  }
  return (await res.json()) as T;
}

type Page = { id: string; created_time: string; last_edited_time: string; properties: Record<string, Prop> };
type Prop = { type: string; [k: string]: unknown };

async function queryAll(dbId: string, body: Record<string, unknown> = {}): Promise<Page[]> {
  const out: Page[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion<{ results: Page[]; has_more: boolean; next_cursor: string | null }>(
      `/databases/${dbId}/query`,
      { method: "POST", body: { ...body, page_size: 100, start_cursor: cursor } },
    );
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out;
}

// ---------- 읽기 헬퍼 ----------
const p = (page: Page, name: string): Prop | undefined => page.properties[name];

function text(page: Page, name: string): string {
  const prop = p(page, name);
  if (!prop) return "";
  const arr = (prop[prop.type] as { plain_text: string }[] | undefined) ?? [];
  return arr.map((t) => t.plain_text).join("");
}
function select<T extends string>(page: Page, name: string): T | null {
  const prop = p(page, name);
  const v = prop?.select as { name: string } | null | undefined;
  return (v?.name as T) ?? null;
}
function relation(page: Page, name: string): string[] {
  const prop = p(page, name);
  return ((prop?.relation as { id: string }[] | undefined) ?? []).map((r) => r.id);
}
function num(page: Page, name: string): number | null {
  const v = p(page, name)?.number;
  return typeof v === "number" ? v : null;
}
function date(page: Page, name: string): string | null {
  const v = p(page, name)?.date as { start: string } | null | undefined;
  return v?.start ?? null;
}
function url(page: Page, name: string): string | null {
  return (p(page, name)?.url as string | null) ?? null;
}
function checkbox(page: Page, name: string): boolean {
  return Boolean(p(page, name)?.checkbox);
}
function uniqueId(page: Page, name: string): string | null {
  const v = p(page, name)?.unique_id as { prefix: string | null; number: number } | undefined;
  if (!v) return null;
  return v.prefix ? `${v.prefix}-${v.number}` : String(v.number);
}

// ---------- 쓰기 헬퍼 ----------
function rt(value: string) {
  // 노션 rich_text 한 덩어리는 2000자 제한
  const chunks = value.match(/[\s\S]{1,1900}/g) ?? [];
  return chunks.map((c) => ({ type: "text", text: { content: c } }));
}
const w = {
  title: (v: string) => ({ title: rt(v) }),
  text: (v: string) => ({ rich_text: rt(v) }),
  select: (v: string | null) => ({ select: v ? { name: v } : null }),
  relation: (ids: string[]) => ({ relation: ids.map((id) => ({ id })) }),
  number: (v: number | null) => ({ number: v }),
  date: (v: string | null) => ({ date: v ? { start: v } : null }),
  url: (v: string | null) => ({ url: v || null }),
  checkbox: (v: boolean) => ({ checkbox: v }),
};

// ---------- 매핑 ----------
function toAgent(page: Page): Agent {
  return {
    id: page.id,
    name: text(page, "AI 이름"),
    rank: select(page, "계급"),
    unit: select(page, "소속"),
    app: select(page, "앱"),
    superiorIds: relation(page, "상관"),
    strengths: text(page, "강점·역량"),
    device: text(page, "기기·계정"),
    role: text(page, "역할"),
    activity: text(page, "현재 활동"),
    connection: select(page, "연결 방식"),
    state: select(page, "상태"),
    lastReportAt: (p(page, "마지막 보고")?.last_edited_time as string) ?? page.last_edited_time,
  };
}

function toTask(page: Page): Task {
  return {
    id: page.id,
    title: text(page, "업무명"),
    code: uniqueId(page, "업무 ID"),
    issuer: select(page, "지시자"),
    staffIds: relation(page, "담당 참모"),
    assigneeIds: relation(page, "담당 AI"),
    progress: num(page, "진행률") ?? 0,
    state: select(page, "상태"),
    priority: select(page, "우선순위"),
    due: date(page, "마감"),
    doneAt: date(page, "완료일"),
    doneCriteria: text(page, "완료 조건"),
    resultNext: text(page, "결과 및 다음 행동"),
    approval: select(page, "승인"),
    resultUrl: url(page, "결과물 링크"),
    reviewResult: select(page, "검수 결과"),
    rejectReason: text(page, "반려 사유"),
    reworkCount: num(page, "재작업 횟수") ?? 0,
    parentIds: relation(page, "상위 업무"),
    childIds: relation(page, "하위 업무"),
    updatedAt: (p(page, "마지막 업데이트")?.last_edited_time as string) ?? page.last_edited_time,
    createdAt: page.created_time,
  };
}

function toTaskReport(page: Page): TaskReport {
  return {
    id: page.id,
    summary: text(page, "보고 요약"),
    code: uniqueId(page, "보고 ID"),
    taskIds: relation(page, "관련 업무"),
    reporterIds: relation(page, "보고자"),
    stage: select(page, "보고 단계"),
    recipient: select(page, "받는 사람"),
    progress: num(page, "보고 진행률"),
    state: select(page, "보고 상태"),
    content: text(page, "내용"),
    resultUrl: url(page, "결과물 링크"),
    staffReview: select(page, "참모 검토"),
    reportedAt: (p(page, "보고 시각")?.created_time as string) ?? page.created_time,
  };
}

function toChat(page: Page): ChatMessage {
  return {
    id: page.id,
    room: text(page, "방"),
    senderName: text(page, "보낸 사람"),
    senderId: relation(page, "보낸 AI")[0] ?? null,
    kind: select(page, "종류"),
    text: text(page, "내용"),
    taskIds: relation(page, "관련 업무"),
    // 노션 created_time은 분 단위라, 앱이 넣은 밀리초 값(정밀 시각)을 우선 쓴다
    at: msIso(num(page, "정밀 시각")) ?? (p(page, "보낸 시각")?.created_time as string) ?? page.created_time,
  };
}

function msIso(ms: number | null): string | null {
  return ms && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function toFinalReport(page: Page): FinalReport {
  return {
    id: page.id,
    title: text(page, "보고서명"),
    date: date(page, "보고일"),
    type: select(page, "보고 유형"),
    authorIds: relation(page, "작성 AI"),
    taskIds: relation(page, "관련 업무"),
    summary: text(page, "요약"),
    confirmed: checkbox(page, "사단장 확인"),
    createdAt: page.created_time,
  };
}

// ---------- 공개 API ----------
export const notionStore = {
  async listAgents(): Promise<Agent[]> {
    return (await queryAll(await DB.agents())).map(toAgent);
  },

  async updateAgent(id: string, patch: AgentPatch): Promise<Agent> {
    const properties: Record<string, unknown> = {};
    if (patch.strengths !== undefined) properties["강점·역량"] = w.text(patch.strengths);
    if (patch.state !== undefined) properties["상태"] = w.select(patch.state);
    if (patch.connection !== undefined) properties["연결 방식"] = w.select(patch.connection);
    if (patch.device !== undefined) properties["기기·계정"] = w.text(patch.device);
    if (patch.role !== undefined) properties["역할"] = w.text(patch.role);
    if (patch.activity !== undefined) properties["현재 활동"] = w.text(patch.activity);
    return toAgent(await notion<Page>(`/pages/${id}`, { method: "PATCH", body: { properties } }));
  },

  async listTasks(): Promise<Task[]> {
    const pages = await queryAll(await DB.tasks(), {
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    });
    return pages.map(toTask);
  },

  async getTask(id: string): Promise<Task> {
    return toTask(await notion<Page>(`/pages/${id}`));
  },

  async createTask(input: NewTaskInput): Promise<Task> {
    const properties: Record<string, unknown> = {
      업무명: w.title(input.title),
      지시자: w.select("사단장(사용자)"),
      "담당 AI": w.relation(input.assigneeIds),
      ...(input.staffIds.length ? { "담당 참모": w.relation(input.staffIds) } : {}),
      상태: w.select("대기"),
      진행률: w.number(0),
      우선순위: w.select(input.priority ?? "보통"),
      승인: w.select("불필요"),
      "검수 결과": w.select("미검수"),
    };
    if (input.due) properties["마감"] = w.date(input.due);
    if (input.doneCriteria) properties["완료 조건"] = w.text(input.doneCriteria);
    const page = await notion<Page>(`/pages`, {
      method: "POST",
      body: { parent: { database_id: await DB.tasks() }, properties },
    });
    return toTask(page);
  },

  async updateTaskProgress(
    id: string,
    patch: { progress?: number | null; state?: TaskState | null; reworkCount?: number; approval?: string },
  ): Promise<Task> {
    const properties: Record<string, unknown> = {};
    if (patch.progress != null) properties["진행률"] = w.number(patch.progress);
    if (patch.state) properties["상태"] = w.select(patch.state);
    if (patch.state === "완료") properties["완료일"] = w.date(new Date().toISOString().slice(0, 10));
    if (patch.reworkCount != null) properties["재작업 횟수"] = w.number(patch.reworkCount);
    if (patch.approval) properties["승인"] = w.select(patch.approval);
    return toTask(await notion<Page>(`/pages/${id}`, { method: "PATCH", body: { properties } }));
  },

  async assignTask(id: string, patch: { staffIds?: string[]; assigneeIds?: string[] }): Promise<Task> {
    const properties: Record<string, unknown> = {};
    if (patch.staffIds) properties["담당 참모"] = w.relation(patch.staffIds);
    if (patch.assigneeIds) properties["담당 AI"] = w.relation(patch.assigneeIds);
    return toTask(await notion<Page>(`/pages/${id}`, { method: "PATCH", body: { properties } }));
  },

  async listTaskReports(filter: { taskId?: string; stage?: string; reporterId?: string }): Promise<TaskReport[]> {
    const and: unknown[] = [];
    if (filter.taskId) and.push({ property: "관련 업무", relation: { contains: filter.taskId } });
    if (filter.stage) and.push({ property: "보고 단계", select: { equals: filter.stage } });
    if (filter.reporterId) and.push({ property: "보고자", relation: { contains: filter.reporterId } });
    const pages = await queryAll(await DB.taskReports(), {
      ...(and.length ? { filter: and.length === 1 ? and[0] : { and } } : {}),
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
    });
    return pages.map(toTaskReport);
  },

  async createTaskReport(input: NewTaskReportInput & { recipient: Recipient }): Promise<TaskReport> {
    const summary = input.summary?.trim() || input.content.trim().split("\n")[0].slice(0, 80);
    const properties: Record<string, unknown> = {
      "보고 요약": w.title(summary),
      "관련 업무": w.relation([input.taskId]),
      보고자: w.relation([input.reporterId]),
      "보고 단계": w.select(input.stage),
      "받는 사람": w.select(input.recipient),
      내용: w.text(input.content),
    };
    if (input.progress != null) properties["보고 진행률"] = w.number(input.progress);
    if (input.state) properties["보고 상태"] = w.select(input.state);
    if (input.resultUrl) properties["결과물 링크"] = w.url(input.resultUrl);
    properties["참모 검토"] = w.select(input.staffReview ?? "미검토");
    const page = await notion<Page>(`/pages`, {
      method: "POST",
      body: { parent: { database_id: await DB.taskReports() }, properties },
    });
    return toTaskReport(page);
  },

  /** 방의 최근 메시지 (오래된 것 → 최신). since가 있으면 그 이후만 */
  async listMessages(room: string, opts: { since?: string; limit?: number } = {}): Promise<ChatMessage[]> {
    const and: unknown[] = [{ property: "방", rich_text: { equals: room } }];
    if (opts.since) and.push({ property: "정밀 시각", number: { greater_than_or_equal_to: Date.parse(opts.since) } });
    const res = await notion<{ results: Page[] }>(`/databases/${await DB.chat()}/query`, {
      method: "POST",
      body: {
        filter: { and },
        sorts: [
          { property: "정밀 시각", direction: "descending" },
          { timestamp: "created_time", direction: "descending" },
        ],
        page_size: Math.min(opts.limit ?? 60, 100),
      },
    });
    return res.results.map(toChat).reverse();
  },

  async createMessage(input: NewChatMessage): Promise<ChatMessage> {
    const properties: Record<string, unknown> = {
      내용: w.title(input.text),
      "보낸 사람": w.text(input.senderName),
      방: w.text(input.room),
      종류: w.select(input.kind),
      "정밀 시각": w.number(Date.now()),
    };
    if (input.senderId) properties["보낸 AI"] = w.relation([input.senderId]);
    if (input.taskIds?.length) properties["관련 업무"] = w.relation(input.taskIds);
    const page = await notion<Page>(`/pages`, { method: "POST", body: { parent: { database_id: await DB.chat() }, properties } });
    return toChat(page);
  },

  async listFinalReports(): Promise<FinalReport[]> {
    const pages = await queryAll(await DB.reports(), {
      sorts: [
        { property: "보고일", direction: "descending" },
        { timestamp: "created_time", direction: "descending" },
      ],
    });
    return pages.map(toFinalReport);
  },

  async setFinalReportConfirmed(id: string, confirmed: boolean): Promise<FinalReport> {
    const page = await notion<Page>(`/pages/${id}`, {
      method: "PATCH",
      body: { properties: { "사단장 확인": w.checkbox(confirmed) } },
    });
    return toFinalReport(page);
  },
};

export type Store = typeof notionStore;
