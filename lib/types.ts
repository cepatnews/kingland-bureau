// 노션 DB 속성값과 1:1로 맞춘 타입. 노션 옵션명이 바뀌면 여기만 고친다.

export const RANKS = ["대장", "참모", "실무", "감시", "예비"] as const;
// 소속: 좌참 피클의 부대 = Vermilion, 우참 피클의 부대 = Sapphire (노션 02 `소속` 옵션과 동일)
export const LEFT_UNIT = "Vermilion";
export const RIGHT_UNIT = "Sapphire";
export const UNITS = ["대장실", LEFT_UNIT, RIGHT_UNIT, "예비"] as const;
export const UNIT_COLOR: Record<string, string> = { 대장실: "#a0662f", [LEFT_UNIT]: "#d9573a", [RIGHT_UNIT]: "#3f6fb5" };
export const APPS = ["Pickle", "Vooy", "Hark", "Wabi", "Instinct", "Meta Muse", "Hermes", "ChatGPT", "Claude"] as const;
export const AGENT_STATES = ["인터뷰 전", "활성", "중지"] as const;
export const CONNECTIONS = ["노션 직접", "수동"] as const; // 노션만 사용 (수동 = 아직 노션 미연결, 사단장이 붙여 넣기)

export const ISSUERS = ["사단장(사용자)", "대장 피클", "좌참 피클", "우참 피클"] as const;
export const TASK_STATES = ["대기", "수신 확인", "진행", "검수 대기", "재작업", "완료", "보류"] as const;
export const PRIORITIES = ["긴급", "높음", "보통", "낮음"] as const;
export const APPROVALS = ["불필요", "승인 대기", "승인 완료", "거절"] as const;
export const REVIEW_RESULTS = ["미검수", "통과", "반려"] as const;

export const REPORT_STAGES = ["실무 보고", "참모 검토·취합", "대장 최종 보고"] as const;
export const RECIPIENTS = ["좌참 피클", "우참 피클", "대장 피클", "사단장(사용자)"] as const;
export const STAFF_REVIEWS = ["미검토", "승인", "보완 요청"] as const;
export const FINAL_REPORT_TYPES = ["일일", "주간", "긴급"] as const;
export const CHAT_KINDS = ["대화", "지시", "배정", "보고", "알림"] as const;
/** 10 회의실 대화의 `방` 값: 전체 방 이름, 또는 1:1 상대 AI의 02 페이지 ID */
export const MEETING_ROOM = "대회의실";

export type Rank = (typeof RANKS)[number];
export type Unit = (typeof UNITS)[number];
export type AgentApp = (typeof APPS)[number];
export type AgentState = (typeof AGENT_STATES)[number];
export type Connection = (typeof CONNECTIONS)[number];
export type Issuer = (typeof ISSUERS)[number];
export type TaskState = (typeof TASK_STATES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Approval = (typeof APPROVALS)[number];
export type ReviewResult = (typeof REVIEW_RESULTS)[number];
export type ReportStage = (typeof REPORT_STAGES)[number];
export type Recipient = (typeof RECIPIENTS)[number];
export type StaffReview = (typeof STAFF_REVIEWS)[number];
export type FinalReportType = (typeof FINAL_REPORT_TYPES)[number];
export type ChatKind = (typeof CHAT_KINDS)[number];

/** 02 조직도 및 역할 */
export interface Agent {
  id: string;
  name: string; // AI 이름
  rank: Rank | null; // 계급
  unit: Unit | null; // 소속
  app: AgentApp | null; // 앱
  superiorIds: string[]; // 상관
  strengths: string; // 강점·역량 (사용자 직접 입력)
  device: string; // 기기·계정
  role: string; // 역할
  activity: string; // 현재 활동
  connection: Connection | null; // 연결 방식
  state: AgentState | null; // 상태
  lastReportAt: string | null; // 마지막 보고 (읽기 전용)
}

/** 04 AI 공용 업무 DB */
export interface Task {
  id: string;
  title: string; // 업무명
  code: string | null; // 업무 ID (SF-TASK-n, 읽기 전용)
  issuer: Issuer | null; // 지시자
  staffIds: string[]; // 담당 참모
  assigneeIds: string[]; // 담당 AI
  progress: number; // 진행률 0~1
  state: TaskState | null; // 상태
  priority: Priority | null; // 우선순위
  due: string | null; // 마감
  doneAt: string | null; // 완료일
  doneCriteria: string; // 완료 조건
  resultNext: string; // 결과 및 다음 행동
  approval: Approval | null; // 승인
  resultUrl: string | null; // 결과물 링크
  reviewResult: ReviewResult | null; // 검수 결과
  rejectReason: string; // 반려 사유
  reworkCount: number; // 재작업 횟수
  parentIds: string[]; // 상위 업무
  childIds: string[]; // 하위 업무
  updatedAt: string | null; // 마지막 업데이트 (읽기 전용)
  createdAt: string | null;
}

/** 09 업무 보고 이력 (append-only) */
export interface TaskReport {
  id: string;
  summary: string; // 보고 요약
  code: string | null; // 보고 ID (SF-RPT-n, 읽기 전용)
  taskIds: string[]; // 관련 업무
  reporterIds: string[]; // 보고자
  stage: ReportStage | null; // 보고 단계
  recipient: Recipient | null; // 받는 사람
  progress: number | null; // 보고 진행률 0~1
  state: TaskState | null; // 보고 상태
  content: string; // 내용
  resultUrl: string | null; // 결과물 링크
  staffReview: StaffReview | null; // 참모 검토
  reportedAt: string; // 보고 시각 (created_time, 읽기 전용)
}

/** 05 최종 보고서 (대장 피클) */
export interface FinalReport {
  id: string;
  title: string; // 보고서명
  date: string | null; // 보고일
  type: FinalReportType | null; // 보고 유형
  authorIds: string[]; // 작성 AI
  taskIds: string[]; // 관련 업무
  summary: string; // 요약
  confirmed: boolean; // 사단장 확인
  createdAt: string | null;
}

/** 10 회의실 대화 (append-only) */
export interface ChatMessage {
  id: string;
  room: string; // 방
  senderName: string; // 보낸 사람
  senderId: string | null; // 보낸 AI (사단장이면 null)
  kind: ChatKind | null; // 종류
  text: string; // 내용
  taskIds: string[]; // 관련 업무
  at: string; // 보낸 시각
}

/** 01 설정: 회사(조직) 이름 · 로고 (로고는 작은 이미지 data URL) */
export interface Brand {
  orgName: string | null;
  logo: string | null;
}

export interface NewChatMessage {
  room: string;
  senderName: string;
  senderId: string | null;
  kind: ChatKind;
  text: string;
  taskIds?: string[];
}

export type DataMode = "notion" | "mock";

export type ApiResult<T> =
  | { ok: true; data: T; mode: DataMode; fetchedAt: string }
  | { ok: false; error: string; mode: DataMode };

export interface NewTaskInput {
  title: string;
  assigneeIds: string[];
  staffIds: string[];
  priority?: Priority;
  due?: string | null;
  doneCriteria?: string;
}

export interface NewTaskReportInput {
  taskId: string;
  reporterId: string;
  stage: ReportStage;
  content: string;
  summary?: string;
  recipient?: Recipient;
  progress?: number | null; // 0~1
  state?: TaskState | null;
  resultUrl?: string | null;
  staffReview?: StaffReview | null;
}

export interface AgentPatch {
  strengths?: string;
  state?: AgentState;
  connection?: Connection;
  device?: string;
  role?: string;
  activity?: string;
}
