@echo off
setlocal

cd /d "%~dp0"
call "%~dp0stop-noti.bat"
if errorlevel 1 (
  echo.
  echo [ERROR] Could not stop the existing service.
  pause
  exit /b 1
)

call "%~dp0post-noti.bat"
exit /b %ERRORLEVEL%
