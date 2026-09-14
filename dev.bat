@echo off
REM dev.bat — start frontend (separate window) and Django runserver (foreground)
REM Usage: dev.bat
REM Environment variables: FRONTEND_DIR (default kukuta.com), FRONTEND_CMD (default "npm run dev"), FRONTEND_LOG

setlocal
if "%FRONTEND_DIR%"=="" set FRONTEND_DIR=kukuta.com
if "%FRONTEND_CMD%"=="" set FRONTEND_CMD=npm run dev
if "%FRONTEND_LOG%"=="" set FRONTEND_LOG=%FRONTEND_DIR%\frontend.log

echo Starting frontend: %FRONTEND_CMD% in %FRONTEND_DIR% — logging to %FRONTEND_LOG%

REM Start frontend in a new terminal window and append logs
start "Frontend" cmd /c "cd /d %FRONTEND_DIR% && %FRONTEND_CMD% >> %FRONTEND_LOG% 2>&1"

REM Start Django runserver in this window
python manage.py runserver
