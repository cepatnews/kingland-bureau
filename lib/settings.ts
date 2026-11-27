// 설치할 때 정하는 운영 방식 (Vercel 환경변수로 바꿀 수 있음, 바꾸면 Redeploy).

export type ReportStyle = "brief" | "detailed" | "table";
export type ReportTiming = "each" | "daily" | "both";

/** 사단장님께 보고하는 형식: brief(3줄 요약, 기본) · detailed(상세) · table(표) */
export const REPORT_STYLE: ReportStyle = (["brief", "detailed", "table"] as const).find((v) => v === process.env.REPORT_STYLE?.trim()) ?? "brief";

/** 보고 받는 때: each(업무 끝날 때마다, 기본) · daily(매일 정리 보고만) · both(둘 다) */
export const REPORT_TIMING: ReportTiming = (["each", "daily", "both"] as const).find((v) => v === process.env.REPORT_TIMING?.trim()) ?? "each";

/** 마감을 안 정한 업무의 기본 마감: 오늘부터 N일 뒤 (0 = 당일). 비우면 마감 없음. */
export const DEFAULT_DUE_DAYS: number | null = (() => {
  const raw = process.env.DEFAULT_DUE_DAYS?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 365 ? n : null;
})();

export const REPORT_STYLE_GUIDE: Record<ReportStyle, string> = {
  brief: "핵심만 3줄로: ① 결과 ② 다음 할 일 ③ 사단장님 확인이 필요한 것(없으면 '없음').",
  detailed: "항목별로 자세히: 배경 · 진행 과정 · 결과 · 근거/출처 · 남은 일 · 확인 필요 사항.",
  table: "표 위주로 한눈에: | 항목 | 내용 | 형식의 마크다운 표 하나 + 한 줄 결론.",
};

/** 한국 시간 기준 YYYY-MM-DD (오늘 + offset일) */
export function kstDate(offsetDays = 0, from = new Date()): string {
  return new Date(from.getTime() + 9 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}
