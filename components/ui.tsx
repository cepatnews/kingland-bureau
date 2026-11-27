"use client";

import { useEffect, type ReactNode } from "react";
import { fmtTime } from "@/lib/client-api";
import type { DataMode, TaskState } from "@/lib/types";

const STATE_STYLE: Record<TaskState, [string, string]> = {
  대기: ["var(--wait)", "var(--wait-ink)"],
  "수신 확인": ["var(--info)", "var(--info-ink)"],
  진행: ["var(--run)", "var(--run-ink)"],
  "검수 대기": ["var(--review)", "var(--review-ink)"],
  재작업: ["#fde2d6", "#b4542a"],
  완료: ["var(--done)", "var(--done-ink)"],
  보류: ["var(--hold)", "var(--hold-ink)"],
};

export function stateColor(s: TaskState | null) {
  return s ? STATE_STYLE[s] : (["var(--hold)", "var(--hold-ink)"] as [string, string]);
}

export function StatePill({ state }: { state: TaskState | null }) {
  const [bg, ink] = stateColor(state);
  return (
    <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs" style={{ background: bg, color: ink }}>
      {state ?? "미지정"}
    </span>
  );
}

export function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "warn" | "brown" | "alert" }) {
  const styles = {
    plain: { background: "var(--card-2)", color: "var(--ink-2)", borderColor: "var(--line)" },
    warn: { background: "#fff1d9", color: "#9a6413", borderColor: "#f1d6a6" },
    brown: { background: "var(--brown-soft)", color: "var(--brown-2)", borderColor: "#e3c9a5" },
    alert: { background: "#fde4df", color: "#b3402f", borderColor: "#f4c4bb" },
  }[tone];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs" style={styles}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, state }: { value: number; state?: TaskState | null }) {
  const v = Math.max(0, Math.min(1, value || 0));
  const color = state === "완료" ? "#5c9b67" : state === "재작업" ? "#c4643a" : "linear-gradient(90deg,#c9945e,#8b5a2b)";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "#efe2cf" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${v * 100}%`, background: color }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-ink-2">{Math.round(v * 100)}%</span>
    </div>
  );
}

export function ConnectionBadge({ mode, error, lastOk }: { mode: DataMode | null; error: string | null; lastOk: string | null }) {
  if (error) {
    return (
      <div className="flex flex-col items-end">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs" style={{ background: "#fde4df", color: "#b3402f", borderColor: "#f4c4bb" }}>
          <span className="h-2 w-2 rounded-full bg-[#d0533f]" /> 노션 연결 끊김
        </span>
        <span className="mt-0.5 text-[10px] text-muted">마지막 성공 {lastOk ? fmtTime(lastOk) : "없음"}</span>
      </div>
    );
  }
  if (mode === "mock") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs" style={{ background: "#fff1d9", color: "#9a6413", borderColor: "#f1d6a6" }}>
        <span className="h-2 w-2 rounded-full bg-[#d89b2b]" /> 목업 모드
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs" style={{ background: "#e6f3e7", color: "#3f7d4a", borderColor: "#c6e2c9" }}>
      <span className="h-2 w-2 rounded-full bg-[#4fa05d]" /> {mode ? "노션 실시간 연결" : "연결 중…"}
    </span>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button aria-label="닫기" className="absolute inset-0 bg-[#3a2a1b]/35" onClick={onClose} />
      <div className="sheet-in relative max-h-[92dvh] w-full max-w-[680px] overflow-y-auto rounded-t-[26px] border border-line bg-bg pb-[env(safe-area-inset-bottom)] sm:rounded-[26px]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0 text-base text-ink">{title}</div>
          <button onClick={onClose} className="rounded-full border border-line bg-card px-3 py-1 text-sm text-ink-2">
            닫기
          </button>
        </div>
        <div className="px-4 py-4 sm:px-5">{children}</div>
      </div>
    </div>
  );
}

export type ToastMsg = { id: number; text: string; tone: "ok" | "err" };

export function Toasts({ items }: { items: ToastMsg[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className="sheet-in pointer-events-auto max-w-[480px] rounded-2xl border px-4 py-2.5 text-sm shadow-lg"
          style={t.tone === "err" ? { background: "#fde4df", color: "#9b3426", borderColor: "#f4c4bb" } : { background: "#fffaf2", color: "var(--ink)", borderColor: "var(--line)" }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-1">
      <h2 className="text-sm text-ink-2">{children}</h2>
      {right}
    </div>
  );
}
