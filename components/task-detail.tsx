"use client";

import { useState } from "react";
import { isDelayed, namesOf, type Org } from "@/lib/chain-of-command";
import { api, fmtTime, pct, useResource, type Resource } from "@/lib/client-api";
import type { ReportStage, Task, TaskReport } from "@/lib/types";
import { Chip, Empty, ProgressBar, Sheet, StatePill } from "./ui";

const STAGE_STYLE: Record<ReportStage, { dot: string; label: string }> = {
  "실무 보고": { dot: "#5b8cc4", label: "실무 → 참모" },
  "참모 검토·취합": { dot: "#d48a4a", label: "참모 → 대장" },
  "대장 최종 보고": { dot: "#b3402f", label: "대장 → 사단장" },
};

export function TaskDetail({
  taskId,
  onClose,
  org,
  tasks,
  onOpenTask,
  toast,
}: {
  taskId: string | null;
  onClose: () => void;
  org: Org;
  tasks: Resource<Task[]>;
  onOpenTask: (id: string) => void;
  toast: (t: string, tone?: "ok" | "err") => void;
}) {
  const task = (tasks.data ?? []).find((t) => t.id === taskId) ?? null;
  const reports = useResource<TaskReport[]>(taskId ? `reports:${taskId}` : null, taskId ? `/api/task-reports?taskId=${taskId}` : null);
  const [deciding, setDeciding] = useState(false);

  const byId = new Map((tasks.data ?? []).map((t) => [t.id, t]));
  const children = task ? task.childIds.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t)) : [];
  const parents = task ? task.parentIds.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t)) : [];

  async function decide(approval: "승인 완료" | "거절") {
    if (!task || deciding) return;
    setDeciding(true);
    const rollback = tasks.mutate((prev) => prev.map((t) => (t.id === task.id ? { ...t, approval } : t)));
    try {
      const { data } = await api<Task>("/api/tasks", { method: "PATCH", body: JSON.stringify({ id: task.id, approval }) });
      tasks.mutate((prev) => prev.map((t) => (t.id === data.id ? data : t)));
      toast(approval === "승인 완료" ? "승인했습니다. 대장 피클이 진행합니다." : "거절했습니다.");
    } catch (e) {
      rollback();
      toast(`저장 실패: ${e instanceof Error ? e.message : e}`, "err");
    } finally {
      setDeciding(false);
    }
  }

  return (
    <Sheet
      open={Boolean(taskId)}
      onClose={onClose}
      title={
        <div className="min-w-0">
          <div className="text-[11px] text-muted">{task?.code ?? "업무 상세"}</div>
          <div className="truncate">{task?.title ?? "불러오는 중…"}</div>
        </div>
      }
    >
      {!task ? (
        <Empty>업무를 찾을 수 없습니다. 현황판을 새로고침해 주세요.</Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <section className="card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <StatePill state={task.state} />
              {task.priority && <Chip tone={task.priority === "긴급" ? "alert" : task.priority === "높음" ? "warn" : "plain"}>우선순위 {task.priority}</Chip>}
              {isDelayed(task) && <Chip tone="alert">지연</Chip>}
              {task.reviewResult && task.reviewResult !== "미검수" && <Chip tone={task.reviewResult === "통과" ? "brown" : "alert"}>검수 {task.reviewResult}</Chip>}
              {task.reworkCount > 0 && <Chip tone="warn">재작업 {task.reworkCount}회</Chip>}
            </div>
            <ProgressBar value={task.progress} state={task.state} />
            <dl className="mt-3 grid grid-cols-[84px_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted">지시자</dt>
              <dd className="text-ink">{task.issuer ?? "-"}</dd>
              <dt className="text-muted">담당 참모</dt>
              <dd className="text-ink">{task.staffIds.length ? namesOf(org, task.staffIds) : "배분 전"}</dd>
              <dt className="text-muted">담당 AI</dt>
              <dd className="text-ink">{task.assigneeIds.length ? namesOf(org, task.assigneeIds) : "-"}</dd>
              <dt className="text-muted">마감</dt>
              <dd className="text-ink">{task.due ?? "-"}{task.doneAt ? ` · 완료 ${task.doneAt}` : ""}</dd>
              {task.doneCriteria && (
                <>
                  <dt className="text-muted">완료 조건</dt>
                  <dd className="whitespace-pre-wrap text-ink">{task.doneCriteria}</dd>
                </>
              )}
              {task.resultNext && (
                <>
                  <dt className="text-muted">결과·다음</dt>
                  <dd className="whitespace-pre-wrap text-ink">{task.resultNext}</dd>
                </>
              )}
              {task.rejectReason && (
                <>
                  <dt className="text-muted">반려 사유</dt>
                  <dd className="whitespace-pre-wrap text-[#b3402f]">{task.rejectReason}</dd>
                </>
              )}
              {task.resultUrl && (
                <>
                  <dt className="text-muted">결과물</dt>
                  <dd className="truncate">
                    <a href={task.resultUrl} target="_blank" rel="noreferrer" className="text-brown underline">
                      링크 열기
                    </a>
                  </dd>
                </>
              )}
              <dt className="text-muted">업데이트</dt>
              <dd className="text-ink-2">{fmtTime(task.updatedAt)}</dd>
            </dl>
          </section>

          {task.approval === "승인 대기" && (
            <section className="rounded-2xl border border-[#f1d6a6] bg-[#fff4e0] p-4">
              <div className="text-sm text-[#7a5212]">✋ 사단장님 승인이 필요한 업무입니다</div>
              <p className="mt-1 text-xs text-[#9a7a3f]">전화·결제·메시지 발송·업로드 등은 승인 후에만 진행됩니다.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button disabled={deciding} onClick={() => decide("거절")} className="rounded-2xl border border-line bg-card px-3 py-2.5 text-sm text-ink-2">
                  거절
                </button>
                <button disabled={deciding} onClick={() => decide("승인 완료")} className="btn-brown rounded-2xl px-3 py-2.5 text-sm">
                  승인
                </button>
              </div>
            </section>
          )}

          {parents.length > 0 && (
            <section>
              <h3 className="mb-2 px-1 text-sm text-ink-2">상위 업무</h3>
              {parents.map((p) => (
                <MiniTask key={p.id} task={p} onOpen={() => onOpenTask(p.id)} />
              ))}
            </section>
          )}

          <section>
            <h3 className="mb-2 flex items-center justify-between px-1 text-sm text-ink-2">
              <span>보고 이력</span>
              <span className="text-[11px] text-muted">{reports.data ? `${reports.data.length}건 · 시간순` : ""}</span>
            </h3>
            {reports.error && <div className="mb-2 rounded-xl bg-[#fde4df] px-3 py-2 text-xs text-[#9b3426]">보고 이력을 불러오지 못했습니다: {reports.error}</div>}
            {!reports.data && reports.loading && <Empty>불러오는 중…</Empty>}
            {reports.data && reports.data.length === 0 && <Empty>아직 올라온 보고가 없습니다.</Empty>}
            {reports.data && reports.data.length > 0 && (
              <ol className="relative ml-3 border-l-2 border-dashed border-line pl-5">
                {reports.data.map((r) => (
                  <TimelineItem key={r.id} report={r} org={org} />
                ))}
              </ol>
            )}
          </section>

          <section>
            <h3 className="mb-2 px-1 text-sm text-ink-2">하위 업무 {children.length ? `(${children.length})` : ""}</h3>
            {children.length === 0 ? <Empty>하위 업무가 없습니다.</Empty> : children.map((c) => <MiniTask key={c.id} task={c} onOpen={() => onOpenTask(c.id)} />)}
          </section>
        </div>
      )}
    </Sheet>
  );
}

