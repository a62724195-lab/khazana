@echo off
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  call npm install
  node scripts\ensure-electron.js
  if errorlevel 1 (pause & exit /b 1)
)
set "OUT=%~dp0Khazana-App"
if exist "%OUT%" rmdir /s /q "%OUT%"
echo Packaging...
robocopy "node_modules\electron\dist" "%OUT%" /E /NFL /NDL /NJH /NJS /NP >nul
mkdir "%OUT%\resources\app"
copy /y main.js "%OUT%\resources\app\" >nul
copy /y preload.js "%OUT%\resources\app\" >nul
copy /y package.json "%OUT%\resources\app\" >nul
robocopy renderer "%OUT%\resources\app\renderer" /E /NFL /NDL /NJH /NJS /NP >nul
robocopy renderer "%OUT%\ui" /E /NFL /NDL /NJH /NJS /NP >nul
robocopy assets "%OUT%\resources\app\assets" /E /NFL /NDL /NJH /NJS /NP >nul
if exist "%OUT%\resources\default_app.asar" del /q "%OUT%\resources\default_app.asar"
ren "%OUT%\electron.exe" Khazana.exe
echo.
if exist "%OUT%\Khazana.exe" (
  echo SUCCESS: %OUT%
  echo Move the Khazana-App folder anywhere, run Khazana.exe inside it.
  echo After that you can delete this khazana folder including node_modules.
  start "" "%OUT%"
) else (
  echo FAILED: Khazana.exe is missing. Your antivirus probably removed electron.exe.
  echo Add this folder to Windows Security exclusions and run again.
)
pause
