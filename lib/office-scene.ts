// 실시간 사무실: 실제 업무 상황(노션 04 업무 + 회의실 대화 흐름)으로 에이전트 위치를 정한다.
// 좌표는 사무실 도면(가로 160 × 세로 100) 기준. 화면에서는 % 로 바꿔 쓴다.
//
//  - 지금 차례(ing)인 대장·참모 → 대회의실 (지시·배분 중)
//  - 지금 차례(ing)인 부대원 → 자기 자리 (작업 중)
//  - 맡은 업무가 진행 중 → 자기 자리 (업무 중 / 검수 대기면 보고 대기)
//  - 맡은 일이 없음 → 탕비실·라운지 (45초마다 자리를 옮기며 쉰다)
//  - 상태 중지 → 자리에 ⛔ 팻말만
import { type Org } from "./chain-of-command";
import { LEFT_UNIT, RIGHT_UNIT, type Agent, type Task } from "./types";

export const OFFICE_W = 160;
export const OFFICE_H = 100;

export type Zone =
  "office" | "meeting" | "small" | "desk" | "pantry" | "lounge";

export interface Spot {
  x: number;
  y: number;
}

export interface Placement {
  agent: Agent;
  zone: Zone;
  pos: Spot;
  status: string; // 사람이 읽는 한 줄
  icon: string; // 머리 위 작은 표시
  busy: boolean; // 말풍선 애니메이션
  taskLabel: string | null;
}

export type DeskKind = "commander" | "head" | "member" | "intern";

export interface Desk {
  id: string;
  pos: Spot; // 의자(앉는 자리)
  kind: DeskKind;
  unit: string;
  facing: "up" | "down" | "left" | "right"; // 모니터가 놓인 방향 (테이블 쪽)
  owner: Agent | null;
  outOfOrder: boolean;
}

// ---------- 도면 (160 × 100) ----------
// 왼쪽 위: 대회의실(유리, 상석 = 사단장) / 왼쪽 아래: 소회의실(유리, 부대 배분 회의)
// 가운데: 파티션 없는 오픈 플로어 — 부대별 긴 공용 테이블(마주 보고 앉음), 가운데 대장 지휘석 + 토론 테이블, 오른쪽 인턴석
// 오른쪽: 탕비실 / 라운지
export const CEO_SEAT: Spot = { x: 22, y: 7.5 }; // 사단장 (사용자) — 대회의실 상석
export const COMMANDER_DESK: Spot = { x: 58, y: 49 }; // 대장 지휘석
export const DISCUSSION_TABLE: Spot = { x: 84, y: 47 };
/** 대회의실: [0] = 대장 (사단장 맞은편 끝), 나머지 양옆 */
export const MEETING_ROOM_BOX = { x: 2, y: 2, w: 40, h: 48 };
export const MEETING_TABLE = { x: 18, y: 12, w: 8, h: 30 };
export const MEETING_SEATS: Spot[] = [
  { x: 22, y: 46 },
  { x: 13, y: 16 },
  { x: 31, y: 16 },
  { x: 13, y: 24 },
  { x: 31, y: 24 },
  { x: 13, y: 32 },
  { x: 31, y: 32 },
  { x: 13, y: 40 },
  { x: 31, y: 40 },
];
/** 소회의실: 참모가 부대원에게 배분하는 부대 회의 */
export const SMALL_ROOM_BOX = { x: 2, y: 54, w: 40, h: 44 };
export const SMALL_TABLE: Spot = { x: 22, y: 76 };
export const SMALL_SEATS: Spot[] = [
  { x: 22, y: 65 },
  { x: 32, y: 71 },
  { x: 32, y: 82 },
  { x: 22, y: 88 },
  { x: 12, y: 82 },
  { x: 12, y: 71 },
];
/** 부대 공용 테이블: 머리(참모) 1 + 양쪽 마주 보는 자리 4 */
export const BENCHES: Record<
  string,
  {
    table: { x: number; y: number; w: number; h: number };
    head: Spot;
    seats: { pos: Spot; facing: "up" | "down" }[];
  }
