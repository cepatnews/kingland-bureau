---
name: kingland-setup
description: KingLand Bureau(노션 기반 AI 비서처 웹앱)를 처음부터 끝까지 설치한다 — 노션 통합·본부 페이지 준비, .env.local 작성, 노션 DB 자동 생성, 로컬 실행 확인, Vercel 배포, 첫 대화 테스트, 외부 에이전트 연결 안내. "설치해줘", "세팅해줘", "배포해줘", "처음부터 해줘", "kingland setup"이라고 하면 이 스킬을 쓴다.
---

# KingLand Bureau 설치 안내 (Claude 진행용)

사용자는 개발자가 아닐 수 있다. **한 번에 한 단계씩**, 쉬운 한국어로 안내하고, 각 단계가 끝났는지 확인한 뒤 다음으로 간다.
Claude가 할 수 있는 일(명령 실행·파일 만들기·확인)은 직접 하고, **계정 만들기·키 발급·비밀번호 입력처럼 본인만 할 수 있는 일에서만 멈춘다.**

## 절대 규칙 (보안)
- **키·토큰·비밀번호 값을 채팅으로 받지 않는다.** 사용자가 붙여 넣으려 하면 막고, `.env.local` 파일이나 Vercel 설정 칸에 **직접** 넣게 안내한다.
- `.env.local` 내용을 화면에 출력하지 않는다. 값이 들어갔는지 확인할 때는 아래 "키 확인" 명령처럼 **채워짐/비어 있음만** 출력한다.
- `.env*` 파일은 절대 git에 커밋하지 않는다 (.gitignore에 이미 있음).
- 사용자 노션의 기존 페이지·DB를 지우거나 고치지 않는다. 세팅 스크립트는 본부 페이지 아래에 **새로 만들기만** 한다.
- Slack·이메일 연동은 안내하지 않는다. 연결은 **노션만** 쓴다.

## 0단계. 준비물 확인
처음 하는 사용자에게는 이 저장소의 안내서를 기준으로 화면 하나씩 같이 한다: `docs/PREREQUISITES.md`(전체), `docs/GIT.md`(Git·GitHub·gh), `docs/NOTION.md`(노션 가입·본부 페이지·통합·연결). 사용자가 막히면 해당 문서의 "자주 막히는 곳" 표를 먼저 본다.
다음을 확인하고, 없는 것만 설치를 안내한다.
```bash
node -v   # 20 이상
git --version
```
계정: GitHub, 노션(Notion), Vercel(GitHub로 가입 가능), OpenAI(ChatGPT API 키 — 결제 수단 등록 필요). 없으면 각 사이트에서 가입하라고 안내한다.

## 0.5단계. 먼저 함께 비서처 설계하기 (질문은 하나씩, 보기 + 추천)
`docs/PROMPTS.md`의 STEP 1과 같은 순서로 묻는다.
1. **회사 정보**: 회사(조직) 이름 → `NEXT_PUBLIC_ORG_NAME`, 로고 이미지가 있는지 (있으면 파일 위치를 물어본다: 바탕화면에 있으면 끌어다 놓거나 경로를 알려 달라고 한다. 없으면 👑 기본 아이콘, 나중에 앱 왼쪽 위 로고를 눌러 올릴 수 있다고 알려 준다), 노션 본부 페이지 이름
2. **구성 방식** (대장 피클은 항상 있음):
   - **A. 간단 구성** — 참모 없이 대장 피클에게 에이전트 몇 명이 바로 보고 (예: 와비·부이·키링). 혼자 쓰거나 앱이 몇 개뿐이면 추천.
   - **B. 풀 구성** — 대장 → 좌참·우참 피클 → 부대원.
   흐름 한 줄씩 보여 준다. A: 사단장→대장→에이전트→대장→사단장 / B: 사단장→대장→참모→부대원→참모→대장→사단장
3. **에이전트**: A면 몇 명인지, 한 명씩 이름·앱·역할·잘하는 것 / B면 기본 8명 그대로인지 직접 정할지(직접이면 이름·부대·앱·역할). 고정: 대장 피클·좌참 피클·우참 피클 이름, 부대 이름 Vermilion·Sapphire.
4. **보고 형식** `REPORT_STYLE`: brief(3줄, 추천) / detailed / table — 짧은 예시와 함께
5. **보고 받는 때** `REPORT_TIMING`: each(추천) / daily / both. daily·both면 받을 시각(한국 시간)을 묻고 `vercel.json` schedule(UTC)로 바꾼다 (18:00→`0 9 * * *`). 무료 플랜은 하루 1번·최대 1시간 지연.
6. **기본 마감** `DEFAULT_DUE_DAYS`: 없음(추천) / 0 / 3 / 7 — 그리고 진행 기록(09 보고 이력 타임라인, 7단계 상태, 지연 표시)을 짧게 설명
7. **AI 모델** `OPENAI_MODEL` (기본 gpt-5.5)

