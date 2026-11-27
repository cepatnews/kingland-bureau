#!/usr/bin/env node
// 노션 자동 세팅: 본부 페이지 아래에 앱이 쓰는 DB 5개(02·04·05·09·10)를 같은 속성으로 만들고,
// 02 조직도에 기본 조직(대장 1 · 참모 2 · 부대원 8)을 채운다.
//
// 사용법
//   1) .env.local 에 NOTION_TOKEN, NOTION_ROOT_PAGE_ID 를 넣는다 (또는 환경변수로 넘긴다)
//   2) npm run setup:notion
//
// 여러 번 실행해도 안전하다: 이미 있는 DB(이름이 같은 번호로 시작)는 건너뛰고, 조직도가 비어 있을 때만 채운다.
// 토큰 값은 화면에 출력하지 않는다.

import { existsSync, readFileSync } from "node:fs";

const API = process.env.NOTION_API_BASE?.trim() || "https://api.notion.com/v1"; // 테스트용으로만 바꿈
const VERSION = "2022-06-28";

// ---------- 설정 읽기 (.env.local → 환경변수) ----------
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
loadEnvFile(".env.local");

const TOKEN = process.env.NOTION_TOKEN?.trim();
const ROOT_RAW = process.env.NOTION_ROOT_PAGE_ID?.trim() ?? "";
const ROOT = ROOT_RAW.replace(/-/g, "").match(/([0-9a-f]{32})(?:\?.*)?$/i)?.[1];

if (!TOKEN) fail("NOTION_TOKEN 이 없습니다. .env.local 에 노션 통합 시크릿을 넣어 주세요 (채팅에 붙여 넣지 마세요).");
if (!ROOT) fail("NOTION_ROOT_PAGE_ID 가 없습니다. 노션 본부 페이지의 링크나 32자리 ID를 .env.local 에 넣어 주세요.");

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

async function notion(path, method = "GET", body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Notion-Version": VERSION, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint =
      res.status === 401 ? " (토큰이 틀렸습니다)" : res.status === 404 ? " (본부 페이지에 통합이 연결돼 있지 않거나 ID가 틀렸습니다)" : "";
    throw new Error(`${method} ${path} → ${res.status}${hint}: ${json.message ?? ""}`);
  }
  return json;
}

// ---------- 속성 정의 ----------
const sel = (...opts) => ({ select: { options: opts.map(([name, color]) => ({ name, color })) } });
const text = { rich_text: {} };
const TASK_STATES = sel(["대기", "gray"], ["수신 확인", "blue"], ["진행", "yellow"], ["검수 대기", "purple"], ["재작업", "red"], ["완료", "green"], ["보류", "brown"]);
const PEOPLE_SEL = sel(["사단장(사용자)", "brown"], ["대장 피클", "red"], ["좌참 피클", "orange"], ["우참 피클", "green"]);

