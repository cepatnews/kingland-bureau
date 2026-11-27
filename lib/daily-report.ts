import "server-only";
// 일일 보고: 오늘(한국 시간) 움직인 업무·보고를 모아 대장 피클이 정리해 05 최종 보고서에 올린다.
// Vercel Cron(vercel.json)이 매일 정해진 시각에 /api/cron/daily-report 를 부르고,
// 보고서 탭의 "지금 일일 보고 받기" 버튼으로도 바로 만들 수 있다.

import { generateText } from "ai";
import { aiReady, model } from "./agent-engine";
import { buildOrg, isDelayed, namesOf } from "./chain-of-command";
import { store } from "./data-source";
import { REPORT_STYLE, REPORT_STYLE_GUIDE, REPORT_TIMING, kstDate } from "./settings";
import { MEETING_ROOM, type Task, type TaskReport } from "./types";

const fakeOn = () => process.env.SFORCE_FAKE_AI === "1" && !process.env.VERCEL;

export async function runDailyReport({ force = false } = {}): Promise<{ ok: true; created: boolean; reason?: string; id?: string }> {
  if (!force && REPORT_TIMING === "each") return { ok: true, created: false, reason: "REPORT_TIMING=each (업무 끝날 때마다 보고) 설정이라 일일 보고를 만들지 않습니다." };

  const s = store();
  const [agents, tasks, reports] = await Promise.all([s.listAgents(), s.listTasks(), s.listTaskReports({})]);
  const org = buildOrg(agents);
  const commander = org.commander;
  if (!commander) return { ok: true, created: false, reason: "02 조직도에 대장이 없습니다." };

  // 자동 실행이 오전(한국 12시 전)이면 어제 하루를, 그 밖(버튼 포함)이면 오늘 지금까지를 정리한다
  const kstHour = Number(new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 13));
  const yesterday = !force && kstHour < 12;
  const today = yesterday ? kstDate(-1) : kstDate();
  const dayWord = yesterday ? "어제" : "오늘";
  // 자동 실행(Cron)은 오늘 일일 보고가 이미 있으면 건너뛴다 (버튼으로 만든 경우 등)
  if (!force && (await s.listFinalReports()).some((f) => f.type === "일일" && f.date?.slice(0, 10) === today))
    return { ok: true, created: false, reason: `${today} 일일 보고가 이미 있습니다.` };
  const kst = (iso: string | null) => (iso ? kstDate(0, new Date(iso)) : "");
  const todays = reports.filter((r) => kst(r.reportedAt) === today);
  const touched = tasks.filter((t) => kst(t.updatedAt) === today || todays.some((r) => r.taskIds.includes(t.id)));
  const done = touched.filter((t) => t.state === "완료");
  const open = tasks.filter((t) => t.state !== "완료" && t.state !== "보류");
  const delayed = open.filter((t) => isDelayed(t));
  const approvals = tasks.filter((t) => t.approval === "승인 대기");
  if (!force && touched.length === 0 && delayed.length === 0 && approvals.length === 0)
    return { ok: true, created: false, reason: `${dayWord} 움직인 업무가 없어 일일 보고를 건너뜁니다.` };

  const no = (t: Task) => `#${t.code?.match(/\d+/)?.[0] ?? "?"}`;
  const line = (t: Task) =>
    `- ${no(t)} ${t.title} | ${t.state ?? "-"} ${Math.round(t.progress * 100)}% | 담당 ${namesOf(org, t.assigneeIds) || "-"}${t.due ? ` | 마감 ${t.due}` : ""}`;
  const rline = (r: TaskReport) => {
    const t = tasks.find((x) => r.taskIds.includes(x.id));
    return `- ${r.reportedAt.slice(11, 16)}UTC ${namesOf(org, r.reporterIds)} · ${r.stage ?? "-"} · ${t ? no(t) : ""} ${r.summary}`;
  };
  const data = [
    `날짜: ${today}`,
    `■ ${dayWord} 움직인 업무 (${touched.length})`, ...touched.slice(0, 30).map(line),
    `■ ${dayWord} 완료 (${done.length})`, ...done.slice(0, 20).map(line),
    `■ ${dayWord} 들어온 보고 (${todays.length})`, ...todays.slice(0, 40).map(rline),
    `■ 진행 중 (${open.length})`, ...open.slice(0, 20).map(line),
    `■ 마감 지남 (${delayed.length})`, ...delayed.map(line),
    `■ 사단장 승인 대기 (${approvals.length})`, ...approvals.map(line),
  ].join("\n");

  let summary: string;
  if (aiReady() && !fakeOn()) {
    const res = await generateText({
      model: await model(),
      system: [
        `너는 ${commander.name}이다. 사단장님께 ${dayWord}(${today}) 하루 업무를 정리한 일일 보고서를 쓴다.`,
        `형식: ${REPORT_STYLE_GUIDE[REPORT_STYLE]}`,
        `꼭 넣을 것: ${dayWord} 완료한 일, 진행 중인 일과 다음 단계, 마감 지난 일, 사단장님 승인이 필요한 일. 데이터에 없는 내용은 지어내지 않는다.`,
        "사단장님께 존댓말. 제목·인사말 없이 본문만.",
      ].join("\n"),
      prompt: data,
    });
    summary = res.text.trim();
  } else {
    // AI 없이 만드는 기본 요약
    summary = [
      `${dayWord} 움직인 업무 ${touched.length}건 · 완료 ${done.length}건 · 진행 중 ${open.length}건 · 마감 지남 ${delayed.length}건 · 승인 대기 ${approvals.length}건`,
      ...done.slice(0, 10).map((t) => `✅ ${no(t)} ${t.title}`),
      ...delayed.slice(0, 10).map((t) => `⏰ ${no(t)} ${t.title} (마감 ${t.due})`),
      ...approvals.slice(0, 10).map((t) => `✋ ${no(t)} ${t.title}`),
    ].join("\n");
  }

  const fr = await s.createFinalReport({
    title: `${today} 일일 보고`,
    date: today,
    type: "일일",
    authorIds: [commander.id],
    taskIds: touched.map((t) => t.id),
    summary,
  });
  const preview = summary.split("\n").filter(Boolean).slice(0, 3).join("\n");
  await s.createMessage({
    room: MEETING_ROOM,
    senderName: commander.name,
    senderId: commander.id,
    kind: "보고",
    text: `📑 사단장님, ${today} 일일 보고서를 올렸습니다 (보고서 탭).\n${preview}`,
    taskIds: touched.slice(0, 20).map((t) => t.id),
  });
  return { ok: true, created: true, id: fr.id };
}
