"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildOrg } from "@/lib/chain-of-command";
import { useResource } from "@/lib/client-api";
import {
  MEETING_ROOM,
  type Agent,
  type FinalReport,
  type Task,
} from "@/lib/types";
import { AgentsPanel } from "./agents-panel";
import { Conversation, useChatRoom } from "./commander-room";
import { BrandHeader, useBrand } from "./brand";
import { OfficeView, type OfficeViewMode } from "./office-view";
import { workingAgents } from "@/lib/working";
import { ReportsPanel } from "./reports-panel";
import { TaskBoard, type BoardFilter } from "./task-board";
import { TaskDetail } from "./task-detail";
import { ConnectionBadge, Toasts, type ToastMsg } from "./ui";

export type Tab = "chat" | "office" | "board" | "reports" | "agents";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "chat", label: "대화", icon: "💬" },
  { id: "office", label: "오피스", icon: "🏢" },
  { id: "board", label: "업무 현황", icon: "📋" },
  { id: "reports", label: "보고서", icon: "📑" },
  { id: "agents", label: "에이전트", icon: "🎖️" },
];

const PARTNER_KEY = "sforce-partner";

/**
 * 반응형 기준 (휴대폰 우선)
 * - 기본(휴대폰): 한 열, 위쪽 4칸 탭
 * - md 768px~ (아이패드): 넓은 본문, 대화는 상대 목록 | 대화창 2열, 현황판 2열
 * - lg 1024px~ (맥북): 왼쪽 세로 메뉴 + 본문, 현황판 xl에서 3열
 */
