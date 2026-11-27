import { buildOrg, directOrderRouting, userCanCommand } from "@/lib/chain-of-command";
import { fail, InputError, ok, store } from "@/lib/data-source";
import { PRIORITIES, type Priority } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await store().listTasks());
  } catch (e) {
    return fail(e);
  }
}

/**
 * 사단장(사용자) 지시. 기본 받는 사람은 대장 피클, `toId`로 다른 에이전트에게 직접 지시할 수도 있다.
 * 직접 지시라도 담당 참모는 지휘 계통대로 채워 참모가 검토·보고 흐름을 이어가게 한다.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { title?: unknown; priority?: unknown; due?: unknown; doneCriteria?: unknown; toId?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) throw new InputError("요청 내용을 입력하세요.");
    if (title.length > 200) throw new InputError("업무명은 200자 이내로 적어 주세요. 자세한 내용은 완료 조건에 넣으세요.");
    const priority = body.priority as Priority | undefined;
    if (priority && !PRIORITIES.includes(priority)) throw new InputError("우선순위 값이 올바르지 않습니다.");
    const due = typeof body.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.due) ? body.due : null;

    const s = store();
    const org = buildOrg(await s.listAgents());
    if (!org.commander) throw new InputError("02 조직도에 계급=대장인 에이전트가 없습니다.");
    const toId = typeof body.toId === "string" && body.toId ? body.toId : org.commander.id;
    if (!userCanCommand(org, toId)) throw new InputError("이 에이전트에게는 지시할 수 없습니다 (예비·중지 인원).");
    const route = directOrderRouting(org, toId);
    const task = await s.createTask({
      title,
      priority,
      due,
      doneCriteria: typeof body.doneCriteria === "string" ? body.doneCriteria : "",
      ...route,
    });
    return ok(task, 201);
  } catch (e) {
    return fail(e);
  }
}

/** 컨펌함: 사단장이 `승인 대기` 업무를 승인 완료 / 거절로 결정 */
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { id?: string; approval?: unknown };
    if (!body.id) throw new InputError("id가 필요합니다.");
    if (body.approval !== "승인 완료" && body.approval !== "거절") throw new InputError("승인 값은 '승인 완료' 또는 '거절'만 가능합니다.");
    const s = store();
    const task = await s.getTask(body.id);
    if (task.approval !== "승인 대기") throw new InputError("승인 대기 상태인 업무만 결정할 수 있습니다.");
    return ok(await s.updateTaskProgress(body.id, { approval: body.approval }));
  } catch (e) {
    return fail(e);
  }
}