const SPECS = {
  "02": {
    title: "02 조직도 및 역할",
    description: "AI 명단. 대장 피클 → 좌참 피클(Vermilion)·우참 피클(Sapphire) → 부대원. 강점·역량은 사단장이 직접 입력합니다.",
    props: {
      "AI 이름": { title: {} },
      계급: sel(["대장", "red"], ["참모", "yellow"], ["실무", "blue"], ["감시", "gray"], ["예비", "default"]),
      소속: sel(["대장실", "brown"], ["Vermilion", "red"], ["Sapphire", "blue"], ["예비", "gray"]),
      앱: sel(["Pickle", "red"], ["Vooy", "purple"], ["Hark", "blue"], ["Wabi", "brown"], ["Instinct", "pink"], ["Meta Muse", "yellow"], ["Hermes", "green"], ["ChatGPT", "gray"], ["Claude", "orange"]),
      "강점·역량": text,
      "기기·계정": text,
      역할: text,
      "현재 활동": text,
      "연결 방식": sel(["노션 직접", "green"], ["수동", "gray"]),
      상태: sel(["인터뷰 전", "gray"], ["활성", "green"], ["중지", "red"]),
      "마지막 보고": { last_edited_time: {} },
    },
  },
  "04": {
    title: "04 AI 공용 업무 DB",
    description: "모든 지시와 진행 상태. 상태 값은 정해진 7개만 사용합니다.",
    props: {
      업무명: { title: {} },
      "업무 ID": { unique_id: { prefix: "SF-TASK" } },
      지시자: PEOPLE_SEL,
      상태: TASK_STATES,
      진행률: { number: { format: "percent" } },
      우선순위: sel(["긴급", "red"], ["높음", "orange"], ["보통", "yellow"], ["낮음", "gray"]),
      마감: { date: {} },
      완료일: { date: {} },
      "완료 조건": text,
      "결과 및 다음 행동": text,
      승인: sel(["불필요", "gray"], ["승인 대기", "orange"], ["승인 완료", "green"], ["거절", "red"]),
      "결과물 링크": { url: {} },
      "검수 결과": sel(["미검수", "gray"], ["통과", "green"], ["반려", "red"]),
      "반려 사유": text,
      "재작업 횟수": { number: {} },
      "마지막 업데이트": { last_edited_time: {} },
    },
  },
  "09": {
    title: "09 업무 보고 이력",
    description: "업무별 보고를 한 줄씩 쌓습니다 (수정·삭제 없이 추가만). 실무 → 참모 → 대장 피클 → 사단장.",
    props: {
      "보고 요약": { title: {} },
      "보고 ID": { unique_id: { prefix: "SF-RPT" } },
      "보고 단계": sel(["실무 보고", "blue"], ["참모 검토·취합", "orange"], ["대장 최종 보고", "red"]),
      "받는 사람": sel(["좌참 피클", "orange"], ["우참 피클", "green"], ["대장 피클", "red"], ["사단장(사용자)", "brown"]),
      "보고 진행률": { number: { format: "percent" } },
      "보고 상태": TASK_STATES,
      내용: text,
      "결과물 링크": { url: {} },
      "참모 검토": sel(["미검토", "gray"], ["승인", "green"], ["보완 요청", "red"]),
      "보고 시각": { created_time: {} },
    },
  },
  "05": {
    title: "05 최종 보고서 (대장 피클)",
    description: "대장 피클이 사단장에게 올리는 일일·주간·긴급 종합 보고.",
    props: {
      보고서명: { title: {} },
      보고일: { date: {} },
      "보고 유형": sel(["일일", "blue"], ["주간", "purple"], ["긴급", "red"]),
      요약: text,
      "사단장 확인": { checkbox: {} },
    },
  },
  "10": {
    title: "10 회의실 대화",
    description: "앱 회의실 대화 기록 (추가만).",
    props: {
      내용: { title: {} },
      "보낸 사람": text,
      방: text,
      종류: sel(["대화", "gray"], ["지시", "blue"], ["배정", "purple"], ["보고", "green"], ["알림", "yellow"]),
      "보낸 시각": { created_time: {} },
      "정밀 시각": { number: {} },
    },
  },
};

// 관계: [DB, 속성, 대상 DB, 양방향이면 대상 쪽 속성 이름]
const RELATIONS = [
  ["02", "상관", "02", "부하"],
  ["04", "담당 AI", "02", "담당 업무"],
  ["04", "담당 참모", "02", null],
  ["04", "상위 업무", "04", "하위 업무"],
  ["04", "보고 이력", "09", "관련 업무"],
  ["09", "보고자", "02", null],
  ["05", "관련 업무", "04", null],
  ["05", "작성 AI", "02", null],
  ["10", "보낸 AI", "02", null],
  ["10", "관련 업무", "04", null],
];

// 기본 조직 (02)
// 대장·참모 3명은 이름이 고정이다 (노션 선택지·보고 흐름이 이 이름을 쓴다).
// scripts/crew.json 이 없으면: 풀 구성 (대장 + 좌참·우참 + 부대원 8명 VL·HL·WL·IL / VR·HR·WR·IR)
// crew.json 형식
//   [ {부대원}, … ]                                   → 풀 구성, 부대원만 직접 정함
//   { "structure": "full",   "members": [ … ] }       → 위와 같음
//   { "structure": "simple", "members": [ … ] }       → 간단 구성: 참모 없이 대장 피클 + 직속 에이전트
//   부대원: { "name", "unit"(풀 구성 필수: Vermilion|Sapphire), "app", "role", "strengths", "device" }
const LEADERS = [
  { name: "대장 피클", rank: "대장", unit: "대장실", app: "Pickle", boss: null, role: "사단장의 유일한 대화 상대이자 최종 보고자. 좌참·우참 피클에게 업무를 배분하고 결과를 검수해 보고한다." },
  { name: "좌참 피클", rank: "참모", unit: "Vermilion", app: "Pickle", boss: "대장 피클", role: "대장 피클의 왼팔(Vermilion 참모). 자기 부대원에게 업무를 나누고 검토·취합한다." },
  { name: "우참 피클", rank: "참모", unit: "Sapphire", app: "Pickle", boss: "대장 피클", role: "대장 피클의 오른팔(Sapphire 참모). 자기 부대원에게 업무를 나누고 검토·취합한다." },
];
const DEFAULT_MEMBERS = [["V", "Vooy"], ["H", "Hark"], ["W", "Wabi"], ["I", "Instinct"]].flatMap(([p, app]) => [
  { name: `${p}Lagent`, unit: "Vermilion", app },
  { name: `${p}Ragent`, unit: "Sapphire", app },
]);