> = {
  [LEFT_UNIT]: {
    table: { x: 58, y: 17, w: 40, h: 6 },
    head: { x: 53, y: 20 },
    seats: [
      { pos: { x: 68, y: 12 }, facing: "down" },
      { pos: { x: 88, y: 12 }, facing: "down" },
      { pos: { x: 68, y: 28 }, facing: "up" },
      { pos: { x: 88, y: 28 }, facing: "up" },
    ],
  },
  [RIGHT_UNIT]: {
    table: { x: 58, y: 71, w: 40, h: 6 },
    head: { x: 53, y: 74 },
    seats: [
      { pos: { x: 68, y: 66 }, facing: "down" },
      { pos: { x: 88, y: 66 }, facing: "down" },
      { pos: { x: 68, y: 82 }, facing: "up" },
      { pos: { x: 88, y: 82 }, facing: "up" },
    ],
  },
};
/** 인턴석 3 (새로 들어오는 부대원·부대 정원 초과 인원) */
export const INTERN_TABLE = { x: 110, y: 10, w: 6, h: 26 };
export const INTERN_SEATS: Spot[] = [
  { x: 105, y: 15 },
  { x: 105, y: 23 },
  { x: 105, y: 31 },
];
export const SEAT_COUNT = 1 + 2 + 8 + INTERN_SEATS.length; // 14

export const PANTRY_SPOTS: Spot[] = [
  { x: 131, y: 24 },
  { x: 140, y: 31 },
  { x: 149, y: 24 },
  { x: 133, y: 38 },
  { x: 148, y: 39 },
  { x: 140, y: 18 },
];
export const LOUNGE_SPOTS: Spot[] = [
  { x: 131, y: 64 },
  { x: 143, y: 61 },
  { x: 151, y: 71 },
  { x: 133, y: 82 },
  { x: 146, y: 87 },
  { x: 140, y: 74 },
];

/** 앉는 자리 묶음. 도면(PLAN)과 AI 일러스트(ART)는 가구 위치가 조금 달라 좌표를 따로 둔다. */
export interface Layout {
  ceo: Spot;
  commander: Spot;
  meeting: Spot[]; // [0] = 대장
  small: Spot[];
  benches: Record<
    string,
    { head: Spot; seats: { pos: Spot; facing: "up" | "down" }[] }
  >;
  intern: Spot[];
  pantry: Spot[];
  lounge: Spot[];
  meetingBox: { x: number; y: number; w: number; h: number };
}

export const PLAN_LAYOUT: Layout = {
  ceo: CEO_SEAT,
  commander: COMMANDER_DESK,
  meeting: MEETING_SEATS,
  small: SMALL_SEATS,
  benches: Object.fromEntries(
    Object.entries(BENCHES).map(([u, b]) => [
      u,
      { head: b.head, seats: b.seats },
    ]),
  ),
  intern: INTERN_SEATS,
  pantry: PANTRY_SPOTS,
  lounge: LOUNGE_SPOTS,
  meetingBox: MEETING_ROOM_BOX,
};

