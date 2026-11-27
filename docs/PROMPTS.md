# 단계별 설치 프롬프트 (LLM용)

AI에게 설치를 맡길 때 **아래 프롬프트를 순서대로 하나씩** 붙여 넣으세요. 각 단계마다 AI가 한 번에 하나씩 물어보며 함께 정하고, 끝나면 다음 단계로 넘어갑니다.

| 쓰는 AI | 방식 |
|---|---|
| **Claude Code** (추천) | 저장소 폴더에서 실행하면 명령·파일 작업을 AI가 직접 합니다. 사실 `/kingland-setup` 한 줄이면 아래 전체를 자동으로 진행합니다. |
| ChatGPT·Claude 웹 등 채팅 AI | AI는 안내만 하고, 명령은 내가 터미널에 직접 입력합니다. 결과 화면을 복사해 AI에게 보여 주면 다음을 알려 줍니다. |

> ⚠️ **어떤 단계에서도 키·토큰·비밀번호 값을 AI 채팅에 붙여 넣지 마세요.** 값은 `.env.local` 파일이나 Vercel 설정 칸에 직접 넣습니다. 아래 프롬프트는 AI가 값을 묻지 않도록 만들어져 있습니다.

---

## STEP 0 — 시작 (설치 도우미 역할 정하기)

```
너는 지금부터 "KingLand Bureau" 설치 도우미야.
KingLand Bureau는 노션을 데이터베이스로 쓰는 Next.js 웹앱이고, 저장소는 https://github.com/cepatnews/kingland-bureau 야.
나는 개발자가 아니야. 아래 규칙으로 진행해 줘.

[진행 규칙]
- 한 번에 한 단계, 한 번에 질문 하나만 해. 내가 답하면 다음으로 넘어가.
- 내가 정해야 하는 건 보기를 2~4개 주고 추천을 표시해 줘.
- 명령을 실행할 수 있으면 직접 실행하고 결과를 짧게 알려 줘. 못 하면 내가 터미널에 칠 명령을 코드 블록으로 하나씩 줘.
- 단계가 끝날 때마다 "✅ STEP n 완료"와 다음 STEP 이름을 말해 줘.

[보안 규칙]
- 키·토큰·비밀번호 값을 절대 채팅으로 달라고 하지 마. 내가 붙여 넣으려 하면 막고, .env.local 파일이나 Vercel 설정 칸에 직접 넣으라고 안내해.
- .env.local 내용을 출력하지 마. 확인은 "채워짐/비어 있음"으로만.
- 내 노션의 기존 페이지는 지우거나 고치지 마.

먼저 내 상황을 파악하게 질문을 시작해 줘: 쓰는 컴퓨터(맥/윈도우), Node.js·Git 설치 여부, GitHub·노션·Vercel·OpenAI 계정 유무를 하나씩 물어봐.
```

## STEP 1 — 이름과 구성 정하기

```
STEP 1: 설치 전에 정할 것들을 나와 함께 하나씩 정하자. 질문은 하나씩.
1) 화면에 보일 조직 이름 (기본: KingLand Bureau)
2) 노션 본부 페이지 이름 (기본: AI SForce 본부)
3) 부대원 구성: 
   A. 기본 8명 그대로 (Vermilion: VLagent·HLagent·WLagent·ILagent / Sapphire: VRagent·HRagent·WRagent·IRagent) — 추천
   B. 내가 직접 정하기 → 그러면 부대원마다 이름, 부대(Vermilion=좌참 / Sapphire=우참), 쓰는 앱, 맡을 역할(선택), 잘하는 것(선택)을 차례로 물어봐 줘. 부대당 4명 이하를 권장해 줘.
4) AI 모델 (기본: gpt-5.5, 계정에서 못 쓰면 다른 모델)
고정된 것(지휘 구조, 부대 이름 Vermilion·Sapphire, 대장 피클·좌참 피클·우참 피클 이름)은 바꿀 수 없다고 미리 알려 줘.
다 정하면 정한 내용을 표로 요약하고, 3)에서 B를 골랐다면 scripts/crew.json 내용(JSON 배열)을 만들어 줘.
```

## STEP 2 — 내 저장소 만들기

```
STEP 2: 내 GitHub 저장소를 만들고 내 컴퓨터로 받자.
- GitHub CLI(gh)가 있으면 gh repo create <이름> --template cepatnews/kingland-bureau --private --clone 로,
  없으면 웹에서 "Use this template → Create a new repository" 를 누르는 법을 알려 주고 git clone 명령을 줘.
- 저장소 이름은 나에게 물어봐 (추천: my-bureau).
- 받은 뒤 그 폴더에서 npm install 까지 진행해 줘.
- STEP 1에서 crew.json을 만들었다면 scripts/crew.json 으로 저장해 줘 (직접 못 하면 저장 방법을 알려 줘).
```

## STEP 3 — 노션 준비 (내가 직접)