export function SforceApp() {
  const [tab, setTab] = useState<Tab>("chat");
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [brand, setBrand] = useBrand();
  const choosePartnerRef = useRef<(id: string) => void>(() => {});

  const agents = useResource<Agent[]>("agents", "/api/agents");
  const tasks = useResource<Task[]>("tasks", "/api/tasks");
  const finals = useResource<FinalReport[]>("final-reports", "/api/reports");

  const org = useMemo(() => buildOrg(agents.data ?? []), [agents.data]);

  // 실시간 사무실: 대회의실 흐름(10)과 업무(04)로 위치 계산. 8초마다 갱신, 탭이 숨겨지면 쉰다.
  const officeFeed = useChatRoom(MEETING_ROOM);
  const pollOffice = officeFeed.poll;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      void pollOffice();
    }, 8000);
    return () => clearInterval(id);
  }, [pollOffice]);
  // 사무실 보기: 🧊 3D(기본) / 🎨 평면 / 📐 도면 — 이 기기에만 기억
  const [officeView, setOfficeView] = useState<OfficeViewMode>("3d");
  useEffect(() => {
    try {
      const v = localStorage.getItem("sforce-office-view");
      if (v === "3d" || v === "flat" || v === "plan") setOfficeView(v);
    } catch {}
  }, []);
  const chooseOfficeView = useCallback((v: OfficeViewMode) => {
    setOfficeView(v);
    try {
      localStorage.setItem("sforce-office-view", v);
    } catch {}
  }, []);
  const working = useMemo(
    () => workingAgents(org, MEETING_ROOM, officeFeed.messages, now),
    [org, officeFeed.messages, now],
  );
  const feedAgentMsgs = officeFeed.messages.filter((m) => m.senderId).length;
  const reloadTasksForOffice = tasks.reload;
  useEffect(() => {
    if (feedAgentMsgs) void reloadTasksForOffice();
  }, [feedAgentMsgs, reloadTasksForOffice]);
  const openRoom = useCallback((id: string) => {
    choosePartnerRef.current(id);
    setTab("chat");
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PARTNER_KEY);
      if (saved) setPartnerId(saved);
    } catch {}
  }, []);
  const choosePartner = useCallback((id: string) => {
    setPartnerId(id);
    try {
      localStorage.setItem(PARTNER_KEY, id);
    } catch {}
  }, []);
  choosePartnerRef.current = choosePartner;
  // 저장된 방이 없거나 조직도에 없으면 대회의실로
  const effectivePartner =
    partnerId && (partnerId === MEETING_ROOM || org.byId.has(partnerId))
      ? partnerId
      : MEETING_ROOM;

  const toast = useCallback((text: string, tone: ToastMsg["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      tone === "err" ? 5000 : 2600,
    );
  }, []);

  const all = [agents, tasks, finals];
  const error = all.find((r) => r.error)?.error ?? null;
  const mode = all.find((r) => r.mode)?.mode ?? null;
  const lastOk =
    all
      .map((r) => r.fetchedAt)
      .filter(Boolean)
      .sort()
      .at(0) ?? null;

  const reloadAll = useCallback(() => {
    void agents.reload();
    void tasks.reload();
    void finals.reload();
  }, [agents, tasks, finals]);

  const pendingApprovals = (tasks.data ?? []).filter(
    (t) => t.approval === "승인 대기",
  ).length;
  const unconfirmed = (finals.data ?? []).filter((f) => !f.confirmed).length;

  return (
    <div className="mx-auto w-full max-w-[760px] px-3 pb-10 pt-[max(12px,env(safe-area-inset-top))] sm:px-5 md:max-w-[1100px] lg:grid lg:max-w-[1400px] lg:grid-cols-[232px_minmax(0,1fr)] lg:items-start lg:gap-5 lg:px-6 lg:pt-6">
      <aside className="card overflow-hidden lg:sticky lg:top-6">
        <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5 lg:flex-col lg:items-start lg:gap-3">
          <BrandHeader brand={brand} onChange={setBrand} toast={toast} />
          <button onClick={reloadAll} title="새로고침" className="shrink-0">
            <ConnectionBadge mode={mode} error={error} lastOk={lastOk} />
          </button>
        </header>

        <nav className="grid grid-cols-5 gap-1 sm:gap-2 border-t border-line bg-card-2 px-2 py-2 sm:px-3 lg:grid-cols-1 lg:gap-1 lg:px-3 lg:py-3">
          {TABS.map((t) => {
            const active = tab === t.id;
            const badge =
              t.id === "board"
                ? pendingApprovals
                : t.id === "reports"
                  ? unconfirmed
                  : 0;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2.5 text-xs transition sm:text-sm lg:flex-row lg:gap-3 lg:px-4 lg:py-3 lg:text-[15px] ${
                  active ? "btn-brown" : "text-ink-2 hover:bg-brown-soft/60"
                }`}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                <span className="whitespace-nowrap">{t.label}</span>
                {badge > 0 && (
                  <span className="absolute right-2 top-1 min-w-[18px] rounded-full bg-[#d0533f] px-1 text-[10px] leading-[18px] text-white lg:static lg:ml-auto">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden border-t border-line px-3 py-3 lg:block">
          <OfficeView
            org={org}
            agents={agents.data ?? []}
            tasks={tasks.data ?? []}
            working={working}
            now={now}
            size="mini"
            view={officeView}
            onExpand={() => setTab("office")}
          />
        </div>

        <p className="hidden border-t border-line px-4 py-3 text-[11px] leading-relaxed text-muted lg:block">
          사단장 → 대장 피클 → 좌참·우참 피클 → 부대원
          <br />
          모든 보고는 노션 09에 쌓입니다
        </p>
      </aside>

      <main className="card mt-3 min-w-0 px-3 py-4 sm:px-4 md:px-5 md:py-5 lg:mt-0">
        {tab === "chat" && (
          <Conversation
            org={org}
            agents={agents.data ?? []}
            partnerId={effectivePartner}
            onPartner={choosePartner}
            tasks={tasks}
            toast={toast}
            onOpenTask={setOpenTaskId}
            onShowBoard={(f) => {
              setBoardFilter(f);
              setTab("board");
            }}
            onShowReports={() => setTab("reports")}
          />
        )}
        {tab === "office" && (
          <OfficeView
            org={org}
            agents={agents.data ?? []}
            tasks={tasks.data ?? []}
            working={working}
            now={now}
            size="full"
            orgName={brand.orgName ?? undefined}
            view={officeView}
            onView={chooseOfficeView}
            onOpenRoom={openRoom}
            onOpenTask={setOpenTaskId}
          />
        )}
        {tab === "board" && (
          <TaskBoard
            org={org}
            tasks={tasks.data}
            loading={tasks.loading}
            filter={boardFilter}
            onFilter={setBoardFilter}
            onOpenTask={setOpenTaskId}
          />
        )}
        {tab === "reports" && (
          <ReportsPanel
            org={org}
            finals={finals}
            toast={toast}
            tasks={tasks.data ?? []}
            onOpenTask={setOpenTaskId}
          />
        )}
        {tab === "agents" && (
          <AgentsPanel
            org={org}
            agents={agents}
            tasks={tasks.data ?? []}
            toast={toast}
            onReported={() => {
              void tasks.reload();
            }}
          />
        )}
      </main>

      <p className="mt-3 text-center text-[11px] text-muted lg:hidden">
        사단장 → 대장 피클 → 좌참·우참 피클 → 부대원 · 모든 보고는 노션 09에
        쌓입니다
      </p>

      <TaskDetail
        taskId={openTaskId}
        onClose={() => setOpenTaskId(null)}
        org={org}
        tasks={tasks}
        onOpenTask={setOpenTaskId}
        toast={toast}
      />
      <Toasts items={toasts} />
    </div>
  );
}
