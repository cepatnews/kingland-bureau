import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, safeEqual, sessionToken } from "@/lib/auth";

const noStore = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return NextResponse.json({ ok: false, error: "APP_PASSWORD가 설정되지 않았습니다." }, { status: 503, headers: noStore });
  }
  let input = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    input = typeof body.password === "string" ? body.password : "";
  } catch {}
  if (!input || !safeEqual(input, password)) {
    // 무차별 대입을 조금이라도 늦춘다
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ ok: false, error: "비밀번호가 맞지 않습니다." }, { status: 401, headers: noStore });
  }
  const res = NextResponse.json({ ok: true }, { headers: noStore });
  res.cookies.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { headers: noStore });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
