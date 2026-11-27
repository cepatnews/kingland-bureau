"use client";
/* eslint-disable @next/next/no-img-element -- 작은 정적 webp(배경·캐릭터). Vercel 이미지 최적화 비용을 피하려고 일반 img 사용 */

import { useMemo, useState } from "react";
import { agentAbbr, type Org } from "@/lib/chain-of-command";
import {
  ART_LAYOUT,
  ISO_LAYOUT,
  BENCHES,
  CEO_SEAT,
  COMMANDER_DESK,
  DISCUSSION_TABLE,
  INTERN_SEATS,
  INTERN_TABLE,
  MEETING_ROOM_BOX,
  MEETING_SEATS,
  MEETING_TABLE,
  OFFICE_H,
  OFFICE_W,
  PLAN_LAYOUT,
  SEAT_COUNT,
  SMALL_ROOM_BOX,
  SMALL_SEATS,
  SMALL_TABLE,
  officeScene,
  sceneCounts,
  type Desk,
  type Placement,
} from "@/lib/office-scene";
import { MEETING_ROOM, UNIT_COLOR, type Agent, type Task } from "@/lib/types";
import { APP_ICON } from "./commander-room";
import { ORG_NAME } from "@/lib/brand";

const pct = (x: number, y: number) => ({
  left: `${(x / OFFICE_W) * 100}%`,
  top: `${(y / OFFICE_H) * 100}%`,
});
const unitColor = (a: Agent) => UNIT_COLOR[a.unit ?? ""] ?? "#c9a25e";

/**
 * 실시간 사무실 (1단계: 코드로 그린 도면).
 * 크래프턴풍 오픈 오피스: 짙은 카펫, 검은 책상과 모니터, 유리벽 대장실·대회의실, 탕비실, 라운지.
 */
