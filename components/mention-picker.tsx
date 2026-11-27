"use client";

import { agentAbbr, commandGroups, userCanCommand, type Org } from "@/lib/chain-of-command";
import { type Agent } from "@/lib/types";

export interface MentionOption {
  key: string;
  label: string; // @ 뒤에 들어갈 이름
  sub: string; // 계급·소속
  abbr: string;
  group: string;
}

/** 대화 가능한(사단장이 지시할 수 있는) 에이전트 + @all, 조직 순서대로 */
export function mentionOptions(org: Org, agents: Agent[]): MentionOption[] {
  const out: MentionOption[] = [{ key: "all", label: "all", sub: "대장·참모 전원", abbr: "ALL", group: "전체" }];
  for (const g of commandGroups(org, agents)) {
    for (const { agent } of g.members) {
      if (!userCanCommand(org, agent.id)) continue;
      out.push({ key: agent.id, label: agent.name, sub: `${agent.rank ?? ""}${agent.unit ? ` · ${agent.unit}` : ""}`, abbr: agentAbbr(agent), group: g.label });
    }
  }
  return out;
}

/** 커서 바로 앞이 "@검색어"이면 그 위치와 검색어를 돌려준다 */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const m = text.slice(0, caret).match(/(^|\s)@([^\s@]*)$/);
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}

export function filterMentions(options: MentionOption[], query: string): MentionOption[] {
  const q = query.replace(/\s/g, "").toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.label.replace(/\s/g, "").toLowerCase().includes(q) || o.abbr.toLowerCase().startsWith(q));
}

export function MentionPicker({ items, active, onPick, onHover }: { items: MentionOption[]; active: number; onPick: (o: MentionOption) => void; onHover: (i: number) => void }) {
  if (!items.length) return null;
  let lastGroup = "";
  return (
    <div
      role="listbox"
      className="no-scrollbar absolute bottom-full left-0 z-20 mb-2 max-h-[300px] w-[min(320px,100%)] overflow-y-auto rounded-2xl border border-line bg-card p-1.5 shadow-lg"
    >
      {items.map((o, i) => {
        const header = o.group !== lastGroup ? o.group : null;
        lastGroup = o.group;
        return (
          <div key={o.key}>
            {header && <div className="px-2 pb-0.5 pt-1.5 text-[10px] text-muted">{header}</div>}
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              // textarea 포커스를 잃지 않도록 mousedown에서 선택
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(o);
              }}
              onMouseEnter={() => onHover(i)}
              className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] ${i === active ? "bg-[#f6e4c9] text-brown-2" : "text-ink"}`}
            >
              <span className="w-9 shrink-0 rounded bg-brown-soft/70 px-1 text-center text-[10px] text-brown-2">{o.abbr}</span>
              <span className="truncate">@{o.label}</span>
              <span className="ml-auto shrink-0 text-[11px] text-muted">{o.sub}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
