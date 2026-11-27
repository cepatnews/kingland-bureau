import { buildOrg, validateReporter } from "@/lib/chain-of-command";
import { fail, InputError, ok, store } from "@/lib/data-source";
import {
  REPORT_STAGES,
  STAFF_REVIEWS,
  TASK_STATES,
  type ReportStage,
  type StaffReview,
  type TaskState,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET ?taskId= / ?stage= / ?reporterId= → 09 보고 이력 (보고 시각 오름차순) */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const taskId = sp.get("taskId") ?? undefined;
    const stage = sp.get("stage") ?? undefined;
    const reporterId = sp.get("reporterId") ?? undefined;
    if (stage && !REPORT_STAGES.includes(stage as ReportStage)) throw new InputError("보고 단계 값이 올바르지 않습니다.");
    if (!taskId && !stage && !reporterId) throw new InputError("taskId, stage, reporterId 중 하나가 필요합니다.");
    return ok(await store().listTaskReports({ taskId, stage, reporterId }));
  } catch (e) {
    return fail(e);
  }
}

/**
 * POST 새 보고 (append-only: 기존 보고는 절대 수정·삭제하지 않음)
 * 필수: taskId(관련 업무), reporterId(보고자), stage(보고 단계), content(내용)
 * 참모 검토·취합 단계면 04의 진행률·상태도 갱신한다.
 */
export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const taskId = str(b.taskId);
    const reporterId = str(b.reporterId);
    const stage = str(b.stage) as ReportStage;
    const content = str(b.content).trim();
    const missing = [
      !taskId && "관련 업무",
      !reporterId && "보고자",
      !stage && "보고 단계",
      !content && "내용",
    ].filter(Boolean);
    if (missing.length) throw new InputError(`필수값 누락: ${missing.join(", ")}`);
    if (!REPORT_STAGES.includes(stage)) throw new InputError("보고 단계 값이 올바르지 않습니다.");

    const progress = parseProgress(b.progress);
    const state = b.state == null || b.state === "" ? null : (str(b.state) as TaskState);
    if (state && !TASK_STATES.includes(state)) throw new InputError("보고 상태 값이 올바르지 않습니다.");
    const staffReview = b.staffReview == null || b.staffReview === "" ? null : (str(b.staffReview) as StaffReview);
    if (staffReview && !STAFF_REVIEWS.includes(staffReview)) throw new InputError("참모 검토 값이 올바르지 않습니다.");
    const resultUrl = str(b.resultUrl) || null;
    if (resultUrl && !/^https?:\/\//.test(resultUrl)) throw new InputError("결과물 링크는 http(s) 주소여야 합니다.");

    const s = store();
    const [agents, task] = await Promise.all([s.listAgents(), s.getTask(taskId)]);
    const org = buildOrg(agents);
    const check = validateReporter(org, task, reporterId, stage);
    if (!check.ok) throw new InputError(check.error);

    const report = await s.createTaskReport({
      taskId,
      reporterId,
      stage,
      content,
      summary: str(b.summary),
      recipient: check.recipient,
      progress,
      state,
      resultUrl,
      staffReview,
    });

    let updatedTask = null;
    if (stage === "참모 검토·취합" && (progress != null || state)) {
      updatedTask = await s.updateTaskProgress(taskId, {
        progress,
        state,
        reworkCount: state === "재작업" ? task.reworkCount + 1 : undefined,
      });
    }
    return ok({ report, task: updatedTask }, 201);
  } catch (e) {
    return fail(e);
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** 0~1 저장. 1보다 큰 값은 0~100 퍼센트 입력으로 보고 변환 */
function parseProgress(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new InputError("보고 진행률은 0~1 (또는 0~100) 사이여야 합니다.");
  return n > 1 ? Math.round(n) / 100 : n;
}
