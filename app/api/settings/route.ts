// 회사 이름·로고 바꾸기 (로그인 필요). 로고는 브라우저에서 작게 줄인 이미지 data URL.
import { NextResponse } from "next/server";
import { ORG_NAME } from "@/lib/brand";
import { store } from "@/lib/data-source";

export const dynamic = "force-dynamic";
const MAX_LOGO = 150_000; // 노션 텍스트 칸 한도 안 (약 150KB)

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { orgName?: unknown; logo?: unknown };
  const patch: { orgName?: string; logo?: string | null } = {};
  if (body.orgName !== undefined) {
    const name = String(body.orgName ?? "").trim();
    if (name.length < 1 || name.length > 40) return NextResponse.json({ ok: false, error: "회사 이름은 1~40자로 써 주세요." }, { status: 400 });
    patch.orgName = name;
  }
  if (body.logo !== undefined) {
    if (body.logo === null || body.logo === "") patch.logo = null;
    else {
      const logo = String(body.logo);
      if (!/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(logo)) return NextResponse.json({ ok: false, error: "이미지 형식이 아닙니다." }, { status: 400 });
      if (logo.length > MAX_LOGO) return NextResponse.json({ ok: false, error: "로고 이미지가 너무 큽니다." }, { status: 400 });
      patch.logo = logo;
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: "바꿀 내용이 없습니다." }, { status: 400 });
  try {
    const b = await store().setBrand(patch);
    return NextResponse.json({ ok: true, data: { orgName: b.orgName || ORG_NAME, logo: b.logo } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
