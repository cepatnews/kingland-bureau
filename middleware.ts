import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/login"];

function deny(req: NextRequest, status: number, error: string) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
  }
  if (status === 401) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const next = req.nextUrl.pathname + req.nextUrl.search;
    if (next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return new NextResponse(error, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const password = process.env.APP_PASSWORD;
  if (!password) {
    // 목업 모드(로컬 개발)에서는 잠금 없음. 노션이 연결돼 있으면 비밀번호 없이 열지 않는다.
    if (process.env.NOTION_TOKEN) {
      return deny(req, 503, "APP_PASSWORD 환경변수를 설정해야 사용할 수 있습니다.");
    }
    return NextResponse.next();
  }

  // Vercel Cron: CRON_SECRET (일일 보고)
  const cronSecret = process.env.CRON_SECRET;
  if (pathname.startsWith("/api/cron/") && cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return NextResponse.next();
  }

  // 에이전트: Bearer 키 (API 경로만)
  const agentKey = process.env.AGENT_API_KEY;
  const auth = req.headers.get("authorization");
  if (pathname.startsWith("/api/") && agentKey && auth?.startsWith("Bearer ")) {
    if (safeEqual(auth.slice(7).trim(), agentKey)) return NextResponse.next();
    return deny(req, 401, "에이전트 API 키가 맞지 않습니다.");
  }

  // 사람: 로그인 쿠키
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && safeEqual(cookie, await sessionToken(password))) return NextResponse.next();

  return deny(req, 401, "로그인이 필요합니다.");
}

export const config = {
  // 정적 파일·이미지·아이콘은 잠금 대상에서 제외
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|webmanifest)$).*)"],
};
