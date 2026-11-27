// 부대원 실적 기록: 참모가 검토 때 남긴 평가를 09 업무 보고 이력(append-only)에서 모아
// "누가 어떤 분야를 잘하는지"를 계산한다. 노션 스키마는 건드리지 않고 보고 내용 안의
// "[평가] ..." 줄만 사용한다.
import type { Agent, TaskReport } from "./types";

export const WORK_FIELDS = ["자료 조사", "글쓰기·카피", "기획·아이디어", "이미지·디자인", "영상", "데이터·정리", "일정·운영", "기타"] as const;
export type WorkField = (typeof WORK_FIELDS)[number];

export interface Evaluation {
  agent: string;
  field: WorkField;
  score: number; // 1~5
  note: string;
}

const PREFIX = "[평가]";

export function formatEvaluation(e: Evaluation): string {
  const note = e.note.replace(/\s+/g, " ").replace(/\|/g, "/").trim();
  return `${PREFIX} ${e.agent} | ${e.field} | ${e.score}/5 | ${note}`;
}

export function parseEvaluations(content: string): Evaluation[] {
  const out: Evaluation[] = [];
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t.startsWith(PREFIX)) continue;
    const [agent, field, score, ...rest] = t.slice(PREFIX.length).split("|").map((x) => x.trim());
    const n = Number(score?.match(/^(\d)/)?.[1]);
    if (!agent || !(WORK_FIELDS as readonly string[]).includes(field) || !(n >= 1 && n <= 5)) continue;
    out.push({ agent, field: field as WorkField, score: n, note: rest.join(" | ") });
  }
  return out;
}

export interface FieldStat {
  field: WorkField;
  count: number;
  avg: number;
  lastNote: string;
}

/** 에이전트 이름 → 분야별 통계 (평균 높은 순) */
export function buildTrackRecord(reports: TaskReport[]): Map<string, FieldStat[]> {
  // 같은 업무에서 같은 에이전트를 여러 번 평가했다면 마지막 평가만 센다 (재취합·중복 보고 대비)
  const latest = new Map<string, Evaluation>();
  for (const r of [...reports].sort((a, b) => a.reportedAt.localeCompare(b.reportedAt))) {
    const task = r.taskIds[0] ?? r.id;
    for (const e of parseEvaluations(r.content)) latest.set(`${task}|${e.agent.replace(/\s/g, "")}`, e);
  }
  const acc = new Map<string, Map<WorkField, { sum: number; count: number; lastNote: string }>>();
  {
    for (const e of latest.values()) {
      const key = e.agent.replace(/\s/g, "");
      const byField = acc.get(key) ?? new Map();
      const cur = byField.get(e.field) ?? { sum: 0, count: 0, lastNote: "" };
      cur.sum += e.score;
      cur.count += 1;
      cur.lastNote = e.note;
      byField.set(e.field, cur);
      acc.set(key, byField);
    }
  }
  const out = new Map<string, FieldStat[]>();
  for (const [name, byField] of acc) {
    out.set(
      name,
      [...byField.entries()]
        .map(([field, v]) => ({ field, count: v.count, avg: v.sum / v.count, lastNote: v.lastNote }))
        .sort((a, b) => b.avg - a.avg || b.count - a.count),
    );
  }
  return out;
}

/** 프롬프트용 한 줄 요약. 평가가 없으면 "평가 없음(시험 단계)". */
export function describeRecord(a: Agent, record: Map<string, FieldStat[]>): string {
  const stats = record.get(a.name.replace(/\s/g, ""));
  if (!stats?.length) return `${a.name}: 평가 없음 (시험 단계)`;
  const parts = stats.map((s) => `${s.field} ${s.avg.toFixed(1)}점/${s.count}건${s.count >= 2 && s.avg >= 4 ? " ★" : ""}`);
  return `${a.name}: ${parts.join(", ")}`;
}
