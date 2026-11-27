import "server-only";
// 로컬 테스트 전용 가짜 AI (SFORCE_FAKE_AI=1, Vercel이 아닐 때만). 실제 AI 없이 배정→보고 연쇄를 점검한다.

import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2Content } from "@ai-sdk/provider";

export async function fakeModel(): Promise<LanguageModelV2> {
  const { MockLanguageModelV2 } = await import("ai/test");
  return new MockLanguageModelV2({ doGenerate: async (opts: LanguageModelV2CallOptions) => respond(opts) });
}

function respond(opts: LanguageModelV2CallOptions) {
  const msgs = opts.prompt;
  const system = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const user = msgs.filter((m) => m.role === "user").flatMap((m) => m.content).map((c) => (c.type === "text" ? c.text : "")).join("\n");
  const results = msgs.filter((m) => m.role === "tool").flatMap((m) => m.content).map((c) => JSON.stringify(c.output));
  const step = results.length;
  const trigger = user.split("■ 지금 네 차례인 이유:")[1] ?? "";
  const rank = system.match(/계급 (\S+?),/)?.[1] ?? "";
  const num = trigger.match(/#(\d+)/)?.[1] ?? results.join(" ").match(/#(\d+)/)?.[1] ?? "0";
  const subNames = (system.match(/직속 부하: ([^\n]+)/)?.[1] ?? "").split(",").map((x) => x.replace(/\(.*$/, "").trim()).filter(Boolean);
  const firstSub = subNames[0] ?? "";

  const call = (toolName: string, input: unknown): LanguageModelV2Content => ({ type: "tool-call", toolCallId: `c${Date.now()}${step}`, toolName, input: JSON.stringify(input) });
  const say = (text: string): LanguageModelV2Content => ({ type: "text", text });
  let plan: LanguageModelV2Content[] = [];

  if (rank === "대장" && trigger.includes("사단장님 메시지")) {
    if (/안녕|누구|소개|말해봐/.test(trigger)) plan = [say("사단장님, 대장 피클입니다. 좌참·우참 피클을 지휘해 맡기신 일을 처리하고 보고드립니다.")];
    else plan = [call("register_task", { title: `테스트 업무 ${trigger.slice(9, 30).trim()}`, doneCriteria: "사단장 지시 요약: 후보를 조사해 표로 정리하면 완료." }), call("delegate", { task: num, to: subNames[0] ?? "좌참 피클", instruction: "나눠 처리하라." }), ...(trigger.includes("둘 다") && subNames[1] ? [call("delegate", { task: num, to: subNames[1], instruction: "나눠 처리하라." })] : []), say(`사단장님, 업무로 등록하고 ${subNames[0] ?? "좌참 피클"}에게 넘겼습니다.`)];
  } else if (rank === "대장") {
    plan = [call("report", { task: num, progress: 100, state: "완료", content: "좌참 보고 검토 완료. 결과 이상 없습니다." }), say("사단장님, 최종 보고 올립니다. 완료됐습니다.")];
  } else if (rank === "참모" && trigger.includes("맡겼다")) {
    plan = [call("delegate", { task: num, to: firstSub, instruction: "조사해서 보고하라." }), ...(subNames[1] ? [call("delegate", { task: num, to: subNames[1], instruction: "같은 일을 비교 시험으로 맡긴다." })] : []), say(`${firstSub}에게 맡겼습니다.`)];
  } else if (rank === "참모") {
    plan = [call("report", { task: num, progress: 100, state: "완료", staffReview: "승인", content: "부대원 결과 검토, 승인합니다.", evaluations: [{ agent: firstSub, field: "자료 조사", score: 4, note: "정리가 깔끔함" }] }), say("대장님께 취합 보고 올렸습니다.")];
  } else {
    plan = [call("report", { task: num, progress: 100, state: "완료", content: "조사 결과: 테스트 항목 3개 정리 완료." }), say("작업 끝내고 보고했습니다.")];
  }
  const part = plan[Math.min(step, plan.length - 1)];
  return {
    content: [part],
    finishReason: part.type === "tool-call" ? ("tool-calls" as const) : ("stop" as const),
    usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
    warnings: [],
  };
}