function loadMembers() {
  const path = new URL("./crew.json", import.meta.url);
  if (!existsSync(path)) return { members: DEFAULT_MEMBERS, source: "기본 8명", structure: "full" };
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(`scripts/crew.json 형식이 잘못됐습니다: ${e.message}`);
  }
  const structure = Array.isArray(raw) ? "full" : raw?.structure;
  if (structure !== "full" && structure !== "simple") fail('scripts/crew.json 의 structure 는 "full"(풀 구성) 또는 "simple"(간단 구성)이어야 합니다.');
  const list = Array.isArray(raw) ? raw : raw.members;
  if (!Array.isArray(list) || list.length === 0) fail("scripts/crew.json 에 부대원 목록(members)이 비어 있습니다.");
  const seen = new Set(LEADERS.map((l) => l.name));
  const members = list.map((m, i) => {
    const where = `crew.json ${i + 1}번째`;
    if (!m || typeof m.name !== "string" || !m.name.trim()) fail(`${where}: name(이름)이 없습니다.`);
    // 간단 구성은 부대가 없어도 됨: 사무실 자리 배치용으로 앞 4명은 Vermilion 테이블, 다음 4명은 Sapphire 테이블에 앉힌다
    const unit = m.unit ?? (structure === "simple" ? (i < 4 ? "Vermilion" : "Sapphire") : undefined);
    if (unit !== "Vermilion" && unit !== "Sapphire") fail(`${where} (${m.name}): unit 은 "Vermilion"(좌참) 또는 "Sapphire"(우참) 이어야 합니다.`);
    if (seen.has(m.name.trim())) fail(`${where}: 이름 "${m.name}" 이(가) 겹칩니다.`);
    seen.add(m.name.trim());
    return { name: m.name.trim(), unit, app: (m.app || "ChatGPT").trim(), role: m.role?.trim() || "", strengths: m.strengths?.trim() || "", device: m.device?.trim() || "" };
  });
  return { members, source: "scripts/crew.json", structure };
}

