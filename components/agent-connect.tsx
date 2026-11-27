"use client";

import { useEffect, useMemo, useState } from "react";
import { buildBriefing, parseReport, reportTemplate, stageFor } from "@/lib/agent-briefing";
import { subordinatesOf, superiorOf, type Org } from "@/lib/chain-of-command";
import { api, fmtTime } from "@/lib/client-api";
import { NOTION_DB, notionUrl } from "@/lib/notion-ids";
import { CONNECTIONS, TASK_STATES, type Agent, type AgentPatch, type Connection, type Task, type TaskReport, type TaskState } from "@/lib/types";
import { Chip, Sheet } from "./ui";

const CONNECTION_INFO: Record<Connection, { icon: string; desc: string }> = {
  "노션 직접": { icon: "🗂️", desc: "AI 앱이 노션에 직접 접근해 09 보고 이력에 스스로 기록합니다." },
  수동: { icon: "✍️", desc: "AI 앱에서 받은 보고를 사단장님이 아래 '보고 기록'에 붙여 넣어 기록합니다." },
};

export function AgentConnectSheet({
  agent,
  org,
  agents,
  tasks,
  onClose,
  onSave,
  onReported,
  toast,
}: {
  agent: Agent | null;
  org: Org;
  agents: Agent[];
  tasks: Task[];
  onClose: () => void;
  onSave: (id: string, patch: AgentPatch) => Promise<boolean>;
  onReported: () => void;
  toast: (t: string, tone?: "ok" | "err") => void;
}) {
  return (
    <Sheet
      open={Boolean(agent)}
      onClose={onClose}
      title={
        <div className="min-w-0">
          <div className="text-[11px] text-muted">연결 설정</div>
          <div className="truncate">{agent?.name}</div>
        </div>
      }
    >
      {agent && <ConnectBody key={agent.id} agent={agent} org={org} agents={agents} tasks={tasks} onSave={onSave} onReported={onReported} toast={toast} />}
    </Sheet>
  );
}

function ConnectBody({
  agent,
  org,
  agents,
  tasks,
  onSave,
  onReported,
  toast,
}: {
  agent: Agent;
  org: Org;
  agents: Agent[];
  tasks: Task[];
  onSave: (id: string, patch: AgentPatch) => Promise<boolean>;
  onReported: () => void;
  toast: (t: string, tone?: "ok" | "err") => void;
}) {
  const [connection, setConnection] = useState<Connection>(agent.connection ?? "수동");
  const [device, setDevice] = useState(agent.device);
  const [role, setRole] = useState(agent.role);
  const [activity, setActivity] = useState(agent.activity);
  const [saving, setSaving] = useState(false);
  const [appUrl, setAppUrl] = useState("");
  useEffect(() => setAppUrl(window.location.origin), []);

  const boss = superiorOf(org, agent.id);
  const subs = subordinatesOf(agents, agent.id);
  const isReserve = agent.rank === "예비" || agent.unit === "예비";
  const dirty = connection !== (agent.connection ?? "수동") || device !== agent.device || role !== agent.role || activity !== agent.activity;
  // 브리핑은 저장 전 선택값으로 미리 보여 준다
  const briefing = useMemo(
    () => buildBriefing(org, { ...agent, connection, role }, agents, appUrl || "지휘실 주소"),
    [org, agent, connection, role, agents, appUrl],
  );

  async function save() {
    const patch: AgentPatch = {};
    if (connection !== agent.connection) patch.connection = connection;
    if (device !== agent.device) patch.device = device;
    if (role !== agent.role) patch.role = role;
    if (activity !== agent.activity) patch.activity = activity;
    setSaving(true);
    await onSave(agent.id, patch);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-ink">{agent.name}</span>
          <Chip>{agent.rank ?? "-"}</Chip>
          <Chip tone="brown">{agent.unit ?? "-"}</Chip>
          <Chip>{agent.app ?? "-"}</Chip>
          <span className="ml-auto text-[11px] text-muted">최근 {fmtTime(agent.lastReportAt)}</span>
        </div>
        <div className="mt-2 text-xs text-ink-2">
          상관: {boss?.name ?? "없음 (사단장 직속)"}
          {subs.length > 0 && <> · 지휘: {subs.map((s) => s.name).join(", ")}</>}
        </div>
      </section>

      <section className="card p-4">
        <h3 className="mb-2 text-sm text-ink">연결 방식</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CONNECTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setConnection(c)}
              className={`rounded-2xl border px-2 py-2.5 text-sm ${connection === c ? "border-[#c9a27a] bg-[#f6e4c9] text-brown-2" : "border-line bg-card text-ink-2"}`}
            >
              {CONNECTION_INFO[c].icon} {c}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{CONNECTION_INFO[connection].desc}</p>

        <div className="mt-3 flex flex-col gap-2">
          <Field label="기기·계정" hint="어느 폰/계정에서 쓰는지 (예: 메인폰 · 갤럭시 S24 · cepat 계정)">
            <input value={device} onChange={(e) => setDevice(e.target.value)} className="field w-full px-3 py-2.5 text-sm" />
          </Field>
          <Field label="역할" hint="인터뷰 후 정한 이 AI의 담당 영역">
            <textarea value={role} onChange={(e) => setRole(e.target.value)} rows={2} className="field w-full resize-y px-3 py-2 text-sm" />
          </Field>
          <Field label="현재 활동" hint="지금 하고 있는 일 한 줄 (에이전트 카드 말풍선)">
            <input value={activity} onChange={(e) => setActivity(e.target.value)} className="field w-full px-3 py-2.5 text-sm" />
          </Field>
          <button disabled={!dirty || saving} onClick={save} className="btn-brown rounded-2xl px-3 py-2.5 text-sm">
            {saving ? "저장 중…" : dirty ? "노션 02에 저장" : "저장됨"}
          </button>
        </div>
      </section>

      {connection === "노션 직접" && <NotionDirectGuide agent={agent} />}

      <section className="card p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm text-ink">브리핑 프롬프트</h3>
          <CopyButton text={briefing} toast={toast} label="복사" />
        </div>
        <p className="mb-2 text-xs text-muted">
          {agent.app ?? "AI"} 앱의 첫 대화(또는 맞춤 지시·시스템 프롬프트 칸)에 붙여 넣으세요. 강점·역량이나 연결 방식을 바꾸면 다시 붙여 넣으면 됩니다.
        </p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-card-2 p-3 text-xs leading-relaxed text-ink-2">{briefing}</pre>
      </section>

      {!isReserve && <ReportRelay agent={agent} org={org} tasks={tasks} onReported={onReported} toast={toast} />}
    </div>
  );
}

