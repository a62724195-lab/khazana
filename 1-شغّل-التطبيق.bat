@echo off
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  echo First run: downloading Electron once, about 100MB. Please wait...
  call npm install
  node scripts\ensure-electron.js
  if errorlevel 1 (pause & exit /b 1)
)
start "" "node_modules\electron\dist\electron.exe" .
