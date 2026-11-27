// 일일 보고 만들기
// - GET: Vercel Cron이 매일 호출 (vercel.json). REPORT_TIMING이 daily/both일 때만 만든다.
// - POST: 보고서 탭의 "지금 일일 보고 받기" 버튼 (설정과 상관없이 바로 만든다).
// 잠금: 사람은 로그인 쿠키, Cron은 CRON_SECRET (middleware.ts에서 확인).
import { NextResponse } from "next/server";
import { runDailyReport } from "@/lib/daily-report";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function handle(force: boolean) {
  try {
    const result = await runDailyReport({ force });
    return NextResponse.json({ ok: true, data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(new URL(req.url).searchParams.get("force") === "1");
}

export async function POST() {
  return handle(true);
}
