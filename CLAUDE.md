# KingLand Bureau — Claude 작업 안내

노션을 유일한 원본으로 쓰는 1인용 AI 비서처 웹앱 (Next.js 15 · Vercel).
사단장(사용자) → 대장 피클 → 좌참 피클(Vermilion)·우참 피클(Sapphire) → 부대원.

## 설치·배포 요청을 받으면
`.claude/skills/kingland-setup/SKILL.md`(명령: `/kingland-setup`)를 따라 한 단계씩 진행한다.
사람용 문서: `docs/INSTALL.md`(설치 안내서), `docs/PROMPTS.md`(다른 AI에 붙여 넣는 단계별 프롬프트), `docs/agent-instructions.md`(외부 AI 앱 연결).

## 규칙
- 키·토큰·비밀번호 값은 채팅으로 받거나 출력하지 않는다. `.env.local`·Vercel 설정 칸에 사용자가 직접 넣는다. `.env*`는 커밋하지 않는다.
- 노션 속성 이름이 코드와 다르면 **코드를 노션에 맞춘다**. DB 이름의 번호(02·04·05·09·10)로 DB를 찾으므로 번호를 바꾸지 않는다.
- 09 업무 보고 이력·10 회의실 대화는 추가만 한다 (수정·삭제 금지).
- 연결 채널은 노션만 쓴다 (Slack·이메일 없음).

## 구조 요약
| 위치 | 역할 |
|---|---|
| `scripts/setup-notion.mjs` | 노션 DB 5개 자동 생성 + 기본 조직 등록 (`npm run setup:notion`, 부대원은 `scripts/crew.json`이 있으면 그걸로) |
| `lib/notion-store.ts` | 노션 REST 어댑터. `NOTION_ROOT_PAGE_ID` 아래에서 DB를 이름 번호로 찾음 |
| `lib/agent-engine.ts` | 회의실 AI 엔진 (OpenAI 또는 Vercel AI Gateway) — 업무 등록·배정·보고·평가 |
| `lib/chain-of-command.ts` | 지휘·보고 규칙 (한 곳에만) |
| `lib/office-scene.ts` · `components/office-view.tsx` | 실시간 사무실 (3D/평면/도면) |
| `lib/track-record.ts` | 참모 평가 누적 → 잘하는 분야 배정 |
| `lib/mock-store.ts` · `lib/fake-model.ts` | 노션·AI 없이 개발할 때의 목업 |
