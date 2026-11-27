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
다음을 확인하고, 없는 것만 설치를 안내한다.
```bash
node -v   # 20 이상
git --version
```
계정: GitHub, 노션(Notion), Vercel(GitHub로 가입 가능), OpenAI(ChatGPT API 키 — 결제 수단 등록 필요). 없으면 각 사이트에서 가입하라고 안내한다.

## 0.5단계. 먼저 함께 정하기 (질문은 하나씩)
1. 화면에 보일 조직 이름 (기본 `KingLand Bureau`) → 나중에 `NEXT_PUBLIC_ORG_NAME`
2. 노션 본부 페이지 이름 (기본 `AI SForce 본부`)
3. 부대원 구성: **A. 기본 8명**(추천) / **B. 직접 정하기** → 부대원마다 이름, 부대(`Vermilion`=좌참 / `Sapphire`=우참), 앱, 역할(선택), 잘하는 것(선택)을 차례로 묻고 `scripts/crew.json`으로 저장한다 (형식은 `scripts/crew.example.json`). 부대당 4명 이하 권장 (5번째부터는 사무실 인턴석).
4. AI 모델 (기본 `gpt-5.5`) → `OPENAI_MODEL`
고정된 것(지휘 구조, 부대 이름 Vermilion·Sapphire, 대장 피클·좌참 피클·우참 피클 이름)은 바꿀 수 없다고 먼저 알려 준다. 정한 내용을 표로 요약해 확인받고 진행한다.

## 1단계. 내 저장소로 코드 가져오기
이미 이 저장소 폴더 안에서 실행 중이면 건너뛴다. 아니면:
- GitHub CLI(`gh`)가 있으면: `gh repo create <원하는-이름> --template cepatnews/kingland-bureau --private --clone`
- 없으면: GitHub에서 저장소 페이지의 **Use this template → Create a new repository**를 누르게 하고, 만든 저장소를 `git clone` 한다.
그다음 `npm install`.

## 2단계. 노션 준비 (사용자가 직접)
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
그리고 사용자에게 에디터로 `.env.local`을 열어 아래 4개를 **직접** 채우게 한다:
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
- 본부 페이지 아래에 `02 조직도 및 역할`, `04 AI 공용 업무 DB`, `05 최종 보고서 (대장 피클)`, `09 업무 보고 이력`, `10 회의실 대화`가 생기고, 02에 기본 조직 11명(대장 피클·좌참 피클·우참 피클·부대원 8)이 들어간다.
- 여러 번 실행해도 안전하다(있는 DB는 건너뜀).
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
3. **Environment Variables**에 4개를 **사용자가 직접** 넣는다: `NOTION_TOKEN`, `NOTION_ROOT_PAGE_ID`, `APP_PASSWORD`, `OPENAI_API_KEY` (필요하면 `OPENAI_MODEL`, `NEXT_PUBLIC_ORG_NAME`). **Production에 체크** 확인.
4. **Deploy**. 나중에 환경변수를 바꾸면 반드시 **Deployments → Redeploy** 해야 적용된다.
5. 배포 주소(예: `https://<프로젝트>.vercel.app`)로 로그인 → 5단계와 같은 확인. 휴대폰도 같은 주소(홈 화면에 추가하면 앱처럼 쓸 수 있음).

## 7단계. (선택) 외부 AI 앱을 노션에 직접 연결
에이전트별로 노션 통합을 **하나씩** 만들어(예: `Hark-HL`) 본부 페이지에 연결하고, 그 앱 설정 칸에 시크릿을 넣게 한다. 그다음 `docs/agent-instructions.md`의 지침 템플릿을 그 앱에 넣게 하고, 02 조직도 자기 행을 직접 고치게 해서 연결을 확인한다(연결 방식 = 노션 직접). 다른 AI의 지시를 거부하는 앱이면 사용자가 직접 승인 문구를 넣어야 한다.

## 마무리 보고
끝나면 사용자에게: 배포 주소, 로그인 방법, 대회의실에서 일을 맡기는 법(@이름으로 부르기), 🏢 오피스 탭, 노션에서 02 조직도의 `역할`·`강점·역량`을 채우면 배정이 똑똑해진다는 점을 짧게 알려 준다.
