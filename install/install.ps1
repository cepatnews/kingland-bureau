# ─────────────────────────────────────────────────────────────
#  KingLand Bureau 설치기 (Windows PowerShell 5.1 이상)
#  하는 일: 준비물 확인 → 코드 내려받기 → 패키지 설치 → Claude Code로 설치 인터뷰 시작
#  키·비밀번호는 이 스크립트가 묻거나 저장하지 않습니다. (인터뷰에서 .env.local 에 직접 넣게 안내)
#
#  실행 방법
#   - 설치 파일: KingLand-Setup.bat 더블클릭 (이 파일을 대신 실행해 줌)
#   - 한 줄: powershell -ExecutionPolicy Bypass -c "iex ((irm https://raw.githubusercontent.com/cepatnews/kingland-bureau/main/install/install.ps1) -replace '^\uFEFF','')"
#  환경변수(선택): KB_DIR=설치 폴더(묻지 않음), KB_NO_LAUNCH=1(마지막에 Claude Code를 열지 않음, 시험용)
# ─────────────────────────────────────────────────────────────

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Install-KingLand {
  $Repo = 'https://github.com/cepatnews/kingland-bureau.git'
  $DefaultDir = Join-Path $env:USERPROFILE 'kingland-bureau'

  function Say-Step([string]$m) { Write-Host ''; Write-Host $m -ForegroundColor Cyan }
  function Say-Ok([string]$m) { Write-Host "  [OK] $m" -ForegroundColor Green }
  function Say-Warn([string]$m) { Write-Host "  [!] $m" -ForegroundColor Yellow }

  Write-Host ''
  Write-Host '   KingLand Bureau 설치기' -ForegroundColor Yellow
  Write-Host '   -----------------------------------------'
  Write-Host '   노션 하나로 굴러가는 나만의 AI 비서처'
  Write-Host '   준비를 마치면 Claude Code가 열리고, 몇 가지를 물어보며 끝까지 설치를 도와줍니다.'

  # ---------- 1. 준비물 확인 ----------
  Say-Step '1/4  준비물 확인'
  $missing = 0
  if (Get-Command git -ErrorAction SilentlyContinue) {
    Say-Ok ("Git " + ((git --version) -replace '^git version ', ''))
  } else {
    Say-Warn 'Git이 없습니다 → https://git-scm.com 에서 설치 (Claude Code도 Git이 필요합니다)'; $missing++
  }
  if (Get-Command node -ErrorAction SilentlyContinue) {
    $major = 0
    [int]::TryParse(((node -v) -replace '^v', '').Split('.')[0], [ref]$major) | Out-Null
    if ($major -ge 20) { Say-Ok ("Node.js " + (node -v)) }
    else { Say-Warn ("Node.js가 너무 오래됐습니다 (" + (node -v) + ") → https://nodejs.org 에서 LTS 설치"); $missing++ }
  } else {
    Say-Warn 'Node.js가 없습니다 → https://nodejs.org 에서 LTS 버전 설치'; $missing++
  }
  if (Get-Command claude -ErrorAction SilentlyContinue) {
    Say-Ok 'Claude Code 설치됨'
  } else {
    Say-Warn 'Claude Code가 없습니다 → https://claude.com/claude-code 에서 설치하고 한 번 로그인'; $missing++
  }
  if ($missing -gt 0) {
    throw "위 준비물을 설치한 뒤, 새 창에서 이 설치기를 다시 실행해 주세요. (설치 직후에는 창을 새로 열어야 인식됩니다)`n      화면 따라 하기 안내: https://github.com/cepatnews/kingland-bureau/blob/main/docs/PREREQUISITES.md"
  }

  # ---------- 2. 설치 위치 ----------
  Say-Step '2/4  설치할 위치'
  $dir = $env:KB_DIR
  if ([string]::IsNullOrWhiteSpace($dir)) {
    $answer = Read-Host "  어디에 만들까요? [엔터 = $DefaultDir]"
    if ([string]::IsNullOrWhiteSpace($answer)) { $dir = $DefaultDir } else { $dir = $answer }
  }
  $dir = $dir.Trim().Trim('"')
  if ($dir.StartsWith('~')) { $dir = Join-Path $env:USERPROFILE $dir.Substring(1).TrimStart('\', '/') }
  Say-Ok $dir

  # ---------- 3. 코드 내려받기 ----------
  Say-Step '3/4  코드 내려받기'
  if ((Test-Path -LiteralPath (Join-Path $dir '.git')) -and (Test-Path -LiteralPath (Join-Path $dir 'scripts\setup-notion.mjs'))) {
    Say-Ok "이미 있습니다: $dir (그대로 이어서 진행)"
  } elseif ((Test-Path -LiteralPath $dir) -and (Get-ChildItem -LiteralPath $dir -Force | Select-Object -First 1)) {
    throw "$dir 폴더가 이미 있고 비어 있지 않습니다. 다른 위치를 입력해 다시 실행해 주세요."
  } else {
    $parent = Split-Path -Path $dir -Parent
    if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    & git clone --quiet --depth 1 $Repo $dir
    if ($LASTEXITCODE -ne 0) { throw '내려받기에 실패했습니다. 인터넷 연결과 폴더 위치를 확인해 주세요.' }
    # 원본 저장소로 실수로 올리지 않도록 연결 이름을 바꿔 둔다 (내 저장소는 인터뷰에서 만든다)
    & git -C $dir remote rename origin template
    Say-Ok "내려받기 완료: $dir"
  }

  # ---------- 4. 패키지 설치 ----------
  Say-Step '4/4  패키지 설치 (1~3분)'
  Set-Location -LiteralPath $dir
  & npm.cmd install --no-fund --no-audit --loglevel=error
  if ($LASTEXITCODE -ne 0) { throw '패키지 설치에 실패했습니다. 위 오류를 Claude Code에 보여 주면 도와줍니다.' }
  Say-Ok '설치 완료'

  # ---------- Claude Code로 인터뷰 시작 ----------
  Write-Host ''
  Write-Host '  준비 끝! 이제 Claude Code가 열리고 설치 인터뷰를 시작합니다.' -ForegroundColor Green
  Write-Host "  (나중에 다시 이어 하려면: cd `"$dir`" 한 뒤 claude `"/kingland-setup`")"
  Write-Host ''
  if ($env:KB_NO_LAUNCH -eq '1') { return }
  & claude '/kingland-setup'
}

$code = 0
try {
  Install-KingLand
} catch {
  Write-Host ''
  Write-Host ("  [X] " + $_.Exception.Message) -ForegroundColor Red
  Write-Host ''
  $code = 1
}
# 파일로 실행했을 때(.bat → -File)만 종료 코드를 돌려준다. 한 줄(iex) 실행이면 창을 닫지 않는다.
if ($PSCommandPath) { exit $code }