function TimelineItem({ report, org }: { report: TaskReport; org: Org }) {
  const st = report.stage ? STAGE_STYLE[report.stage] : { dot: "#a08a70", label: "" };
  return (
    <li className="relative mb-4 last:mb-0">
      <span className="absolute -left-[29px] top-3 h-3.5 w-3.5 rounded-full border-2 border-[var(--card)]" style={{ background: st.dot }} />
      <div className="card p-3.5">
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full px-2 py-0.5 text-white" style={{ background: st.dot }}>
            {report.stage ?? "보고"}
          </span>
          <span className="text-ink">{namesOf(org, report.reporterIds)}</span>
          <span className="text-muted">→ {report.recipient ?? "-"}</span>
          <span className="ml-auto text-muted">{fmtTime(report.reportedAt)}</span>
        </div>
        {report.summary && report.summary !== report.content && <div className="text-sm text-ink">{report.summary}</div>}
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{report.content}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {report.state && <StatePill state={report.state} />}
          {report.progress != null && <Chip>{pct(report.progress)}</Chip>}
          {report.staffReview && report.staffReview !== "미검토" && (
            <Chip tone={report.staffReview === "승인" ? "brown" : "alert"}>참모 {report.staffReview}</Chip>
          )}
          {report.resultUrl && (
            <a href={report.resultUrl} target="_blank" rel="noreferrer" className="text-xs text-brown underline">
              결과물
            </a>
          )}
          {report.code && <span className="ml-auto text-[10px] text-muted">{report.code}</span>}
        </div>
      </div>
    </li>
  );
}

function MiniTask({ task, onOpen }: { task: Task; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-2.5 text-left">
      <StatePill state={task.state} />
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{task.title}</span>
      <span className="text-xs tabular-nums text-ink-2">{pct(task.progress)}</span>
    </button>
  );
}