정한 내용을 표로 요약해 확인받은 뒤:
- 간단 구성이거나 에이전트를 직접 정했으면 `scripts/crew.json` 작성 (`{ "structure": "simple"|"full", "members": [...] }`, 예시: `scripts/crew.simple.example.json`, `scripts/crew.example.json`)
- 운영 설정(비밀 아님)은 3단계에서 `.env.local`에 Claude가 직접 넣어도 된다: `NEXT_PUBLIC_ORG_NAME`, `OPENAI_MODEL`, `REPORT_STYLE`, `REPORT_TIMING`, `DEFAULT_DUE_DAYS`
- daily·both면 `vercel.json`의 schedule 수정

## 1단계. 내 저장소로 코드 가져오기
- **설치 파일(KingLand-Setup.command / .bat)로 시작한 경우**: 코드와 `npm install`은 이미 끝나 있고, 원본 연결은 `template`이라는 이름으로 바뀌어 있다 (`git remote -v`로 확인). 배포(Vercel)에 쓸 **내 GitHub 저장소**만 만들면 된다:
  - `gh`가 있고 로그인돼 있으면: 저장소 이름을 물어보고 `gh repo create <이름> --private --source . --remote origin --push`
  - 없으면: github.com/new 에서 **빈 Private 저장소**를 만들게 하고, `git remote add origin <주소>` → `git push -u origin main`
  - 이 단계는 6단계(배포) 직전에 해도 된다. 로컬 확인(5단계)까지는 저장소 없이 가능.
- 이 폴더 밖에서 시작했다면: `gh repo create <이름> --template cepatnews/kingland-bureau --private --clone` 또는 GitHub에서 **Use this template**로 만든 뒤 `git clone` → `npm install`.

## 2단계. 노션 준비 (사용자가 직접 — 자세한 화면은 `docs/NOTION.md`)
1. **본부 페이지 만들기**: 노션에서 빈 페이지를 하나 만든다 (이름 예: `AI SForce 본부`). 이 페이지 아래에 DB들이 자동으로 생긴다.
2. **통합 만들기**: https://www.notion.so/profile/integrations → **새 통합** → 이름(예: `KingLand App`), 유형 **내부** → 저장.
   - 기능: 콘텐츠 읽기·업데이트·입력 ✅, 사용자 정보 없음.
   - **구성** 탭의 **내부 통합 시크릿**(ntn_…)이 `NOTION_TOKEN` 이다. 아직 복사만 해 둔다.
3. **페이지에 통합 연결**: 본부 페이지 오른쪽 위 **•••** → **연결** → 방금 만든 통합 추가. (가장 많이 빠뜨리는 단계)
4. 본부 페이지 **링크 복사**(••• → 링크 복사). 이것이 `NOTION_ROOT_PAGE_ID` 다 (링크 그대로 넣어도 됨).

## 3단계. `.env.local` 작성 (값은 사용자가 직접)
Claude가 파일만 만든다:
```bash
[ -f .env.local ] || cp .env.example .env.local
```
그리고 사용자에게 에디터로 `.env.local`을 열어 (맥 `open -e .env.local`, 윈도우 `notepad .env.local`) 아래 4개를 **직접** 채우게 한다:
`NOTION_TOKEN`, `NOTION_ROOT_PAGE_ID`, `APP_PASSWORD`(앱 로그인 비밀번호, 직접 정함), `OPENAI_API_KEY`.

**키 확인** (값은 출력하지 않음):
```bash
node -e 'const fs=require("fs");const t=fs.readFileSync(".env.local","utf8");for(const k of ["NOTION_TOKEN","NOTION_ROOT_PAGE_ID","APP_PASSWORD","OPENAI_API_KEY"]){const m=t.match(new RegExp("^"+k+"=(.*)$","m"));console.log(k.padEnd(20), m&&m[1].trim()?"✅ 채워짐":"⬜ 비어 있음")}'
```

