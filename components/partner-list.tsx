"use client";

import { useEffect, useState } from "react";
import { commandGroups, type Org } from "@/lib/chain-of-command";
import { MEETING_ROOM, UNIT_COLOR, type Agent, type Task } from "@/lib/types";

const STATE_DOT: Record<string, string> = { 활성: "#4fa05d", "인터뷰 전": "#c2ad8f", 중지: "#d0533f" };
const OPEN_KEY = "sforce-partner-list-open";

/** 대화 상대 고르기: 대장실 / Vermilion(좌참) / Sapphire(우참)로 묶은 bullet 목록. 휴대폰은 접기 가능, 아이패드·맥은 세로 목록 */
export function PartnerList({
  org,
  agents,
  tasks,
  selectedId,
  onSelect,
  working,
}: {
  org: Org;
  agents: Agent[];
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  working: Map<string, number>;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      const v = localStorage.getItem(OPEN_KEY);
      if (v) setOpen(v === "1");
    } catch {}
  }, []);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? "0" : "1");
      } catch {}
      return !o;
    });
  };

  const groups = commandGroups(org, agents);
  const selectedName = selectedId === MEETING_ROOM ? "대회의실" : selectedId ? org.byId.get(selectedId)?.name : null;
  const openCount = (id: string) => tasks.filter((t) => t.state !== "완료" && t.assigneeIds.includes(id)).length;

  return (
    <div className="rounded-2xl border border-line bg-card-2/70 md:sticky md:top-4">
      <button onClick={toggle} className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left md:pointer-events-none">
        <span className="text-xs text-ink-2">
          대화방 <span className="ml-1 text-sm text-ink">{selectedName ?? "선택"}</span>
        </span>
        <span className="text-xs text-muted md:hidden">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>

      <div className={`${open ? "block" : "hidden"} border-t border-line px-2.5 pb-3 pt-2 md:block`}>
        <button
          onClick={() => onSelect(MEETING_ROOM)}
          className={`mb-2.5 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[14px] transition ${
            selectedId === MEETING_ROOM ? "border-[#e2c49e] bg-[#f6e4c9] text-brown-2" : "border-line bg-card text-ink hover:bg-brown-soft/40"
          }`}
          aria-pressed={selectedId === MEETING_ROOM}
        >
          <span>🏛️</span>
          <span>대회의실</span>
          <span className="ml-auto text-[11px] text-muted">전원</span>
        </button>
        <div className="mb-1.5 px-1 text-[11px] text-muted">1:1 대화</div>
        {groups.map((g) => (
          <div key={g.label} className="mb-2.5 last:mb-0">
            <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-muted">
              <span className="h-2.5 w-1 rounded-full" style={{ background: UNIT_COLOR[g.label] ?? "#c2ad8f" }} />
              {g.label}
            </div>
            <ul className="flex flex-wrap gap-1.5 md:flex-col md:gap-0.5">
              {g.members.map(({ agent, depth }) => {
                const active = agent.id === selectedId;
                const n = openCount(agent.id);
                const stopped = agent.state === "중지";
                return (
                  <li key={agent.id} className={depth ? "md:pl-4" : ""}>
                    <button
                      onClick={() => onSelect(agent.id)}
                      className={`flex w-full items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] transition md:rounded-xl md:border-transparent md:px-2.5 md:py-2 ${
                        active ? "border-[#c9a27a] bg-[#f6e4c9] text-brown-2 md:border-[#e2c49e]" : "border-line bg-card text-ink md:bg-transparent hover:md:bg-card"
                      } ${stopped ? "opacity-50" : ""}`}
                      aria-pressed={active}
                    >
                      {depth === 1 && <span className="hidden text-muted md:inline">•</span>}
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATE_DOT[agent.state ?? ""] ?? "#c2ad8f" }} title={agent.state ?? ""} />
                      <span className="truncate">{agent.name}</span>
                      {stopped ? (
                        <span className="shrink-0 rounded-full bg-[#fbe4e0] px-1.5 text-[10px] text-[#b5473a]" title="상태 중지: 일을 맡기지 않음">
                          ⛔ Out of Order
                        </span>
                      ) : (
                        <span className="hidden text-[11px] text-muted md:inline">{agent.rank}</span>
                      )}
                      <span className="ml-auto flex shrink-0 items-center gap-1">
                        {working.has(agent.id) && <WorkingPill />}
                        {n > 0 && (
                          <span className="rounded-full bg-[#fbe4e0] px-1.5 text-[10px] text-[#b5473a]" title={`진행 중 업무 ${n}건`}>
                            📌{n}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[10px] leading-relaxed text-muted">
          {Object.entries(STATE_DOT).map(([label, color]) => (
            <span key={label} className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            · <WorkingPill /> 지금 작업 중
          </span>
          <span>· 📌 진행 중 업무 수</span>
        </p>
      </div>
    </div>
  );
}

/** 지금 차례를 받아 작업 중인 에이전트 옆 작은 풍선 */
function WorkingPill() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-[#bfe0c4] bg-[#e7f5e9] px-1.5 py-px text-[10px] leading-tight text-[#2f7a3d]" title="지금 작업 중">
      ing
      <span className="inline-flex gap-px">
        {[0, 150, 300].map((d) => (
          <span key={d} className="h-1 w-1 animate-bounce rounded-full bg-[#4fa05d]" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
    </span>
  );
}