function NotionDirectGuide({ agent }: { agent: Agent }) {
  const steps = [
    `${agent.app ?? "AI"} 앱에서 노션 연결(커넥터·통합)을 켜고, 노션의 'AI SForce 본부' 페이지 접근을 허용합니다.`,
    "아래 브리핑을 붙여 넣습니다. 브리핑에 보고할 DB와 이 AI의 페이지 ID가 들어 있습니다.",
    "시험 보고를 한 번 시켜 보고, 해당 업무 상세의 보고 이력에 뜨는지 확인합니다.",
  ];
  return (
    <section className="card p-4">
      <h3 className="mb-2 text-sm text-ink">🗂️ 노션 직접 연결 순서</h3>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[NOTION_DB.tasks, NOTION_DB.taskReports, NOTION_DB.agents].map((d) => (
          <span key={d.prefix} className="rounded-full border border-line bg-card-2 px-2.5 py-1 text-xs text-ink-2">
            🗂️ {d.title}
          </span>
        ))}
        <a href={notionUrl(agent.id)} target="_blank" rel="noreferrer" className="rounded-full border border-line bg-card-2 px-2.5 py-1 text-xs text-ink-2">
          {agent.name} 02 페이지 ↗
        </a>
      </div>
      <p className="mt-2 text-[11px] text-muted">앱에 노션 연결 기능이 없다면 「수동」을 고르세요.</p>
    </section>
  );
}

