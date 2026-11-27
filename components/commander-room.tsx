"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agentAbbr, superiorOf, userCanCommand, type Org } from "@/lib/chain-of-command";
import { api, fmtTime, type Resource } from "@/lib/client-api";
import { MEETING_ROOM, type Agent, type ChatMessage, type Task } from "@/lib/types";
import { workingAgents } from "@/lib/working";
import { filterMentions, mentionOptions, mentionQuery, MentionPicker, type MentionOption } from "./mention-picker";
import { PartnerList } from "./partner-list";
import type { BoardFilter } from "./task-board";
import { Chip } from "./ui";

export const APP_ICON: Record<string, string> = {
  Pickle: "🥒", Vooy: "🛶", Hark: "👂", Wabi: "🍵", Instinct: "⚡", "Meta Muse": "🎨", Hermes: "🪽", ChatGPT: "💬", Claude: "✳️",
};

const FAST_MS = 2000; // 보낸 직후 (에이전트 응답 기다리는 중)
const SLOW_MS = 6000; // 평소
const WAIT_LIMIT_MS = 180_000;

const CHAT_CACHE = "sforce-chat:v1:";
function readChatCache(room: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_CACHE + room);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}
function writeChatCache(room: string, list: ChatMessage[]) {
  try {
    localStorage.setItem(CHAT_CACHE + room, JSON.stringify(list.slice(-150)));
  } catch {}
}