export function OfficeView({
  org,
  agents,
  tasks,
  working,
  now,
  size,
  onOpenRoom,
  onOpenTask,
  onExpand,
  view,
  onView,
}: {
  org: Org;
  agents: Agent[];
  tasks: Task[];
  working: Map<string, number>;
  now: number;
  size: "mini" | "full";
  onOpenRoom?: (id: string) => void;
  onOpenTask?: (id: string) => void;
  onExpand?: () => void;
  view: OfficeViewMode; // 3d = 입체 일러스트, flat = 평면 일러스트, plan = 코드 도면
  onView?: (v: OfficeViewMode) => void;
}) {
  const art = view !== "plan";
  const layout =
    view === "3d" ? ISO_LAYOUT : view === "flat" ? ART_LAYOUT : PLAN_LAYOUT;
  const { placements, desks } = useMemo(
    () => officeScene(org, agents, tasks, working, now, layout),
    [org, agents, tasks, working, now, layout],
  );
  const counts = sceneCounts(placements);
  const [picked, setPicked] = useState<string | null>(null);
  const pickedP = placements.find((p) => p.agent.id === picked) ?? null;
  const full = size === "full";

  const map = (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{ aspectRatio: `${OFFICE_W} / ${OFFICE_H}` }}
      onClick={() => setPicked(null)}
    >
      {art && (
        <img
          src={view === "3d" ? OFFICE_BG_3D : OFFICE_BG}
          alt=""
          className="absolute inset-0 h-full w-full select-none object-cover"
          draggable={false}
        />
      )}
      <Floor desks={desks} full={full} art={art} view={view} />
      {full && (
        <>
          <ZoneButton
            {...layout.meetingBox}
            label="대회의실 대화 열기"
            onClick={() => onOpenRoom?.(MEETING_ROOM)}
          />
        </>
      )}
      <CeoToken full={full} pos={layout.ceo} />
      {placements.map((p) => (
        <Token
          key={p.agent.id}
          p={p}
          full={full}
          art={art}
          depth={view === "3d"}
          active={picked === p.agent.id}
          onPick={() =>
            setPicked((id) => (id === p.agent.id ? null : p.agent.id))
          }
        />
      ))}
      {full && pickedP && (
        <AgentCard
          p={pickedP}
          tasks={tasks}
          onOpenRoom={onOpenRoom}
          onOpenTask={onOpenTask}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );

  if (!full) {
    return (
      <button
        onClick={onExpand}
        className="block w-full text-left"
        title="크게 보기"
      >
        <div className="mb-1.5 flex items-center justify-between px-0.5 text-[11px] text-ink-2">
          <span>🏢 실시간 사무실</span>
          <span className="text-muted">
            회의 {counts.meeting} · 업무 {counts.work} · 휴식 {counts.rest}
          </span>
        </div>
        {map}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-[15px] text-ink">
          🏢 {ORG_NAME} 본부 사무실
        </span>
        <span className="text-xs text-muted">
          실제 업무 흐름대로 움직입니다 · 사람을 누르면 지금 하는 일
        </span>
        {onView && (
          <div className="ml-auto flex overflow-hidden rounded-full border border-line text-xs">
            {VIEW_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => onView(m.id)}
                className={`px-3 py-1.5 ${view === m.id ? "bg-[#f6e4c9] text-brown-2" : "bg-card text-ink-2"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <Pill>🏛️ 회의 중 {counts.meeting}</Pill>
        <Pill>⌨️ 업무 중 {counts.work}</Pill>
        <Pill>☕ 휴식 {counts.rest}</Pill>
        <Pill>
          👥 출근 {placements.length}명 · 좌석 {SEAT_COUNT}석 (인턴석{" "}
          {INTERN_SEATS.length})
        </Pill>
        <Pill>
          🕘{" "}
          {new Date(now).toLocaleTimeString("ko-KR", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Asia/Seoul",
          })}
        </Pill>
      </div>
      <div className="no-scrollbar overflow-x-auto rounded-2xl border border-line bg-[#1d1f23] p-1.5 sm:p-2">
        <div className="min-w-[640px]">{map}</div>
      </div>
      <p className="-mt-1 px-1 text-[10px] text-muted md:hidden">
        ← 옆으로 밀어서 사무실 전체 보기 →
      </p>
      <p className="px-1 text-[11px] leading-relaxed text-muted">
        파티션 없는 오픈 플로어입니다. 대장이 지시를 내리면 대장·참모가
        대회의실에, 참모가 부대원에게 일을 나눌 때는 소회의실에 모입니다.
        배정받은 부대원은 부대 공용 테이블 자기 자리로 가서 일합니다. 맡은 일이
        없으면 탕비실·라운지에서 쉽니다. 대회의실을 누르면 그 대화방이 열립니다.
      </p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-card px-2.5 py-1 text-ink-2">
      {children}
    </span>
  );
}

function ZoneButton({
  x,
  y,
  w,
  h,
  label,
  onClick,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute rounded-lg transition hover:bg-white/5"
      style={{
        ...pct(x, y),
        width: `${(w / OFFICE_W) * 100}%`,
        height: `${(h / OFFICE_H) * 100}%`,
      }}
    />
  );
}

/** 사단장(사용자) 자리 표시 */
function CeoToken({
  full,
  pos,
}: {
  full: boolean;
  pos: { x: number; y: number };
}) {
  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={pct(pos.x, pos.y)}
      title="사단장"
    >
      {full ? (
        <div className="flex flex-col items-center">
          <span
            className="grid h-8 w-8 place-items-center rounded-full bg-[#fbecd2] text-[16px] shadow-md"
            style={{
              boxShadow: "0 0 0 2px #c9a25e, 0 2px 6px rgba(0,0,0,.45)",
            }}
          >
            👑
          </span>
          <span className="mt-0.5 rounded bg-[#c9a25e] px-1 text-[9px] font-semibold leading-tight text-white">
            사단장
          </span>
        </div>
      ) : (
        <span
          className="grid h-[13px] w-[13px] place-items-center rounded-full bg-[#fbecd2] text-[8px] leading-none"
          style={{ boxShadow: "0 0 0 1px #c9a25e" }}
        >
          👑
        </span>
      )}
    </div>
  );
}

/** 에이전트 캐릭터 그림 (AI로 만든 시트를 잘라 둔 것) */
const OFFICE_BG = "/office/office-bg.webp";
const OFFICE_BG_3D = "/office/office-3d.webp";
export type OfficeViewMode = "3d" | "flat" | "plan";
export const VIEW_MODES: { id: OfficeViewMode; label: string }[] = [
  { id: "3d", label: "🧊 3D" },
  { id: "flat", label: "🎨 평면" },
  { id: "plan", label: "📐 도면" },
];
function spriteOf(a: Agent): string {
  let key = "intern";
  if (a.rank === "대장") key = "gc";
  else if (a.rank === "참모") key = a.unit === "Sapphire" ? "rc" : "lc";
  else {
    const m = a.name.match(/^([VHWI])([LR])agent$/i);
    if (m) key = (m[1] + m[2]).toLowerCase();
  }
  return `/office/agents/${key}.webp`;
}

function Token({
  p,
  full,
  art,
  depth = false,
  active,
  onPick,
}: {
  p: Placement;
  full: boolean;
  art: boolean;
  depth?: boolean; // 3D: 뒤쪽은 작게, 앞쪽은 크게 + 앞사람이 위로
  active: boolean;
  onPick: () => void;
}) {
  const color = unitColor(p.agent);
  const abbr = agentAbbr(p.agent);
  const scale = depth ? 0.8 + (p.pos.y / OFFICE_H) * 0.35 : 1;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-[2400ms] ease-in-out"
      style={{ ...pct(p.pos.x, p.pos.y), zIndex: 10 + Math.round(p.pos.y) }}
    >
      <div
        style={{ transform: `scale(${scale})`, transformOrigin: "50% 70%" }}
        className="transition-transform duration-[2400ms]"
      >
        {full ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPick();
            }}
            className="group relative flex flex-col items-center"
            title={`${p.agent.name} · ${p.status}`}
          >
            <span
              className={`absolute -top-5 text-[13px] leading-none drop-shadow ${p.busy ? "animate-bounce" : ""}`}
            >
              {p.icon}
            </span>
            {art ? (
              <img
                src={spriteOf(p.agent)}
                alt=""
                draggable={false}
                className={`h-9 w-9 object-contain drop-shadow-[0_3px_3px_rgba(0,0,0,0.55)] transition sm:h-10 sm:w-10 ${active ? "scale-110" : "group-hover:scale-105"}`}
              />
            ) : (
              <span
                className={`grid h-7 w-7 place-items-center rounded-full bg-[#fffaf2] text-[15px] shadow-md transition sm:h-8 sm:w-8 ${active ? "scale-110" : "group-hover:scale-105"}`}
                style={{
                  boxShadow: `0 0 0 2px ${color}, 0 2px 6px rgba(0,0,0,.45)`,
                }}
              >
                {APP_ICON[p.agent.app ?? ""] ?? "🤖"}
              </span>
            )}
            <span
              className="mt-0.5 rounded px-1 text-[9px] font-semibold leading-tight text-white"
              style={{ background: color }}
            >
              {abbr}
            </span>
          </button>
        ) : (
          <span className="relative block">
            {p.busy && (
              <span
                className="absolute inset-0 animate-ping rounded-full"
                style={{ background: color, opacity: 0.6 }}
              />
            )}
            {art ? (
              <img
                src={spriteOf(p.agent)}
                alt=""
                draggable={false}
                className="relative h-[16px] w-[16px] object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
              />
            ) : (
              <span
                className="relative grid h-[13px] w-[13px] place-items-center rounded-full text-[5.5px] font-bold leading-none text-white"
                style={{
                  background: color,
                  boxShadow: "0 0 0 1px rgba(255,255,255,.8)",
                }}
              >
                {abbr}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function AgentCard({
  p,
  tasks,
  onOpenRoom,
  onOpenTask,
  onClose,
}: {
  p: Placement;
  tasks: Task[];
  onOpenRoom?: (id: string) => void;
  onOpenTask?: (id: string) => void;
  onClose: () => void;
}) {
  const left = p.pos.x > OFFICE_W * 0.6;
  const up = p.pos.y > OFFICE_H * 0.55;
  const task = p.taskLabel
    ? tasks.find((t) => `#${t.code?.match(/\d+/)?.[0]}` === p.taskLabel)
    : null;
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute z-[200] w-[210px] rounded-xl border border-line bg-card p-3 text-xs shadow-xl"
      style={{
        ...pct(p.pos.x, p.pos.y),
        transform: `translate(${left ? "calc(-100% - 18px)" : "18px"}, ${up ? "calc(-100% + 8px)" : "-8px"})`,
      }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-sm text-ink">{p.agent.name}</span>
        <span className="text-[10px] text-muted">
          {p.agent.rank} · {p.agent.unit}
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-muted"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
      <div className="text-ink-2">
        {p.icon} {p.status}
      </div>
      {p.agent.activity && (
        <div className="mt-1 line-clamp-2 text-[11px] text-muted">
          {p.agent.activity}
        </div>
      )}
      <div className="mt-2 flex gap-1.5">
        <button
          onClick={() => onOpenRoom?.(p.agent.id)}
          className="rounded-full border border-line bg-card-2 px-2.5 py-1 text-[11px] text-ink-2"
        >
          💬 대화하기
        </button>
        {task && (
          <button
            onClick={() => onOpenTask?.(task.id)}
            className="rounded-full border border-line bg-card-2 px-2.5 py-1 text-[11px] text-ink-2"
          >
            📌 {p.taskLabel} 보기
          </button>
        )}
      </div>
    </div>
  );
}

/** 바닥 도면 (SVG). 좌표계 160 × 100. 파티션 없는 오픈 플로어. */
export function Floor({
  desks,
  full,
  art = false,
  view = "plan",
}: {
  desks: Desk[];
  full: boolean;
  art?: boolean;
  view?: OfficeViewMode;
}) {
  if (art) {
    // 일러스트 배경 위에는 움직이는 정보(⛔ 팻말·이름·구역 이름)만 얹는다
    return (
      <svg
        viewBox={`0 0 ${OFFICE_W} ${OFFICE_H}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {desks.map((d) => (
          <SeatShape key={d.id} d={d} full={full} art />
        ))}
        {full && <ZoneLabels view={view} />}
      </svg>
    );
  }
  const glass = {
    fill: "rgba(170,200,220,0.10)",
    stroke: "rgba(225,238,248,0.55)",
    strokeWidth: 0.5,
  };
  return (
    <svg
      viewBox={`0 0 ${OFFICE_W} ${OFFICE_H}`}
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <pattern id="carpet" width="2" height="2" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#2c2f34" />
          <circle cx="0.5" cy="0.5" r="0.18" fill="#363a40" />
          <circle cx="1.5" cy="1.5" r="0.18" fill="#25282c" />
        </pattern>
        <pattern id="wood" width="6" height="3" patternUnits="userSpaceOnUse">
          <rect width="6" height="3" fill="#7b5c40" />
          <line
            x1="0"
            y1="1.5"
            x2="6"
            y2="1.5"
            stroke="#6f523a"
            strokeWidth="0.25"
          />
          <line
            x1="3"
            y1="0"
            x2="3"
            y2="1.5"
            stroke="#6f523a"
            strokeWidth="0.2"
          />
        </pattern>
        <pattern id="wood2" width="6" height="3" patternUnits="userSpaceOnUse">
          <rect width="6" height="3" fill="#94714f" />
          <line
            x1="0"
            y1="1.5"
            x2="6"
            y2="1.5"
            stroke="#856446"
            strokeWidth="0.25"
          />
        </pattern>
        <radialGradient id="glow">
          <stop offset="0%" stopColor="#9fd0ff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#9fd0ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 오픈 플로어 카펫 + 노출 천장 라인 조명 */}
      <rect width={OFFICE_W} height={OFFICE_H} fill="url(#carpet)" />
      <rect x="42" y="2" width="3" height="96" fill="#303338" />
      {[6, 38, 60, 92].map((y) => (
        <rect
          key={y}
          x="47"
          y={y}
          width="70"
          height="0.6"
          rx="0.3"
          fill="#f3f6fa"
          opacity="0.13"
        />
      ))}

      {/* 대회의실 (유리벽) — 상석은 사단장, 맞은편 끝은 대장 */}
      <rect
        x={MEETING_ROOM_BOX.x}
        y={MEETING_ROOM_BOX.y}
        width={MEETING_ROOM_BOX.w}
        height={MEETING_ROOM_BOX.h}
        rx="1.5"
        {...glass}
      />
      <rect
        x={MEETING_TABLE.x}
        y={MEETING_TABLE.y}
        width={MEETING_TABLE.w}
        height={MEETING_TABLE.h}
        rx="2"
        fill="#5a4535"
        stroke="#6e5644"
        strokeWidth="0.3"
      />
      <circle
        cx={CEO_SEAT.x}
        cy={CEO_SEAT.y + 0.4}
        r="2.6"
        fill="#5b4a3a"
        stroke="#c9a25e"
        strokeWidth="0.35"
      />
      {MEETING_SEATS.map((m, i) => (
        <circle
          key={i}
          cx={m.x}
          cy={m.y}
          r="2.1"
          fill="#45494f"
          stroke="#55595f"
          strokeWidth="0.2"
        />
      ))}
      <rect
        x="38.5"
        y="14"
        width="1"
        height="20"
        rx="0.4"
        fill="#e8eef4"
        opacity="0.45"
      />
      <circle cx="38" cy="46" r="1.8" fill="#3f6b45" />

      {/* 소회의실 (유리벽) — 부대 배분 회의 */}
      <rect
        x={SMALL_ROOM_BOX.x}
        y={SMALL_ROOM_BOX.y}
        width={SMALL_ROOM_BOX.w}
        height={SMALL_ROOM_BOX.h}
        rx="1.5"
        {...glass}
      />
      <circle
        cx={SMALL_TABLE.x}
        cy={SMALL_TABLE.y}
        r="7"
        fill="#5a4535"
        stroke="#6e5644"
        strokeWidth="0.3"
      />
      {SMALL_SEATS.map((m, i) => (
        <circle
          key={i}
          cx={m.x}
          cy={m.y}
          r="2"
          fill="#45494f"
          stroke="#55595f"
          strokeWidth="0.2"
        />
      ))}
      <rect
        x="5"
        y="94"
        width="9"
        height="1"
        rx="0.5"
        fill="#e8eef4"
        opacity="0.45"
      />
      <circle cx="38" cy="94" r="1.8" fill="#3f6b45" />

      {/* 부대 공용 테이블 (칸막이 없음, 마주 보고 앉음) */}
      {Object.entries(BENCHES).map(([unit, b]) => (
        <g key={unit}>
          <rect
            x={b.table.x - 2}
            y={b.table.y}
            width={b.table.w + 2}
            height={b.table.h}
            rx="1"
            fill="#1a1c1f"
            stroke={UNIT_COLOR[unit] ?? "#666"}
            strokeWidth="0.35"
          />
          <text
            x={b.table.x + b.table.w / 2}
            y={b.table.y + b.table.h / 2 + 0.9}
            fontSize="2.3"
            textAnchor="middle"
            fill={UNIT_COLOR[unit] ?? "#999"}
            opacity="0.85"
          >
            {unit} · {unit === "Vermilion" ? "좌참" : "우참"}
          </text>
        </g>
      ))}

      {/* 가운데: 대장 지휘석 + 자유 토론 테이블 + 화이트보드 */}
      <rect
        x={COMMANDER_DESK.x - 7}
        y={COMMANDER_DESK.y - 7.5}
        width="14"
        height="4.6"
        rx="0.8"
        fill="#1a1c1f"
        stroke="#c9a25e"
        strokeWidth="0.45"
      />
      <circle
        cx={DISCUSSION_TABLE.x}
        cy={DISCUSSION_TABLE.y}
        r="4.6"
        fill="#5a4535"
        stroke="#6e5644"
        strokeWidth="0.3"
      />
      {[0, 90, 180, 270].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return (
          <circle
            key={deg}
            cx={DISCUSSION_TABLE.x + Math.cos(r) * 7}
            cy={DISCUSSION_TABLE.y + Math.sin(r) * 7}
            r="1.4"
            fill="#45494f"
          />
        );
      })}
      <rect
        x="95"
        y="42"
        width="1"
        height="10"
        rx="0.4"
        fill="#e9edf1"
        opacity="0.8"
      />
      <text x="97.5" y="48" fontSize="1.9" fill="#9aa3ad">
        토론
      </text>

      {/* 인턴석 */}
      <rect
        x={INTERN_TABLE.x}
        y={INTERN_TABLE.y}
        width={INTERN_TABLE.w}
        height={INTERN_TABLE.h}
        rx="1"
        fill="#1a1c1f"
        stroke="#7d8590"
        strokeWidth="0.3"
        strokeDasharray="1 0.6"
      />

      {/* 자리 (의자 + 모니터) */}
      {desks.map((d) => (
        <SeatShape key={d.id} d={d} full={full} />
      ))}

      {/* 오른쪽 아래 공용 공간: 프린터·화분 */}
      <rect x="106" y="88" width="8" height="6" rx="0.8" fill="#d6dde3" />
      <circle cx="117" cy="62" r="2" fill="#3f6b45" />
      <circle cx="47.5" cy="95" r="1.8" fill="#3f6b45" />

      {/* 탕비실 */}
      <rect x="122" y="2" width="36" height="44" rx="1.5" fill="url(#wood)" />
      <rect x="124" y="4" width="32" height="5" rx="0.8" fill="#e3ddd3" />
      <rect x="126" y="4.6" width="4" height="3.6" rx="0.5" fill="#3b3e44" />
      <rect x="131" y="4.6" width="3" height="3.6" rx="0.5" fill="#b89a6a" />
      {[136, 139, 142, 145, 148, 151].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy="6.4"
          r="0.9"
          fill={
            ["#d96b4f", "#e7c35a", "#79b26b", "#5f9ad6", "#c47ac0", "#efe7d8"][
              i
            ]
          }
        />
      ))}
      <circle
        cx="140"
        cy="31"
        r="4.6"
        fill="#c8b493"
        stroke="#a88f6c"
        strokeWidth="0.3"
      />
      <circle cx="140" cy="31" r="1.2" fill="#e9dfcf" />
      <rect x="152" y="12" width="4" height="9" rx="0.8" fill="#d6dde3" />

      {/* 라운지 */}
      <rect x="122" y="52" width="36" height="46" rx="1.5" fill="url(#wood2)" />
      <ellipse cx="141" cy="74" rx="10" ry="7" fill="#d9b9a0" opacity="0.6" />
      <path d="M125 57 h18 v4 h-14 v14 h-4 z" fill="#b5584a" />
      <rect x="145" y="90" width="9" height="5" rx="2" fill="#efe6d6" />
      <circle cx="152" cy="62" r="3" fill="#e8dcc6" />
      <circle cx="128" cy="91" r="3" fill="#e8dcc6" />
      <circle cx="156" cy="96" r="1.8" fill="#3f6b45" />

      {/* 벽 */}
      <rect
        x="0.5"
        y="0.5"
        width={OFFICE_W - 1}
        height={OFFICE_H - 1}
        rx="2"
        fill="none"
        stroke="#8a7a66"
        strokeWidth="1"
      />
      <line
        x1="121"
        y1="2"
        x2="121"
        y2="98"
        stroke="#8a7a66"
        strokeWidth="0.6"
      />

      {full && <ZoneLabels />}
    </svg>
  );
}

/** 구역 이름표 위치: 보기마다 방 위치가 달라 따로 둔다 */
const LABEL_POS: Record<
  OfficeViewMode,
  Record<"big" | "small" | "pantry" | "lounge" | "intern", [number, number]>
> = {
  plan: {
    big: [3.5, 5.5],
    small: [3.5, 58],
    pantry: [124, 14],
    lounge: [124, 50],
    intern: [100.5, 8],
  },
  flat: {
    big: [3.5, 5.5],
    small: [3.5, 59.5],
    pantry: [127, 12.5],
    lounge: [127, 57],
    intern: [104, 10.5],
  },
  "3d": {
    big: [11, 17.5],
    small: [12, 61],
    pantry: [121, 22.5],
    lounge: [121.5, 95.5],
    intern: [100, 19.5],
  },
};

function ZoneLabels({ view = "plan" }: { view?: OfficeViewMode }) {
  const L = LABEL_POS[view];
  return (
    <g fontSize="3" fill="#f6efe4">
      <ZoneLabel x={L.big[0]} y={L.big[1]} text="🏛️ 대회의실" />
      <ZoneLabel x={L.small[0]} y={L.small[1]} text="🗣️ 소회의실" />
      <ZoneLabel x={L.pantry[0]} y={L.pantry[1]} text="☕ 탕비실" />
      <ZoneLabel x={L.lounge[0]} y={L.lounge[1]} text="🛋️ 라운지" />
      <ZoneLabel x={L.intern[0]} y={L.intern[1]} text="🌱 인턴석" />
    </g>
  );
}

function ZoneLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <rect
        x={x - 0.8}
        y={y - 3}
        width={text.length * 2.4 + 1.6}
        height="4.2"
        rx="2.1"
        fill="rgba(0,0,0,0.45)"
      />
      <text x={x} y={y}>
        {text}
      </text>
    </g>
  );
}

/** 공용 테이블 위 모니터 + 의자. 칸막이 없음. */
function SeatShape({
  d,
  full,
  art = false,
}: {
  d: Desk;
  full: boolean;
  art?: boolean;
}) {
  if (art) {
    const { x, y } = d.pos;
    return (
      <g>
        {d.outOfOrder && (
          <g>
            <rect
              x={x - 6}
              y={y - 2.3}
              width="12"
              height="4.6"
              rx="0.8"
              fill="#b5473a"
            />
            <text
              x={x}
              y={y + 0.9}
              fontSize={full ? 2.2 : 2.6}
              textAnchor="middle"
              fill="#fff"
            >
              {full ? "⛔ Out of Order" : "⛔"}
            </text>
          </g>
        )}
        {full && d.kind === "intern" && !d.owner && (
          <text
            x={x}
            y={y + 0.7}
            fontSize="1.7"
            textAnchor="middle"
            fill="#cfd5db"
            opacity="0.8"
          >
            빈자리
          </text>
        )}
      </g>
    );
  }
  const { x, y } = d.pos;
  const on = d.owner && !d.outOfOrder;
  // 모니터는 테이블 쪽(facing)으로 3.8 떨어진 곳
  const off = {
    up: [0, -4.6],
    down: [0, 4.6],
    left: [-4.6, 0],
    right: [4.4, 0],
  }[d.facing];
  const mx = x + off[0];
  const my = y + off[1];
  const vertical = d.facing === "left" || d.facing === "right";
  const mw = vertical ? 1.2 : 6;
  const mh = vertical ? 5 : 1.2;
  const monitorY = d.kind === "commander" ? y - 6.6 : my - mh / 2;
  const monitorX = d.kind === "commander" ? x - 3.2 : mx - mw / 2;
  return (
    <g>
      <rect
        x={monitorX}
        y={monitorY}
        width={d.kind === "commander" ? 6.4 : mw}
        height={d.kind === "commander" ? 1.2 : mh}
        rx="0.4"
        fill={on ? "#8cc4f5" : "#3f454d"}
        opacity="0.9"
      />
      {on && (
        <ellipse
          cx={d.kind === "commander" ? x : mx}
          cy={d.kind === "commander" ? y - 6 : my}
          rx="4.5"
          ry="2.6"
          fill="url(#glow)"
        />
      )}
      <circle
        cx={x}
        cy={y}
        r="2.3"
        fill={d.kind === "intern" && !d.owner ? "#3a3d43" : "#44484f"}
        stroke={d.kind === "intern" ? "#6b7280" : "none"}
        strokeWidth="0.25"
        strokeDasharray="0.8 0.5"
      />
      {d.outOfOrder && (
        <g>
          <rect
            x={x - 6}
            y={y - 2.3}
            width="12"
            height="4.6"
            rx="0.8"
            fill="#b5473a"
          />
          <text
            x={x}
            y={y + 0.9}
            fontSize={full ? 2.2 : 2.6}
            textAnchor="middle"
            fill="#fff"
          >
            {full ? "⛔ Out of Order" : "⛔"}
          </text>
        </g>
      )}
      {full && d.owner && !d.outOfOrder && (
        <text
          x={x}
          y={d.facing === "down" ? y - 3.6 : y + 5.4}
          fontSize="1.8"
          textAnchor="middle"
          fill="#8f98a3"
        >
          {d.owner.name.replace(/agent$/, "")}
        </text>
      )}
      {full && d.kind === "intern" && !d.owner && (
        <text
          x={x}
          y={y + 0.7}
          fontSize="1.7"
          textAnchor="middle"
          fill="#7d8590"
        >
          빈자리
        </text>
      )}
    </g>
  );
}
