#!/usr/bin/env node
// 회사 이름·로고를 노션 「01 설정」에 저장한다 (앱 왼쪽 위·로그인 화면에 표시).
//   npm run set:brand -- --name "우리 회사" --logo ./logo.png
//   (둘 중 하나만 줘도 됨. 로고는 192px 안으로 줄여 저장. 앱에서 로고·이름을 눌러 바꿀 수도 있음)
import { existsSync, readFileSync } from "node:fs";

const API = process.env.NOTION_API_BASE?.trim() || "https://api.notion.com/v1";
for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}
const TOKEN = process.env.NOTION_TOKEN?.trim();
const ROOT = process.env.NOTION_ROOT_PAGE_ID?.trim().replace(/-/g, "").match(/([0-9a-f]{32})(?:\?.*)?$/i)?.[1];
const fail = (m) => (console.error(`\n❌ ${m}\n`), process.exit(1));
if (!TOKEN || !ROOT) fail(".env.local 에 NOTION_TOKEN 과 NOTION_ROOT_PAGE_ID 가 필요합니다.");

const args = process.argv.slice(2);
const arg = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const name = arg("--name")?.trim();
const logoPath = arg("--logo");
if (!name && !logoPath) fail('사용법: npm run set:brand -- --name "회사 이름" --logo ./logo.png');
if (name && (name.length < 1 || name.length > 40)) fail("회사 이름은 1~40자로 써 주세요.");

async function notion(path, method = "GET", body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json.message ?? ""}`);
  return json;
}

async function logoDataUrl(path) {
  if (!existsSync(path)) fail(`로고 파일이 없습니다: ${path}`);
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    fail("이미지 줄이기 도구(sharp)를 불러오지 못했습니다. 앱 왼쪽 위 로고를 눌러 올려 주세요.");
  }
  for (const size of [192, 128, 96]) {
    const buf = await sharp(path).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 85 }).toBuffer();
    const url = `data:image/webp;base64,${buf.toString("base64")}`;
    if (url.length <= 150_000) return url;
  }
  fail("로고 이미지가 너무 복잡합니다. 더 단순한 이미지를 써 주세요.");
}

const kids = await notion(`/blocks/${ROOT}/children?page_size=100`);
const db = kids.results.find((b) => b.type === "child_database" && /^01\s/.test(b.child_database.title));
if (!db) fail("노션 본부 페이지에 「01 설정」 DB가 없습니다. 먼저 npm run setup:notion 을 실행해 주세요.");
const rows = (await notion(`/databases/${db.id}/query`, "POST", {})).results;
const rt = (v) => (v.match(/[\s\S]{1,1900}/g) ?? []).map((c) => ({ type: "text", text: { content: c } }));
async function put(key, value) {
  const row = rows.find((r) => r.properties["항목"]?.title?.map((t) => t.plain_text).join("") === key);
  if (row) await notion(`/pages/${row.id}`, "PATCH", { properties: { 값: { rich_text: rt(value) } } });
  else await notion("/pages", "POST", { parent: { database_id: db.id }, properties: { 항목: { title: [{ text: { content: key } }] }, 값: { rich_text: rt(value) } } });
}
if (name) {
  await put("조직 이름", name);
  console.log(`✅ 회사 이름: ${name}`);
}
if (logoPath) {
  const url = await logoDataUrl(logoPath);
  await put("로고", url);
  console.log(`✅ 로고 저장 (${Math.round(url.length / 1024)}KB)`);
}
console.log("앱을 새로고침하면 왼쪽 위와 로그인 화면에 보입니다.");
