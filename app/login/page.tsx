"use client";

import { useState } from "react";
import { ORG_NAME } from "@/lib/brand";
import { BrandLogo, useBrand } from "@/components/brand";

function safeNext(): string {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  // 같은 사이트 안의 경로만 허용 (외부 주소로 튕기는 것 방지)
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const [brand] = useBrand();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? `로그인 실패 (${res.status})`);
      window.location.replace(safeNext());
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 실패");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl border border-line bg-card p-6 shadow-[0_8px_30px_rgba(110,67,32,0.08)]"
      >
        <div className="mb-5 flex items-center gap-3">
          <BrandLogo brand={brand} />
          <div>
            <h1 className="text-lg text-ink">{brand.orgName || ORG_NAME}</h1>
            <p className="text-sm text-muted">사단장 전용 · 비밀번호를 입력하세요</p>
          </div>
        </div>
        <label className="mb-2 block text-sm text-ink-2" htmlFor="pw">
          비밀번호
        </label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink outline-none focus:border-brown"
        />
        {error && <p className="mb-3 text-sm text-[var(--run-ink)]">{error}</p>}
        <button
          type="submit"
          disabled={!password || busy}
          className="w-full rounded-2xl bg-gradient-to-b from-brown to-brown-2 px-4 py-3 text-base text-white shadow disabled:opacity-50"
        >
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>
    </main>
  );
}
