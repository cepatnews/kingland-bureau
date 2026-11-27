"use client";
// 클라이언트 데이터 훅. localStorage는 표시용 캐시일 뿐이고, 서버 응답으로 항상 덮어쓴다.
// 노션 실패 시: 캐시를 그대로 보여 주되 "노션 연결 끊김" + 마지막 성공 시각을 표시한다.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResult, DataMode } from "./types";

const CACHE_PREFIX = "sforce-cache:v1:";

type Cached<T> = { data: T; fetchedAt: string };

function readCache<T>(key: string): Cached<T> | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as Cached<T>) : null;
  } catch {
    return null;
  }
}
function writeCache<T>(key: string, value: Cached<T>) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {}
}

export async function api<T>(url: string, init?: RequestInit): Promise<{ data: T; mode: DataMode; fetchedAt: string }> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  } catch {
    throw new Error("서버에 연결하지 못했습니다.");
  }
  let body: ApiResult<T>;
  try {
    body = (await res.json()) as ApiResult<T>;
  } catch {
    throw new Error(`서버 응답 오류 (${res.status})`);
  }
  if (!body.ok) throw new Error(body.error);
  return body;
}

export type Resource<T> = {
  data: T | null;
  loading: boolean;
  error: string | null; // 마지막 불러오기 실패 메시지
  fetchedAt: string | null; // 마지막 성공 시각
  mode: DataMode | null;
  reload: () => Promise<void>;
  /** 낙관적 갱신. 실패 시 rollback() 호출 */
  mutate: (fn: (prev: T) => T) => () => void;
};

export function useResource<T>(key: string | null, url: string | null): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [mode, setMode] = useState<DataMode | null>(null);
  const dataRef = useRef<T | null>(null);
  dataRef.current = data;

  const reload = useCallback(async () => {
    if (!url || !key) return;
    setLoading(true);
    try {
      const r = await api<T>(url);
      setData(r.data);
      setFetchedAt(r.fetchedAt);
      setMode(r.mode);
      setError(null);
      writeCache(key, { data: r.data, fetchedAt: r.fetchedAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [key, url]);

  useEffect(() => {
    if (!key) return;
    const c = readCache<T>(key);
    if (c) {
      setData(c.data);
      setFetchedAt(c.fetchedAt);
    } else {
      setData(null);
      setFetchedAt(null);
    }
    void reload();
  }, [key, reload]);

  const mutate = useCallback((fn: (prev: T) => T) => {
    const before = dataRef.current;
    if (before != null) setData(fn(before));
    return () => setData(before);
  }, []);

  return { data, loading, error, fetchedAt, mode, reload, mutate };
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

export const pct = (v: number | null | undefined) => `${Math.round((v ?? 0) * 100)}%`;
