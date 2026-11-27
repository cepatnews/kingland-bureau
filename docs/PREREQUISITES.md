# 준비물 한눈에 (설치 전에)

설치 파일을 실행하기 전에 아래를 준비하세요. **프로그램 3개 + 계정 4개**입니다. 이미 있는 건 건너뛰면 됩니다.

| | 무엇 | 왜 필요 | 안내 |
|---|---|---|---|
| 💻 프로그램 | **Node.js** (20 이상) | 앱을 내 컴퓨터에서 설치·실행 | [아래 ①](#-nodejs) |
| 💻 프로그램 | **Git** | 코드 내려받기·기록 | [Git 안내](GIT.md) |
| 💻 프로그램 | **Claude Code** | 설치 인터뷰를 진행하는 AI | [아래 ②](#-claude-code) |
| 🌐 계정 | **GitHub** | 내 코드 보관 (배포에 필요) | [Git 안내 ③](GIT.md#-github-계정-만들기) |
| 🌐 계정 | **노션** | 모든 데이터가 쌓이는 곳 | [노션 안내](NOTION.md) |
| 🌐 계정 | **Vercel** | 웹 주소로 배포 (GitHub로 가입) | [아래 ③](#-vercel) |
| 🌐 계정 | **OpenAI** | 회의실 AI(ChatGPT) | [아래 ④](#-openai-api-키) |

순서 추천: **Git → Node.js → Claude Code → 계정들** (윈도우는 Claude Code가 Git을 필요로 해서 Git이 먼저)

---

## ① Node.js

1. https://nodejs.org 접속 → **LTS** 버전 받기 (윈도우 `.msi`, 맥 `.pkg`)
2. 설치 파일 실행 → 기본값으로 **Next/계속** → 설치
   - 윈도우: "Tools for Native Modules" 체크 화면이 나오면 **체크하지 않아도 됩니다.**
3. 확인 — **새** 터미널/PowerShell 창에서:
   ```bash
   node -v
   npm -v
   ```
   `v20` 이상이면 OK. (윈도우 PowerShell은 `winget install OpenJS.NodeJS.LTS` 한 줄로도 설치됩니다)

## ② Claude Code

설치 인터뷰를 진행하는 AI입니다. **Claude 유료 플랜(Pro/Max) 또는 Anthropic API 결제**가 필요합니다.

| | 설치 (공식) |
|---|---|
| 맥 | 터미널: `curl -fsSL https://claude.ai/install.sh \| bash` |
| 윈도우 | PowerShell: `irm https://claude.ai/install.ps1 \| iex` |
| 공통 (Node.js가 있으면) | `npm install -g @anthropic-ai/claude-code` |

설치 후 **새 창**에서 `claude` 입력 → 안내대로 브라우저에서 로그인 → 처음 화면이 나오면 `/exit`로 닫아도 됩니다.
최신 설치 방법은 https://claude.com/claude-code 를 확인하세요.

> 데스크톱 앱(Claude) 안의 Code 탭을 쓰는 분도 같은 계정이면 됩니다. 설치 파일은 터미널용 `claude` 명령을 씁니다.

## ③ Vercel

1. https://vercel.com/signup → **Continue with GitHub** (GitHub 계정으로 가입하면 연결이 쉬움)
2. 플랜은 **Hobby(무료)** — 개인 사용엔 충분합니다.
3. 배포는 설치 인터뷰 STEP 7에서 함께 합니다.

## ④ OpenAI API 키

회의실 에이전트가 ChatGPT로 움직입니다. (ChatGPT Plus 구독과는 **별개**인 API 결제입니다)

1. https://platform.openai.com 가입/로그인
2. **Settings → Billing** 에서 결제 수단 등록·충전 (사용한 만큼만 나갑니다. 한도 설정 권장: **Limits**)
3. **API keys → Create new secret key** → 이름 입력 → 키 복사 (`sk-`로 시작)
   - ⚠️ 키는 **한 번만 보여 줍니다.** 채팅에 붙여 넣지 말고, 설치 중 `.env.local`·Vercel 설정 칸에만 넣으세요.

---

준비가 끝났으면 → [설치 파일 받기](https://github.com/cepatnews/kingland-bureau/releases/latest) 또는 [설치 안내서](INSTALL.md)
