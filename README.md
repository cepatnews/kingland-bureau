# KingLand Bureau 🏢

**노션 하나로 굴러가는 나만의 AI 비서처.** 내가 지시하면 대장 AI가 받아 참모 AI들에게 나누고, 참모는 부대원 AI에게 일을 맡겨 결과를 검토·취합해 다시 보고합니다. 모든 지시·보고·대화는 내 노션에 쌓이고, 웹앱(휴대폰 포함)에서 실시간으로 봅니다.

![실시간 사무실](public/office/office-3d.webp)

```
사단장(나) → 대장 피클 → 좌참 피클 (Vermilion 부대: VL·HL·WL·IL agent)
                       → 우참 피클 (Sapphire 부대: VR·HR·WR·IR agent)
```

## 할 수 있는 것
- 💬 **회의실 채팅** — 대회의실에 쓰면 대장이 받고, `@좌참 피클`·`@IRagent`처럼 부르면 그 에이전트가 답합니다. `@`를 누르면 대화 가능한 에이전트 목록이 뜹니다. 카톡처럼 누가 안 읽었는지 약칭(GC·LC·RC·VL…)으로 보여 줍니다.
- 📌 **자동 업무 흐름** — 대장이 업무를 등록(노션 04) → 참모에게 배정 → 참모가 부대원에게 배정 → 부대원 보고(09) → 참모 검토·평가 → 대장 최종 보고. 아래 사람이 다 보고하기 전에는 완료 보고가 막힙니다.
- 📊 **실적 기반 배정** — 참모가 결과물을 분야별 1~5점으로 평가해 쌓고, 잘하는 분야(★)는 그 에이전트에게, 평가가 없는 분야는 두 명에게 시험 삼아 맡겨 비교합니다.
- 🏢 **실시간 사무실** — 지시 중인 대장·참모는 회의실로, 일하는 부대원은 자기 자리로, 일 없는 인원은 탕비실·라운지로 실제 업무 흐름대로 움직입니다 (🧊 3D / 🎨 평면 / 📐 도면).
- 🧩 **구성 선택** — 간단 구성(대장 + 에이전트 몇 명이 바로 보고)이나 풀 구성(대장 → 참모 2 → 부대원) 중 골라 설치합니다.
- 📑 **보고 방식 선택** — 3줄 요약·상세·표 형식, 업무 끝날 때마다 또는 매일 정해진 시각에 일일 보고서(노션 05)로. 마감 자동 설정과 지연 표시.
- 📋 업무 현황(한 줄 목록·카드) · 승인 대기 · 최종 보고서 · 에이전트 관리 · 휴대폰 반응형 · 비밀번호 잠금.

## 설치 방법 고르기
| 방법 | 이런 분께 | 문서 |
|---|---|---|
| 🤖 **Claude Code에 맡기기** | 가장 쉬움. `/kingland-setup` 한 줄 | 아래 |
| 💬 **아무 AI 채팅에 프롬프트 붙여 넣기** | ChatGPT·Claude 웹 등에서 하나씩 정하며 진행 | [단계별 프롬프트](docs/PROMPTS.md) |
| 📖 **직접 따라 하기** | 화면 설명을 보며 직접 | [설치 안내서](docs/INSTALL.md) |