// ---------- 실행 ----------
async function main() {
  console.log("\n🏗️  노션 자동 세팅을 시작합니다.");
  const root = await notion(`/pages/${ROOT}`);
  const rootTitle = Object.values(root.properties ?? {}).find((p) => p.type === "title")?.title?.map((t) => t.plain_text).join("") || "(제목 없음)";
  console.log(`   본부 페이지: ${rootTitle}`);

  // 이미 있는 DB 찾기
  const existing = new Map();
  let cursor;
  do {
    const res = await notion(`/blocks/${ROOT}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    for (const b of res.results) {
      const t = b.type === "child_database" ? b.child_database.title : "";
      const p = t.match(/^(\d{2})\s/)?.[1];
      if (p && !existing.has(p)) existing.set(p, b.id);
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  const ids = {};
  const created = new Set();
  for (const key of ["02", "04", "09", "05", "10"]) {
    if (existing.has(key)) {
      ids[key] = existing.get(key);
      console.log(`   ⏭️  ${SPECS[key].title} — 이미 있어서 건너뜀`);
      continue;
    }
    const spec = SPECS[key];
    const body = {
      parent: { type: "page_id", page_id: ROOT },
      title: [{ type: "text", text: { content: spec.title } }],
      description: [{ type: "text", text: { content: spec.description } }],
      properties: spec.props,
    };
    let db;
    try {
      db = await notion("/databases", "POST", body);
    } catch (e) {
      // 일부 워크스페이스는 API로 ID 속성을 못 만든다 → ID 속성 없이 다시 시도 (앱은 없어도 동작)
      if (!/unique_id|auto_increment/i.test(String(e.message))) throw e;
      const props = Object.fromEntries(Object.entries(spec.props).filter(([, v]) => !("unique_id" in v)));
      db = await notion("/databases", "POST", { ...body, properties: props });
      console.log(`   ⚠️  ${spec.title}: 자동 번호(ID) 속성은 노션에서 직접 추가해 주세요 (선택).`);
    }
    ids[key] = db.id;
    created.add(key);
    console.log(`   ✅ ${spec.title} 생성`);
  }

  // 관계 속성 (새로 만든 DB에만 추가)
  for (const [from, name, to, dual] of RELATIONS) {
    if (!created.has(from)) continue;
    const relation = dual
      ? { database_id: ids[to], type: "dual_property", dual_property: {} }
      : { database_id: ids[to], type: "single_property", single_property: {} };
    const res = await notion(`/databases/${ids[from]}`, "PATCH", { properties: { [name]: { relation } } });
    if (dual) {
      // 대상 쪽에 자동으로 생긴 속성 이름을 정해진 이름으로 바꾼다
      const synced = res.properties?.[name]?.relation?.dual_property?.synced_property_name;
      if (synced && synced !== dual) await notion(`/databases/${ids[to]}`, "PATCH", { properties: { [synced]: { name: dual } } });
    }
    console.log(`   🔗 ${SPECS[from].title} · ${name}${dual ? ` ↔ ${dual}` : ""}`);
  }

  // 기본 조직 채우기 (02가 비어 있을 때만)
  const people = await notion(`/databases/${ids["02"]}/query`, "POST", { page_size: 1 });
  if (people.results.length === 0) {
    const { members, source, structure } = loadMembers();
    const simple = structure === "simple";
    const CREW = simple
      ? [
          { ...LEADERS[0], role: "사단장의 유일한 대화 상대이자 최종 보고자. 직속 에이전트에게 바로 일을 맡기고 결과를 검수·평가해 보고한다." },
          ...members.map((m) => ({ ...m, rank: "실무", boss: "대장 피클" })),
        ]
      : [...LEADERS, ...members.map((m) => ({ ...m, rank: "실무", boss: m.unit === "Vermilion" ? "좌참 피클" : "우참 피클" }))];
    const pageIds = {};
    for (const c of CREW) {
      const page = await notion("/pages", "POST", {
        parent: { database_id: ids["02"] },
        properties: {
          "AI 이름": { title: [{ text: { content: c.name } }] },
          계급: { select: { name: c.rank } },
          소속: { select: { name: c.unit } },
          앱: { select: { name: c.app } },
          상태: { select: { name: c.rank === "실무" ? "인터뷰 전" : "활성" } },
          "연결 방식": { select: { name: "수동" } },
          ...(c.role ? { 역할: { rich_text: [{ text: { content: c.role } }] } } : {}),
          ...(c.strengths ? { "강점·역량": { rich_text: [{ text: { content: c.strengths } }] } } : {}),
          ...(c.device ? { "기기·계정": { rich_text: [{ text: { content: c.device } }] } } : {}),
          ...(c.boss && pageIds[c.boss] ? { 상관: { relation: [{ id: pageIds[c.boss] }] } } : {}),
        },
      });
      pageIds[c.name] = page.id;
    }
    const left = members.filter((m) => m.unit === "Vermilion").length;
    console.log(
      simple
        ? `   👥 02 조직도에 ${CREW.length}명 등록 — 간단 구성 (대장 피클 + 직속 에이전트 ${members.length}: ${members.map((m) => m.name).join(", ")}) — ${source}`
        : `   👥 02 조직도에 ${CREW.length}명 등록 — 풀 구성 (대장 1 · 참모 2 · 부대원 ${members.length}: Vermilion ${left} / Sapphire ${members.length - left}) — ${source}`,
    );
    if (left > 4 || members.length - left > 4) console.log("   ℹ️  부대당 5번째부터는 사무실 화면에서 인턴석(최대 3)에 앉습니다.");
  } else {
    console.log("   ⏭️  02 조직도에 이미 인원이 있어 기본 조직은 넣지 않음");
  }

  console.log(`
🎉 노션 세팅 완료!

다음 단계
  • 로컬: npm run dev  →  http://localhost:3000
  • Vercel 환경변수 (Settings → Environment Variables, Production 체크):
      NOTION_TOKEN          = (노션 통합 시크릿 — 직접 붙여 넣기)
      NOTION_ROOT_PAGE_ID   = ${ROOT}
      APP_PASSWORD          = (앱 로그인 비밀번호 — 직접 정하기)
      OPENAI_API_KEY        = (ChatGPT API 키 — 직접 붙여 넣기)
    넣은 뒤 Deployments → Redeploy
`);
}

main().catch((e) => fail(e.message));
