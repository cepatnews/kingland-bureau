// "지금 작업 중"인 에이전트 계산 (클라이언트 전용, 저장 없음).
// 대화방 메시지 흐름으로 판단한다: 차례가 넘어간 에이전트가 아직 아무 말도 안 했으면 작업 중.
//  - 사단장 메시지 → 받는 에이전트 (1:1 방은 상대, 대회의실은 @이름 / @all / 기본 대장)
//  - "➡️ X에게 배정" → X
//  - 보고 알림 → 보고한 에이전트의 상관 (대장 보고는 사단장에게서 끝)
//  - 에이전트가 말하면 그 에이전트는 작업 끝
//  - 시스템 알림(오류·차례 한도)이 오면 모두 끝, 3분 넘게 조용하면 끝
import { superiorOf, userCanCommand, type Org } from "./chain-of-command";
import { MEETING_ROOM, type Agent, type ChatMessage } from "./types";

export const WORKING_TTL_MS = 180_000;

function userTargets(org: Org, room: string, text: string): string[] {
  if (room !== MEETING_ROOM) return [room];
  if (/@(all|전체|모두)/i.test(text)) return [org.commander, ...org.staff].filter((a): a is Agent => Boolean(a)).map((a) => a.id);
  const compact = text.replace(/\s/g, "");
  const hit = [...org.byId.values()].filter(
    (a) => userCanCommand(org, a.id) && [a.name, a.name.replace(/\s*피클$/, "")].some((n) => compact.includes(`@${n.replace(/\s/g, "")}`)),
  );
  if (hit.length) return hit.map((a) => a.id);
  return org.commander ? [org.commander.id] : [];
}

/** 에이전트 ID → 작업 시작 시각(ms) */
export function workingAgents(org: Org, room: string, messages: ChatMessage[], now = Date.now()): Map<string, number> {
  const pending = new Map<string, number>();
  const byName = new Map([...org.byId.values()].map((a) => [a.name.replace(/\s/g, ""), a]));
  for (const m of messages) {
    const at = Date.parse(m.at) || 0;
    if (!m.senderId) {
      if (m.senderName === "사단장") for (const id of userTargets(org, room, m.text)) pending.set(id, at);
      else pending.clear(); // 시스템 알림
      continue;
    }
    pending.delete(m.senderId);
    if (m.kind === "배정") {
      const name = m.text.match(/^➡️\s*(.+?)에게 배정/)?.[1];
      const target = name ? byName.get(name.replace(/\s/g, "")) : undefined;
      if (target) pending.set(target.id, at);
    } else if (m.kind === "보고" && m.text.startsWith("🧾")) {
      const sender = org.byId.get(m.senderId);
      const boss = sender && sender.rank !== "대장" ? superiorOf(org, sender.id) : null;
      if (boss) pending.set(boss.id, at);
    }
  }
  for (const [id, at] of pending) if (now - at > WORKING_TTL_MS) pending.delete(id);
  return pending;
}