/** public/office/office-bg.webp (1024×640) 위 의자 위치를 재서 맞춘 좌표 */
export const ART_LAYOUT: Layout = {
  ceo: { x: 25.8, y: 8.6 },
  commander: { x: 64.4, y: 51.2 },
  meeting: [
    { x: 25.8, y: 48.8 },
    { x: 15.2, y: 17.7 },
    { x: 36.2, y: 17.7 },
    { x: 15.2, y: 25.5 },
    { x: 36.2, y: 25.5 },
    { x: 15.2, y: 33.3 },
    { x: 36.2, y: 33.3 },
    { x: 15.2, y: 41.4 },
    { x: 36.2, y: 41.4 },
  ],
  small: [
    { x: 25.8, y: 64.8 },
    { x: 35.6, y: 71.4 },
    { x: 35.3, y: 81.6 },
    { x: 25.8, y: 87.8 },
    { x: 16.1, y: 81.6 },
    { x: 15.8, y: 71.4 },
  ],
  benches: {
    [LEFT_UNIT]: {
      head: { x: 57.8, y: 21.6 },
      seats: [
        { pos: { x: 72.7, y: 13.8 }, facing: "down" },
        { pos: { x: 93.3, y: 13.8 }, facing: "down" },
        { pos: { x: 72.7, y: 30 }, facing: "up" },
        { pos: { x: 93.3, y: 30 }, facing: "up" },
      ],
    },
    [RIGHT_UNIT]: {
      head: { x: 57.8, y: 74.7 },
      seats: [
        { pos: { x: 72.7, y: 66.9 }, facing: "down" },
        { pos: { x: 93.3, y: 66.9 }, facing: "down" },
        { pos: { x: 72.7, y: 83.1 }, facing: "up" },
        { pos: { x: 93.3, y: 83.1 }, facing: "up" },
      ],
    },
  },
  intern: [
    { x: 110.6, y: 16.3 },
    { x: 110.6, y: 24.7 },
    { x: 110.6, y: 33.1 },
  ],
  pantry: [
    { x: 134, y: 34 },
    { x: 149.5, y: 34 },
    { x: 141.7, y: 26.5 },
    { x: 141.7, y: 41.5 },
    { x: 132, y: 22 },
    { x: 151, y: 23 },
  ],
  lounge: [
    { x: 133, y: 62 },
    { x: 141, y: 59 },
    { x: 130, y: 71 },
    { x: 144, y: 75 },
    { x: 131, y: 89 },
    { x: 148, y: 89 },
  ],
  meetingBox: { x: 2, y: 2, w: 48, h: 50 },
};

/** public/office/office-3d.webp (1024×640, 비스듬히 내려다본 입체 일러스트) 위 의자 위치 */
export const ISO_LAYOUT: Layout = {
  ceo: { x: 30.9, y: 18.4 },
  commander: { x: 63.9, y: 54.4 },
  meeting: [
    { x: 29.7, y: 49.7 },
    { x: 21.6, y: 25.0 },
    { x: 40.0, y: 25.0 },
    { x: 21.6, y: 31.2 },
    { x: 40.0, y: 31.2 },
    { x: 21.6, y: 37.5 },
    { x: 40.0, y: 37.5 },
    { x: 21.6, y: 44.1 },
    { x: 40.0, y: 44.1 },
  ],
  small: [
    { x: 28.9, y: 63.6 },
    { x: 38.3, y: 68.1 },
    { x: 38.0, y: 78.1 },
    { x: 28.4, y: 83.9 },
    { x: 19.4, y: 78.1 },
    { x: 19.4, y: 68.4 },
  ],
  benches: {
    [LEFT_UNIT]: {
      head: { x: 57.5, y: 29.4 },
      seats: [
        { pos: { x: 71.4, y: 22.3 }, facing: "down" },
        { pos: { x: 90.3, y: 22.3 }, facing: "down" },
        { pos: { x: 71.4, y: 35.6 }, facing: "up" },
        { pos: { x: 90.3, y: 35.6 }, facing: "up" },
      ],
    },
    [RIGHT_UNIT]: {
      head: { x: 57.3, y: 75.0 },
      seats: [
        { pos: { x: 71.7, y: 67.2 }, facing: "down" },
        { pos: { x: 91.1, y: 67.2 }, facing: "down" },
        { pos: { x: 71.7, y: 80.5 }, facing: "up" },
        { pos: { x: 91.4, y: 80.5 }, facing: "up" },
      ],
    },
  },
  intern: [
    { x: 105.8, y: 24.5 },
    { x: 106.1, y: 31.2 },
    { x: 106.2, y: 38.1 },
  ],
  pantry: [
    { x: 128.4, y: 39.1 },
    { x: 140.6, y: 39.1 },
    { x: 134.7, y: 45.3 },
    { x: 130.5, y: 33.1 },
    { x: 139.1, y: 46.2 },
    { x: 125.0, y: 37.5 },
  ],
  lounge: [
    { x: 130.0, y: 62.2 },
    { x: 135.9, y: 60.9 },
    { x: 125.0, y: 69.5 },
    { x: 138.6, y: 73.8 },
    { x: 126.9, y: 85.2 },
    { x: 142.5, y: 85.6 },
  ],
  meetingBox: { x: 11, y: 15, w: 39, h: 37 },
};

