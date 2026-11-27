"use client";
/* eslint-disable @next/next/no-img-element -- 로고는 노션에 저장된 작은 data URL 이미지 */

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { ORG_NAME } from "@/lib/brand";
import type { Brand } from "@/lib/types";

/** 회사 이름·로고 (노션 01 설정). 로그인 화면에서도 쓴다. */
export function useBrand() {
  const [brand, setBrand] = useState<Brand>({ orgName: ORG_NAME, logo: null });
  useEffect(() => {
    let alive = true;
    fetch("/api/brand", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => alive && j?.ok && setBrand(j.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return [brand, setBrand] as const;
}

/** 고른 이미지를 정사각형 안에 맞춰 작게 줄인다 (노션 텍스트 칸에 들어가도록 150KB 이하) */
async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("이미지를 읽지 못했습니다."));
      i.src = url;
    });
    for (const size of [192, 128, 96]) {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d")!;
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      let data = c.toDataURL("image/webp", 0.85);
      if (!data.startsWith("data:image/webp")) data = c.toDataURL("image/png");
      if (data.length <= 150_000) return data;
    }
    throw new Error("로고 이미지가 너무 복잡합니다. 더 단순한 이미지를 골라 주세요.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BrandLogo({ brand, size = 48 }: { brand: Brand; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#e6cfa9] bg-[#fbecd2]"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {brand.logo ? <img src={brand.logo} alt="" className="h-full w-full object-contain" /> : "👑"}
    </span>
  );
}

/** 왼쪽 위 회사 표시: 로고를 누르면 이미지 바꾸기, 이름을 누르면 이름 바꾸기 */
export function BrandHeader({
  brand,
  onChange,
  toast,
}: {
  brand: Brand;
  onChange: (b: Brand) => void;
  toast: (t: string, tone?: "ok" | "err") => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(brand.orgName ?? "");

  async function save(patch: { orgName?: string; logo?: string | null }, done: string) {
    setBusy(true);
    try {
      const { data } = await api<Brand>("/api/settings", { method: "PATCH", body: JSON.stringify(patch) });
      onChange(data);
      toast(done);
    } catch (e) {
      toast(`저장 실패: ${e instanceof Error ? e.message : e}`, "err");
    } finally {
      setBusy(false);
    }
  }

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    try {
      await save({ logo: await shrinkImage(file) }, "로고를 바꿨습니다.");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "err");
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="group relative">
        <button onClick={() => fileRef.current?.click()} disabled={busy} title="로고 바꾸기 (이미지 고르기)" className={busy ? "opacity-60" : ""}>
          <BrandLogo brand={brand} />
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-line bg-card text-[10px] opacity-0 shadow transition group-hover:opacity-100">
            📷
          </span>
        </button>
        {brand.logo && (
          <button
            onClick={() => save({ logo: null }, "로고를 지웠습니다.")}
            title="로고 지우기"
            className="absolute -left-1 -top-1 hidden h-4 w-4 place-items-center rounded-full bg-[#b5473a] text-[9px] text-white group-hover:grid"
          >
            ✕
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pickLogo(e.target.files?.[0]).then(() => (e.target.value = ""))} />
      </div>
      <div className="min-w-0">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = name.trim();
              setEditing(false);
              if (v && v !== brand.orgName) void save({ orgName: v }, "회사 이름을 바꿨습니다.");
            }}
          >
            <input
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              className="field w-40 px-2 py-1 text-base"
            />
          </form>
        ) : (
          <button
            onClick={() => {
              setName(brand.orgName ?? "");
              setEditing(true);
            }}
            title="회사 이름 바꾸기"
            className="group block max-w-full truncate text-left text-lg text-ink"
          >
            {brand.orgName || ORG_NAME}
            <span className="ml-1 text-xs opacity-0 transition group-hover:opacity-60">✏️</span>
          </button>
        )}
        <p className="flex items-center gap-1.5 text-xs text-ink-2">
          <span className="h-2 w-2 rounded-full bg-[#4fa05d]" /> 사단장 전용 비서처
        </p>
      </div>
    </div>
  );
}