## 4단계. 노션 DB 자동 생성
```bash
npm run setup:notion
```
- `scripts/crew.json`이 있으면 그 부대원으로, 없으면 기본 8명으로 만든다.
- 본부 페이지 아래에 `01 설정`(회사 이름·로고), `02 조직도 및 역할`, `04 AI 공용 업무 DB`, `05 최종 보고서 (대장 피클)`, `09 업무 보고 이력`, `10 회의실 대화`가 생기고, 02에 기본 조직 11명(대장 피클·좌참 피클·우참 피클·부대원 8)이 들어간다.
- 여러 번 실행해도 안전하다(있는 DB는 건너뜀).
- 끝나면 회사 정보를 저장한다: `npm run set:brand -- --name "<회사 이름>"` (로고 파일이 있으면 `--logo "<경로>"` 추가). 로고는 자동으로 작게 줄여 노션 「01 설정」에 저장된다.
- 오류별 대처:
  - `401` → 토큰이 틀림. 통합 시크릿을 다시 복사해 넣게 한다.
  - `404` → 본부 페이지에 통합이 연결되지 않았거나 링크가 틀림 → 2단계 3번.
  - `자동 번호(ID) 속성은 노션에서 직접 추가` 경고 → 무시해도 됨(선택).

## 5단계. 내 컴퓨터에서 먼저 확인
```bash
npm run dev
```
http://localhost:3000 을 열게 하고(가능하면 Claude가 브라우저로 직접 확인), `APP_PASSWORD`로 로그인 → 왼쪽 위 표시가 **🟢 노션 실시간 연결**인지 확인 → 대화 탭 대회의실에 `너에 대해서 짧게 말해봐` → 대장 피클이 답하면 성공.
- **목업 모드**로 보이면 `NOTION_TOKEN`이 비었거나 서버를 다시 켜지 않은 것 (`Ctrl+C` 후 다시 `npm run dev`).
- "DB를 찾지 못했습니다" → 4단계를 안 했거나 `NOTION_ROOT_PAGE_ID`가 다른 페이지.
- "AI 인증 실패/크레딧 부족" → `OPENAI_API_KEY` 또는 OpenAI 결제 확인. 모델을 못 찾으면 `OPENAI_MODEL`을 계정에서 쓸 수 있는 모델로 바꾼다.

## 6단계. 인터넷에 배포 (Vercel)
1. 코드를 사용자 GitHub 저장소에 올린다 (`git push`; 템플릿으로 만들었으면 이미 올라가 있음).
2. https://vercel.com/new → 그 저장소 **Import**.
3. **Environment Variables**에 4개를 **사용자가 직접** 넣는다: `NOTION_TOKEN`, `NOTION_ROOT_PAGE_ID`, `APP_PASSWORD`, `OPENAI_API_KEY`. 0.5단계에서 정한 운영 설정(`REPORT_STYLE`, `REPORT_TIMING`, `DEFAULT_DUE_DAYS`, `OPENAI_MODEL`, `NEXT_PUBLIC_ORG_NAME`)도 넣는다. 매일 보고면 `CRON_SECRET`(사용자가 직접 정한 긴 문자열)도. **Production에 체크** 확인.
4. **Deploy**. 나중에 환경변수를 바꾸면 반드시 **Deployments → Redeploy** 해야 적용된다.
5. 배포 주소(예: `https://<프로젝트>.vercel.app`)로 로그인 → 5단계와 같은 확인. 매일 보고면 Vercel → Settings → Cron Jobs에 일정이 있는지, 보고서 탭 "📑 지금 일일 보고 받기"가 되는지 확인. 휴대폰도 같은 주소(홈 화면에 추가하면 앱처럼 쓸 수 있음).

## 7단계. (선택) 외부 AI 앱을 노션에 직접 연결
에이전트별로 노션 통합을 **하나씩** 만들어(예: `Hark-HL`) 본부 페이지에 연결하고, 그 앱 설정 칸에 시크릿을 넣게 한다. 그다음 `docs/agent-instructions.md`의 지침 템플릿을 그 앱에 넣게 하고, 02 조직도 자기 행을 직접 고치게 해서 연결을 확인한다(연결 방식 = 노션 직접). 다른 AI의 지시를 거부하는 앱이면 사용자가 직접 승인 문구를 넣어야 한다.

## 마무리 보고
끝나면 사용자에게: 배포 주소, 로그인 방법, 대회의실에서 일을 맡기는 법(@이름으로 부르기), 🏢 오피스 탭, 노션에서 02 조직도의 `역할`·`강점·역량`을 채우면 배정이 똑똑해진다는 점을 짧게 알려 준다.
