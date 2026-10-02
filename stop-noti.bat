@echo off
setlocal

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-service.ps1"
set "GANK_EXIT_CODE=%ERRORLEVEL%"

if not "%GANK_EXIT_CODE%"=="0" pause
exit /b %GANK_EXIT_CODE%
