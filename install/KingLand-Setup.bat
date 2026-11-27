@echo off
setlocal
rem ------------------------------------------------------------------
rem  KingLand Bureau installer for Windows (launcher, English only on purpose:
rem  cmd.exe mis-reads non-ASCII batch files on some code pages).
rem  It runs install.ps1 next to this file, or downloads it from GitHub.
rem  Korean messages live in install.ps1 (UTF-8 with BOM).
rem  Optional env: KB_DIR=install folder, KB_NO_LAUNCH=1, KB_NO_PAUSE=1 (tests)
rem ------------------------------------------------------------------
title KingLand Bureau Setup
set "PS1=%~dp0install.ps1"
if exist "%PS1%" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((irm https://raw.githubusercontent.com/cepatnews/kingland-bureau/main/install/install.ps1) -replace '^\uFEFF','')"
)
set "RC=%ERRORLEVEL%"
if not defined KB_NO_PAUSE pause
exit /b %RC%