const OPEN_STATES = new Set(["대기", "수신 확인", "진행", "재작업"]);

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function taskNo(t: Task): string {
  return `#${t.code?.match(/\d+/)?.[0] ?? "?"}`;
}

/** 14자리와 주인. 부대원은 이름순으로 자기 부대 테이블 4자리, 넘치거나 부대가 없으면 인턴석. */
export function deskLayout(
  org: Org,
  agents: Agent[],
  L: Layout = PLAN_LAYOUT,
): Desk[] {
  const desks: Desk[] = [];
  const cmd = org.commander;
  desks.push({
    id: "commander",
    pos: L.commander,
    kind: "commander",
    unit: "대장실",
    facing: "up",
    owner: cmd ?? null,
    outOfOrder: cmd?.state === "중지",
  });
  const overflow: Agent[] = [];
  for (const unit of [LEFT_UNIT, RIGHT_UNIT]) {
    const bench = L.benches[unit];
    const staff = org.staff.find((a) => a.unit === unit) ?? null;
    desks.push({
      id: `${unit}-head`,
      pos: bench.head,
      kind: "head",
      unit,
      facing: "right",
      owner: staff,
      outOfOrder: staff?.state === "중지",
    });
    // 기존 부대원(V·H·W·I agent)이 먼저 자기 테이블에 앉고, 새로 온 인원은 인턴석으로
    const order = (a: Agent) => {
      const i = "VHWI".indexOf(a.name.charAt(0).toUpperCase());
      return /^[VHWI][LR]agent$/i.test(a.name) && i >= 0 ? i : 99;
    };
    const members = agents
      .filter((a) => a.rank === "실무" && a.unit === unit)
      .sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
    bench.seats.forEach((seat, i) => {
      const owner = members[i] ?? null;
      desks.push({
        id: `${unit}-${i}`,
        pos: seat.pos,
        kind: "member",
        unit,
        facing: seat.facing,
        owner,
        outOfOrder: owner?.state === "중지",
      });
    });
    overflow.push(...members.slice(bench.seats.length));
  }
  overflow.push(
    ...agents.filter(
      (a) =>
        a.rank === "실무" &&
        a.unit !== LEFT_UNIT &&
        a.unit !== RIGHT_UNIT &&
        a.unit !== "예비",
    ),
  );
  L.intern.forEach((pos, i) => {
    const owner = overflow[i] ?? null;
    desks.push({
      id: `intern-${i}`,
      pos,
      kind: "intern",
      unit: owner?.unit ?? "인턴",
      facing: "right",
      owner,
      outOfOrder: owner?.state === "중지",
    });
  });
  return desks;
}

