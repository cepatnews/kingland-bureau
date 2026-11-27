"use client";

import { useState } from "react";
import { namesOf, type Org } from "@/lib/chain-of-command";
import { api, fmtDate, type Resource } from "@/lib/client-api";
import type { FinalReport, Task } from "@/lib/types";
import { Chip, Empty } from "./ui";

export function ReportsPanel({
  org,
  finals,
  tasks,
  toast,
  onOpenTask,
}: {
  org: Org;
  finals: Resource<FinalReport[]>;
  tasks: Task[];
  toast: (t: string, tone?: "ok" | "err") => void;
  onOpenTask: (id: string) => void;
}) {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [making, setMaking] = useState(false);

  async function makeDaily() {
    setMaking(true);
    try {
      const { data } = await api<{ created: boolean; reason?: string }>("/api/cron/daily-report", { method: "POST" });
      if (data.created) {
        toast("오늘 일일 보고서를 만들었습니다.");
        void finals.reload();
      } else toast(data.reason ?? "만들 내용이 없습니다.", "err");
    } catch (e) {
      toast(`일일 보고 실패: ${e instanceof Error ? e.message : e}`, "err");
    } finally {
      setMaking(false);
    }
  }
  const list = (finals.data ?? []).filter((f) => !onlyUnread || !f.confirmed);
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  async function toggle(f: FinalReport) {
    const next = !f.confirmed;
    const rollback = finals.mutate((prev) => prev.map((x) => (x.id === f.id ? { ...x, confirmed: next } : x)));
    try {
      const { data } = await api<FinalReport>("/api/reports", { method: "PATCH", body: JSON.stringify({ id: f.id, confirmed: next }) });
      finals.mutate((prev) => prev.map((x) => (x.id === data.id ? data : x)));
    } catch (e) {
      rollback();
      toast(`저장 실패: ${e instanceof Error ? e.message : e}`, "err");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted">대장 피클 명의 종합 보고 (노션 05)</p>
        <div className="flex gap-1.5">
          <button onClick={makeDaily} disabled={making} className="rounded-full border border-line bg-card px-3 py-1 text-xs text-ink-2 disabled:opacity-50">
            {making ? "정리하는 중…" : "📑 지금 일일 보고 받기"}
          </button>
          <button onClick={() => setOnlyUnread((v) => !v)} className={`rounded-full border px-3 py-1 text-xs ${onlyUnread ? "border-[#c9a27a] bg-[#f6e4c9] text-brown-2" : "border-line bg-card text-ink-2"}`}>
            미확인만
          </button>
        </div>
      </div>

      {!finals.data && finals.loading && <Empty>보고서를 불러오는 중…</Empty>}
      {finals.data && list.length === 0 && <Empty>{onlyUnread ? "확인하지 않은 보고서가 없습니다." : "아직 최종 보고서가 없습니다."}</Empty>}

      <div className="grid gap-3 md:grid-cols-2">
      {list.map((f) => (
        <article key={f.id} className={`card flex flex-col p-4 ${f.confirmed ? "" : "border-[#e2c49e]"}`}>
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {f.type && <Chip tone={f.type === "긴급" ? "alert" : f.type === "주간" ? "brown" : "plain"}>{f.type}</Chip>}
            <span className="text-xs text-muted">{fmtDate(f.date ?? f.createdAt)}</span>
            <span className="ml-auto text-xs text-muted">🥒 {f.authorIds.length ? namesOf(org, f.authorIds) : "대장 피클"}</span>
          </div>
          <h3 className="text-[15px] text-ink">{f.title}</h3>
          {f.summary && <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{f.summary}</p>}
          {f.taskIds.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {f.taskIds.map((id) => {
                const t = taskById.get(id);
                return (
                  <button key={id} onClick={() => onOpenTask(id)} className="max-w-full truncate rounded-full border border-line bg-card-2 px-2.5 py-1 text-xs text-ink-2">
                    📌 {t?.title ?? "관련 업무"}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-auto pt-3">
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-line bg-card-2 px-3.5 py-2.5">
            <span className="text-sm text-ink">사단장 확인</span>
            <span className={`relative h-7 w-12 rounded-full transition ${f.confirmed ? "bg-[#8b5a2b]" : "bg-[#e5d6c0]"}`}>
              <input type="checkbox" className="peer sr-only" checked={f.confirmed} onChange={() => toggle(f)} />
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${f.confirmed ? "left-6" : "left-1"}`} />
            </span>
          </label>
          </div>
        </article>
      ))}
      </div>
    </div>
  );
}
