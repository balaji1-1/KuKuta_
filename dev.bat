@echo off
setlocal
cd /d "%~dp0"

if exist "%~dp0\.venv\Scripts\activate.bat" (
  call "%~dp0\.venv\Scripts\activate.bat"
) else if exist "%USERPROFILE%\OneDrive\project k.com\.venv\Scripts\activate.bat" (
  call "%USERPROFILE%\OneDrive\project k.com\.venv\Scripts\activate.bat"
)

cd /d "%~dp0\kukuta.com"
echo Starting Kukuta React and Django development servers...
npm run dev
