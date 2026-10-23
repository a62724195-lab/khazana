// npm الجديد يمنع سكربت تثبيت electron، فنشغّله بأنفسنا إذا ما نزل الملف التنفيذي
const fs = require('fs'), path = require('path'), cp = require('child_process');
const dir = path.join(__dirname, '..', 'node_modules', 'electron');
const exe = path.join(dir, 'dist', 'electron.exe');
if (!fs.existsSync(dir)) process.exit(0);
if (!fs.existsSync(exe)) {
  console.log('Downloading Electron binary...');
  const r = cp.spawnSync(process.execPath, [path.join(dir, 'install.js')], { stdio: 'inherit' });
  if (r.status !== 0 || !fs.existsSync(exe)) { console.error('Electron download failed. Check your internet / antivirus and run again.'); process.exit(1); }
}
console.log('Electron is ready.');