/** 수동 연결: AI가 보낸 보고를 붙여 넣어 09에 기록 (보고자 = 이 AI) */
function ReportRelay({
  agent,
  org,
  tasks,
  onReported,
  toast,
}: {
  agent: Agent;
  org: Org;
  tasks: Task[];
  onReported: () => void;
  toast: (t: string, tone?: "ok" | "err") => void;
}) {
  const stage = stageFor(agent);
  const boss = superiorOf(org, agent.id);
  const candidates = useMemo(() => {
    const open = tasks.filter((t) => !t.id.startsWith("temp-"));
    if (agent.rank === "대장") return open;
    if (agent.rank === "참모") return open.filter((t) => t.staffIds.includes(agent.id) || t.assigneeIds.includes(agent.id));
    return open.filter((t) => t.assigneeIds.includes(agent.id) || (boss && t.staffIds.includes(boss.id)));
  }, [tasks, agent, boss]);

  const [raw, setRaw] = useState("");
  const [taskId, setTaskId] = useState("");
  const [progress, setProgress] = useState("");
  const [state, setState] = useState<TaskState | "">("");
  const [review, setReview] = useState<"" | "승인" | "보완 요청">("");
  const [resultUrl, setResultUrl] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  function readPasted(text: string) {
    setRaw(text);
    const p = parseReport(text);
    setContent(p.content);
    if (p.progress != null) setProgress(String(Math.round(p.progress * 100)));
    if (p.state) setState(p.state);
    if (p.staffReview) setReview(p.staffReview);
    if (p.resultUrl) setResultUrl(p.resultUrl);
    const byCode = p.taskCode && candidates.find((t) => t.code?.toUpperCase() === p.taskCode);
    const byTitle = !byCode && p.taskTitle && candidates.find((t) => t.title.includes(p.taskTitle!) || p.taskTitle!.includes(t.title));
    const found = byCode || byTitle;
    if (found) setTaskId(found.id);
  }

  async function submit() {
    if (!stage || !taskId || !content.trim() || sending) return;
    setSending(true);
    try {
      await api<{ report: TaskReport }>("/api/task-reports", {
        method: "POST",
        body: JSON.stringify({
          taskId,
          reporterId: agent.id,
          stage,
          content: content.trim(),
          progress: progress === "" ? null : Number(progress),
          state: state || null,
          staffReview: review || null,
          resultUrl: resultUrl.trim() || null,
        }),
      });
      toast(`${agent.name}의 보고를 09에 기록했습니다.`);
      setRaw("");
      setContent("");
      setProgress("");
      setState("");
      setReview("");
      setResultUrl("");
      onReported();
    } catch (e) {
      toast(`기록 실패: ${e instanceof Error ? e.message : e}`, "err");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm text-ink">보고 기록 ({stage})</h3>
        <CopyButton text={reportTemplate(agent)} toast={toast} label="양식 복사" />
      </div>
      <p className="mb-2 text-xs text-muted">
        {agent.name}이(가) 보낸 보고를 그대로 붙여 넣으면 양식을 읽어 칸을 채웁니다. 받는 사람은 지휘 계통에 따라 자동으로 정해집니다
        {boss ? ` (→ ${boss.name})` : agent.rank === "대장" ? " (→ 사단장)" : ""}.
      </p>
      <textarea value={raw} onChange={(e) => readPasted(e.target.value)} rows={4} placeholder="[SFORCE 보고] … 붙여 넣기" className="field mb-2 w-full resize-y px-3 py-2 text-sm" />

      <div className="grid gap-2">
        <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="field px-3 py-2.5 text-sm" aria-label="관련 업무">
          <option value="">관련 업무 선택 {candidates.length ? `(${candidates.length})` : "— 배정된 업무 없음"}</option>
          {candidates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code ? `${t.code} ` : ""}
              {t.title}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input value={progress} onChange={(e) => setProgress(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} inputMode="numeric" placeholder="진행률 %" className="field px-3 py-2.5 text-sm" aria-label="진행률" />
          <select value={state} onChange={(e) => setState(e.target.value as TaskState | "")} className="field px-3 py-2.5 text-sm" aria-label="보고 상태">
            <option value="">상태 선택</option>
            {TASK_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {agent.rank === "참모" && (
          <select value={review} onChange={(e) => setReview(e.target.value as "" | "승인" | "보완 요청")} className="field px-3 py-2.5 text-sm" aria-label="참모 검토">
            <option value="">참모 검토 (미검토)</option>
            <option>승인</option>
            <option>보완 요청</option>
          </select>
        )}
        <input value={resultUrl} onChange={(e) => setResultUrl(e.target.value)} placeholder="결과물 링크 (선택)" className="field px-3 py-2.5 text-sm" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="보고 내용" className="field resize-y px-3 py-2 text-sm" />
        <button disabled={!taskId || !content.trim() || sending} onClick={submit} className="btn-brown rounded-2xl px-3 py-2.5 text-sm">
          {sending ? "기록 중…" : "09 보고 이력에 기록"}
        </button>
        {agent.rank === "참모" && <p className="text-[11px] text-muted">참모 검토·취합 보고는 04 업무의 진행률·상태도 함께 갱신합니다.</p>}
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-2">{label}</span>
      {hint && <span className="ml-1.5 text-[11px] text-muted">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CopyButton({ text, label, toast }: { text: string; label: string; toast: (t: string, tone?: "ok" | "err") => void }) {
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast("복사했습니다.");
        } catch {
          toast("복사하지 못했습니다. 글을 길게 눌러 직접 복사해 주세요.", "err");
        }
      }}
      className="shrink-0 rounded-full border border-line bg-card px-3 py-1 text-xs text-ink-2"
    >
      📋 {label}
    </button>
  );
}
