# Git · GitHub 준비 안내 (처음 하는 분용)

KingLand Bureau를 설치하려면 **Git**(내 컴퓨터 프로그램)과 **GitHub**(인터넷 계정)이 필요합니다. 처음이면 15분 정도 걸립니다.

> 🙋 **둘이 뭐가 달라요?**
> - **Git** = 내 컴퓨터에 까는 프로그램. 코드를 내려받고, 바뀐 내용을 기록합니다. (워드 파일의 "버전 기록" 같은 것)
> - **GitHub** = 그 코드를 인터넷에 보관하는 곳. Vercel(웹 배포)은 GitHub에 있는 코드를 가져가서 웹사이트로 만듭니다.
>
> 설치 인터뷰가 Git·GitHub 명령은 대신 실행해 줍니다. 여기서는 **프로그램 설치와 계정 만들기**만 하면 됩니다.

목차: [① Git 설치 (윈도우)](#-git-설치--윈도우) · [② Git 설치 (맥)](#-git-설치--맥) · [③ GitHub 계정](#-github-계정-만들기) · [④ 처음 한 번 설정](#-처음-한-번-설정-이름이메일) · [⑤ (선택) GitHub CLI](#-선택-github-cli-gh--저장소-만들기를-claude에게-맡기기) · [자주 막히는 곳](#자주-막히는-곳)

---

## ① Git 설치 — 윈도우

1. https://git-scm.com/download/win 접속 → **Click here to download** (64-bit 설치 파일이 받아집니다).
   - 윈도우 10/11이면 명령 한 줄도 됩니다. 시작 메뉴 → **PowerShell** 열고:
     ```powershell
     winget install --id Git.Git -e
     ```
2. 받은 `Git-…-64-bit.exe` 실행 → 대부분 **Next**만 누르면 됩니다. 아래 두 화면만 확인하세요.
   | 화면 | 고를 것 |
   |---|---|
   | **Choosing the default editor used by Git** | `Use Notepad as Git's default editor` (메모장 — Vim보다 쉬움) |
   | **Adjusting your PATH environment** | `Git from the command line and also from 3rd-party software` (기본값, **Recommended**) |
   나머지(줄바꿈, 터미널 등)는 기본값 그대로 두세요.
3. **Install → Finish**.
4. 확인: 시작 메뉴 → **PowerShell**을 **새로** 열고
   ```powershell
   git --version
   ```
   `git version 2.xx…`가 나오면 성공. (이미 열려 있던 창에서는 인식이 안 될 수 있어요. 새 창!)

> 💡 Claude Code도 윈도우에서는 Git(Git Bash)이 있어야 동작합니다. 그래서 Git을 **먼저** 설치하세요.

## ② Git 설치 — 맥

맥은 보통 명령 한 번이면 됩니다.

1. **터미널** 열기: `⌘ + Space` → "터미널" 입력 → 엔터
2. 입력:
   ```bash
   git --version
   ```
   - 버전이 나오면 이미 설치돼 있습니다. → ③으로
   - "명령어 개발자 도구를 설치하겠습니까?" 창이 뜨면 **설치** → 약관 동의 → 5~10분 기다리기
3. 다시 `git --version` 으로 확인.

(Homebrew를 쓰는 분은 `brew install git` 도 됩니다.)

## ③ GitHub 계정 만들기

1. https://github.com/signup 접속
2. 이메일 → 비밀번호 → 사용자 이름(영문, 나중에 주소에 쓰임: `github.com/내이름`) → 이메일 인증 코드 입력
3. 요금제는 **Free** 그대로 (KingLand Bureau는 무료로 충분합니다)
4. 권장: **이메일 비공개** 설정
   - 오른쪽 위 프로필 → **Settings → Emails** → `Keep my email addresses private` 체크
   - 그 아래 나오는 `숫자+아이디@users.noreply.github.com` 주소를 ④에서 씁니다. 내 실제 이메일이 코드 기록에 남지 않습니다.
5. 권장: **2단계 인증(2FA)** — Settings → Password and authentication. GitHub이 곧 요구하기도 합니다.

## ④ 처음 한 번 설정 (이름·이메일)

Git은 기록을 남길 때 "누가 했는지"를 적습니다. 터미널(맥) 또는 PowerShell(윈도우)에서 한 번만:

```bash
git config --global user.name "내 이름 또는 아이디"
git config --global user.email "숫자+아이디@users.noreply.github.com"
```
(③-4의 noreply 주소를 쓰면 실제 이메일이 공개되지 않습니다.)

확인:
```bash
git config --global --list
```

## ⑤ (선택) GitHub CLI `gh` — 저장소 만들기를 Claude에게 맡기기

설치 인터뷰 마지막에 "내 GitHub 저장소"를 만들어 코드를 올려야 Vercel 배포가 됩니다. **`gh`가 있으면 Claude가 명령 한 줄로 대신 만들어 줍니다.** 없으면 GitHub 웹에서 직접 만들면 되니 필수는 아닙니다.

| | 설치 |
|---|---|
| 윈도우 | PowerShell: `winget install --id GitHub.cli -e` (또는 https://cli.github.com 에서 설치 파일) |
| 맥 | `brew install gh` (Homebrew가 없으면 https://cli.github.com 에서 받기) |

설치 후 **새 창**에서 로그인:
```bash
gh auth login
```
질문이 나오면 차례로: **GitHub.com** → **HTTPS** → **Yes**(Git에 이 로그인 사용) → **Login with a web browser** → 화면의 8자리 코드를 복사 → 엔터 → 열린 브라우저에 코드 붙여 넣고 **Authorize**.

확인: `gh auth status` → `Logged in to github.com` 이 보이면 끝.

---

## 자주 막히는 곳

| 증상 | 해결 |
|---|---|
| `git` 은(는) 내부 또는 외부 명령… 아닙니다 / `command not found: git` | 설치 직후라 창이 옛 정보를 쓰는 것. **창을 닫고 새로 열기**. 그래도 안 되면 윈도우는 설치를 다시 하며 PATH 화면에서 *Recommended* 선택 |
| 맥에서 개발자 도구 설치 창이 안 뜸 | 터미널에 `xcode-select --install` 입력 |
| `Permission denied (publickey)` | 주소가 `git@github.com:`(SSH)로 돼 있는 경우. `gh auth login`으로 HTTPS 로그인하거나 `https://github.com/…` 주소 사용 |
| `push` 할 때 아이디·비밀번호를 묻고 실패 | GitHub은 비밀번호로 push가 안 됩니다. `gh auth login`으로 로그인하면 해결 |
| `remote origin already exists` | 이미 연결돼 있는 것. 설치기는 원본 연결을 `template`으로 바꿔 두므로 `origin`은 내 저장소용으로 비어 있습니다. 인터뷰에 "origin이 이미 있대"라고 말하면 정리해 줍니다 |
| 회사 PC라 설치가 막힘 | 관리자 권한이 필요할 수 있습니다. IT 담당자에게 Git 설치를 요청하세요 |

다음 단계: [노션 준비 안내](NOTION.md) → [설치 안내서](INSTALL.md)
