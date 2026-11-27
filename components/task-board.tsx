"use client";

import { useEffect, useMemo, useState } from "react";
import { isDelayed, namesOf, taskUnit, type Org } from "@/lib/chain-of-command";
import { fmtTime } from "@/lib/client-api";
import { LEFT_UNIT, RIGHT_UNIT, UNIT_COLOR, type Task } from "@/lib/types";
import { Chip, Empty, ProgressBar, StatePill } from "./ui";

export type BoardFilter = "all" | "left" | "right" | "delayed" | "approval";

const FILTERS: { id: BoardFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "left", label: `${LEFT_UNIT} (좌참)` },
  { id: "right", label: `${RIGHT_UNIT} (우참)` },
  { id: "delayed", label: "지연" },
  { id: "approval", label: "승인 대기" },
];

export function TaskBoard({
  org,
  tasks,
  loading,
  filter,
  onFilter,
  onOpenTask,
}: {
  org: Org;
  tasks: Task[] | null;
  loading: boolean;
  filter: BoardFilter;
  onFilter: (f: BoardFilter) => void;
  onOpenTask: (id: string) => void;
}) {
  const list = useMemo(() => tasks ?? [], [tasks]);
  const [view, setView] = useState<"list" | "card">("list");
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "card") setView("card");
    } catch {}
  }, []);
  const chooseView = (v: "list" | "card") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };
  const counts = useMemo(() => {
    const c = { wait: 0, run: 0, done: 0 };
    for (const t of list) {
      if (t.state === "완료") c.done++;
      else if (t.state === "대기" || t.state === "수신 확인" || !t.state) c.wait++;
      else c.run++;
    }
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    return list.filter((t) => {
      if (filter === "left") return taskUnit(org, t) === LEFT_UNIT;
      if (filter === "right") return taskUnit(org, t) === RIGHT_UNIT;
      if (filter === "delayed") return isDelayed(t);
      if (filter === "approval") return t.approval === "승인 대기";
      return true;
    });
  }, [list, filter, org]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="대기" value={counts.wait} bg="var(--wait)" ink="var(--wait-ink)" />
        <Stat label="진행" value={counts.run} bg="var(--run)" ink="var(--run-ink)" />
        <Stat label="완료" value={counts.done} bg="var(--done)" ink="var(--done-ink)" />
      </div>

      <div className="flex items-start gap-2">
      <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 md:flex-wrap">
        {FILTERS.map((f) => {
          const n = f.id === "approval" ? list.filter((t) => t.approval === "승인 대기").length : f.id === "delayed" ? list.filter((t) => isDelayed(t)).length : null;
          return (
            <button
              key={f.id}
              onClick={() => onFilter(f.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${filter === f.id ? "border-[#c9a27a] bg-[#f6e4c9] text-brown-2" : "border-line bg-card text-ink-2"}`}
            >
              {f.label}
              {n ? <span className="ml-1 text-xs text-[#b3402f]">{n}</span> : null}
            </button>
          );
        })}
      </div>
        <div className="flex shrink-0 overflow-hidden rounded-full border border-line text-xs">
          {(["list", "card"] as const).map((v) => (
            <button key={v} onClick={() => chooseView(v)} className={`px-3 py-1.5 ${view === v ? "bg-[#f6e4c9] text-brown-2" : "bg-card text-ink-2"}`}>
              {v === "list" ? "☰ 목록" : "▦ 카드"}
            </button>
          ))}
        </div>
      </div>

      {loading && !tasks && <Empty>업무를 불러오는 중…</Empty>}
      {tasks && filtered.length === 0 && <Empty>{filter === "approval" ? "승인 대기 중인 업무가 없습니다." : "해당하는 업무가 없습니다."}</Empty>}

      {view === "list" && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <div className={`${LIST_COLS} hidden border-b border-line bg-card-2 px-3 py-2 text-[11px] text-muted md:grid`}>
            <span>#</span>
            <span>업무명</span>
            <span>지시 내용</span>
            <span>참모</span>
            <span>담당</span>
            <span>협업</span>
            <span>진행</span>
          </div>
          <ul>
            {filtered.map((t, i) => (
              <li key={t.id} className="border-b border-line last:border-b-0">
                <TaskLine task={t} index={i + 1} org={org} onOpen={() => !t.id.startsWith("temp-") && onOpenTask(t.id)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "card" && (
        <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <li key={t.id}>
              <TaskRow task={t} org={org} onOpen={() => !t.id.startsWith("temp-") && onOpenTask(t.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const VIEW_KEY = "sforce-board-view";
const LIST_COLS = "md:grid md:grid-cols-[40px_minmax(140px,1.2fr)_minmax(160px,1.6fr)_84px_minmax(90px,0.8fr)_minmax(90px,0.8fr)_132px] md:items-center md:gap-3";

/** 담당 = 첫 실무 담당(없으면 배정된 사람), 협업 = 함께 맡은 나머지 실무 */
function people(org: Org, task: Task) {
  const field = task.assigneeIds.filter((id) => org.byId.get(id)?.rank === "실무");
  const lead = field.length ? [field[0]] : task.assigneeIds.filter((id) => !task.staffIds.includes(id));
  return { lead, helpers: field.slice(1) };
}

function TaskLine({ task, index, org, onOpen }: { task: Task; index: number; org: Org; onOpen: () => void }) {
  const delayed = isDelayed(task);
  const unit = taskUnit(org, task);
  const accent = unit ? UNIT_COLOR[unit] : "#c9b59a";
  const { lead, helpers } = people(org, task);
  const num = task.code?.match(/\d+/)?.[0] ?? String(index);
  const order = task.doneCriteria.trim() || task.resultNext.trim();
  const dash = <span className="text-muted">-</span>;
  return (
    <button onClick={onOpen} className={`${LIST_COLS} block w-full px-3 py-2.5 text-left transition hover:bg-brown-soft/30`} style={{ boxShadow: `inset 3px 0 0 ${accent}` }}>
      {/* 휴대폰: 두 줄 요약 */}
      <div className="flex items-center gap-2 md:contents">
        <span className="w-7 shrink-0 text-xs tabular-nums text-muted md:w-auto">#{num}</span>
        <span className="min-w-0 flex-1 md:flex-none">
          <span className="block truncate text-[14px] text-ink">{task.title}</span>
          <span className="mt-0.5 flex flex-wrap gap-1">
            {task.approval === "승인 대기" && <Chip tone="warn">✋ 승인 대기</Chip>}
            {delayed && <Chip tone="alert">지연</Chip>}
            {task.priority === "긴급" && <Chip tone="alert">긴급</Chip>}
            {task.due && <span className="text-[10px] text-muted">마감 {task.due}</span>}
          </span>
        </span>
        <span className="truncate text-xs leading-snug text-ink-2 max-md:hidden" title={order}>{order || dash}</span>
        <span className="truncate text-xs text-ink-2 max-md:hidden">{task.staffIds.length ? namesOf(org, task.staffIds) : <span className="text-muted">배분 전</span>}</span>
        <span className="truncate text-xs text-ink max-md:hidden">{lead.length ? namesOf(org, lead) : dash}</span>
        <span className="truncate text-xs text-ink-2 max-md:hidden">{helpers.length ? `🤝 ${namesOf(org, helpers)}` : dash}</span>
        <span className="flex w-[118px] shrink-0 flex-col gap-1 md:w-auto">
          <span className="flex">
            <StatePill state={task.state} />
          </span>
          <ProgressBar value={task.progress} state={task.state} />
        </span>
      </div>
      <div className="mt-1.5 pl-9 text-[11px] leading-relaxed text-ink-2 md:hidden">
        {order && <div className="truncate">📝 {order}</div>}
        <div className="truncate">
          참모 {task.staffIds.length ? namesOf(org, task.staffIds) : "배분 전"} · 담당 {lead.length ? namesOf(org, lead) : "-"}
          {helpers.length ? ` · 🤝 ${namesOf(org, helpers)}` : ""}
        </div>
      </div>
    </button>
  );
}

function Stat({ label, value, bg, ink }: { label: string; value: number; bg: string; ink: string }) {
  return (
    <div className="rounded-2xl border px-3 py-3 text-center text-sm" style={{ background: bg, color: ink, borderColor: "rgba(0,0,0,0.05)" }}>
      {label} <span className="ml-1 text-lg tabular-nums">{value}</span>
    </div>
  );
}

function TaskRow({ task, org, onOpen }: { task: Task; org: Org; onOpen: () => void }) {
  const delayed = isDelayed(task);
  const unit = taskUnit(org, task);
  const accent = unit ? UNIT_COLOR[unit] : "#c9b59a";
  return (
    <button onClick={onOpen} className="card block h-full w-full overflow-hidden text-left transition active:scale-[0.99]" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="px-4 py-3">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <StatePill state={task.state} />
          {task.approval === "승인 대기" && <Chip tone="warn">✋ 승인 대기</Chip>}
          {delayed && <Chip tone="alert">지연</Chip>}
          {task.priority === "긴급" && <Chip tone="alert">긴급</Chip>}
          {task.priority === "높음" && <Chip tone="warn">높음</Chip>}
          {task.code && <span className="ml-auto text-[11px] text-muted">{task.code}</span>}
        </div>
        <div className="text-[15px] leading-snug text-ink">{task.title}</div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-2">
          <div className="truncate">참모 · {task.staffIds.length ? namesOf(org, task.staffIds) : <span className="text-muted">배분 전</span>}</div>
          <div className="truncate">담당 · {task.assigneeIds.length ? namesOf(org, task.assigneeIds) : <span className="text-muted">-</span>}</div>
        </div>
        <div className="mt-2.5">
          <ProgressBar value={task.progress} state={task.state} />
        </div>
        <div className="mt-2 flex justify-between border-t border-dashed border-line pt-2 text-[11px] text-muted">
          <span>{task.due ? `마감 ${task.due}` : "마감 없음"}</span>
          <span>최근 업데이트 {fmtTime(task.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
}
