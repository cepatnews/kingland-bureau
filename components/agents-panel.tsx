"use client";

import { useState } from "react";
import { subordinatesOf, type Org } from "@/lib/chain-of-command";
import { api, fmtTime, type Resource } from "@/lib/client-api";
import { AGENT_STATES, type Agent, type AgentPatch, type Task } from "@/lib/types";
import { AgentConnectSheet } from "./agent-connect";
import { Chip, Empty } from "./ui";

const APP_ICON: Record<string, string> = {
  Pickle: "🥒", Vooy: "🛶", Hark: "👂", Wabi: "🍵", Instinct: "⚡", "Meta Muse": "🎨", Hermes: "🪽", ChatGPT: "💬", Claude: "✳️",
};

export function AgentsPanel({
  org,
  agents,
  tasks,
  toast,
  onReported,
}: {
  org: Org;
  agents: Resource<Agent[]>;
  tasks: Task[];
  toast: (t: string, tone?: "ok" | "err") => void;
  onReported: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [connectId, setConnectId] = useState<string | null>(null);
  const [showReserve, setShowReserve] = useState(false);
  const list = agents.data ?? [];

  async function save(id: string, patch: AgentPatch) {
    const rollback = agents.mutate((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    try {
      const { data } = await api<Agent>("/api/agents", { method: "PATCH", body: JSON.stringify({ id, ...patch }) });
      agents.mutate((prev) => prev.map((a) => (a.id === id ? data : a)));
      toast("노션 02 조직도에 저장했습니다.");
      return true;
    } catch (e) {
      rollback();
      toast(`저장 실패: ${e instanceof Error ? e.message : e}`, "err");
      return false;
    }
  }

  const openCount = (id: string) => tasks.filter((t) => t.state !== "완료" && (t.assigneeIds.includes(id) || t.staffIds.includes(id))).length;
  const card = (a: Agent, level: 0 | 1 | 2) => (
    <AgentCard key={a.id} agent={a} level={level} open={openCount(a.id)} editing={editing === a.id} onEdit={() => setEditing(editing === a.id ? null : a.id)} onConnect={() => setConnectId(a.id)} onSave={save} />
  );

  if (!agents.data && agents.loading) return <Empty>조직도를 불러오는 중…</Empty>;
  if (!org.commander) return <Empty>02 조직도에 계급=대장인 에이전트가 없습니다.</Empty>;

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-xs text-muted">강점·역량은 사단장님이 직접 적는 칸입니다. 참모는 이 내용을 보고 부대원에게 업무를 배분합니다.</p>

      {card(org.commander, 0)}

      <div className="grid gap-3 md:grid-cols-2 md:items-start">
        {org.staff.map((s) => (
          <div key={s.id} className="rounded-[22px] border border-line bg-card-2/70 p-2.5">
            <div className="mb-2 px-1.5 text-xs text-ink-2">{s.unit}</div>
            {card(s, 1)}
            <div className="mt-2 flex flex-col gap-2 border-l-2 border-dashed border-line pl-2.5">
              {subordinatesOf(list, s.id).map((m) => card(m, 2))}
              {subordinatesOf(list, s.id).length === 0 && <Empty>부대원 없음</Empty>}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[22px] border border-line bg-card-2/50">
        <button onClick={() => setShowReserve((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-sm text-ink-2">
          <span>예비 인원 {org.reserves.length}명 (보관)</span>
          <span>{showReserve ? "접기 ▲" : "펼치기 ▼"}</span>
        </button>
        {showReserve && <div className="flex flex-col gap-2 px-2.5 pb-2.5">{org.reserves.map((r) => card(r, 2))}</div>}
      </div>

      <AgentConnectSheet
        agent={list.find((a) => a.id === connectId) ?? null}
        org={org}
        agents={list}
        tasks={tasks}
        onClose={() => setConnectId(null)}
        onSave={save}
        onReported={onReported}
        toast={toast}
      />
    </div>
  );
}

function AgentCard({
  agent,
  level,
  open,
  editing,
  onEdit,
  onConnect,
  onSave,
}: {
  agent: Agent;
  level: 0 | 1 | 2;
  open: number;
  editing: boolean;
  onEdit: () => void;
  onConnect: () => void;
  onSave: (id: string, patch: AgentPatch) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(agent.strengths);
  const [saving, setSaving] = useState(false);
  const stateTone = agent.state === "활성" ? "brown" : agent.state === "중지" ? "alert" : "plain";
  return (
    <div className={`card ${level === 0 ? "border-[#e2c49e] bg-[#fdf3e3]" : ""} p-3.5`}>
      <div className="flex items-start gap-3">
        <div className={`grid shrink-0 place-items-center rounded-full border border-line bg-card-2 ${level === 2 ? "h-9 w-9 text-lg" : "h-11 w-11 text-xl"}`}>
          {APP_ICON[agent.app ?? ""] ?? "🤖"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] text-ink">{agent.name}</span>
            {agent.rank && <span className="text-xs text-muted">{agent.rank}</span>}
            <Chip tone={stateTone}>{agent.state ?? "미정"}</Chip>
            {open > 0 && <Chip tone="warn">진행 {open}</Chip>}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {agent.app ?? "-"} · {agent.connection ?? "연결 방식 미정"} · 최근 {fmtTime(agent.lastReportAt)}
          </div>
          {agent.activity && <div className="mt-1.5 rounded-xl bg-card-2 px-2.5 py-1.5 text-xs text-ink-2">💬 {agent.activity}</div>}
          {!editing && (
            <div className="mt-1.5 text-sm text-ink-2">
              <span className="text-xs text-muted">강점·역량 </span>
              {agent.strengths ? <span className="whitespace-pre-wrap">{agent.strengths}</span> : <span className="text-muted">미입력</span>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button onClick={onConnect} className="rounded-full border border-[#e2c49e] bg-[#f6e4c9] px-2.5 py-1 text-xs text-brown-2">
            🔌 연결
          </button>
          <button
            onClick={() => {
              setDraft(agent.strengths);
              onEdit();
            }}
            className="rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink-2"
          >
            {editing ? "닫기" : "편집"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs text-muted">강점·역량 (직접 입력)</label>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="예: 쇼핑 검색·가격 비교가 빠름 / 인스타 DM 응대" className="field w-full resize-y px-3 py-2 text-sm" />
          <div className="flex flex-wrap gap-1.5">
            {AGENT_STATES.map((s) => (
              <button
                key={s}
                onClick={() => s !== agent.state && void onSave(agent.id, { state: s })}
                className={`rounded-full border px-3 py-1 text-xs ${agent.state === s ? "border-[#c9a27a] bg-[#f6e4c9] text-brown-2" : "border-line bg-card text-ink-2"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            disabled={saving || draft === agent.strengths}
            onClick={async () => {
              setSaving(true);
              const okSaved = await onSave(agent.id, { strengths: draft });
              setSaving(false);
              if (okSaved) onEdit();
            }}
            className="btn-brown rounded-2xl px-3 py-2.5 text-sm"
          >
            {saving ? "저장 중…" : "강점·역량 저장"}
          </button>
        </div>
      )}
    </div>
  );
}