## 설치 — Claude에게 맡기기 (추천)
1. 이 저장소에서 **Use this template → Create a new repository**로 내 저장소를 만들고 내 컴퓨터로 받습니다.
2. [Claude Code](https://claude.com/claude-code)로 그 폴더를 열고 이렇게 말합니다:
   ```
   /kingland-setup
   ```
3. Claude가 처음부터 배포까지 한 단계씩 안내합니다. 계정 만들기·키 발급처럼 **본인이 해야 하는 부분에서만** 멈추고, 나머지(설치·노션 DB 생성·확인)는 Claude가 직접 합니다.

## 설치 — 직접 하기 (요약)
자세한 화면 설명과 오류 대처는 **[설치 안내서](docs/INSTALL.md)** 를 보세요.
준비물: Node.js 20+, GitHub · 노션 · Vercel · OpenAI 계정.

1. **노션 준비**
   - 빈 페이지 하나 만들기 (예: `AI SForce 본부`) — 여기에 DB가 자동으로 생깁니다.
   - [통합 만들기](https://www.notion.so/profile/integrations) → 내부 통합, 기능: 읽기·업데이트·입력 → **내부 통합 시크릿** 복사.
   - 본부 페이지 **••• → 연결**에 그 통합 추가 → 페이지 **링크 복사**.
2. **설정 파일**
   ```bash
   npm install
   cp .env.example .env.local   # NOTION_TOKEN, NOTION_ROOT_PAGE_ID, APP_PASSWORD, OPENAI_API_KEY 채우기
   ```
3. **노션 DB 자동 생성** (부대원을 직접 정하려면 먼저 `cp scripts/crew.example.json scripts/crew.json` 후 수정)
   ```bash
   npm run setup:notion
   ```
   02 조직도 · 04 업무 · 05 최종 보고서 · 09 보고 이력 · 10 회의실 대화 + 기본 조직 11명이 만들어집니다 (다시 실행해도 안전).
4. **확인**: `npm run dev` → http://localhost:3000 → 로그인 → 🟢 노션 실시간 연결 → 대회의실에 `너에 대해서 짧게 말해봐`.
5. **배포**:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcepatnews%2Fkingland-bureau&project-name=kingland-bureau&env=NOTION_TOKEN,NOTION_ROOT_PAGE_ID,APP_PASSWORD,OPENAI_API_KEY&envDescription=%EB%85%B8%EC%85%98%20%ED%86%B5%ED%95%A9%20%EC%8B%9C%ED%81%AC%EB%A6%BF%2C%20%EB%B3%B8%EB%B6%80%20%ED%8E%98%EC%9D%B4%EC%A7%80%20%EB%A7%81%ED%81%AC%2C%20%EC%95%B1%20%EB%B9%84%EB%B0%80%EB%B2%88%ED%98%B8%2C%20ChatGPT%20API%20%ED%82%A4&envLink=https%3A%2F%2Fgithub.com%2Fcepatnews%2Fkingland-bureau%23%ED%99%98%EA%B2%BD%EB%B3%80%EC%88%98)

   또는 Vercel에서 내 저장소를 Import → 환경변수 4개 입력(Production 체크) → Deploy. **환경변수를 바꾸면 Redeploy** 해야 적용됩니다.

## 환경변수
| 이름 | 필수 | 내용 |
|---|---|---|
| `NOTION_TOKEN` | ✅ | 노션 내부 통합 시크릿 (`ntn_…`) |
| `NOTION_ROOT_PAGE_ID` | ✅ | 노션 본부 페이지 링크 또는 32자리 ID — 앱이 이 아래에서 `02`·`04`·`05`·`09`·`10`으로 시작하는 DB를 찾습니다 |
| `APP_PASSWORD` | ✅ | 앱 로그인 비밀번호 (노션 토큰이 있는데 이게 없으면 앱이 잠깁니다) |
| `OPENAI_API_KEY` | 권장 | 회의실 AI 에이전트 (ChatGPT) |
| `OPENAI_MODEL` | | 기본 `gpt-5.5` — 계정에서 쓸 수 있는 모델로 |
| `NEXT_PUBLIC_ORG_NAME` | | 화면에 보일 조직 이름 (기본 `KingLand Bureau`) |
| `REPORT_STYLE` | | 보고 형식 `brief`(3줄, 기본) · `detailed` · `table` |
| `REPORT_TIMING` | | 보고 시점 `each`(끝날 때마다, 기본) · `daily`(매일 정리) · `both` |
| `DEFAULT_DUE_DAYS` | | 마감 안 정한 업무의 기본 마감(일). 비우면 없음 |
| `CRON_SECRET` | | 매일 보고(daily/both) 쓸 때 Vercel Cron 보안 문자열. 보고 시각은 `vercel.json` (UTC) |
| `AI_GATEWAY_API_KEY`, `AI_MODEL` | | OpenAI 대신 Vercel AI Gateway 사용 시 |

## 자주 막히는 곳
| 증상 | 해결 |
|---|---|
| 화면에 **목업 모드** | Vercel **Production**에 `NOTION_TOKEN`이 없음 → 넣고 **Redeploy** |
| "DB를 찾지 못했습니다" | `npm run setup:notion`을 안 했거나, 본부 페이지에 통합이 연결 안 됨, 또는 `NOTION_ROOT_PAGE_ID`가 다른 페이지 |
| 대화가 로그인할 때마다 사라짐 | 노션 연결 문제 (위 두 줄 확인) |
| "AI 인증 실패 / 크레딧 부족 / 모델 없음" | `OPENAI_API_KEY`·결제 확인, `OPENAI_MODEL` 변경 |
| 외부 AI 앱이 "했다"는데 노션 값이 그대로 | 실제로 못 쓴 것 → [외부 앱 연결 지침](docs/agent-instructions.md)의 읽기 테스트부터 |

## 노션 구조 (자동 생성)
| DB | 내용 |
|---|---|
| 02 조직도 및 역할 | 에이전트 명단 · 계급 · 소속 · 상관 · 연결 방식 · 상태 · 역할 · 강점·역량 |
| 04 AI 공용 업무 DB | 업무 · 담당 참모/AI · 상태(7단계) · 진행률 · 승인 · 검수 |
| 05 최종 보고서 | 대장의 일일·주간·긴급 종합 보고 |
| 09 업무 보고 이력 | 보고 한 줄씩 (추가만) · 참모 평가 `[평가]` 줄 포함 |
| 10 회의실 대화 | 회의실 대화 기록 (추가만) |

에이전트 이름·앱(02 조직도)은 노션에서 바로 바꾸면 앱에 반영됩니다. `역할`·`강점·역량`을 채울수록 배정이 똑똑해집니다.

## 개발
```bash
npm run dev          # 노션 토큰이 없으면 목업 모드
SFORCE_FAKE_AI=1 npm run dev   # AI 키 없이 가짜 AI로 업무 흐름만 확인
npx tsc --noEmit && npx eslint .
```
구조는 [CLAUDE.md](CLAUDE.md)를 참고하세요. 사무실 일러스트·캐릭터는 AI로 생성한 이미지입니다 (`public/office/`).

## 라이선스
[MIT](LICENSE) — 자유롭게 복사·수정·배포·상업적 이용이 가능합니다. 저작권 표시와 라이선스 문구만 함께 남겨 주세요.
