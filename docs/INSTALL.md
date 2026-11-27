# 설치 안내서 (처음 하는 분용)

이 안내서를 위에서부터 순서대로 따라 하면 **내 노션 + 내 웹 주소**로 KingLand Bureau가 돌아갑니다.
걸리는 시간: 처음이면 30~60분.

> 🤖 **AI에게 맡기고 싶다면** → [단계별 프롬프트 모음](PROMPTS.md)을 순서대로 붙여 넣거나, Claude Code에서 `/kingland-setup` 을 입력하세요.

---

## 전체 흐름 한눈에

```
① 계정 준비 → ② 내 저장소 만들기 → ③ 노션 준비 → ④ 설정 파일 → ⑤ 노션 DB 자동 생성
→ ⑥ 내 컴퓨터에서 확인 → ⑦ 인터넷 배포(Vercel) → ⑧ 사용 시작 → (선택) ⑨ 외부 AI 앱 연결
```

## 먼저 정해 둘 것 (5분)

설치 중에 물어보는 것들입니다. 미리 정해 두면 빠릅니다. 나중에 바꿀 수 있는 것도 많습니다.

| 정할 것 | 예시 | 나중에 바꾸기 |
|---|---|---|
| 조직 이름 (화면 제목) | `KingLand Bureau`, `우리집 비서실` | Vercel 환경변수 `NEXT_PUBLIC_ORG_NAME` → Redeploy |
| 노션 본부 페이지 이름 | `AI SForce 본부` | 노션에서 바로 |
| 앱 로그인 비밀번호 | 남이 모르는 문장 | Vercel 환경변수 `APP_PASSWORD` → Redeploy |
| 부대원 구성 | 기본 8명(VL·HL·WL·IL / VR·HR·WR·IR) 또는 직접 정한 이름·앱·역할 | 노션 02 조직도에서 바로 |
| AI 모델 | `gpt-5.5` (기본) | Vercel 환경변수 `OPENAI_MODEL` |

**고정된 것**: 지휘 구조(사단장 → 대장 피클 → 좌참·우참 피클 → 부대원)와 두 부대 이름(Vermilion·Sapphire), 대장·참모 3명의 이름은 앱 동작에 쓰여서 바꾸지 않습니다. 부대원은 자유롭게 정할 수 있습니다.

---

## ① 계정 준비

