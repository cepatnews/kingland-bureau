import { fail, InputError, ok, store } from "@/lib/data-source";
import { AGENT_STATES, CONNECTIONS, type AgentPatch, type AgentState, type Connection } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await store().listAgents());
  } catch (e) {
    return fail(e);
  }
}

const TEXT_FIELDS = { strengths: "강점·역량", device: "기기·계정", role: "역할", activity: "현재 활동" } as const;

/** 에이전트 관리·연결 설정: 강점·역량, 상태, 연결 방식, 기기·계정, 역할, 현재 활동만 편집 */
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.id !== "string" || !body.id) throw new InputError("id가 필요합니다.");
    const patch: AgentPatch = {};
    for (const [key, label] of Object.entries(TEXT_FIELDS) as [keyof typeof TEXT_FIELDS, string][]) {
      const v = body[key];
      if (v === undefined) continue;
      if (typeof v !== "string") throw new InputError(`${label}은(는) 문자열이어야 합니다.`);
      if (v.length > 2000) throw new InputError(`${label}은(는) 2000자 이내로 적어 주세요.`);
      patch[key] = v;
    }
    if (body.state !== undefined) {
      if (!AGENT_STATES.includes(body.state as AgentState)) throw new InputError("상태 값이 올바르지 않습니다.");
      patch.state = body.state as AgentState;
    }
    if (body.connection !== undefined) {
      if (!CONNECTIONS.includes(body.connection as Connection)) throw new InputError("연결 방식 값이 올바르지 않습니다.");
      patch.connection = body.connection as Connection;
    }
    if (!Object.keys(patch).length) throw new InputError("바꿀 값이 없습니다.");
    return ok(await store().updateAgent(body.id, patch));
  } catch (e) {
    return fail(e);
  }
}
