@echo off
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (call npm install & node scripts\ensure-electron.js)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($d+'\Khazana.lnk'); $s.TargetPath='%~dp0node_modules\electron\dist\electron.exe'; $s.Arguments='\"%~dp0.\"'; $s.WorkingDirectory='%~dp0'; $s.Save()"
echo Shortcut "Khazana" created on your Desktop.
pause