```
STEP 3: 노션 준비를 안내해 줘. 이건 내가 직접 해야 하니 한 단계씩 기다려 줘.
1) STEP 1에서 정한 이름으로 빈 페이지 만들기
2) https://www.notion.so/profile/integrations 에서 내부 통합 만들기 (기능: 읽기·업데이트·입력, 사용자 정보 없음)
3) 본부 페이지 ••• → 연결 → 그 통합 추가  (가장 많이 빠뜨리니 꼭 확인해 줘)
4) 통합의 "내부 통합 시크릿"과 본부 페이지 "링크"는 복사만 해 두고 채팅에는 붙여 넣지 말라고 다시 말해 줘.
각 항목을 끝냈는지 하나씩 물어봐.
```

## STEP 4 — 설정 파일 (.env.local)

```
STEP 4: 설정 파일을 만들자.
- cp .env.example .env.local 을 실행(또는 안내)하고, 내가 텍스트 편집기로 열 수 있게 도와줘 (맥: open -e .env.local).
- 내가 직접 채울 칸: NOTION_TOKEN, NOTION_ROOT_PAGE_ID, APP_PASSWORD, OPENAI_API_KEY, 그리고 STEP 1에서 정한 NEXT_PUBLIC_ORG_NAME·OPENAI_MODEL.
- 각 값이 어디서 오는지 한 줄씩 알려 줘. (OPENAI_API_KEY: platform.openai.com → API keys)
- 내가 다 넣었다고 하면, 값은 출력하지 말고 채워졌는지만 확인해 줘. 실행할 수 있으면 이 명령을 써:
  node -e 'const t=require("fs").readFileSync(".env.local","utf8");for(const k of ["NOTION_TOKEN","NOTION_ROOT_PAGE_ID","APP_PASSWORD","OPENAI_API_KEY"]){const m=t.match(new RegExp("^"+k+"=(.*)$","m"));console.log(k.padEnd(20), m&&m[1].trim()?"채워짐":"비어 있음")}'
```

## STEP 5 — 노션 DB 자동 생성

```
STEP 5: npm run setup:notion 을 실행(또는 안내)해 줘.
- 성공하면 노션 본부 페이지에 DB 5개(02 조직도 및 역할, 04 AI 공용 업무 DB, 05 최종 보고서, 09 업무 보고 이력, 10 회의실 대화)와 조직도 인원이 생겼는지 확인하게 해 줘.
- 오류가 나면: 401이면 시크릿 재복사, 404면 STEP 3의 페이지 연결 확인, "자동 번호" 경고는 무시해도 된다고 알려 줘.
- 결과 화면을 보고 다음으로 갈지 판단해 줘.
```

## STEP 6 — 내 컴퓨터에서 확인

```
STEP 6: npm run dev 로 앱을 켜고 확인하자.
- http://localhost:3000 에서 APP_PASSWORD로 로그인
- 왼쪽 위가 "노션 실시간 연결"인지 (목업 모드면 원인과 해결을 알려 줘)
- 대화 탭 대회의실에 "너에 대해서 짧게 말해봐" → 대장 피클이 답하는지
- 노션 10 회의실 대화에 기록이 쌓였는지
하나씩 확인하고, 안 되면 원인을 같이 찾아 줘. 브라우저를 직접 볼 수 있으면 직접 확인해 줘.
```

## STEP 7 — 인터넷 배포 (Vercel)

```
STEP 7: Vercel에 배포하자.
- 내 저장소가 GitHub에 올라가 있는지 확인 (안 올라갔으면 git push 안내)
- https://vercel.com/new 에서 내 저장소 Import
- Environment Variables에 STEP 4와 같은 값을 내가 직접 넣게 안내 (Production 체크 강조). 값은 채팅에 쓰지 말라고 다시 말해 줘.
- Deploy 후 생긴 주소로 로그인해서 STEP 6과 같은 확인
- "환경변수를 바꾸면 Redeploy 해야 적용된다", "같은 저장소로 Vercel 프로젝트가 두 개 생기지 않게" 를 알려 줘.
```

## STEP 8 — 마무리와 사용법

```
STEP 8: 마무리해 줘.
- 내 배포 주소, 로그인 방법, 휴대폰 홈 화면에 추가하는 법
- 대회의실에서 일 맡기는 법 (@로 에이전트 부르기), 업무 현황·오피스 탭
- 노션 02 조직도의 역할·강점·역량을 채우면 배정이 좋아진다는 점, 쉬게 할 에이전트는 상태를 '중지'로
- 오늘 정한 설정(조직 이름, 부대원 구성, 모델)을 표로 정리해서 보여 줘
그리고 외부 AI 앱(기기)을 노션에 직접 연결하고 싶은지 물어보고, 원하면 docs/agent-instructions.md 대로 안내해 줘.
```

---

## (선택) 나중에 쓰는 프롬프트

**부대원 추가**
```
노션 02 조직도에 부대원을 한 명 추가하고 싶어. 이름, 부대(Vermilion/Sapphire), 앱, 역할, 잘하는 것을 하나씩 물어보고,
노션에서 어떤 칸에 무엇을 넣으면 되는지 알려 줘 (계급=실무, 상관=그 부대 참모, 상태=인터뷰 전, 연결 방식=수동).
```

**문제 해결**
```
KingLand Bureau가 이상해. 증상: <여기에 증상>.
docs/INSTALL.md 의 "문제 해결" 표를 기준으로 원인을 하나씩 확인해 줘. 키 값은 묻지 말고, 채워졌는지만 확인해 줘.
```