| 계정 | 용도 | 비용 |
|---|---|---|
| [GitHub](https://github.com) | 내 코드 보관 | 무료 |
| [Notion](https://www.notion.so) | 모든 데이터가 쌓이는 곳 | 무료 플랜 가능 |
| [Vercel](https://vercel.com) | 웹 주소로 배포 (GitHub로 가입) | 무료 플랜 가능 |
| [OpenAI 플랫폼](https://platform.openai.com) | 회의실 AI(ChatGPT) | 사용한 만큼 (결제 수단 등록 필요) |

내 컴퓨터에서 확인하려면 [Node.js](https://nodejs.org) 20 이상과 Git도 필요합니다. 터미널에서 확인:
```bash
node -v
git --version
```

## ② 내 저장소 만들기

1. https://github.com/cepatnews/kingland-bureau 에서 초록 버튼 **Use this template → Create a new repository**.
2. 이름을 정하고(예: `my-bureau`), **Private** 권장 → Create.
3. 내 컴퓨터로 받기:
   ```bash
   git clone https://github.com/<내아이디>/<저장소이름>.git
   cd <저장소이름>
   npm install
   ```

## ③ 노션 준비

1. **본부 페이지**: 노션에서 새 빈 페이지를 만들고 이름을 붙입니다 (예: `AI SForce 본부`).
2. **통합(Integration) 만들기**
   - https://www.notion.so/profile/integrations → **+ 새 통합**
   - 이름: `KingLand App` / 워크스페이스: 본부 페이지가 있는 곳 / 유형: **내부**
   - **기능**: 콘텐츠 읽기 ✅ · 업데이트 ✅ · 입력 ✅ / 사용자 정보: **없음**
   - **구성** 탭 → **내부 통합 시크릿** → 표시 → 복사 (`ntn_`로 시작). 이게 `NOTION_TOKEN`.
3. **페이지에 연결** ← 가장 많이 빠뜨리는 단계
   - 본부 페이지 오른쪽 위 **•••** → **연결** → `KingLand App` 추가
4. **페이지 링크 복사**: **•••** → **링크 복사**. 이게 `NOTION_ROOT_PAGE_ID` (링크를 그대로 넣어도 됩니다).

## ④ 설정 파일

```bash
cp .env.example .env.local
```
`.env.local`을 텍스트 편집기로 엽니다 (점으로 시작하는 숨김 파일이라 Finder에 안 보이면 `open -e .env.local`).

```
NOTION_TOKEN=ntn_...            ← ③-2에서 복사한 시크릿
NOTION_ROOT_PAGE_ID=https://... ← ③-4에서 복사한 링크
APP_PASSWORD=...                ← 직접 정한 비밀번호
OPENAI_API_KEY=sk-...           ← platform.openai.com → API keys
NEXT_PUBLIC_ORG_NAME=...        ← (선택) 조직 이름
```
⚠️ 이 값들은 **채팅·메신저·이메일에 붙여 넣지 마세요.** `.env.local`은 GitHub에 올라가지 않습니다.

## ⑤ 노션 DB 자동 생성

부대원을 직접 정하고 싶으면 먼저 (아니면 건너뛰기):
```bash
cp scripts/crew.example.json scripts/crew.json
```
`scripts/crew.json`을 열어 부대원 이름·부대·앱·역할을 고칩니다.
```json
[
  { "name": "리서처", "unit": "Vermilion", "app": "ChatGPT", "role": "자료 조사", "strengths": "웹 검색, 표 정리" },
  { "name": "카피라이터", "unit": "Sapphire", "app": "Claude", "role": "글쓰기" }
]
```
- `unit`: `Vermilion`(좌참 부대) 또는 `Sapphire`(우참 부대)
- 부대당 4명까지 자기 부대 테이블에 앉고, 5번째부터는 사무실의 인턴석(3자리)에 앉습니다.

그다음 실행:
```bash
npm run setup:notion
```
성공하면 이렇게 나옵니다:
```
✅ 02 조직도 및 역할 생성 … ✅ 10 회의실 대화 생성
🔗 … (관계 연결)
👥 02 조직도에 11명 등록
🎉 노션 세팅 완료!
```
노션 본부 페이지를 열면 DB 5개가 생겨 있습니다. **여러 번 실행해도 안전**합니다 (있는 DB는 건너뜀).

| 오류 | 원인 · 해결 |
|---|---|
| `401 (토큰이 틀렸습니다)` | 시크릿을 끝까지 다시 복사해 넣기 |
| `404 (통합이 연결돼 있지 않거나…)` | ③-3 페이지 연결, 또는 링크가 다른 페이지 |
| `자동 번호(ID) 속성은 … 직접 추가` | 무시해도 됨 (업무 번호가 `#?`로 보일 뿐) |

## ⑥ 내 컴퓨터에서 확인

```bash
npm run dev
```
1. 브라우저에서 http://localhost:3000 → `APP_PASSWORD`로 로그인
2. 왼쪽 위가 **🟢 노션 실시간 연결**인지 확인 (목업 모드면 `.env.local` 확인 후 서버 재시작)
3. 대화 탭 → 대회의실에 `너에 대해서 짧게 말해봐` → 대장 피클이 답하면 성공
4. 노션 `10 회의실 대화`에 대화가 쌓였는지 확인

AI 키 없이 흐름만 보려면 `.env.local`에 `SFORCE_FAKE_AI=1`을 넣고 다시 실행합니다 (가짜 AI).

## ⑦ 인터넷 배포 (Vercel)

1. https://vercel.com/new → 내 GitHub 저장소 **Import**
2. **Environment Variables**에 4개 입력 (⑤에서 쓴 값과 같게, **Production 체크**):
   `NOTION_TOKEN`, `NOTION_ROOT_PAGE_ID`, `APP_PASSWORD`, `OPENAI_API_KEY` (+ 선택 `OPENAI_MODEL`, `NEXT_PUBLIC_ORG_NAME`)
3. **Deploy** → 1~2분 뒤 `https://<프로젝트>.vercel.app` 주소가 생깁니다.
4. 그 주소로 로그인 → ⑥과 같은 확인.

> 환경변수를 **나중에 바꾸면 반드시 Deployments → ⋯ → Redeploy** 해야 적용됩니다.
> Vercel에 같은 저장소로 프로젝트가 두 개 생기지 않게 주의하세요 (하나만 남기기).

## ⑧ 사용 시작

- **일 맡기기**: 대회의실에 그냥 쓰면 대장 피클이 받아 참모 → 부대원으로 나눕니다. `@`를 누르면 특정 에이전트를 부를 수 있습니다.
- **업무 현황** 탭: 한 줄에 업무 하나 (지시 내용·참모·담당·협업·진행).
- **오피스** 탭: 누가 회의 중·업무 중·휴식 중인지 실시간 사무실로.
- **노션 02 조직도**에서 각 에이전트의 `역할`·`강점·역량`을 채우면 배정이 정확해집니다. 쉬게 하고 싶은 에이전트는 `상태`를 `중지`로 (Out of Order).
- **휴대폰**: 같은 주소 → 브라우저 공유/메뉴 → **홈 화면에 추가**하면 앱처럼 쓸 수 있습니다.

## ⑨ (선택) 외부 AI 앱 연결

회의실 에이전트는 앱이 ChatGPT로 움직입니다. 따로 쓰는 AI 앱(기기)을 노션에 직접 붙이고 싶다면 → [외부 AI 앱 연결 지침](agent-instructions.md).

---

## 문제 해결

| 증상 | 해결 |
|---|---|
| 화면에 **목업 모드** | Vercel **Production**에 `NOTION_TOKEN`이 없음 → 넣고 Redeploy |
| "DB를 찾지 못했습니다" | ⑤를 안 했거나 페이지 연결 누락, `NOTION_ROOT_PAGE_ID`가 다른 페이지 |
| 로그인할 때마다 대화가 사라짐 | 노션 연결 문제 (위 두 줄) |
| "AI 인증 실패 / 크레딧 부족 / 모델 없음" | OpenAI 키·결제 확인, `OPENAI_MODEL` 변경 후 Redeploy |
| 고친 코드가 사이트에 안 보임 | 배포 끝날 때까지 1~2분, 브라우저 새로고침 |
