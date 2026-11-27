// 노션 '본부' 페이지 아래 DB 이름 규칙 (비밀 아님). 서버·클라이언트 공용.
// 앱은 NOTION_ROOT_PAGE_ID 페이지 바로 아래에서 이름이 아래 번호로 시작하는 DB를 찾아 쓴다.
// (scripts/setup-notion.mjs가 이 이름 그대로 만들어 준다)

export const NOTION_DB = {
  settings: { prefix: "01", title: "01 설정", env: "NOTION_SETTINGS_DB_ID" },
  agents: { prefix: "02", title: "02 조직도 및 역할", env: "NOTION_AGENTS_DB_ID" },
  tasks: { prefix: "04", title: "04 AI 공용 업무 DB", env: "NOTION_TASKS_DB_ID" },
  reports: { prefix: "05", title: "05 최종 보고서 (대장 피클)", env: "NOTION_REPORTS_DB_ID" },
  taskReports: { prefix: "09", title: "09 업무 보고 이력", env: "NOTION_TASK_REPORTS_DB_ID" },
  chat: { prefix: "10", title: "10 회의실 대화", env: "NOTION_CHAT_DB_ID" },
} as const;

export type NotionDbKey = keyof typeof NOTION_DB;

export const notionUrl = (id: string) => `https://www.notion.so/${id.replace(/-/g, "")}`;
