#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  KingLand Bureau 설치기 (macOS · Linux)
#  하는 일: 준비물 확인 → 코드 내려받기 → 패키지 설치 → Claude Code로 설치 인터뷰 시작
#  키·비밀번호는 이 스크립트가 묻거나 저장하지 않습니다. (인터뷰에서 .env.local 에 직접 넣게 안내)
#
#  한 줄 설치:  curl -fsSL https://raw.githubusercontent.com/cepatnews/kingland-bureau/main/install/install.sh | bash
#  환경변수(선택): KB_DIR=설치 폴더(묻지 않음), KB_NO_LAUNCH=1(마지막에 Claude Code를 열지 않음, 시험용)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO="https://github.com/cepatnews/kingland-bureau.git"
DEFAULT_DIR="$HOME/kingland-bureau"
TTY=/dev/tty   # curl | bash 로 실행해도 키보드 입력을 받기 위해

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
ok() { printf "  ✅ %s\n" "$*"; }
warn() { printf "  ⚠️  %s\n" "$*"; }
die() { printf "\n  ❌ %s\n\n" "$*"; [ -t 0 ] && read -r -p "엔터를 누르면 닫힙니다…" _ <"$TTY" || true; exit 1; }
ask() { local q="$1" def="${2:-}" a; read -r -p "  $q " a <"$TTY" || a=""; echo "${a:-$def}"; }

clear 2>/dev/null || true
cat <<'BANNER'

   👑  KingLand Bureau 설치기
   ─────────────────────────────────────────
   노션 하나로 굴러가는 나만의 AI 비서처

   이 창에서 준비를 마치면 Claude Code가 열리고,
   몇 가지를 물어보며 끝까지 설치를 도와줍니다.

BANNER

# ---------- 1. 준비물 확인 ----------
bold "1/4  준비물 확인"
missing=0
if command -v git >/dev/null 2>&1; then ok "Git $(git --version | awk '{print $3}')"; else warn "Git이 없습니다 → 맥: 터미널에서 'xcode-select --install' / 그 밖: https://git-scm.com"; missing=1; fi
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$NODE_MAJOR" -ge 20 ]; then ok "Node.js $(node -v)"; else warn "Node.js가 너무 오래됐습니다 ($(node -v)) → https://nodejs.org 에서 LTS 설치"; missing=1; fi
else warn "Node.js가 없습니다 → https://nodejs.org 에서 LTS 버전 설치"; missing=1; fi
if command -v claude >/dev/null 2>&1; then ok "Claude Code 설치됨"; else warn "Claude Code가 없습니다 → https://claude.com/claude-code 에서 설치 후 한 번 로그인"; missing=1; fi
[ "$missing" -eq 0 ] || die "위 준비물을 설치한 뒤 이 설치기를 다시 실행해 주세요."

# ---------- 2. 설치 위치 ----------
echo
bold "2/4  설치할 위치"
DIR="${KB_DIR:-}"   # KB_DIR 이 있으면 묻지 않음 (시험·자동 설치용)
[ -n "$DIR" ] || DIR=$(ask "어디에 만들까요? [엔터 = $DEFAULT_DIR]" "$DEFAULT_DIR")
DIR="${DIR/#\~/$HOME}"

# ---------- 3. 코드 내려받기 ----------
echo
bold "3/4  코드 내려받기"
if [ -d "$DIR/.git" ] && [ -f "$DIR/scripts/setup-notion.mjs" ]; then
  ok "이미 있습니다: $DIR (그대로 이어서 진행)"
elif [ -e "$DIR" ] && [ -n "$(ls -A "$DIR" 2>/dev/null)" ]; then
  die "$DIR 폴더가 이미 있고 비어 있지 않습니다. 다른 위치를 입력해 다시 실행해 주세요."
else
  git clone --depth 1 "$REPO" "$DIR" >/dev/null 2>&1 || die "내려받기에 실패했습니다. 인터넷 연결을 확인해 주세요."
  # 원본 저장소로 실수로 올리지 않도록 연결 이름을 바꿔 둔다 (내 저장소는 인터뷰에서 만든다)
  git -C "$DIR" remote rename origin template >/dev/null 2>&1 || true
  ok "내려받기 완료: $DIR"
fi

# ---------- 4. 패키지 설치 ----------
echo
bold "4/4  패키지 설치 (1~3분)"
cd "$DIR"
npm install --no-fund --no-audit --loglevel=error || die "패키지 설치에 실패했습니다. 위 오류를 Claude Code에 보여 주면 도와줍니다."
ok "설치 완료"

# ---------- Claude Code로 인터뷰 시작 ----------
echo
bold "🎉 준비 끝! 이제 Claude Code가 열리고 설치 인터뷰를 시작합니다."
echo "   (나중에 다시 이어 하려면: cd \"$DIR\" && claude \"/kingland-setup\")"
echo
if [ "${KB_NO_LAUNCH:-}" = "1" ]; then exit 0; fi   # 테스트용
sleep 1
exec claude "/kingland-setup" <"$TTY"
