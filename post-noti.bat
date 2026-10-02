@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Please install Node.js 20 or newer, then try again.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\service-status.ps1"
set "GANK_STATUS_CODE=%ERRORLEVEL%"

if "%GANK_STATUS_CODE%"=="0" (
  echo.
  echo The service is already running. Use restart-noti.bat to restart it.
  pause
  exit /b 0
)

if "%GANK_STATUS_CODE%"=="2" (
  echo.
  echo [ERROR] Port 3000 is occupied by another application.
  pause
  exit /b 2
)

echo Starting Gank Post Notify...
echo Status URL: http://localhost:3000/api/status
echo Press Ctrl+C to stop.
echo.

call npm start
set "GANK_EXIT_CODE=%ERRORLEVEL%"

if not "%GANK_EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] The service stopped with exit code %GANK_EXIT_CODE%.
  pause
)

exit /b %GANK_EXIT_CODE%
