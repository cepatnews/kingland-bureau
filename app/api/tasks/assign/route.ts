import { buildOrg, canCommand } from "@/lib/chain-of-command";
import { fail, InputError, ok, store } from "@/lib/data-source";

export const dynamic = "force-dynamic";

/**
 * 지휘 계통에 따른 업무 배분 (AI 쪽에서 호출, 사용자 화면에는 노출하지 않음).
 * - 대장 피클 → 좌참/우참 피클: 담당 참모 지정
 * - 참모 → 자기 부대 실무 AI: 담당 AI 지정
 * 허용 여부는 `상관` relation 기준(canCommand)으로만 판단한다.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { taskId?: string; fromId?: string; toId?: string };
    if (!body.taskId || !body.fromId || !body.toId) throw new InputError("taskId, fromId, toId가 모두 필요합니다.");
    const s = store();
    const org = buildOrg(await s.listAgents());
    const from = org.byId.get(body.fromId);
    const to = org.byId.get(body.toId);
    if (!from || !to) throw new InputError("에이전트를 찾을 수 없습니다.");
    if (!canCommand(org, from.id, to.id))
      throw new InputError(`${from.name}은(는) ${to.name}에게 지시할 수 없습니다 (직속 상관이 아님).`);

    const task = await s.getTask(body.taskId);
    if (from.rank === "대장" && to.rank === "참모") {
      return ok(await s.assignTask(task.id, { staffIds: [to.id], assigneeIds: [to.id] }));
    }
    if (from.rank === "참모" && to.rank === "실무") {
      if (task.staffIds.length && !task.staffIds.includes(from.id))
        throw new InputError(`이 업무의 담당 참모는 ${from.name}이(가) 아닙니다.`);
      return ok(await s.assignTask(task.id, { staffIds: [from.id], assigneeIds: [to.id] }));
    }
    throw new InputError("지원하지 않는 배분 단계입니다.");
  } catch (e) {
    return fail(e);
  }
}
