@echo off
chcp 65001 >nul
setlocal EnableExtensions
title KingLand Bureau 설치기
echo.
echo    KingLand Bureau 설치기
echo    -----------------------------------------
echo    노션 하나로 굴러가는 나만의 AI 비서처
echo    준비를 마치면 Claude Code가 열리고 설치 인터뷰를 시작합니다.
echo    (키나 비밀번호는 이 창에서 묻지 않습니다)
echo.

echo [1/4] 준비물 확인
set MISSING=0
where git >nul 2>nul
if errorlevel 1 (
  echo   [!] Git이 없습니다 - https://git-scm.com 에서 설치
  set MISSING=1
)
where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js가 없습니다 - https://nodejs.org 에서 LTS 설치
  set MISSING=1
)
where claude >nul 2>nul
if errorlevel 1 (
  echo   [!] Claude Code가 없습니다 - https://claude.com/claude-code 에서 설치 후 한 번 로그인
  set MISSING=1
)
if "%MISSING%"=="1" (
  echo.
  echo   위 준비물을 설치한 뒤 이 파일을 다시 실행해 주세요.
  pause
  exit /b 1
)
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo   [!] Node.js 20 이상이 필요합니다. https://nodejs.org 에서 LTS로 다시 설치해 주세요.
  pause
  exit /b 1
)
echo   OK: Git, Node.js, Claude Code
echo.

echo [2/4] 설치할 위치
set "DIR=%USERPROFILE%\kingland-bureau"
set "INPUT="
set /p "INPUT=  어디에 만들까요? [엔터 = %DIR%] "
if not "%INPUT%"=="" set "DIR=%INPUT%"
echo.

echo [3/4] 코드 내려받기
if exist "%DIR%\scripts\setup-notion.mjs" (
  echo   이미 있습니다: %DIR% - 이어서 진행
) else (
  git clone --depth 1 https://github.com/cepatnews/kingland-bureau.git "%DIR%"
  if errorlevel 1 (
    echo   [!] 내려받기 실패 - 인터넷 연결이나 폴더 위치를 확인해 주세요.
    pause
    exit /b 1
  )
  git -C "%DIR%" remote rename origin template >nul 2>nul
)
echo.

echo [4/4] 패키지 설치 (1~3분)
cd /d "%DIR%"
call npm install --no-fund --no-audit --loglevel=error
if errorlevel 1 (
  echo   [!] 패키지 설치 실패 - 위 오류를 Claude Code에 보여 주면 도와줍니다.
  pause
  exit /b 1
)
echo.
echo  준비 끝! 이제 Claude Code가 열리고 설치 인터뷰를 시작합니다.
echo  (나중에 다시 이어 하려면: cd "%DIR%" 후 claude "/kingland-setup")
echo.
claude "/kingland-setup"
pause
