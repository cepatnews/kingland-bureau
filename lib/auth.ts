// 접속 잠금 (Vercel 공개 주소 보호)
// - 사람(사단장): APP_PASSWORD로 로그인 → httpOnly 쿠키
// - 에이전트: API 호출 시 `Authorization: Bearer <AGENT_API_KEY>`
// - APP_PASSWORD가 없으면 잠금 없음. 단, NOTION_TOKEN이 있는데 APP_PASSWORD가 없으면 전부 차단(노션 무단 접근 방지).
// middleware(Edge)와 API(Node) 양쪽에서 쓰므로 Web Crypto만 사용한다.

export const SESSION_COOKIE = "sforce_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

export async function sessionToken(password: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`ai-sforce:${password}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 길이가 달라도 시간 차이가 덜 나게 비교 */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
