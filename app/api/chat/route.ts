import { after } from "next/server";
import { runAgents, USER_NAME } from "@/lib/agent-engine";
import { buildOrg, userCanCommand, type Org } from "@/lib/chain-of-command";
import { fail, InputError, ok, store } from "@/lib/data-source";
import { MEETING_ROOM, type Agent } from "@/lib/types";

export const dynamic = "force-dynamic";
// 에이전트 차례가 이어지는 동안(배정 → 실무 → 참모 → 대장) 함수가 살아 있어야 한다.
export const maxDuration = 300;

/** GET ?room=대회의실|<에이전트ID>&since=ISO → 10 회의실 대화 */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const room = sp.get("room") || MEETING_ROOM;
    const since = sp.get("since") ?? undefined;
    if (since && Number.isNaN(Date.parse(since))) throw new InputError("since 값이 올바르지 않습니다.");
    return ok(await store().listMessages(room, { since, limit: since ? 100 : 60 }));
  } catch (e) {
    return fail(e);
  }
}

/** POST { room, text } → 사단장 메시지 저장 후, 받을 에이전트를 깨워 백그라운드로 답하게 한다. */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as { room?: unknown; text?: unknown };
    const text = typeof b.text === "string" ? b.text.trim() : "";
    const room = typeof b.room === "string" && b.room ? b.room : MEETING_ROOM;
    if (!text) throw new InputError("메시지를 입력하세요.");
    if (text.length > 2000) throw new InputError("메시지는 2000자 이내로 적어 주세요.");

    const s = store();
    const org = buildOrg(await s.listAgents());
    if (room !== MEETING_ROOM && !userCanCommand(org, room)) throw new InputError("이 에이전트와는 대화할 수 없습니다 (예비·중지 인원).");
    const targets = room === MEETING_ROOM ? pickTargets(org, text) : [room];
    if (!targets.length) throw new InputError("02 조직도에 대장 피클이 없습니다.");

    const msg = await s.createMessage({ room, senderName: USER_NAME, senderId: null, kind: "대화", text });
    after(() => runAgents(room, targets, text));
    return ok({ message: msg, waitingFor: targets.map((id) => org.byId.get(id)?.name ?? id) }, 201);
  } catch (e) {
    return fail(e);
  }
}

/** 대회의실: @이름(또는 '피클' 뺀 별칭)으로 부른 에이전트, @all은 대장+참모, 아무도 안 부르면 대장 피클 */
function pickTargets(org: Org, text: string): string[] {
  const all = [...org.byId.values()].filter((a) => userCanCommand(org, a.id));
  if (/@(all|전체|모두)/i.test(text)) return [org.commander, ...org.staff].filter((a): a is Agent => Boolean(a)).map((a) => a.id);
  const compact = text.replace(/\s/g, "");
  const hit = all.filter((a) => {
    const names = [a.name, a.name.replace(/\s*피클$/, "")].map((n) => `@${n.replace(/\s/g, "")}`);
    return names.some((n) => compact.includes(n));
  });
  if (hit.length) return hit.map((a) => a.id);
  return org.commander ? [org.commander.id] : [];
}