export function officeScene(
  org: Org,
  agents: Agent[],
  tasks: Task[],
  working: Map<string, number>,
  now: number,
  L: Layout = PLAN_LAYOUT,
): { placements: Placement[]; desks: Desk[] } {
  const desks = deskLayout(org, agents, L);
  const deskOf = new Map(
    desks.filter((d) => d.owner).map((d) => [d.owner!.id, d.pos]),
  );
  const crew = agents.filter(
    (a) => a.rank !== "예비" && a.unit !== "예비" && a.state !== "중지",
  );

  const openTasks = (a: Agent) =>
    tasks.filter(
      (t) =>
        t.state &&
        OPEN_STATES.has(t.state) &&
        (t.assigneeIds.includes(a.id) || t.staffIds.includes(a.id)),
    );
  const reviewTasks = (a: Agent) =>
    tasks.filter(
      (t) =>
        t.state === "검수 대기" &&
        (t.assigneeIds.includes(a.id) || t.staffIds.includes(a.id)),
    );

  const placements: Placement[] = [];
  const idle: Agent[] = [];
  let meetingSeat = 1;
  let smallSeat = 0;
  const commanderBusy = org.commander ? working.has(org.commander.id) : false;

  for (const a of crew) {
    const home = a.rank === "대장" ? L.commander : (deskOf.get(a.id) ?? null);
    const isWorking = working.has(a.id);
    const open = openTasks(a);
    const label = open[0] ? taskNo(open[0]) : null;

    // 대장이 지시 중이면 대장·참모는 대회의실(전체 회의), 대장 없이 참모만 바쁘면 소회의실(부대 배분 회의)
    if (
      isWorking &&
      (a.rank === "대장" || (a.rank === "참모" && commanderBusy))
    ) {
      const pos =
        a.rank === "대장"
          ? L.meeting[0]
          : L.meeting[Math.min(meetingSeat++, L.meeting.length - 1)];
      placements.push({
        agent: a,
        zone: "meeting",
        pos,
        status: "대회의실에서 지시·배분 회의 중",
        icon: "💬",
        busy: true,
        taskLabel: label,
      });
      continue;
    }
    if (isWorking && a.rank === "참모") {
      const pos = L.small[Math.min(smallSeat++, L.small.length - 1)];
      placements.push({
        agent: a,
        zone: "small",
        pos,
        status: "소회의실에서 부대 배분 회의 중",
        icon: "🗣️",
        busy: true,
        taskLabel: label,
      });
      continue;
    }
    if (isWorking && home) {
      placements.push({
        agent: a,
        zone: "desk",
        pos: home,
        status: label ? `${label} 작업 중` : "작업 중",
        icon: "⌨️",
        busy: true,
        taskLabel: label,
      });
      continue;
    }
    if (open.length && home) {
      const more = open.length > 1 ? ` 외 ${open.length - 1}건` : "";
      const status =
        a.rank === "실무"
          ? `${label} 업무 중${more}`
          : `${label} 진행 관리${more}`;
      placements.push({
        agent: a,
        zone: a.rank === "대장" ? "office" : "desk",
        pos: home,
        status,
        icon: "📝",
        busy: false,
        taskLabel: label,
      });
      continue;
    }
    const review = reviewTasks(a);
    if (review.length && home && a.rank === "실무") {
      placements.push({
        agent: a,
        zone: "desk",
        pos: home,
        status: `${taskNo(review[0])} 보고 완료 · 검수 대기`,
        icon: "🧾",
        busy: false,
        taskLabel: taskNo(review[0]),
      });
      continue;
    }
    idle.push(a);
  }

  // 쉬는 인원: 45초마다 탕비실 ↔ 라운지를 오가며 자리를 바꾼다. 겹치지 않게 차례로 배정.
  const slot = Math.floor(now / 45_000);
  const pantryFree = [...L.pantry];
  const loungeFree = [...L.lounge];
  for (const a of [...idle].sort(
    (x, y) => hash(x.id + slot) - hash(y.id + slot),
  )) {
    const wantPantry = (hash(a.id) + slot) % 2 === 0;
    const list =
      wantPantry && pantryFree.length
        ? pantryFree
        : loungeFree.length
          ? loungeFree
          : pantryFree;
    const zone: Zone = list === pantryFree ? "pantry" : "lounge";
    const pos =
      list.splice(hash(a.id + slot) % Math.max(list.length, 1), 1)[0] ??
      L.pantry[0];
    const snack =
      zone === "pantry"
        ? ["☕", "🍪", "🥤", "🍩"][hash(a.id + slot) % 4]
        : ["🛋️", "📖", "🎧"][hash(a.id + slot) % 3];
    placements.push({
      agent: a,
      zone,
      pos,
      status: zone === "pantry" ? "탕비실에서 간식 타임" : "라운지에서 휴식 중",
      icon: snack,
      busy: false,
      taskLabel: null,
    });
  }
  return { placements, desks };
}

export function sceneCounts(placements: Placement[]) {
  const c = { meeting: 0, work: 0, rest: 0 };
  for (const p of placements) {
    if (p.zone === "meeting" || p.zone === "small") c.meeting++;
    else if (p.zone === "pantry" || p.zone === "lounge") c.rest++;
    else c.work++;
  }
  return c;
}
