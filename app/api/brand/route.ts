// 회사 이름·로고 읽기 (로그인 화면에서도 보여야 해서 공개). 바꾸기는 /api/settings (로그인 필요).
import { NextResponse } from "next/server";
import { ORG_NAME } from "@/lib/brand";
import { store } from "@/lib/data-source";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const b = await store().getBrand();
    return NextResponse.json({ ok: true, data: { orgName: b.orgName || ORG_NAME, logo: b.logo } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: true, data: { orgName: ORG_NAME, logo: null } });
  }
}