/** 회의실 메시지: 노션 10이 원본. 화면엔 이 기기의 캐시를 먼저 보여 주고, 처음엔 최근 60개, 이후엔 since 이후만 붙인다. */
export function useChatRoom(room: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastAt = useRef<string | null>(null);
  const roomRef = useRef(room);

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const add = incoming.filter((m) => !seen.has(m.id));
      if (!add.length) return prev;
      const next = [...prev, ...add].sort((a, b) => a.at.localeCompare(b.at));
      lastAt.current = next.at(-1)?.at ?? lastAt.current;
      writeChatCache(roomRef.current, next);
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    const r = roomRef.current;
    const since = lastAt.current;
    try {
      const { data } = await api<ChatMessage[]>(`/api/chat?room=${encodeURIComponent(r)}${since ? `&since=${encodeURIComponent(since)}` : ""}`);
      if (roomRef.current !== r) return;
      merge(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [merge]);

  useEffect(() => {
    roomRef.current = room;
    lastAt.current = null; // 캐시가 있어도 처음 한 번은 노션에서 최근 기록을 다시 받는다
    setMessages(readChatCache(room));
    setLoading(true);
    void poll();
  }, [room, poll]);

  return { messages, loading, error, poll, merge };
}

/** 대화: 대회의실(전원) 또는 1:1. 에이전트는 앱 안의 AI 엔진으로 실시간 답하고, 업무 등록·배정·보고를 노션에 기록한다. */
export function Conversation({
  org,
  agents,
  partnerId,
  onPartner,
  tasks,
  toast,
  onOpenTask,
  onShowBoard,
  onShowReports,
}: {
  org: Org;
  agents: Agent[];
  partnerId: string | null; // MEETING_ROOM 또는 에이전트 ID
  onPartner: (id: string) => void;
  tasks: Resource<Task[]>;
  toast: (t: string, tone?: "ok" | "err") => void;
  onOpenTask: (id: string) => void;
  onShowBoard: (f: BoardFilter) => void;
  onShowReports: () => void;
}) {
  const room = partnerId && (partnerId === MEETING_ROOM || org.byId.has(partnerId)) ? partnerId : MEETING_ROOM;
  const isMeeting = room === MEETING_ROOM;
  const partner = isMeeting ? null : org.byId.get(room) ?? null;
  const { messages, loading, error, poll, merge } = useChatRoom(room);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState<{ names: string[]; since: number } | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const taskById = useMemo(() => new Map((tasks.data ?? []).map((t) => [t.id, t])), [tasks.data]);
  const canTalk = isMeeting || (partner ? userCanCommand(org, partner.id) : false);
  const boss = partner ? superiorOf(org, partner.id) : null;

  // 폴링: 기다리는 중이면 2초, 평소 6초. 탭이 숨겨지면 쉰다.
  useEffect(() => {
    const ms = waiting ? FAST_MS : SLOW_MS;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, ms);
    return () => clearInterval(id);
  }, [poll, waiting]);

  // 에이전트 메시지가 들어오면 업무 목록도 새로 (배정·보고가 바뀌었을 수 있음)
  const agentMsgCount = messages.filter((m) => m.senderId || m.kind === "알림").length;
  const reloadTasks = tasks.reload;
  useEffect(() => {
    if (agentMsgCount) void reloadTasks();
  }, [agentMsgCount, reloadTasks]);

  // 기다림 표시: 새 에이전트 메시지가 오면 시간을 늘리고, 오래 조용하면 끝낸다
  const lastAgentAt = [...messages].reverse().find((m) => m.senderId || m.kind === "알림")?.at ?? null;
  useEffect(() => {
    if (!waiting) return;
    if (lastAgentAt && Date.parse(lastAgentAt) > waiting.since) setWaiting((w) => (w ? { ...w, names: [], since: Date.parse(lastAgentAt) } : w));
  }, [lastAgentAt, waiting]);
  useEffect(() => {
    if (!waiting) return;
    const quiet = waiting.names.length ? WAIT_LIMIT_MS : 25_000;
    const t = setTimeout(() => setWaiting(null), quiet);
    return () => clearTimeout(t);
  }, [waiting]);
  useEffect(() => setWaiting(null), [room]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, room, waiting?.names.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    if (!canTalk) return toast("예비·중지 인원과는 대화할 수 없습니다.", "err");
    setSending(true);
    setText("");
    try {
      const { data } = await api<{ message: ChatMessage; waitingFor: string[] }>("/api/chat", { method: "POST", body: JSON.stringify({ room, text: body }) });
      merge([data.message]);
      setWaiting({ names: data.waitingFor, since: Date.parse(data.message.at) || Date.now() });
    } catch (e) {
      setText(body);
      toast(`전송 실패: ${e instanceof Error ? e.message : e}`, "err");
    } finally {
      setSending(false);
    }
  }

  // 읽음 표시: 방 멤버 중 그 메시지 이후에 아직 말하지 않은(=읽지 않은) 에이전트의 약칭
  const receipts = useMemo(() => {
    const lastPost = new Map<string, string>();
    for (const m of messages) if (m.senderId && (lastPost.get(m.senderId) ?? "") < m.at) lastPost.set(m.senderId, m.at);
    const base = isMeeting ? [org.commander, ...org.staff] : [partner];
    const members = new Map<string, Agent>();
    for (const a of base) if (a) members.set(a.id, a);
    for (const id of lastPost.keys()) {
      const a = org.byId.get(id);
      if (a) members.set(id, a);
    }
    const out = new Map<string, Agent[]>();
    for (const m of messages) {
      if (!m.senderId && m.senderName !== "사단장") continue; // 시스템 알림 제외
      out.set(m.id, [...members.values()].filter((a) => a.id !== m.senderId && (lastPost.get(a.id) ?? "") < m.at));
    }
    return out;
  }, [messages, isMeeting, org, partner]);

  // 작업 중 표시: 메시지 흐름으로 계산, 15초마다 만료 확인
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const working = useMemo(() => workingAgents(org, room, messages, now), [org, room, messages, now]);

  // @ 입력 시 대화 가능한 에이전트 목록 (대회의실)
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [mentionActive, setMentionActive] = useState(0);
  const [mentionClosed, setMentionClosed] = useState(false);
  const allMentions = useMemo(() => mentionOptions(org, agents), [org, agents]);
  const mq = isMeeting && canTalk && !mentionClosed ? mentionQuery(text, caret) : null;
  const mentionItems = mq ? filterMentions(allMentions, mq.query) : [];
  const pickMention = (o: MentionOption) => {
    if (!mq) return;
    const before = text.slice(0, mq.start);
    const after = text.slice(caret).replace(/^\S*/, "");
    const insert = `@${o.label} `;
    const next = `${before}${insert}${after.replace(/^\s/, "")}`;
    setText(next);
    const pos = before.length + insert.length;
    setCaret(pos);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  const mention = (name: string) => setText((t) => `${t.trimEnd()}${t.trim() ? " " : ""}@${name} `);
  const title = isMeeting ? "🏛️ 대회의실" : partner?.name ?? "";
  const icon = partner ? APP_ICON[partner.app ?? ""] ?? "🤖" : "🏛️";

  return (
    <div className="flex flex-col gap-3 md:grid md:grid-cols-[230px_minmax(0,1fr)] md:items-start md:gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <PartnerList org={org} agents={agents} tasks={tasks.data ?? []} selectedId={room} onSelect={onPartner} working={working} />

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 px-1">
          {!isMeeting && <span className="grid h-8 w-8 place-items-center rounded-full border border-line bg-card text-base">{icon}</span>}
          <span className="text-[15px] text-ink">{title}</span>
          <span className="text-xs text-muted">
            {isMeeting
              ? "대장·참모·부대원 전원 · @이름으로 부르기"
              : `${partner?.rank ?? ""} · ${partner?.unit ?? ""}${boss ? ` · 상관 ${boss.name}` : ""}`}
          </span>
          {!isMeeting && partner?.rank !== "대장" && canTalk && <Chip tone="warn">1:1 직접 대화</Chip>}
          {error && <Chip tone="alert">불러오기 실패</Chip>}
        </div>

        <div
          ref={feedRef}
          className="no-scrollbar flex max-h-[58dvh] min-h-[260px] flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-card-2/60 px-3 py-4 md:max-h-[calc(100dvh-340px)] md:min-h-[400px] lg:max-h-[calc(100dvh-300px)]"
        >
          {error && (
            <div className="rounded-2xl border border-[#e8b4aa] bg-[#fbe9e5] px-3 py-2 text-xs leading-relaxed text-[#9a3b2e]">
              ⚠️ 노션 10 회의실 대화에 연결하지 못했습니다. 대화가 저장·복원되지 않습니다.
              <br />
              <span className="text-[11px] opacity-80">{error}</span>
            </div>
          )}
          {!loading && messages.length === 0 && (
            <SystemLine>
              {isMeeting
                ? "대회의실입니다. 그냥 쓰면 대장 피클이 받고, @좌참 피클 · @HLagent처럼 이름을 부르면 그 에이전트가 답합니다. @all은 대장·참모 전원."
                : `${partner?.name}과(와)의 1:1 대화입니다. 일을 맡기면 업무로 등록되고 보고는 계통을 따라 올라갑니다.`}
            </SystemLine>
          )}
          {loading && messages.length === 0 && <SystemLine>대화를 불러오는 중…</SystemLine>}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const sep = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
            return (
              <div key={m.id} className="flex flex-col gap-3">
                {sep && (
                  <div className="mx-auto rounded-full border border-line bg-card px-3 py-0.5 text-[11px] text-muted">
                    {new Date(m.at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
                  </div>
                )}
                <MessageRow m={m} org={org} taskById={taskById} onOpenTask={onOpenTask} unread={receipts.get(m.id) ?? []} />
              </div>
            );
          })}
          {waiting && (
            <div className="flex items-center gap-2 px-1 text-xs text-muted">
              <span className="inline-flex gap-0.5">
                <Dot d={0} />
                <Dot d={150} />
                <Dot d={300} />
              </span>
              {waiting.names.length ? `${waiting.names.join(", ")} 답하는 중…` : "다음 에이전트가 이어서 처리하는 중…"}
            </div>
          )}
        </div>

        <div className="card p-3 sm:p-4">
          {isMeeting && (
            <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
              {[org.commander, ...org.staff].filter((a): a is Agent => Boolean(a)).map((a) => (
                <button key={a.id} onClick={() => mention(a.name)} className="shrink-0 rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink-2 hover:bg-brown-soft/50">
                  @{a.name}
                </button>
              ))}
              <button onClick={() => mention("all")} className="shrink-0 rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink-2 hover:bg-brown-soft/50">
                @all
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="relative min-w-0 flex-1">
            {mentionItems.length > 0 && (
              <MentionPicker items={mentionItems} active={Math.min(mentionActive, mentionItems.length - 1)} onPick={pickMention} onHover={setMentionActive} />
            )}
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setCaret(e.target.selectionStart ?? e.target.value.length);
                setMentionActive(0);
                setMentionClosed(false);
              }}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
              onBlur={() => setMentionClosed(true)}
              onFocus={() => setMentionClosed(false)}
              onKeyDown={(e) => {
                if (mentionItems.length && !e.nativeEvent.isComposing) {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const n = mentionItems.length;
                    setMentionActive((i) => (Math.min(i, n - 1) + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
                    return;
                  }
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    pickMention(mentionItems[Math.min(mentionActive, mentionItems.length - 1)]);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setMentionClosed(true);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={2000}
              disabled={!canTalk}
              placeholder={
                !canTalk
                  ? "예비·중지 인원과는 대화할 수 없습니다"
                  : isMeeting
                    ? "예: 이번 주 호텔 숏츠 후보 정리해줘 · @를 누르면 에이전트 목록"
                    : `${partner?.name}에게 메시지`
              }
              className="field w-full resize-none px-4 py-3 text-[15px] placeholder:text-muted"
            />
            </div>
            <button onClick={send} disabled={!text.trim() || sending || !canTalk} className="btn-brown shrink-0 whitespace-nowrap rounded-2xl px-4 py-3 text-[15px]">
              {sending ? "…" : "보내기"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button onClick={() => onShowBoard("all")} className="rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink-2">
              📋 업무 현황
            </button>
            <button onClick={() => onShowBoard("approval")} className="rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink-2">
              ✋ 승인 대기
            </button>
            <button onClick={onShowReports} className="rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink-2">
              📑 보고서
            </button>
            <span className="ml-auto text-[10px] text-muted">대화는 노션 10에 저장</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dot({ d }: { d: number }) {
  return <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b9946b]" style={{ animationDelay: `${d}ms` }} />;
}

function SystemLine({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[92%] rounded-2xl border border-dashed border-line bg-card/70 px-3 py-2 text-center text-xs leading-relaxed text-ink-2">{children}</div>;
}

const KIND_TONE: Record<string, string> = { 지시: "#f6e4c9", 배정: "#fbf1d6", 보고: "#e6eef9" };

/** 카카오톡의 안 읽은 숫자처럼, 아직 안 읽은 에이전트 약칭을 말풍선 옆에 표시 */
function Unread({ list, align }: { list: Agent[]; align: "left" | "right" }) {
  if (!list.length) return null;
  const shown = list.slice(0, 4).map(agentAbbr);
  return (
    <span
      className={`mb-0.5 flex shrink-0 flex-col gap-0 text-[10px] leading-tight text-[#c99a0e] ${align === "left" ? "items-end" : "items-start"}`}
      title={`안 읽음: ${list.map((a) => a.name).join(", ")}`}
    >
      <span>{shown.join(" ")}{list.length > 4 ? ` +${list.length - 4}` : ""}</span>
    </span>
  );
}

/** AI 답변의 **굵게** 표시를 실제 굵은 글씨로 보여 준다 (HTML 주입 없이 React 요소로만). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+?\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.length > 4 && p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          p
        ),
      )}
    </>
  );
}

function MessageRow({ m, org, taskById, onOpenTask, unread }: { m: ChatMessage; org: Org; taskById: Map<string, Task>; onOpenTask: (id: string) => void; unread: Agent[] }) {
  if (!m.senderId && m.senderName !== "사단장") return <SystemLine>{m.text}</SystemLine>;

  const tasks = m.taskIds.map((id) => taskById.get(id)).filter((t): t is Task => Boolean(t));
  const taskChips = tasks.length > 0 && (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tasks.map((t) => (
        <button key={t.id} onClick={() => onOpenTask(t.id)} className="rounded-full border border-line bg-card px-2 py-0.5 text-[11px] text-ink-2">
          📌 {t.code ? `#${t.code.match(/\d+/)?.[0] ?? t.code} ` : ""}
          {t.title.length > 18 ? `${t.title.slice(0, 18)}…` : t.title} · {t.state ?? "-"}
        </button>
      ))}
    </div>
  );

  if (!m.senderId) {
    return (
      <div className="ml-auto flex max-w-[88%] flex-col items-end lg:max-w-[75%]">
        <div className="flex items-end gap-1.5">
          <div className="flex flex-col items-end">
            <Unread list={unread} align="left" />
            <span className="text-[10px] text-muted">{fmtTime(m.at)}</span>
          </div>
          <div className="text-long min-w-0 whitespace-pre-wrap rounded-2xl rounded-tr-md border border-[#e2c49e] bg-[#f6e4c9] px-3.5 py-2.5 text-sm text-ink">{m.text}</div>
        </div>
      </div>
    );
  }

  const a = org.byId.get(m.senderId);
  const icon = APP_ICON[a?.app ?? ""] ?? "🤖";
  const compact = m.kind === "배정" || m.kind === "지시" || m.kind === "보고";
  return (
    <div className="flex max-w-[94%] items-start gap-2 lg:max-w-[82%]">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#d9e7c7] bg-[#eef6e2] text-lg">{icon}</div>
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-ink">{m.senderName}</span>
          {a && <span className="rounded bg-brown-soft/70 px-1 text-[10px] text-brown-2">{agentAbbr(a)}</span>}
          {m.kind && m.kind !== "대화" && <span className="text-muted">· {m.kind}</span>}
        </div>
        <div className="flex items-end gap-1.5">
        <div
          className={`text-long whitespace-pre-wrap rounded-2xl rounded-tl-md border border-line px-3.5 py-2.5 leading-relaxed text-ink ${compact ? "text-[13px]" : "text-sm"}`}
          style={{ background: (compact && KIND_TONE[m.kind ?? ""]) || "var(--color-card, #fffaf2)" }}
        >
          <RichText text={m.text} />
          {taskChips}
        </div>
          <div className="flex flex-col items-start">
            <Unread list={unread} align="right" />
            <span className="whitespace-nowrap text-[10px] text-muted">{fmtTime(m.at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
