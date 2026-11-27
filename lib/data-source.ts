import "server-only";
// 데이터 기준점: NOTION_TOKEN이 있으면 노션이 유일한 원본. 없을 때만 목업.
// 노션이 실패해도 목업으로 조용히 바꾸지 않는다 → 오류를 그대로 클라이언트에 돌려준다.

import { NextResponse } from "next/server";
import { mockStore } from "./mock-store";
import { NotionError, notionStore, type Store } from "./notion-store";
import type { ApiResult, DataMode } from "./types";

export function dataMode(): DataMode {
  return process.env.NOTION_TOKEN ? "notion" : "mock";
}

export function store(): Store {
  return dataMode() === "notion" ? notionStore : mockStore;
}

export class InputError extends Error {}

export function ok<T>(data: T, status = 200) {
  const body: ApiResult<T> = { ok: true, data, mode: dataMode(), fetchedAt: new Date().toISOString() };
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(err: unknown) {
  const mode = dataMode();
  let status = 500;
  let error = "알 수 없는 오류";
  if (err instanceof InputError) {
    status = 400;
    error = err.message;
  } else if (err instanceof NotionError) {
    status = err.status;
    error = err.message;
  } else if (err instanceof Error) {
    error = err.message;
  }
  const body: ApiResult<never> = { ok: false, error, mode };
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
