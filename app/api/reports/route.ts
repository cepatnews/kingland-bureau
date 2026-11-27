import { fail, InputError, ok, store } from "@/lib/data-source";

export const dynamic = "force-dynamic";

/** 05 최종 보고서 (대장 피클 명의) 전용 */
export async function GET() {
  try {
    return ok(await store().listFinalReports());
  } catch (e) {
    return fail(e);
  }
}

/** `사단장 확인` 체크박스 토글 */
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { id?: string; confirmed?: unknown };
    if (!body.id) throw new InputError("id가 필요합니다.");
    if (typeof body.confirmed !== "boolean") throw new InputError("confirmed는 true/false여야 합니다.");
    return ok(await store().setFinalReportConfirmed(body.id, body.confirmed));
  } catch (e) {
    return fail(e);
  }
}
