const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, globalShortcut, nativeImage, Menu, Tray, net, clipboard, Notification } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const MODEL = 'claude-haiku-5-5';
let win = null, tray = null, quitting = false;
const ICON = path.join(__dirname, 'assets', 'icon.png');
const appIcon = () => { try { const i = nativeImage.createFromPath(ICON); return i.isEmpty() ? undefined : i; } catch (e) { return undefined; } };

/* KZ-ROLLBACK:BEGIN — لو آخر تحديث خلّى البرنامج ما يفتح، نرجع للنسخة القديمة تلقائياً (لا تحذف هذا الجزء) */
const updPendingFile = () => path.join(app.getPath('userData'), 'update-pending.json');
const updRolledFile = () => path.join(app.getPath('userData'), 'update-rolledback.json');
function restoreUpdateBackup() {
  const bdir = path.join(app.getPath('userData'), 'update-backup'); let n = 0;
  const list = JSON.parse(fs.readFileSync(path.join(bdir, 'list.json'), 'utf8'));
  for (const it of list) {
    try {
      if (it.had) { const b = fs.readFileSync(path.join(bdir, it.bak)); fs.writeFileSync(it.dst + '.rb', b); fs.renameSync(it.dst + '.rb', it.dst); }
      else fs.rmSync(it.dst, { force: true });
      n++;
    } catch (e) {}
  }
  return n;
}
let updFirstBoot = false;
function rollbackUpdate(p, why) {
  try { restoreUpdateBackup(); } catch (e) {}
  try { fs.writeFileSync(updRolledFile(), JSON.stringify({ version: p.version, at: Date.now(), why: String(why || '').slice(0, 300) })); } catch (e) {}
  try { const sf = path.join(app.getPath('userData'), 'settings.json'); const s = JSON.parse(fs.readFileSync(sf, 'utf8')); s.updVersion = p.from || ''; s.updSkip = p.version; fs.writeFileSync(sf + '.rb', JSON.stringify(s)); fs.renameSync(sf + '.rb', sf); } catch (e) {}
  try { fs.unlinkSync(updPendingFile()); } catch (e) {}
  app.relaunch(); app.exit(0);
}
const gotLock = app.requestSingleInstanceLock(); // نسخة ثانية من البرنامج ما تلمس ملفات التحديث
(function checkUpdateRollback() {
  if (!gotLock) return;
  let p = null; try { p = JSON.parse(fs.readFileSync(updPendingFile(), 'utf8')); } catch (e) { return; }
  if ((p.boots || 0) >= 1) { rollbackUpdate(p, 'app did not start after update'); return; } // المرة اللي قبل ما فتح البرنامج: نرجع
  p.boots = 1; try { fs.writeFileSync(updPendingFile(), JSON.stringify(p)); } catch (e) {}
  updFirstBoot = true;
  // أول تشغيل بعد التحديث: لو صار خطأ قبل ما تفتح الواجهة نرجع على طول
  const onCrash = err => { if (updFirstBoot) rollbackUpdate(p, (err && err.stack) || err); };
  process.on('uncaughtException', onCrash);
  process._kzUpdCrash = onCrash;
})();
function markUpdateBootOK() { // الواجهة فتحت وحمّلت الخزنة: التحديث سليم
  if (updFirstBoot) { updFirstBoot = false; try { fs.unlinkSync(updPendingFile()); } catch (e) {} if (process._kzUpdCrash) process.removeListener('uncaughtException', process._kzUpdCrash); }
  let rb = null; try { rb = JSON.parse(fs.readFileSync(updRolledFile(), 'utf8')); fs.unlinkSync(updRolledFile()); } catch (e) {}
  if (rb) setTimeout(() => { try { new Notification({ title: 'خزنة', body: '↩ التحديث الأخير ما اشتغل صح، فرجّعنا النسخة السابقة تلقائياً. بياناتك سليمة.' }).show(); } catch (e) {} }, 1500);
}
/* KZ-ROLLBACK:END */

if (!gotLock) { app.quit(); }
app.on('second-instance', () => showWin());

/* ---------- تخزين ---------- */
const dataDir = () => app.getPath('userData');
const profName = () => { try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8')).profile || 'default'; } catch (e) { return 'default'; } };
const safeProf = n => String(n || '').trim().replace(/[^\p{L}\p{N}_ -]/gu, '').slice(0, 24).trim().replace(/ +/g, '_');
const vaultFile = () => path.join(dataDir(), profName() === 'default' ? 'vault.json' : 'vault-' + profName() + '.json');
const settingsFile = () => path.join(dataDir(), 'settings.json');
/* ---------- 💾 حفظ آمن للملفات ----------
   - الكتابة «ذرّية»: نكتب بملف مؤقت + fsync + rename، فلو طفى الجهاز بالنص يظل الملف القديم سليم
   - لو ملف JSON خربان ما نرجّع فاضي بصمت: نجرّب نسخة .bak */
const parseJSONText = t => JSON.parse(String(t).replace(/^\uFEFF/, ''));
function tryReadJSON(f) {
  let text;
  try { text = fs.readFileSync(f, 'utf8'); } catch (e) { return { ok: false, missing: e.code === 'ENOENT', error: e }; }
  try { return { ok: true, data: parseJSONText(text), text }; } catch (e) { return { ok: false, corrupt: true, error: e }; }
}
const bakOf = f => f.replace(/\.json$/, '.bak.json');
function readJSON(f, def) {
  const r = tryReadJSON(f); if (r.ok) return r.data;
  if (r.corrupt) { const b = tryReadJSON(bakOf(f)); if (b.ok) return b.data; }
  return def;
}
function sleepSync(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) {} }
function writeFileAtomic(f, str) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + '.tmp', buf = Buffer.isBuffer(str) ? str : Buffer.from(String(str), 'utf8');
  const fd = fs.openSync(tmp, 'w');
  try { let off = 0; while (off < buf.length) off += fs.writeSync(fd, buf, off, buf.length - off); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  for (let k = 0; ; k++) { // ويندوز أحياناً يقفل الملف لحظة (مضاد الفيروسات): نعيد المحاولة
    try { fs.renameSync(tmp, f); return; } catch (e) {
      if (k >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) { try { fs.unlinkSync(tmp); } catch (_) {} throw e; }
      sleepSync(60 * (k + 1));
    }
  }
}
// عدد الأشياء الحقيقية بالخزنة (عناصر + ملاحظات) عشان نعرف إذا النسخة «فاضية»
function vaultCount(d) {
  const a = Array.isArray(d) ? d : (d && Array.isArray(d.items) ? d.items : null); if (!a) return -1;
  let n = 0; for (const x of a) { if (!x) continue; if (x.kind === '_meta') n += (Array.isArray(x.notes) ? x.notes.length : 0); else n++; }
  return n;
}
const isVaultData = d => Array.isArray(d) || !!(d && typeof d === 'object' && Array.isArray(d.items));
const isVaultName = f => /^vault(-.+)?\.json$/.test(path.basename(f)) && !/\.(bak|corrupt-[^.]*)\.json$/.test(path.basename(f));
function writeJSON(f, d) {
  const str = typeof d === 'string' ? d : JSON.stringify(d);
  try {
    // ننسخ الملف الحالي لـ .bak بس لو هو سليم (عشان ما يمسح ملف خربان نسخة سليمة)
    const cur = fs.existsSync(f) ? tryReadJSON(f) : null;
    if (cur && cur.ok) {
      let keep = false; // خزنة فاضية ما تكتب فوق نسخة .bak فيها بيانات
      if (isVaultName(f) && vaultCount(cur.data) === 0) { const old = tryReadJSON(bakOf(f)); keep = old.ok && vaultCount(old.data) > 0; }
      if (!keep) writeFileAtomic(bakOf(f), cur.text);
    }
  } catch (e) {}
  writeFileAtomic(f, str);
}
const stampNow = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); };

/* ---------- مفتاح API (مشفّر بحساب ويندوز) ---------- */
let keyCache = null; // نفك تشفير المفتاح مرة وحدة بس، مو مع كل تحميل
function getKey() {
  if (keyCache !== null) return keyCache;
  const s = readJSON(settingsFile(), {});
  let k = '';
  try {
    if (s.keyEnc && safeStorage.isEncryptionAvailable()) k = safeStorage.decryptString(Buffer.from(s.keyEnc, 'base64'));
    else if (s.keyPlain) k = Buffer.from(s.keyPlain, 'base64').toString('utf8');
  } catch (e) { k = ''; }
  keyCache = k;
  return k;
}
function setKey(k) {
  const s = readJSON(settingsFile(), {});
  delete s.keyEnc; delete s.keyPlain;
  if (k) {
    if (safeStorage.isEncryptionAvailable()) s.keyEnc = safeStorage.encryptString(k).toString('base64');
    else s.keyPlain = Buffer.from(k, 'utf8').toString('base64');
  }
  writeJSON(settingsFile(), s);
  keyCache = null;
}

/* ---------- أنواع الملفات ---------- */
const KINDS = {
  app: ['.exe', '.lnk', '.msi', '.bat', '.cmd', '.appref-ms'],
  image: ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp', '.ico', '.svg', '.tif', '.tiff', '.heic', '.psd'],
  video: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.flv'],
  audio: ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'],
  doc: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.rtf', '.odt', '.csv', '.epub'],
  archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.iso'],
  code: ['.js', '.ts', '.py', '.html', '.css', '.json', '.java', '.c', '.cpp', '.cs', '.php', '.sh', '.ps1', '.sql', '.xml', '.yml', '.yaml', '.go', '.rs']
};
const TEXT_EXT = new Set(['.txt', '.md', '.csv', '.json', '.js', '.ts', '.py', '.html', '.css', '.xml', '.yml', '.yaml', '.ini', '.log', '.sql', '.java', '.c', '.cpp', '.cs', '.php', '.sh', '.bat', '.cmd', '.ps1', '.rtf']);
function kindOf(ext, isDir) {
  if (isDir) return 'folder';
  for (const k of Object.keys(KINDS)) if (KINDS[k].includes(ext)) return k;
  return 'other';
}


/* يتأكد إن الصورة مو فاضية/شفافة/لون واحد (ويندوز أحياناً يرجّع صورة موجودة بس شكلها فاضي) */
function isBlank(n) {
  try {
    if (!n || n.isEmpty()) return true;
    const sz = n.getSize(); if (sz.width < 2 || sz.height < 2) return true;
    const b = n.toBitmap(); let vis = 0, tot = 0, r0 = -1, g0 = 0, b0 = 0, diff = 0;
    for (let i = 0; i + 3 < b.length; i += 16) {
      tot++; const bb = b[i], gg = b[i + 1], rr = b[i + 2], aa = b[i + 3];
      if (aa < 24) continue; vis++;
      if (r0 < 0) { r0 = rr; g0 = gg; b0 = bb; } else if (Math.abs(rr - r0) + Math.abs(gg - g0) + Math.abs(bb - b0) > 40) diff++;
    }
    return vis < tot * 0.004 || diff < Math.max(3, vis * 0.002);
  } catch (e) { return false; }
}


/* أيقونات ويندوز «العامة» (النافذة الزرقاء للبرامج / الورقة بسهم للاختصارات): نكتشفها ونرفضها عشان ما تظهر مكان الأيقونة الحقيقية */
let genericP = null;
function loadGeneric() {
  if (genericP) return genericP;
  genericP = (async () => {
    const set = new Set();
    try {
      const dir = path.join(require('os').tmpdir(), 'kz-generic'); fs.mkdirSync(dir, { recursive: true });
      for (const ext of ['.exe', '.lnk', '.url', '.dll', '.jar', '.bat', '.cmd', '.msi', '.com', '.txt']) {
        const f = path.join(dir, 'g' + ext); try { fs.writeFileSync(f, ''); } catch (e) { continue; }
        for (const sz of ['large', 'normal', 'small']) { try { const ic = await app.getFileIcon(f, { size: sz }); if (!ic.isEmpty()) set.add(crypto.createHash('sha1').update(ic.toPNG()).digest('hex')); } catch (e) {} }
      }
    } catch (e) {}
    return set;
  })();
  return genericP;
}
async function isGenericIcon(img) { try { const s = await loadGeneric(); return s.has(crypto.createHash('sha1').update(img.toPNG()).digest('hex')); } catch (e) { return false; } }
async function goodIcon(ic) { return !!ic && !ic.isEmpty() && !isBlank(ic) && !(await isGenericIcon(ic)); }

/* أيقونة تطبيقات متجر ويندوز (MSIX) عن طريق اسم الحزمة */
function msixKey(p) {
  try {
    let target = p, args = '', aumid = '';
    if (/\.lnk$/i.test(p)) { const r = shell.readShortcutLink(p); target = r.target || ''; args = r.args || ''; aumid = r.appUserModelId || ''; }
    let m = /([A-Za-z0-9.\-]+_[a-z0-9]{13})!/.exec(aumid || '') || /AppsFolder\\([A-Za-z0-9.\-]+_[a-z0-9]{13})!/i.exec(args + ' ' + target);
    if (m) return m[1];
    m = /WindowsApps\\([^\\_]+)_[^_\\]+_[^_\\]*__([a-z0-9]{13})/i.exec(target || '');
    if (m) return m[1] + '_' + m[2];
  } catch (e) {}
  return '';
}
function psMsixIcon(key) {
  return new Promise(res => {
    if (process.platform !== 'win32' || !key) return res('');
    const script = "$ErrorActionPreference='SilentlyContinue'; $k=$env:KZ_K; $pkg=Get-AppxPackage | Where-Object { $_.PackageFamilyName -eq $k } | Select-Object -First 1; if(-not $pkg){exit}; $loc=$pkg.InstallLocation; [xml]$m=Get-Content (Join-Path $loc 'AppxManifest.xml'); $app=$m.Package.Applications.Application | Select-Object -First 1; $ve=$app.VisualElements; $logo=$ve.Square44x44Logo; if(-not $logo){$logo=$ve.Square150x150Logo}; if(-not $logo){$logo=$m.Package.Properties.Logo}; $rel=($logo -replace '/','\\\\'); $dir=Join-Path $loc (Split-Path $rel); $stem=[IO.Path]::GetFileNameWithoutExtension($rel); $f=Get-ChildItem $dir -Filter ($stem+'*.png') | Sort-Object Length -Descending | Select-Object -First 1; if($f){[Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName))}";
    try {
      require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, timeout: 12000, env: { ...process.env, KZ_K: key }, maxBuffer: 8 * 1024 * 1024 }, (err, out) => {
        const b = String(out || '').trim(); if (err || !/^[A-Za-z0-9+/=]{100,}$/.test(b)) return res('');
        try { const img = nativeImage.createFromBuffer(Buffer.from(b, 'base64')); if (img.isEmpty()) return res(''); res(img.resize({ width: Math.min(256, img.getSize().width) }).toDataURL()); } catch (e) { res(''); }
      });
    } catch (e) { res(''); }
  });
}

/* أيقونة حقيقية من داخل الاختصارات (.lnk / .url) بدل الأيقونة العامة */
const expandEnv = v => String(v || '').replace(/"/g, '').replace(/%([^%]+)%/g, (m, k) => process.env[k] || m);
async function iconFromFile(f) {
  try {
    f = expandEnv(f).trim();
    if (!f || !fs.existsSync(f)) return '';
    const e = path.extname(f).toLowerCase();
    if (['.ico', '.png', '.jpg', '.jpeg', '.bmp'].includes(e)) {
      const n = nativeImage.createFromPath(f);
      if (!n.isEmpty() && !isBlank(n)) return n.toDataURL();
    }
    const ic = await app.getFileIcon(f, { size: 'large' });
    if (await goodIcon(ic)) return ic.toDataURL();
  } catch (e) {}
  return '';
}
async function steamHeader(id) {
  for (const u of [`https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`, `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`]) {
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 7000);
      const r = await fetch(u, { signal: ctl.signal }); clearTimeout(to);
      if (!r.ok) continue;
      const n = nativeImage.createFromBuffer(Buffer.from(await r.arrayBuffer()));
      if (!n.isEmpty()) { const sz = n.getSize(); return 'data:image/jpeg;base64,' + n.resize({ width: Math.min(300, sz.width) }).toJPEG(80).toString('base64'); }
    } catch (e) {}
  }
  return '';
}
async function shortcutThumb(p, ext) {
  try {
    if (ext === '.lnk' && process.platform === 'win32') {
      const r = shell.readShortcutLink(p);
      let t = await iconFromFile(r.icon); if (t) return t;
      t = await iconFromFile(r.target); if (t) return t;
    } else if (ext === '.url') {
      const txt = fs.readFileSync(p, 'utf8');
      const g = k => { const m = txt.match(new RegExp('^' + k + '=(.*)$', 'mi')); return m ? m[1].trim() : ''; };
      let t = await iconFromFile(g('IconFile')); if (t) return t;
      const m = g('URL').match(/steam:\/\/rungameid\/(\d+)/i);
      if (m) { t = await steamHeader(m[1]); if (t) return t; }
    }
  } catch (e) {}
  return '';
}


/* ---------- بدائل أيقونات التطبيقات (للبرامج الحديثة: Electron / MSIX / متجر ويندوز) ---------- */
function psIcon(p) {
  return new Promise(res => {
    if (process.platform !== 'win32') return res('');
    const script = "Add-Type -AssemblyName System.Drawing; $i=[System.Drawing.Icon]::ExtractAssociatedIcon($env:KZ_P); if($i){$b=$i.ToBitmap();$ms=New-Object IO.MemoryStream;$b.Save($ms,[System.Drawing.Imaging.ImageFormat]::Png);[Convert]::ToBase64String($ms.ToArray())}";
    try {
      require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, timeout: 9000, env: { ...process.env, KZ_P: p }, maxBuffer: 4 * 1024 * 1024 }, (err, out) => {
        const b = String(out || '').trim(); res(!err && /^[A-Za-z0-9+/=]{100,}$/.test(b) ? 'data:image/png;base64,' + b : '');
      });
    } catch (e) { res(''); }
  });
}
function nearbyIconFile(exe) {
  try {
    const dir = path.dirname(exe), base = path.basename(exe, path.extname(exe));
    const names = [base + '.ico', base + '.png', 'icon.ico', 'app.ico', 'icon.png', 'logo.png', 'resources/app.ico', 'resources/icon.ico', 'resources/icon.png', 'assets/icon.png', 'assets/icon.ico'];
    for (const n of names) { const f = path.join(dir, n); if (fs.existsSync(f)) { const img = nativeImage.createFromPath(f); if (!img.isEmpty()) return img.resize({ width: Math.min(256, img.getSize().width) }).toDataURL(); } }
    // MSIX / تطبيقات المتجر: الشعار من AppxManifest
    let d = dir;
    for (let k = 0; k < 3; k++, d = path.dirname(d)) {
      const mf = path.join(d, 'AppxManifest.xml'); if (!fs.existsSync(mf)) continue;
      const x = fs.readFileSync(mf, 'utf8'); const logos = [...x.matchAll(/(?:Square44x44Logo|Square150x150Logo|Logo)="([^"]+)"/g)].map(m => m[1]);
      for (const lg of logos) {
        const rel = lg.replace(/\//g, path.sep), ld = path.join(d, path.dirname(rel)), stem = path.basename(rel, path.extname(rel));
        let files = []; try { files = fs.readdirSync(ld).filter(n => n.toLowerCase().startsWith(stem.toLowerCase()) && /\.png$/i.test(n)); } catch (e) {}
        files.sort((a, b) => (fs.statSync(path.join(ld, b)).size - fs.statSync(path.join(ld, a)).size));
        if (files[0]) { const img = nativeImage.createFromPath(path.join(ld, files[0])); if (!img.isEmpty()) return img.resize({ width: Math.min(256, img.getSize().width) }).toDataURL(); }
      }
    }
  } catch (e) {}
  return '';
}
async function appIconFallback(p) {
  let target = p;
  try { if (/\.lnk$/i.test(p)) { const r = shell.readShortcutLink(p); if (r && r.target) target = r.target; } } catch (e) {}
  let t = '';
  const key = msixKey(p); if (key) { t = await psMsixIcon(key); if (t) return t; }
  if (/\.exe$/i.test(target)) { t = nearbyIconFile(target); if (t) return t; }
  t = await psIcon(target); if (t) return t;
  if (target !== p) { t = await psIcon(p); if (t) return t; }
  return '';
}

/* صورة مصغّرة لأي عنصر: معاينة ويندوز الحقيقية (صور، فيديو، PDF، مستندات، برامج) ثم بدائل */
async function makeThumb(p, kind) {
  const isIcon = kind === 'app' || kind === 'folder';
  const ext0 = path.extname(p).toLowerCase();
  if (ext0 === '.lnk' || ext0 === '.url') { const sc = await shortcutThumb(p, ext0); if (sc) return sc; }
  const appLike = isIcon || ext0 === '.exe' || ext0 === '.lnk';
  const viaIcon = async sz => { try { const ic = await app.getFileIcon(p, { size: sz || 'large' }); if (kind === 'folder' ? (!ic.isEmpty() && !isBlank(ic)) : await goodIcon(ic)) return ic.toDataURL(); } catch (e) {} return ''; };
  if (appLike) {
    let v = await viaIcon(); if (v) return v;
    if (kind !== 'folder') { try { v = await appIconFallback(p); if (v) return v; } catch (e) {} }
  }
  try {
    if (process.platform === 'win32' && typeof nativeImage.createThumbnailFromPath === 'function') {
      const t = await nativeImage.createThumbnailFromPath(p, { width: 256, height: 256 });
      if (t && !isBlank(t)) return isIcon ? t.toDataURL() : 'data:image/jpeg;base64,' + t.toJPEG(78).toString('base64');
    }
  } catch (e) {}
  try {
    if (kind === 'image') {
      const n = nativeImage.createFromPath(p);
      if (!n.isEmpty()) {
        const sz = n.getSize();
        return 'data:image/jpeg;base64,' + n.resize({ width: Math.min(256, sz.width) }).toJPEG(78).toString('base64');
      }
    }
  } catch (e) {}
  if (!appLike) { const v = await viaIcon(); if (v) return v; }
  try { await new Promise(r => setTimeout(r, 150)); const v = await viaIcon('normal'); if (v) return v; } catch (e) {}
  return '';
}

/* 🩺 تشخيص: يجرّب كل طريقة ويقول وش صار (عشان نعرف ليش صورة ما تطلع) */
ipcMain.handle('thumb:diag', async (_e, p) => {
  const L = []; const add = s => L.push(s);
  try {
    add('path: ' + p); add('exists: ' + fs.existsSync(p)); const ext = path.extname(p).toLowerCase(); add('ext: ' + ext + ' · platform: ' + process.platform);
    let target = p;
    if (ext === '.lnk') {
      try { const r = shell.readShortcutLink(p); add('lnk target: ' + r.target + ' (exists: ' + fs.existsSync(r.target || '') + ')'); add('lnk icon: ' + r.icon + ' idx ' + r.iconIndex + ' (exists: ' + fs.existsSync(expandEnv(r.icon || '')) + ')'); add('lnk args: ' + (r.args || '')); if (r.target) target = r.target; } catch (e) { add('readShortcutLink ERR ' + e.message); }
      try { const s = await shortcutThumb(p, ext); add('shortcutThumb: ' + (s ? s.length + ' chars' : 'EMPTY')); } catch (e) { add('shortcutThumb ERR ' + e.message); }
    }
    try { const t = await nativeImage.createThumbnailFromPath(p, { width: 256, height: 256 }); const s = t.getSize(); add(`createThumbnailFromPath: ${s.width}x${s.height} empty=${t.isEmpty()} blank=${isBlank(t)}`); } catch (e) { add('createThumbnailFromPath ERR ' + e.message); }
    for (const sz of ['large', 'normal']) { try { const ic = await app.getFileIcon(p, { size: sz }); const s = ic.getSize(); add(`getFileIcon(${sz}): ${s.width}x${s.height} empty=${ic.isEmpty()} blank=${isBlank(ic)}`); } catch (e) { add(`getFileIcon(${sz}) ERR ` + e.message); } }
    if (target !== p) { try { const ic = await app.getFileIcon(target, { size: 'large' }); const s = ic.getSize(); add(`getFileIcon(target): ${s.width}x${s.height} empty=${ic.isEmpty()} blank=${isBlank(ic)}`); } catch (e) { add('getFileIcon(target) ERR ' + e.message); } }
    add('msix key: ' + (msixKey(p) || 'none'));
    try { const g = await loadGeneric(); add('generic icons known: ' + g.size); const ic = await app.getFileIcon(p, { size: 'large' }); add('getFileIcon is generic: ' + (await isGenericIcon(ic))); } catch (e) { add('generic ERR ' + e.message); }
    const ni = /\.exe$/i.test(target) ? nearbyIconFile(target) : ''; add('nearbyIcon: ' + (ni ? ni.length + ' chars' : 'none'));
    const ps = await psIcon(target); add('powershell icon: ' + (ps ? ps.length + ' chars' : 'EMPTY'));
    const fin = await makeThumb(p, ext === '.exe' || ext === '.lnk' ? 'app' : 'other'); add('FINAL makeThumb: ' + (fin ? fin.length + ' chars' : 'EMPTY'));
  } catch (e) { add('DIAG ERR ' + e.message); }
  return L.join('\n');
});

async function inspectPath(p) {
  let st;
  try { st = fs.statSync(p); } catch (e) { return { error: 'not_found' }; }
  const ext = path.extname(p).toLowerCase();
  const isDir = st.isDirectory();
  const out = { path: p, base: path.basename(p), ext, size: st.size, isDir, mtime: st.mtimeMs, kind: kindOf(ext, isDir) };
  out.thumb = await makeThumb(p, out.kind);
  try {
    if (!isDir && TEXT_EXT.has(ext) && st.size < 5 * 1024 * 1024) {
      const fd = fs.openSync(p, 'r'); const buf = Buffer.alloc(2000);
      const n = fs.readSync(fd, buf, 0, 2000, 0); fs.closeSync(fd);
      out.snippet = buf.slice(0, n).toString('utf8');
    }
  } catch (e) {}
  return out;
}

/* ---------- Claude ---------- */
async function callClaude({ system, content, max = 800 }) {
  const key = getKey();
  if (!key) return { ok: false, error: 'no_key' };
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: max, system, messages: [{ role: 'user', content }] }),
      signal: AbortSignal.timeout(20000) // لو النت علّق ما يظل الزر «…» للأبد
    });
    const d = await r.json();
    if (!r.ok) return { ok: false, error: (d && d.error && d.error.message) || ('HTTP ' + r.status) };
    const t = (d.content || []).map(c => c.text || '').join('');
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: 'bad_reply' };
    return { ok: true, data: JSON.parse(m[0]) };
  } catch (e) {
    if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) return { ok: false, error: 'ما رد خلال 20 ثانية، تأكد من النت وجرّب مرة ثانية' };
    return { ok: false, error: String(e.message || e) };
  }
}

ipcMain.handle('ai:suggest', async (_e, d) => {
  const blocks = [];
  try {
    if (d.kind === 'image' && d.path) {
      const n = nativeImage.createFromPath(d.path);
      if (!n.isEmpty()) {
        const sz = n.getSize();
        const jpg = n.resize({ width: Math.min(1024, sz.width) }).toJPEG(80);
        blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpg.toString('base64') } });
      }
    }
  } catch (e) {}
  const lines = [
    'هذا عنصر يريد المستخدم حفظه في خزانته الشخصية.',
    'النوع: ' + d.kind,
    d.base ? 'اسم الملف: ' + d.base : '',
    d.ext ? 'الامتداد: ' + d.ext : '',
    d.size ? 'الحجم: ' + Math.round(d.size / 1024) + ' KB' : '',
    d.url ? 'الرابط: ' + d.url : '',
    'الفئات الموجودة عنده: ' + ((d.cats || []).join('، ') || 'لا شي بعد'),
    d.snippet ? 'بداية المحتوى:\n' + String(d.snippet).slice(0, 1500) : ''
  ].filter(Boolean).join('\n');
  blocks.push({ type: 'text', text: lines });
  const system = 'أنت مساعد تنظيم شخصي. ارجع JSON فقط بهذا الشكل: {"name":"اسم واضح وقصير للعنصر (نظّف الأسماء التقنية للملفات، ولا تغيّر اسم برنامج أو موقع معروف)","desc":"وصف عربي بجملة أو جملتين: شنو هذا العنصر ولشنو يُستخدم","category":"تصنيف عربي قصير؛ استخدم واحداً من فئات المستخدم الموجودة إذا ناسب، وإلا اقترح جديداً","tags":"4 إلى 6 كلمات مفتاحية بالعربي والإنجليزي مفصولة بفاصلة"}. إذا ما تعرف العنصر لا تخترع تفاصيل، اكتفِ بما هو ظاهر.';
  return callClaude({ system, content: blocks, max: 500 });
});

ipcMain.handle('ai:search', async (_e, d) => {
  const system = 'أنت مساعد يبحث في خزانة المستخدم الشخصية (ملفات، صور، برامج، روابط، ملاحظات). افهم وصف المستخدم (عربي أو إنجليزي) وارجع JSON فقط: {"matches":[{"id":"...","reason":"سبب قصير بالعربي"}],"suggestions":[{"name":"...","desc":"...","category":"..."}]}. matches: فقط ids موجودة في القائمة، مرتبة من الأنسب، وفاضية إذا ما في شي مناسب. suggestions: فقط إذا كان المستخدم يبحث عن برنامج أو أداة وما لقيتها في القائمة، اقترح حتى 3 برامج حقيقية ومعروفة (يفضّل المجانية) مع وصف بجملة وحدة، وإلا اتركها فاضية. لا تكتب شي خارج JSON.';
  return callClaude({ system, content: 'قائمة خزانتي:\n' + JSON.stringify(d.items) + '\n\nطلبي: ' + d.query, max: 1500 });
});

ipcMain.handle('ai:fill', async (_e, d) => {
  const system = 'ارجع JSON فقط: {"items":[{"id":"نفس المعرّف","desc":"وصف عربي بجملة أو جملتين","category":"تصنيف عربي قصير","tags":"3 إلى 5 كلمات مفتاحية"}]}. إذا ما تعرف عنصراً اترك desc فاضياً ولا تخترع.';
  return callClaude({ system, content: 'العناصر:\n' + JSON.stringify(d.items), max: 4000 });
});


/* ---------- ملاحظة سريعة (Ctrl+Alt+N) ---------- */
let capWin = null;
function openCapture() {
  const wa = require('electron').screen.getDisplayNearestPoint(require('electron').screen.getCursorScreenPoint()).workArea;
  if (capWin && !capWin.isDestroyed()) {
    if (capWin.isVisible()) { capWin.hide(); return; }
    capWin.setPosition(Math.round(wa.x + (wa.width - 560) / 2), Math.round(wa.y + wa.height * 0.2));
    capWin.show(); capWin.focus(); capWin.webContents.send('cap:reset'); return;
  }
  capWin = new BrowserWindow({
    width: 560, height: 330, x: Math.round(wa.x + (wa.width - 560) / 2), y: Math.round(wa.y + wa.height * 0.2),
    frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, show: false,
    minimizable: false, maximizable: false, title: 'ملاحظة سريعة',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  capWin.loadFile(uiFile('capture.html'));
  capWin.once('ready-to-show', () => { capWin.show(); capWin.focus(); });
  capWin.on('blur', () => { if (capWin && !capWin.isDestroyed() && capWin.isVisible()) capWin.webContents.send('cap:blur'); });
  capWin.on('closed', () => { capWin = null; });
  capWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  capWin.webContents.on('will-navigate', e => e.preventDefault());
}
ipcMain.handle('cap:hide', () => { if (capWin && !capWin.isDestroyed()) capWin.hide(); return true; });
// الملاحظة السريعة: نرسلها للنافذة الرئيسية وننتظر تأكيد إنها انحفظت فعلاً قبل ما تطلع ✓
const extAcks = new Map(); let extAckN = 0;
ipcMain.handle('ext:ack', (_e, id, ok) => { const r = extAcks.get(id); if (r) { extAcks.delete(id); r(!!ok); } return true; });
function sendExtAwait(msg, ms = 8000) {
  return new Promise(res => {
    if (!win || win.isDestroyed() || win.webContents.isCrashed()) return res(false);
    const id = 'a' + (++extAckN); const t = setTimeout(() => { extAcks.delete(id); res(false); }, ms);
    extAcks.set(id, ok => { clearTimeout(t); res(ok); });
    try { win.webContents.send('ext', { ...msg, ack: id }); } catch (e) { clearTimeout(t); extAcks.delete(id); res(false); }
  });
}
ipcMain.handle('cap:save', async (_e, d) => {
  const ok = await sendExtAwait({ type: 'note', text: String((d && d.text) || '').slice(0, 20000), tags: String((d && d.tags) || '').slice(0, 200) });
  if (ok && capWin && !capWin.isDestroyed()) capWin.hide();
  return ok;
});
const NOTE_AI = {
  summarize: ['لخّص الملاحظة بنقاط قصيرة بنفس لغة النص. ارجع JSON فقط: {"text":"الملخص بصيغة ماركداون"}', 600],
  tasks: ['استخرج المهام القابلة للتنفيذ من الملاحظة. ارجع JSON فقط: {"tasks":["مهمة قصيرة","..."]} بنفس لغة النص. إذا ما فيه مهام ارجع قائمة فاضية.', 600],
  tags: ['اقترح من 2 إلى 5 وسوم قصيرة (كلمة وحدة لكل وسم) تناسب الملاحظة. ارجع JSON فقط: {"tags":"وسم1 وسم2 وسم3"}', 200],
  improve: ['حسّن صياغة الملاحظة وصحّح الأخطاء الإملائية مع الحفاظ على المعنى والتنسيق (ماركداون وقوائم المهام) وبنفس اللغة، ولا تضف معلومات جديدة. ارجع JSON فقط: {"text":"النص المحسّن"}', 3000]
};
ipcMain.handle('ai:note', async (_e, d) => {
  const a = NOTE_AI[d && d.action]; if (!a) return { ok: false, error: 'bad_action' };
  return callClaude({ system: a[0], content: 'عنوان: ' + String(d.title || '').slice(0, 200) + '\n\n' + String(d.text || '').slice(0, 12000), max: a[1] });
});

/* ---------- IPC ---------- */
/* ---------- 🗄 الخزنة بالذاكرة ----------
   - نقرأ الملف مرة وحدة ونخليه بالذاكرة (الحاويات ما تقرأ القرص كل ثانيتين)
   - الحفظ مؤجّل 300ms (لو صار كذا تعديل ورا بعض نكتب مرة وحدة) ونكمّل الحفظ قبل ما يسكّر البرنامج
   - لو الملف خربان: نجرّب vault.bak.json ثم آخر نسخة احتياطية سليمة، والملف الخربان ننقله جنب باسم vault.corrupt-التاريخ.json */
const vault = { file: '', data: null, str: '', diskStr: null, diskCount: -1, dirty: false, timer: null, epoch: 0, recovered: null, retry: null };
const loadedEpoch = new Map(); // كل نافذة: آخر مرة حمّلت فيها الخزنة (عشان ما تحفظ بيانات قديمة فوق الجديدة)
function vaultBackupsNewestFirst(f) {
  try {
    const base = path.basename(f), tag = base === 'vault.json' ? '' : base.slice(6, -5) + '-';
    const re = new RegExp('^khazana-(backup|before-restore)-' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\d{4}-\\d\\d-\\d\\d(?:[-_T0-9]*)\\.json$');
    const dir = backupDir();
    return fs.readdirSync(dir).filter(n => re.test(n)).map(n => { const p = path.join(dir, n); let t = 0; try { t = fs.statSync(p).mtimeMs; } catch (e) {} return { p, t }; }).sort((a, b) => b.t - a.t).map(x => x.p);
  } catch (e) { return []; }
}
function readVaultFromDisk(f) {
  let r = tryReadJSON(f);
  for (let k = 0; !r.ok && !r.missing && !r.corrupt && k < 4; k++) { sleepSync(150); r = tryReadJSON(f); } // ملف مقفول لحظة
  if (r.ok && isVaultData(r.data)) return { data: Array.isArray(r.data) ? { items: r.data } : r.data, text: r.text };
  if (!r.ok && !r.missing && !r.corrupt) return { error: String((r.error && r.error.code) || r.error) }; // ما قدرنا نقرأ: لا نحفظ فوقه
  const cands = [bakOf(f), ...vaultBackupsNewestFirst(f)];
  if (r.missing) { // مستخدم جديد، إلا لو فيه .bak فيه بيانات (نادر)
    const b = tryReadJSON(cands[0]);
    if (!(b.ok && isVaultData(b.data) && vaultCount(b.data) > 0)) return { data: { items: [] }, text: null, fresh: true };
  }
  // الملف خربان (أو ناقص): ندوّر على أحدث نسخة سليمة، ونفضّل اللي فيها بيانات
  let pick = null, firstValid = null;
  for (const c of cands) {
    const b = tryReadJSON(c); if (!b.ok || !isVaultData(b.data)) continue;
    const item = { file: c, data: Array.isArray(b.data) ? { items: b.data } : b.data, text: b.text, count: vaultCount(b.data) };
    if (!firstValid) firstValid = item;
    if (item.count > 0) { pick = item; break; }
  }
  pick = pick || firstValid;
  let corrupt = '';
  if (!r.missing) { // ننقل الملف الخربان جنب (ما نحذفه أبداً)
    corrupt = f.replace(/\.json$/, '.corrupt-' + stampNow() + '.json');
    try { fs.renameSync(f, corrupt); } catch (e) { try { fs.copyFileSync(f, corrupt); } catch (e2) { corrupt = ''; } }
  }
  const info = { at: Date.now(), from: pick ? path.basename(pick.file) : '', count: pick ? pick.count : 0, corrupt: corrupt ? path.basename(corrupt) : '', missing: !!r.missing };
  if (pick) { try { writeFileAtomic(f, pick.text); } catch (e) {} }
  return { data: pick ? pick.data : { items: [] }, text: pick ? pick.text : null, recovered: info };
}
function vaultLoad() {
  const f = vaultFile();
  if (vault.data && vault.file === f) return vault.data;
  vaultFlush(); // لو تغيّر الملف الشخصي نكمّل حفظ القديم أول
  const r = readVaultFromDisk(f);
  if (r.error) { vault.file = ''; vault.data = null; return { items: [], loadError: r.error }; }
  vault.file = f; vault.data = r.data; vault.str = JSON.stringify(r.data); vault.dirty = false;
  vault.diskStr = r.text; vault.diskCount = r.text == null ? -1 : vaultCount(r.data);
  vault.epoch++;
  if (r.recovered) { vault.recovered = r.recovered; console.warn('[khazana] vault recovered', JSON.stringify(r.recovered)); }
  return vault.data;
}
function vaultFlush() {
  clearTimeout(vault.timer); vault.timer = null;
  if (!vault.dirty || !vault.file) return true;
  try {
    if (vault.diskStr != null) { // آخر نسخة سليمة على القرص تصير .bak (إلا لو كانت فاضية والـ .bak فيه بيانات)
      let keep = false;
      if (vault.diskCount === 0) { const old = tryReadJSON(bakOf(vault.file)); keep = old.ok && vaultCount(old.data) > 0; }
      if (!keep) writeFileAtomic(bakOf(vault.file), vault.diskStr);
    }
    writeFileAtomic(vault.file, vault.str);
    vault.diskStr = vault.str; vault.diskCount = vaultCount(vault.data); vault.dirty = false;
    return true;
  } catch (e) {
    console.error('[khazana] save failed', e && e.message);
    clearTimeout(vault.retry); vault.retry = setTimeout(vaultFlush, 2000); // نعيد المحاولة (مثلاً القرص كان مقفول)
    return false;
  }
}
let fencePushT = null;
function pushVaultToFences() { // نبلّغ الحاويات إن البيانات تغيّرت (بدل ما تسأل كل 2.5 ثانية)
  clearTimeout(fencePushT);
  fencePushT = setTimeout(() => { fences.forEach(w => { try { if (!w.isDestroyed()) w.webContents.send('vault:changed'); } catch (e) {} }); }, 150);
}
function vaultSet(items) {
  const data = { items: Array.isArray(items) ? items : [] };
  const str = JSON.stringify(data);
  if (str === vault.str) return false; // ما تغيّر شي
  vault.data = data; vault.str = str; vault.dirty = true;
  clearTimeout(vault.timer); vault.timer = setTimeout(vaultFlush, 300);
  pushVaultToFences();
  return true;
}
function vaultReplace(data) { // استرجاع نسخة: نكتب على طول ونخلي كل النوافذ تعيد التحميل
  vaultLoad(); vault.data = Array.isArray(data) ? { items: data } : data; vault.str = JSON.stringify(vault.data); vault.dirty = true;
  const ok = vaultFlush(); vault.epoch++; pushVaultToFences(); return ok;
}
function recoveredText(r) {
  if (r.from) return '⚠ ملف الخزنة كان خربان، استرجعنا آخر نسخة سليمة ✓\n' + 'رجّعنا ' + r.count + ' عنصر/ملاحظة من «' + r.from + '».' + (r.corrupt ? '\nالملف الخربان ما انحذف، محفوظ باسم «' + r.corrupt + '» بمجلد البيانات.' : '');
  return '⚠ ملف الخزنة خربان وما لقينا نسخة سليمة نسترجعها.\n' + (r.corrupt ? 'الملف الخربان ما انحذف، محفوظ باسم «' + r.corrupt + '» بمجلد البيانات، وتقدر تسترجع من «النسخ الاحتياطية».' : '');
}
let bootOK = false;
ipcMain.handle('vault:load', e => {
  const v = vaultLoad();
  if (!v.loadError) loadedEpoch.set(e.sender.id, vault.epoch);
  if (win && !win.isDestroyed() && e.sender === win.webContents) { if (!bootOK) { bootOK = true; markUpdateBootOK(); } }
  let recovered = null;
  if (vault.recovered && win && !win.isDestroyed() && e.sender === win.webContents) {
    recovered = vault.recovered; vault.recovered = null; recovered.msg = recoveredText(recovered);
    const w = win; setTimeout(() => { try { if (w && !w.isDestroyed()) dialog.showMessageBox(w, { type: 'warning', title: 'خزنة', message: recovered.msg.split('\n')[0], detail: recovered.msg.split('\n').slice(1).join('\n') }); } catch (er) {} }, 1200);
  }
  return { items: Array.isArray(v.items) ? v.items : [], hasKey: !!getKey(), recovered, loadError: v.loadError || '' };
});
ipcMain.handle('vault:save', (e, items) => {
  // نرفض الحفظ من نافذة ما حمّلت الخزنة الحالية (مثلاً بعد استرجاع نسخة أو تبديل الملف الشخصي)
  if (!vault.data || vault.file !== vaultFile() || loadedEpoch.get(e.sender.id) !== vault.epoch) return false;
  vaultSet(items); return true;
});
ipcMain.handle('file:inspect', (_e, p) => inspectPath(p));
ipcMain.handle('thumb:make', (_e, p, kind) => (typeof p === 'string' && fs.existsSync(p)) ? makeThumb(p, kind) : '');
ipcMain.handle('pick', async (_e, o = {}) => {
  const props = [o.dirs ? 'openDirectory' : 'openFile'];
  if (o.multi) props.push('multiSelections');
  const r = await dialog.showOpenDialog(win, { properties: props });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('item:open', async (_e, p) => {
  if (typeof p !== 'string' || !p) return { ok: false, error: 'no_path' };
  if (!fs.existsSync(p)) return { ok: false, error: 'missing' };
  const err = await shell.openPath(p);
  return err ? { ok: false, error: err } : { ok: true };
});
ipcMain.handle('item:reveal', (_e, p) => { if (typeof p === 'string' && fs.existsSync(p)) shell.showItemInFolder(p); return true; });
ipcMain.handle('item:openUrl', async (_e, u) => {
  if (typeof u === 'string' && /^https?:\/\//i.test(u)) { await shell.openExternal(u); return true; }
  return false;
});
/* لو العنصر اختصار (.lnk) نتأكد إن البرنامج اللي يشاور عليه موجود (عشان اختصارات الألعاب اللي انحذف/انتقل ملفها الأصلي) */
function lnkTargetMissing(p) {
  try {
    if (!/\.lnk$/i.test(p) || process.platform !== 'win32') return '';
    const r = shell.readShortcutLink(p); const t = r && r.target;
    if (!t || /windowsapps|explorer\.exe$|^shell:|^[a-z][a-z0-9+.-]+:\/\//i.test(t) || !/[\\/]/.test(t)) return '';
    return fs.existsSync(t) ? '' : t;
  } catch (e) { return ''; }
}
ipcMain.handle('items:exists', (_e, paths) => (paths || []).map(p => { try { return fs.existsSync(p) && !lnkTargetMissing(p); } catch (e) { return false; } }));


/* ---------- 📦 نقل الملفات لمجلد خزنة (بدل ما تظل في سطح المكتب) ---------- */
const filesRoot = () => { const c = getSet().filesDir; return c && typeof c === 'string' ? c : path.join(app.getPath('documents'), 'Khazana Files'); };
const safeName = s => String(s || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 60);
// حماية النقل:
//  - مجلدات النظام والبرامج (Windows, Program Files, ProgramData, AppData, مجلد خزنة نفسه…): ممنوع ننقلها أو أي شي داخلها
//  - المجلدات الخاصة (مجلد المستخدم، سطح المكتب، المستندات، التنزيلات…): ممنوع ننقل المجلد نفسه أو اللي يحتويه، بس الملفات اللي داخله عادي
//  - جذر أي قرص (C:\ D:\) ممنوع
function moveGuards() {
  const norm = p => (p && typeof p === 'string') ? path.resolve(p).toLowerCase() : '';
  const gp = k => { try { return app.getPath(k); } catch (e) { return ''; } };
  const env = process.env;
  const system = [env.WINDIR, env.SystemRoot, env.ProgramFiles, env['ProgramFiles(x86)'], env.ProgramW6432, env.ProgramData, env.APPDATA, env.LOCALAPPDATA, gp('appData'), gp('userData'),
    __dirname, path.dirname(process.execPath)].map(norm).filter(Boolean);
  const special = [gp('home'), gp('desktop'), gp('documents'), gp('downloads'), gp('pictures'), gp('music'), gp('videos'), gp('temp'), env.USERPROFILE, env.PUBLIC,
    env.SystemDrive ? env.SystemDrive + '\\Users' : ''].map(norm).filter(Boolean);
  return { system, special };
}
function blockedForMove(p) {
  const low = path.resolve(p).toLowerCase(), sep = path.sep;
  if (path.dirname(low) === low) return true; // جذر قرص
  if (/^[a-z]:[\\/](windows|program files( \(x86\))?|programdata|\$recycle\.bin|system volume information)([\\/]|$)/i.test(low) || /[\\/]appdata([\\/]|$)/i.test(low)) return true;
  const { system, special } = moveGuards();
  const inside = (a, b) => a === b || a.startsWith(b + sep); // a داخل b
  if (system.some(b => inside(low, b) || b.startsWith(low + sep))) return true;
  if (special.some(b => low === b || b.startsWith(low + sep))) return true;
  return false;
}
// عدّ ملفات مجلد وحجمه (بحد أقصى عشان ما يعلّق)
function dirStats(dir, cap = 20000) {
  let count = 0, size = 0, over = false; const stack = [dir];
  while (stack.length) {
    const d = stack.pop(); let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of ents) {
      const f = path.join(d, e.name);
      if (e.isSymbolicLink()) { count++; continue; }
      if (e.isDirectory()) stack.push(f); else { count++; try { size += fs.statSync(f).size; } catch (er) {} }
      if (count > cap) { over = true; return { count, size, over }; }
    }
  }
  return { count, size, over };
}
// قائمة كل الملفات مع أحجامها (للتأكد إن النسخ كامل قبل ما نحذف الأصل)
function treeList(p) {
  const st = fs.statSync(p); if (!st.isDirectory()) return new Map([['', st.size]]);
  const out = new Map(), stack = [['', p]];
  while (stack.length) {
    const [rel, d] = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name, f = path.join(d, e.name);
      if (e.isDirectory()) { out.set(r + '/', -1); stack.push([r, f]); } else out.set(r, fs.statSync(f).size);
    }
  }
  return out;
}
function sameTree(a, b) {
  const A = treeList(a), B = treeList(b); if (A.size !== B.size) return false;
  for (const [k, v] of A) if (B.get(k) !== v) return false;
  return true;
}
function uniqueDest(dir, name) {
  let t = path.join(dir, name), k = 1; const ext = path.extname(name), base = path.basename(name, ext);
  while (fs.existsSync(t)) t = path.join(dir, `${base} (${k++})${ext}`);
  return t;
}
function moveAny(src, dst) {
  try { fs.renameSync(src, dst); return; } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EBUSY' || e.code === 'EACCES') { const er = new Error('in_use'); er.code = 'IN_USE'; throw er; } // الملف مفتوح ببرنامج ثاني: ما ننسخ ونحذف
    if (e.code !== 'EXDEV') throw e;
  }
  // قرص ثاني (EXDEV): ننسخ، نتأكد إن النسخة كاملة، وبعدين نشيل الأصل. لو صار أي خطأ نرجّع كل شي مثل ما كان
  try {
    fs.cpSync(src, dst, { recursive: true, errorOnExist: true, force: false });
    if (!sameTree(src, dst)) throw new Error('copy_incomplete');
  } catch (e) { try { fs.rmSync(dst, { recursive: true, force: true }); } catch (er) {} throw e; }
  // نغيّر اسم الأصل أول (لو مقفول يفشل هنا وما انحذف شي)، وبعدين نحذفه
  const trash = src + '.khazana-moving';
  try { fs.renameSync(src, trash); } catch (e) { try { fs.rmSync(dst, { recursive: true, force: true }); } catch (er) {} const er = new Error('in_use'); er.code = 'IN_USE'; throw er; }
  try { fs.rmSync(trash, { recursive: true, force: true }); } catch (e) { /* النسخة الجديدة كاملة؛ بقايا الأصل تظل باسم .khazana-moving */ }
}
ipcMain.handle('files:dir', () => { const d = filesRoot(); try { fs.mkdirSync(d, { recursive: true }); } catch (e) {} return d; });
ipcMain.handle('files:chooseDir', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); if (r.canceled || !r.filePaths[0]) return ''; setSet('filesDir', r.filePaths[0]); return r.filePaths[0]; });
ipcMain.handle('files:move', (_e, o = {}) => {
  const out = { moved: {}, skipped: [], failed: [], inUse: [], needConfirm: [] };
  const root = filesRoot();
  const okDirs = new Set(Array.isArray(o.allowDirs) ? o.allowDirs : []);
  for (const it of (Array.isArray(o.items) ? o.items : [])) {
    try {
      const src = it && it.path; if (typeof src !== 'string' || !src || !fs.existsSync(src)) { out.skipped.push(it && it.id); continue; }
      if (blockedForMove(src) || /\.lnk$/i.test(src) || path.resolve(src).toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep) || path.resolve(root).toLowerCase().startsWith(path.resolve(src).toLowerCase() + path.sep)) { out.skipped.push(it.id); continue; }
      if (fs.statSync(src).isDirectory() && !okDirs.has(it.id)) { // المجلدات ما تنتقل إلا بعد تأكيد واضح (مع عدد الملفات والحجم)
        const s = dirStats(src); out.needConfirm.push({ id: it.id, path: src, count: s.count, size: s.size, over: s.over }); continue;
      }
      const sub = safeName(it.section); const dir = sub ? path.join(root, sub) : root; fs.mkdirSync(dir, { recursive: true });
      const dst = uniqueDest(dir, path.basename(src)); moveAny(src, dst); out.moved[it.id] = dst;
    } catch (e) { if (e && e.code === 'IN_USE') out.inUse.push(it && it.id); else out.failed.push(it && it.id); }
  }
  return out;
});
ipcMain.handle('files:restore', (_e, o = {}) => {
  let n = 0;
  for (const mv of (Array.isArray(o.moves) ? o.moves : [])) {
    try { if (!mv || !fs.existsSync(mv.from) || fs.existsSync(mv.to)) continue; fs.mkdirSync(path.dirname(mv.to), { recursive: true }); moveAny(mv.from, mv.to); n++; } catch (e) {}
  }
  return n;
});

/* ---------- 🔧 إصلاح المسارات بعد نقل الملفات ---------- */
const RELOC_SKIP = new Set(['node_modules', '.git', '$recycle.bin', 'system volume information', 'windows', 'program files', 'program files (x86)', 'programdata', 'appdata', '.cache', 'cache']);
async function relocScan(roots, wanted, deadline) {
  const found = new Map(); let visited = 0;
  const stack = roots.map(r => [r, 0]);
  while (stack.length && Date.now() < deadline && visited < 150000) {
    const [dir, depth] = stack.pop();
    let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const en of ents) {
      visited++;
      const low = en.name.toLowerCase(), full = path.join(dir, en.name), isDir = en.isDirectory();
      if (wanted.has(low)) { const a = found.get(low) || []; a.push({ p: full, d: isDir }); found.set(low, a); }
      if (isDir && depth < 7 && !RELOC_SKIP.has(low) && !(en.name[0] === '.' && en.name.length > 1)) stack.push([full, depth + 1]);
    }
  }
  return found;
}
const segs = p => String(p).replace(/\\/g, '/').split('/').filter(Boolean).map(s => s.toLowerCase());
function commonTail(a, b) { let n = 0; const x = segs(a), y = segs(b); while (n < x.length && n < y.length && x[x.length - 1 - n] === y[y.length - 1 - n]) n++; return n; }
ipcMain.handle('items:relocate', async (_e, o = {}) => {
  const list = (Array.isArray(o.items) ? o.items : []).filter(i => i && typeof i.path === 'string' && i.path).map(i => { const t = fs.existsSync(i.path) ? lnkTargetMissing(i.path) : ''; return t ? { ...i, path: t, size: 0, isDir: false } : i; });
  const out = { fixed: {}, ambiguous: [], notFound: [] };
  if (!list.length) return out;
  const deadline = Date.now() + (o.budget || 12000);
  let roots = Array.isArray(o.roots) && o.roots.length ? o.roots.filter(r => typeof r === 'string') : [];
  if (!roots.length) {
    const home = app.getPath('home'); const set = new Set();
    for (const n of ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Videos', 'Music', 'OneDrive']) set.add(path.join(home, n));
    for (const it of list) { let d = path.dirname(it.path); for (let k = 0; k < 8 && d && d !== path.dirname(d); k++) { if (fs.existsSync(d)) { set.add(d); break; } d = path.dirname(d); } }
    roots = [...set].filter(r => { try { return fs.statSync(r).isDirectory(); } catch (e) { return false; } });
  }
  roots = roots.filter(r => !roots.some(q => q !== r && r.toLowerCase().startsWith(q.toLowerCase() + path.sep)));
  const wanted = new Set(list.map(i => path.basename(i.path).toLowerCase()));
  const found = await relocScan(roots, wanted, deadline);
  const unresolved = [];
  for (const it of list) {
    const c = (found.get(path.basename(it.path).toLowerCase()) || []).filter(x => !!x.d === !!it.isDir);
    if (!c.length) { unresolved.push(it); continue; }
    let pick = null;
    if (c.length === 1) pick = c[0];
    else {
      const sc = c.map(x => ({ x, n: commonTail(x.p, it.path) })).sort((a, b) => b.n - a.n);
      if (sc[0].n > sc[1].n) pick = sc[0].x;
      else if (it.size && !it.isDir) { const same = c.filter(x => { try { return fs.statSync(x.p).size === it.size; } catch (e) { return false; } }); if (same.length === 1) pick = same[0]; }
    }
    if (pick) out.fixed[it.id] = pick.p; else out.ambiguous.push(it.id);
  }
  // لو نُقل مجلد كامل: نطبّق نفس النقلة على باقي العناصر اللي تحت المجلد القديم
  const maps = [];
  for (const it of list) { const np = out.fixed[it.id]; if (!np) continue; const x = String(it.path).replace(/\\/g, '/').split('/'), y = String(np).replace(/\\/g, '/').split('/'); let n = 0; while (n < x.length - 1 && n < y.length - 1 && x[x.length - 1 - n].toLowerCase() === y[y.length - 1 - n].toLowerCase()) n++; if (n < x.length - 1) maps.push([x.slice(0, x.length - n).join('/').toLowerCase(), y.slice(0, y.length - n).join('/')]); }
  for (const it of unresolved) {
    const low = String(it.path).replace(/\\/g, '/'); let done = false;
    for (const [from, to] of maps) { if (low.toLowerCase().startsWith(from + '/') || low.toLowerCase() === from) { const cand = path.normalize(to + low.slice(from.length)); if (fs.existsSync(cand)) { out.fixed[it.id] = cand; done = true; break; } } }
    if (!done) out.notFound.push(it.id);
  }
  return out;
});
ipcMain.handle('key:has', () => !!getKey());
ipcMain.handle('key:set', (_e, k) => { setKey(String(k || '').trim()); return !!getKey(); });
ipcMain.handle('data:path', () => dataDir());

ipcMain.handle('backup:export', async () => {
  const r = await dialog.showSaveDialog(win, { defaultPath: 'khazana-backup.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return false;
  vaultFlush();
  fs.copyFileSync(vaultFile(), r.filePath);
  return true;
});
ipcMain.handle('backup:import', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  try {
    const d = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8').replace(/^﻿/, ''));
    return Array.isArray(d) ? d : (d.items || []);
  } catch (e) { return null; }
});

/* استيراد البرامج المثبتة من قائمة ابدأ (مع أيقوناتها، وزر التشغيل يفتح الاختصار نفسه) */
function walk(dir, out, depth = 0) {
  if (depth > 4) return;
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out, depth + 1);
    else if (e.name.toLowerCase().endsWith('.lnk')) out.push(f);
  }
}
ipcMain.handle('apps:scan', async () => {
  if (process.platform !== 'win32') return [];
  const roots = [
    path.join(process.env.ProgramData || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  ];
  const files = []; roots.forEach(r => walk(r, files));
  const skip = /uninstall|إلغاء تثبيت|readme|help|documentation|website|license|manual|release notes|repair|configure|\bupdate\b/i;
  const seen = new Set(); const list = [];
  for (const f of files) {
    const name = path.basename(f, '.lnk');
    if (skip.test(name)) continue;
    const key = name.toLowerCase(); if (seen.has(key)) continue;
    try {
      const t = shell.readShortcutLink(f).target || '';
      if (t && !/\.exe$/i.test(t)) continue;
    } catch (e) {}
    seen.add(key); list.push({ name, path: f });
  }
  for (let i = 0; i < list.length; i += 6) {
    await Promise.all(list.slice(i, i + 6).map(async it => {
      try { it.thumb = await makeThumb(it.path, 'app'); } catch (e) {}
    }));
  }
  for (const it of list) { if (it.thumb) continue; try { await new Promise(r => setTimeout(r, 120)); it.thumb = await makeThumb(it.path, 'app'); } catch (e) {} }
  return list;
});

/* ---------- النافذة ---------- */
const getSet = () => readJSON(settingsFile(), {});
const setSet = (k, v) => { const s = getSet(); s[k] = v; writeJSON(settingsFile(), s); };
const bgOn = () => getSet().bg !== false;
ipcMain.handle('app:alert', () => { if (!win) return false; if (win.isMinimized()) win.restore(); win.show(); win.focus(); win.flashFrame(true); return true; });
async function buildTray() {
  try {
    const ai = appIcon();
    const icon = ai ? ai.resize({ width: 32, height: 32 }) : await app.getFileIcon(process.execPath, { size: 'normal' });
    tray = new Tray(icon);
    tray.setToolTip('خزنة');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'فتح خزنة', click: () => showWin() },
      { label: 'نسخ احتياطي تلقائي يومي', type: 'checkbox', checked: getSet().autoBackup !== false, click: i => setSet('autoBackup', i.checked) },
      { label: 'إضافة من الحافظة  (Ctrl+Alt+V)', click: () => clipAdd() },
      { label: 'مراقبة مجلد التنزيلات (إشعار بالملفات الجديدة)', type: 'checkbox', checked: !!getSet().watchOn, click: i => { setSet('watchOn', i.checked); startWatch(); } },
      { label: 'بحث سريع  (Ctrl+Alt+F)', click: () => openQuick() },
      { label: 'ملاحظة سريعة  (Ctrl+Alt+N)', click: () => openCapture() },
      { label: 'إظهار / إخفاء الحاويات  (Ctrl+Alt+D)', click: () => toggleFences() },
      { label: 'خلّ التطبيق شغّال بعد الإغلاق (عشان التذكيرات)', type: 'checkbox', checked: bgOn(), click: i => setSet('bg', i.checked) },
      { label: 'شغّله مع ويندوز', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: i => app.setLoginItemSettings({ openAtLogin: i.checked, args: ['--hidden'] }) },
      { type: 'separator' },
      { label: 'خروج', click: () => { quitting = true; app.quit(); } }
    ]));
    tray.on('click', () => showWin());
  } catch (e) { tray = null; }
}
function showWin() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  win.webContents.send('focus-search');
}
function uiFile(name) {
  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  const ext = path.join(exeDir, 'ui', name);
  return app.isPackaged && fs.existsSync(ext) ? ext : path.join(__dirname, 'renderer', name);
}

/* ---------- 🔄 التحديث من GitHub (يجيب الملفات المتغيرة فقط) ---------- */
const UPD_BASE = 'https://raw.githubusercontent.com/a62724195-lab/khazana/main/';
const exeDirU = () => process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
const OKREL = /^(renderer\/[A-Za-z0-9._-]+|main\.js|preload\.js|assets\/[A-Za-z0-9._-]+)$/;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function localPathU(rel) {
  if (rel.startsWith('renderer/')) { const f = path.join(exeDirU(), 'ui', rel.slice(9)); if (app.isPackaged && fs.existsSync(f)) return f; return path.join(__dirname, rel); }
  return path.join(__dirname, rel);
}
function destPathU(rel) { return rel.startsWith('renderer/') && app.isPackaged ? path.join(exeDirU(), 'ui', rel.slice(9)) : path.join(__dirname, rel); }
async function fetchBuf(rel) {
  const r = await net.fetch(UPD_BASE + rel + '?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + rel);
  return Buffer.from(await r.arrayBuffer());
}
async function updCheck() {
  const man = JSON.parse((await fetchBuf('update/manifest.json')).toString('utf8'));
  const files = (man.files || []).filter(f => f && OKREL.test(f.path) && /^[0-9a-f]{64}$/.test(f.sha));
  const changed = files.filter(f => { try { return sha(fs.readFileSync(localPathU(f.path))) !== f.sha; } catch (e) { return true; } });
  return { man, files, changed };
}
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) return { ok: false, error: 'نسخة التطوير: التحديث التلقائي متوقف عشان ما يمسح تعديلاتك (حدّث بـ git pull)' };
  try { const { man, changed } = await updCheck(); return { ok: true, version: man.version, count: changed.length, names: changed.map(f => f.path) }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
});
/* KZ-UPDATE-SAFE:BEGIN — فحص التحديث قبل تركيبه (لا تحذف هذا الجزء: التحديث يرفض أي main.js ما فيه هالعلامات) */
const UPD_REQUIRED = ['main.js', 'preload.js', 'renderer/index.html', 'renderer/app.js'];
// يفحص الملفات اللي نزلت (بالمجلد المؤقت) قبل ما نركّبها. يرجّع قائمة المشاكل (فاضية = سليم)
function validateUpdateFiles(staged, getLocal) {
  const vm = require('vm'), errs = [];
  const get = rel => staged.has(rel) ? staged.get(rel) : getLocal(rel);
  for (const rel of UPD_REQUIRED) { const b = get(rel); if (!b || !b.length) errs.push('ملف ناقص: ' + rel); }
  for (const [rel, buf] of staged) {
    const text = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
    if (!text.trim() && !/^assets\//.test(rel)) { errs.push('ملف فاضي: ' + rel); continue; }
    try {
      if (/\.js$/i.test(rel)) new vm.Script(text.replace(/^#!.*/, ''), { filename: rel }); // فحص الكتابة (Syntax) بدون تشغيل
      else if (/\.json$/i.test(rel)) JSON.parse(text.replace(/^\uFEFF/, ''));
      else if (/\.html$/i.test(rel) && !/<html[\s>]/i.test(text)) errs.push('ملف HTML غريب: ' + rel);
    } catch (e) { errs.push(rel + ': ' + String(e.message || e).split('\n')[0]); }
  }
  const m = get('main.js'); const mt = m ? m.toString('utf8') : '';
  if (mt && !(mt.includes('KZ-UPDATE-SAFE:BEGIN') && mt.includes('KZ-ROLLBACK:BEGIN'))) errs.push('main.js الجديد ما فيه نظام التحديث الآمن أو الرجوع للنسخة السابقة');
  return errs;
}
/* KZ-UPDATE-SAFE:END */
const updBackupDir = () => path.join(dataDir(), 'update-backup');
ipcMain.handle('update:apply', async () => {
  // وأنت تبرمج (تشغيل من الكود بـ 1-شغّل-التطبيق.bat) التحديث ممنوع عشان ما يكتب فوق تعديلاتك
  if (!app.isPackaged) return { ok: false, error: 'التحديث التلقائي متوقف بنسخة التطوير (عشان ما يمسح تعديلاتك). حدّث بـ git pull' };
  let stageDir = '';
  try {
    const { man, files, changed } = await updCheck();
    // 1) ننزّل كل الملفات المتغيرة لمجلد مؤقت ونتأكد من البصمة
    stageDir = path.join(app.getPath('temp'), 'khazana-update-' + Date.now()); fs.mkdirSync(stageDir, { recursive: true });
    const bufs = new Map();
    for (const f of changed) {
      let b = null;
      for (let k = 0; k < 5; k++) { // جيت هب يتأخر تحديث الكاش أحياناً دقيقة: نعيد المحاولة
        try { b = await fetchBuf(f.path); } catch (e) { if (k === 4) throw e; b = null; }
        if (b && sha(b) === f.sha) break; b = null;
        await new Promise(r => setTimeout(r, 1500 * (k + 1)));
      }
      if (!b) throw new Error('الملف لسا ما تحدّث على الخادم، جرّب بعد دقيقة (' + f.path + ')');
      bufs.set(f.path, b);
      const sp = path.join(stageDir, f.path); fs.mkdirSync(path.dirname(sp), { recursive: true }); fs.writeFileSync(sp, b);
    }
    // 2) نفحص الملفات قبل التركيب: لو فيه غلطة ما نركّب شي
    const errs = validateUpdateFiles(bufs, rel => { try { return fs.readFileSync(localPathU(rel)); } catch (e) { return null; } });
    if (errs.length) throw new Error('التحديث فيه مشكلة وما ركّبته: ' + errs.slice(0, 3).join(' | '));
    // 3) نحدد وش بيتغيّر، وناخذ نسخة من الملفات الحالية عشان نرجع لها لو التحديث ما اشتغل
    const plan = [];
    for (const f of files) {
      const dst = destPathU(f.path);
      let b = bufs.get(f.path);
      if (!b) { if (!f.path.startsWith('renderer/') || !app.isPackaged || fs.existsSync(dst)) continue; try { b = fs.readFileSync(path.join(__dirname, f.path)); } catch (e) { continue; } }
      plan.push({ rel: f.path, dst, b });
    }
    const bdir = updBackupDir(); fs.rmSync(bdir, { recursive: true, force: true }); fs.mkdirSync(bdir, { recursive: true });
    const backup = plan.map((p, i) => { const had = fs.existsSync(p.dst); if (had) fs.copyFileSync(p.dst, path.join(bdir, 'f' + i)); return { dst: p.dst, had, bak: 'f' + i }; });
    writeFileAtomic(path.join(bdir, 'list.json'), JSON.stringify(backup));
    // 4) علامة «تحديث جديد لسا ما اشتغل»: لو البرنامج ما فتح بعده، يرجع للنسخة القديمة تلقائياً
    writeFileAtomic(updPendingFile(), JSON.stringify({ version: man.version, from: getSet().updVersion || '', at: Date.now(), boots: 0 }));
    // 5) التركيب
    try {
      for (const p of plan) { fs.mkdirSync(path.dirname(p.dst), { recursive: true }); writeFileAtomic(p.dst, p.b); }
    } catch (e) { restoreUpdateBackup(); throw new Error('ما قدرت أكتب ملفات التحديث، رجّعت النسخة القديمة (' + (e.code || e.message) + ')'); }
    setSet('updVersion', man.version);
    vaultFlush();
    setTimeout(() => { quitting = true; app.relaunch(); app.exit(0); }, 900);
    return { ok: true, count: changed.length };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
  finally { if (stageDir) { try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch (e) {} } }
});


/* ---------- 🔔 تنبيه تلقائي لما ينزل تحديث ---------- */
let updAvail = null, updNotified = '';
let updBusy = false, updLast = 0;
async function bgUpdateCheck() {
  if (!app.isPackaged) return; // نسخة التطوير: لا نزعجك بتحديثات (ملفاتك هي الأحدث)
  if (updBusy) return; updBusy = true; updLast = Date.now();
  try {
    const { man, changed } = await updCheck();
    if (!changed.length) { updAvail = null; if (win && !win.isDestroyed()) win.webContents.send('upd:avail', null); updBusy = false; return; }
    const key = changed.map(f => f.sha).join('');
    if (getSet().updSkip && getSet().updSkip === man.version) { updBusy = false; return; } // نفس التحديث اللي رجعنا منه: ما نزعجك فيه مرة ثانية
    updAvail = { count: changed.length, version: man.version };
    if (win && !win.isDestroyed()) win.webContents.send('upd:avail', updAvail);
    if (key !== updNotified) {
      updNotified = key;
      try { if (win && !win.isDestroyed() && !win.isFocused()) win.flashFrame(true); } catch (e) {}
      {
        try { const n = new Notification({ title: 'خزنة', body: '🔄 فيه تحديث جديد! اضغط هنا وحدّث بضغطة.', icon: appIcon() }); n.on('click', () => showWin()); n.show(); } catch (e) {}
      }
    }
  } catch (e) {}
  updBusy = false;
}
ipcMain.handle('update:pending', () => updAvail);

/* ---------- وقت الاستخدام (يراقب البرامج المشغّلة كل 30 ثانية) ---------- */
const playFile = () => path.join(dataDir(), 'play.json');
let play = null, playDirty = false; const exeCache = new Map();
function exeOf(it) {
  const key = it.path; if (exeCache.has(key)) return exeCache.get(key);
  let exe = '';
  try {
    let p = it.path;
    if (/\.lnk$/i.test(p)) { const t = shell.readShortcutLink(p); p = (t && t.target) || ''; }
    if (/\.exe$/i.test(p)) exe = path.basename(p).toLowerCase();
  } catch (e) {}
  exeCache.set(key, exe); return exe;
}
function runningExes() {
  return new Promise(res => {
    require('child_process').execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, out) => {
      if (err || !out) return res(null);
      const set = new Set(); out.split(/\r?\n/).forEach(l => { const m = /^"([^"]+)"/.exec(l); if (m) set.add(m[1].toLowerCase()); }); res(set);
    });
  });
}
async function playTick() {
  if (process.platform !== 'win32') return;
  try {
    const v = vaultLoad();
    const apps = (v.items || []).filter(i => i && i.kind === 'app' && i.path);
    if (!apps.length) return;
    const run = await runningExes(); if (!run) return;
    if (!play) play = readJSON(playFile(), {});
    for (const it of apps) { const e = exeOf(it); if (e && run.has(e)) { play[it.id] = (play[it.id] || 0) + 30; playDirty = true; } }
    if (playDirty) { writeJSON(playFile(), play); playDirty = false; }
  } catch (e) {}
}
let runC = { t: 0, set: null };
ipcMain.handle('fence:running', async () => {
  if (process.platform !== 'win32') return [];
  try {
    if (!runC.set || Date.now() - runC.t > 4000) { runC = { t: Date.now(), set: await runningExes() }; }
    if (!runC.set) return [];
    const v = vaultLoad();
    return (v.items || []).filter(i => i && (i.kind === 'app' || i.kind === 'game') && i.path).filter(i => { const e = exeOf(i); return e && runC.set.has(e); }).map(i => i.id);
  } catch (e) { return []; }
});
ipcMain.handle('play:get', () => { if (!play) play = readJSON(playFile(), {}); return play; });

/* ---------- نسخ احتياطي تلقائي ---------- */
const backupDir = () => getSet().backupDir || path.join(dataDir(), 'backups');
function autoBackup() {
  try {
    if (getSet().autoBackup === false) return null;
    vaultLoad(); // لو ملف الخزنة خربان نسترجعه أول (عشان النسخة اليومية تكون سليمة)
    vaultFlush(); // نكمّل أي حفظ معلّق أول
    const dir = backupDir(); fs.mkdirSync(dir, { recursive: true });
    const d = new Date(); const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    let last = null;
    fs.readdirSync(dataDir()).filter(n => isVaultName(n)).forEach(n => {
      const tag = n === 'vault.json' ? '' : n.slice(6, -5) + '-';
      const f = path.join(dir, 'khazana-backup-' + tag + day + '.json');
      // ما ننسخ ملف خربان فوق نسخة سليمة، ولا خزنة فاضية فوق نسخة اليوم اللي فيها بيانات
      const cur = tryReadJSON(path.join(dataDir(), n)); if (!cur.ok || !isVaultData(cur.data)) return;
      if (vaultCount(cur.data) === 0) { const old = tryReadJSON(f); if (old.ok && vaultCount(old.data) > 0) return; }
      writeFileAtomic(f, cur.text); last = f;
      const re = new RegExp('^khazana-backup-' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\d{4}-\\d\\d-\\d\\d\\.json$');
      const all = fs.readdirSync(dir).filter(x => re.test(x)).sort();
      all.slice(0, Math.max(0, all.length - 14)).forEach(x => { try { fs.unlinkSync(path.join(dir, x)); } catch (e) {} });
    });
    return last;
  } catch (e) { return null; }
}
ipcMain.handle('backup:now', () => { const s = getSet(); const was = s.autoBackup; const f = autoBackup(); return f || (was === false ? 'off' : null); });
ipcMain.handle('backup:list', () => {
  try {
    const dir = backupDir(), p = profName(), tag = p === 'default' ? '' : p + '-';
    const re = new RegExp('^khazana-(backup|before-restore)-' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d{4}-\\d\\d-\\d\\d)(?:[-_T0-9]*)\\.json$');
    return fs.readdirSync(dir).map(n => { const m = re.exec(n); if (!m) return null; const f = path.join(dir, n), st = fs.statSync(f); let c = 0; try { const d = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); c = (Array.isArray(d) ? d : (d.items || [])).filter(x => x && x.kind !== '_meta').length; } catch (e) {} return { name: n, day: m[2], kind: m[1], size: st.size, mtime: st.mtimeMs, count: c }; }).filter(Boolean).sort((a, b) => b.mtime - a.mtime);
  } catch (e) { return []; }
});
ipcMain.handle('backup:restore', (_e, name) => {
  try {
    const dir = backupDir(), f = path.join(dir, path.basename(String(name || '')));
    if (path.dirname(f) !== path.resolve(dir) && path.dirname(f) !== dir) return false;
    if (!fs.existsSync(f)) return false;
    const d = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
    if (!(Array.isArray(d) || Array.isArray(d.items))) return false;
    const p = profName(), tag = p === 'default' ? '' : p + '-', now = new Date(), pad = n => String(n).padStart(2, '0');
    const stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    vaultFlush();
    if (fs.existsSync(vaultFile())) fs.copyFileSync(vaultFile(), path.join(dir, 'khazana-before-restore-' + tag + stamp + '.json'));
    return vaultReplace(Array.isArray(d) ? { items: d } : d);
  } catch (e) { return false; }
});
ipcMain.handle('backup:open', async () => { const d = backupDir(); fs.mkdirSync(d, { recursive: true }); await shell.openPath(d); return d; });
ipcMain.handle('backup:choose', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  setSet('backupDir', r.filePaths[0]); autoBackup(); return r.filePaths[0];
});

/* ---------- الملفات الشخصية (خزنة منفصلة لكل غرض) ---------- */
ipcMain.handle('profile:list', () => {
  const list = ['default'];
  try { fs.readdirSync(dataDir()).forEach(n => { const m = /^vault-(.+)\.json$/.exec(n); if (m && !/\.(bak|corrupt-[^.]*)$/.test(m[1])) list.push(m[1]); }); } catch (e) {}
  return { current: profName(), list: [...new Set(list)] };
});
ipcMain.handle('profile:switch', (_e, name) => {
  const n = name === 'default' ? 'default' : safeProf(name); if (!n) return false;
  if (n !== 'default' && !fs.existsSync(path.join(dataDir(), 'vault-' + n + '.json'))) writeJSON(path.join(dataDir(), 'vault-' + n + '.json'), { items: [] });
  [...fences.keys()].forEach(s => closeFence(s, false));
  vaultFlush(); // نكمّل حفظ الملف الحالي قبل ما نبدّل
  setSet('profile', n);
  if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache();
  setTimeout(() => restoreFences(false), 800);
  return true;
});

/* ---------- الإشعارات ---------- */
ipcMain.handle('notify', (_e, msg) => { try { new Notification({ title: 'خزنة', body: String(msg || ''), icon: appIcon() }).show(); } catch (e) {} return true; });

/* ---------- 🎮 استيراد ألعاب Steam و Epic ---------- */
function steamRoots() {
  const out = new Set();
  [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, 'C:\\', 'D:\\'].filter(Boolean).forEach(b => { const p = path.join(b, 'Steam'); if (fs.existsSync(path.join(p, 'steamapps'))) out.add(p); });
  try {
    const o = require('child_process').execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true, encoding: 'utf8' });
    const mm = /SteamPath\s+REG_SZ\s+(.+)/.exec(o); if (mm) { const p = path.normalize(mm[1].trim()); if (fs.existsSync(path.join(p, 'steamapps'))) out.add(p); }
  } catch (e) {}
  return [...out];
}
function imgData(f, w = 220) {
  try { const i = nativeImage.createFromPath(f); if (i.isEmpty()) return ''; const s = i.getSize(); const r = i.resize({ width: Math.min(w, s.width) }); return 'data:image/jpeg;base64,' + r.toJPEG(82).toString('base64'); } catch (e) { return ''; }
}
function steamImg(root, id) {
  const lc = path.join(root, 'appcache', 'librarycache'); const names = ['library_600x900.jpg', 'header.jpg', 'library_header.jpg'];
  for (const n of [id + '_library_600x900.jpg', id + '_header.jpg']) { const f = path.join(lc, n); if (fs.existsSync(f)) return imgData(f); }
  const dir = path.join(lc, String(id));
  const find = (d, depth) => {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return ''; }
    for (const n of names) { const hit = ents.find(e => e.isFile() && e.name === n); if (hit) return path.join(d, hit.name); }
    if (depth < 2) for (const e of ents) if (e.isDirectory()) { const r = find(path.join(d, e.name), depth + 1); if (r) return r; }
    return '';
  };
  const f = find(dir, 0); return f ? imgData(f) : '';
}
ipcMain.handle('thumb:game', async (_e, uri) => {
  const id = (/rungameid\/(\d+)/.exec(String(uri || '')) || [])[1]; if (!id) return '';
  for (const root of steamRoots()) { const t = steamImg(root, id); if (t) return t; }
  return await steamHeader(id);
});
ipcMain.handle('games:scan', async () => {
  if (process.platform !== 'win32') return { steam: [], epic: [] };
  const steam = [], epic = [], seen = new Set();
  for (const root of steamRoots()) {
    const libs = new Set([root]);
    try { const t = fs.readFileSync(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8'); for (const mm of t.matchAll(/"path"\s+"([^"]+)"/g)) libs.add(mm[1].replace(/\\\\/g, '\\')); } catch (e) {}
    for (const lib of libs) {
      let files = []; try { files = fs.readdirSync(path.join(lib, 'steamapps')).filter(n => /^appmanifest_\d+\.acf$/.test(n)); } catch (e) { continue; }
      for (const n of files) {
        try {
          const t = fs.readFileSync(path.join(lib, 'steamapps', n), 'utf8');
          const id = (/"appid"\s+"(\d+)"/.exec(t) || [])[1], name = (/"name"\s+"([^"]+)"/.exec(t) || [])[1];
          if (!id || !name || seen.has(id) || /Steamworks|Redistributable|Proton|Steam Linux Runtime/i.test(name)) continue;
          seen.add(id); steam.push({ name, uri: 'steam://rungameid/' + id, thumb: steamImg(root, id) });
        } catch (e) {}
      }
    }
  }
  {
    const miss = steam.filter(x => !x.thumb);
    for (let i = 0; i < miss.length; i += 8) await Promise.all(miss.slice(i, i + 8).map(async x => { const id = (/rungameid\/(\d+)/.exec(x.uri) || [])[1]; if (id) x.thumb = await steamHeader(id); }));
  }
  try {
    const md = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
    for (const n of fs.readdirSync(md).filter(x => x.endsWith('.item'))) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(md, n), 'utf8'));
        if (!j.DisplayName || !j.LaunchExecutable || !j.InstallLocation) continue;
        const p = path.join(j.InstallLocation, j.LaunchExecutable); if (!fs.existsSync(p)) continue;
        epic.push({ name: j.DisplayName, path: p, thumb: await makeThumb(p, 'app') });
      } catch (e) {}
    }
  } catch (e) {}
  return { steam, epic };
});
ipcMain.handle('item:openUri', async (_e, u) => {
  if (typeof u === 'string' && /^(steam|com\.epicgames\.launcher):\/\//i.test(u)) { await shell.openExternal(u); return true; }
  return false;
});

/* ---------- 🔖 مفضلة المتصفحات ---------- */
ipcMain.handle('bookmarks:scan', () => {
  const L = process.env.LOCALAPPDATA; if (!L) return [];
  const roots = [['Chrome', path.join(L, 'Google', 'Chrome', 'User Data')], ['Edge', path.join(L, 'Microsoft', 'Edge', 'User Data')], ['Brave', path.join(L, 'BraveSoftware', 'Brave-Browser', 'User Data')]];
  const out = [];
  for (const [br, base] of roots) {
    let profs = []; try { profs = fs.readdirSync(base).filter(n => n === 'Default' || /^Profile \d+$/.test(n)); } catch (e) { continue; }
    for (const pr of profs) {
      const f = path.join(base, pr, 'Bookmarks'); if (!fs.existsSync(f)) continue;
      try {
        const j = JSON.parse(fs.readFileSync(f, 'utf8'));
        const walkB = (node, folder) => { if (!node) return; if (node.type === 'url' && /^https?:/i.test(node.url || '')) out.push({ browser: br, folder, name: node.name || node.url, url: node.url }); (node.children || []).forEach(c => walkB(c, node.type === 'folder' && node.name ? node.name : folder)); };
        Object.values(j.roots || {}).forEach(r => { if (r && r.children) r.children.forEach(c => walkB(c, r.name || '')); });
      } catch (e) {}
    }
  }
  return out.slice(0, 3000);
});

/* ---------- 📋 إضافة من الحافظة ---------- */
function clipAdd() {
  let paths = [];
  try { const b = clipboard.readBuffer('FileNameW'); if (b && b.length) { const p = b.toString('ucs2').split('\0')[0]; if (p && fs.existsSync(p)) paths.push(p); } } catch (e) {}
  const t = (clipboard.readText() || '').trim().replace(/^"|"$/g, '');
  if (!win || win.isDestroyed()) return;
  if (!paths.length && /^https?:\/\/\S+$/i.test(t)) { win.webContents.send('ext', { type: 'addLink', url: t }); return; }
  if (!paths.length && t && t.length < 500) { try { if (fs.existsSync(t)) paths.push(t); } catch (e) {} }
  if (paths.length) win.webContents.send('ext', { type: 'add', paths, sec: '', notify: true });
  else { try { new Notification({ title: 'خزنة', body: 'الحافظة ما فيها رابط أو ملف', icon: appIcon() }).show(); } catch (e) {} }
}

/* ---------- 👀 مراقبة مجلد (مثل التنزيلات) ---------- */
let watcher = null; const wPending = new Map();
function stopWatch() { try { if (watcher) watcher.close(); } catch (e) {} watcher = null; }
function startWatch() {
  stopWatch();
  const s = getSet(); if (!s.watchOn) return;
  const dir = s.watchDir || app.getPath('downloads'); if (!fs.existsSync(dir)) return;
  try {
    watcher = fs.watch(dir, (ev, name) => {
      if (!name || /\.(tmp|crdownload|part|download|partial)$/i.test(name) || name.startsWith('~$')) return;
      clearTimeout(wPending.get(name));
      wPending.set(name, setTimeout(() => {
        wPending.delete(name); const f = path.join(dir, name);
        try {
          const st = fs.statSync(f); if (Date.now() - st.birthtimeMs > 90000) return;
          const n = new Notification({ title: 'ملف جديد في ' + path.basename(dir), body: name + '\nاضغط لإضافته للخزنة', icon: appIcon() });
          n.on('click', () => { if (win && !win.isDestroyed()) win.webContents.send('ext', { type: 'add', paths: [f], sec: '', notify: true }); });
          n.show();
        } catch (e) {}
      }, 3000));
    });
  } catch (e) {}
}
ipcMain.handle('watch:choose', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] }); if (r.canceled || !r.filePaths[0]) return null;
  setSet('watchDir', r.filePaths[0]); setSet('watchOn', true); startWatch(); return r.filePaths[0];
});

/* ---------- حاويات سطح المكتب ---------- */
const fences = new Map(); // secId -> BrowserWindow
let raised = false;
const fk = () => profName() === 'default' ? 'fences' : 'fences:' + profName();
const getFenceCfg = () => getSet()[fk()] || {};
function saveFenceCfg(sec, patch) { const f = getFenceCfg(); f[sec] = { ...(f[sec] || {}), ...patch }; setSet(fk(), f); }
function edgeBounds(edge, T, wa) {
  const side = edge === 'left' || edge === 'right';
  return { w: side ? T : wa.width, h: side ? wa.height : T, x: edge === 'right' ? wa.x + wa.width - T : wa.x, y: edge === 'bottom' ? wa.y + wa.height - T : wa.y };
}
// تثبيت الحاوية فوق سطح المكتب وتحت كل النوافذ (ويندوز فقط، عبر SetWindowPos)
const PIN_PS = `param([long]$h)
Add-Type -Namespace K -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr FindWindow(string c,string t);[DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr p,IntPtr a,string c,string t);[DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int w,int hh,uint f);'
$host_ = [K.U]::FindWindow('Progman',$null); $w = [IntPtr]::Zero
while ($true) { $w = [K.U]::FindWindowEx([IntPtr]::Zero,$w,'WorkerW',$null); if ($w -eq [IntPtr]::Zero) { break }; if ([K.U]::FindWindowEx($w,[IntPtr]::Zero,'SHELLDLL_DefView',$null) -ne [IntPtr]::Zero) { $host_ = $w; break } }
if ($host_ -ne [IntPtr]::Zero) { [void][K.U]::SetWindowPos([IntPtr]$h,$host_,0,0,0,0,0x13) }`;
let pinFile = '';
function pinToDesktop(w) {
  if (process.platform !== 'win32' || !w || w.isDestroyed() || w._edge || raised) return;
  try {
    if (!pinFile) { pinFile = path.join(app.getPath('temp'), 'khazana-pin.ps1'); fs.writeFileSync(pinFile, PIN_PS, 'utf8'); }
    const hwnd = w.getNativeWindowHandle().readUInt32LE(0);
    require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', pinFile, String(hwnd)], { windowsHide: true }, () => {});
  } catch (e) {}
}
function pinAll() { fences.forEach(w => pinToDesktop(w)); }
function openFence(sec) {
  if (fences.has(sec)) { const o = fences.get(sec); o.showInactive(); setTimeout(() => pinToDesktop(o), 250); return; }
  const wa = require('electron').screen.getPrimaryDisplay().workArea;
  const n = fences.size, cfg = getFenceCfg()[sec] || {};
  const WSZ = { clock: [250, 170], cal: [300, 270], quote: [320, 160], pad: [300, 270], todo: [320, 330] }, wk = sec.startsWith('widget:') ? (WSZ[sec.slice(7)] || [280, 180]) : null;
  const b = { x: cfg.x ?? (wa.x + 40 + n * 30), y: cfg.y ?? (wa.y + 60 + n * 30), w: cfg.w || (wk ? wk[0] : 340), h: cfg.h || (wk ? wk[1] : 300) };
  const full = b.h;
  const edge = EDGES.has(cfg.edge) ? cfg.edge : '';
  if (edge) Object.assign(b, edgeBounds(edge, 240, wa));
  const mat = !edge && MATS.has(cfg.mat) && matOK() ? cfg.mat : '';
  const w = new BrowserWindow({
    x: b.x, y: b.y, width: b.w, height: cfg.collapsed && !edge ? 40 : b.h, minWidth: edge ? 60 : 180, minHeight: edge ? 60 : 40,
    frame: false, resizable: false, skipTaskbar: true, show: false,
    ...(mat ? { transparent: false, backgroundColor: '#00000000', backgroundMaterial: mat, hasShadow: true } : { transparent: true, hasShadow: false }),
    minimizable: false, maximizable: false, fullscreenable: false, title: 'حاوية خزنة',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  w._sec = sec; w._mat = mat; w._edge = edge; w._full = full; w._collapsed = !edge && !!cfg.collapsed;
  if (edge) { w.setAlwaysOnTop(true, 'floating'); w.setIgnoreMouseEvents(true, { forward: true }); } w.loadFile(uiFile('fence.html'), { query: { sec, col: cfg.collapsed && !edge ? '1' : '0', edge } });
  w.once('ready-to-show', () => { w.showInactive(); setTimeout(() => pinToDesktop(w), 250); });
  w.on('moved', () => { if (w._edge) return; const r = w.getBounds(); saveFenceCfg(sec, { x: r.x, y: r.y }); });
  w.on('blur', () => setTimeout(() => { if (raised && ![...fences.values()].some(x => !x.isDestroyed() && x.isFocused())) lowerFences(); }, 150));
  w.on('closed', () => { fences.delete(sec); });
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', e => e.preventDefault());
  fences.set(sec, w);
  saveFenceCfg(sec, { open: true });
}
function closeFence(sec, forget = true) {
  const w = fences.get(sec);
  if (forget) saveFenceCfg(sec, { open: false });
  if (w && !w.isDestroyed()) w.destroy();
  fences.delete(sec);
}
function raiseFences() { raised = true; fences.forEach(w => { if (!w.isDestroyed() && !w._edge) { w.setAlwaysOnTop(true, 'floating'); w.show(); } }); const f = [...fences.values()][0]; if (f && !f.isDestroyed()) f.focus(); }
function lowerFences() { raised = false; fences.forEach(w => { if (!w.isDestroyed() && !w._edge) w.setAlwaysOnTop(false); }); setTimeout(pinAll, 200); }
let edgeHid = false;
function toggleFences() {
  if (!fences.size) { restoreFences(true); return; }
  edgeHid = !edgeHid; fences.forEach(w => { if (w._edge && !w.isDestroyed()) { if (edgeHid) w.hide(); else w.showInactive(); } });
  if (raised) lowerFences(); else raiseFences();
}
function restoreFences(force) {
  const cfg = getFenceCfg();
  Object.keys(cfg).forEach(sec => { if (cfg[sec].open || force) openFence(sec); });
}
ipcMain.handle('fence:toggle', (_e, sec) => { if (fences.has(sec)) { closeFence(sec); return false; } openFence(sec); return true; });
ipcMain.handle('fence:list', () => [...fences.keys()]);
ipcMain.handle('fence:close', e => { const w = BrowserWindow.fromWebContents(e.sender); if (w && w._sec) closeFence(w._sec); return true; });
ipcMain.handle('fence:collapse', (e, on) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return false;
  const r = w.getBounds();
  if (on && !w._collapsed) w._full = r.height;
  w._collapsed = !!on;
  w.setBounds({ x: r.x, y: r.y, width: r.width, height: on ? 40 : (w._full || 300) });
  saveFenceCfg(w._sec, { collapsed: !!on, h: w._full });
  return true;
});
ipcMain.handle('fence:resize', (e, wd, ht, done) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w || w._collapsed) return false;
  const r = w.getBounds();
  w.setBounds({ x: r.x, y: r.y, width: Math.max(180, Math.round(wd)), height: Math.max(90, Math.round(ht)) });
  if (done) { const n = w.getBounds(); w._full = n.height; saveFenceCfg(w._sec, { w: n.width, h: n.height }); }
  return true;
});
const FSTYLE_OK = new Set(['glass', 'midnight', 'paper', 'neon', 'aurora', 'minimal', 'sticky', 'retro', 'sunset', 'mica']);
function cleanStyle(s) {
  s = s || {}; const n = (v, a, b, d) => { v = Number(v); return isFinite(v) ? Math.max(a, Math.min(b, Math.round(v))) : d; };
  return { d: FSTYLE_OK.has(s.d) ? s.d : 'glass', op: n(s.op, 30, 100, 100), r: n(s.r, 0, 30, 14), sz: ['s', 'm', 'l'].includes(s.sz) ? s.sz : 'm', lay: ['grid', 'list', 'dock'].includes(s.lay) ? s.lay : 'grid', nm: s.nm !== false, ra: s.ra === true, eh: s.eh === true, t3: s.t3 !== false, auc: s.auc === true, et: ['glass', 'dark', 'light', 'clear', 'color'].includes(s.et) ? s.et : 'glass', acc: /^#[0-9a-fA-F]{6}$/.test(s.acc || '') ? s.acc : '' };
}
const MATS = new Set(['acrylic', 'mica', 'tabbed']);
const EDGES = new Set(['bottom', 'top', 'left', 'right']);
const matOK = () => { try { return process.platform === 'win32' && parseInt(String(require('os').release()).split('.')[2], 10) >= 22621; } catch (e) { return false; } };
ipcMain.handle('fence:style:get', e => { const w = BrowserWindow.fromWebContents(e.sender); if (!w || !w._sec) return null; const c = getFenceCfg()[w._sec] || {}; return { ...(c.style ? cleanStyle(c.style) : {}), mat: w._mat || '', matOK: matOK(), edge: w._edge || '' }; });
const feedFile = () => path.join(dataDir(), 'fence-feed.json'), padFile = () => path.join(dataDir(), 'fence-pads.json');
let feed = null;
ipcMain.handle('fence:feed:set', (_e, list) => { feed = Array.isArray(list) ? list.slice(0, 40) : []; try { writeFileAtomic(feedFile(), JSON.stringify(feed)); } catch (e) {} fences.forEach(w => { try { if (!w.isDestroyed()) w.webContents.send('fence:feed', feed); } catch (e) {} }); return true; });
ipcMain.handle('fence:feed:get', () => { if (!feed) feed = readJSON(feedFile(), []); return feed; });
ipcMain.handle('fence:done', (_e, id) => { try { if (win && !win.isDestroyed()) win.webContents.send('fence:done', String(id)); } catch (e) {} return true; });
ipcMain.handle('fence:pad:get', (_e, id) => String((readJSON(padFile(), {}))[String(id)] || ''));
ipcMain.handle('fence:pad:set', (_e, id, txt) => { const d = readJSON(padFile(), {}); d[String(id)] = String(txt || '').slice(0, 20000); writeJSON(padFile(), d); return true; });
ipcMain.handle('fence:all', (e, act) => {
  if (act === 'collapse' || act === 'expand') fences.forEach(w => { if (!w.isDestroyed() && !w._edge) { try { w.webContents.send('fence:col', act === 'collapse'); } catch (er) {} } });
  else if (act === 'close') [...fences.keys()].forEach(s => closeFence(s));
  else if (act === 'open') { const v = vaultLoad(); const meta = (v.items || []).find(x => x && x.kind === '_meta') || {}; (meta.sections || []).filter(s => s && !s.parent && !s.lock).slice(0, 8).forEach(s => openFence(s.id)); }
  return fences.size;
});
ipcMain.handle('fence:order:get', e => { const w = BrowserWindow.fromWebContents(e.sender); return w && w._sec ? ((getFenceCfg()[w._sec] || {}).order || {}) : {}; });
ipcMain.handle('fence:order:set', (e, room, ids) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w || !w._sec || typeof room !== 'string' || !Array.isArray(ids)) return false;
  const c = getFenceCfg()[w._sec] || {}; const o = { ...(c.order || {}) }; o[room.slice(0, 80)] = ids.filter(x => typeof x === 'string').slice(0, 800).map(x => x.slice(0, 80));
  saveFenceCfg(w._sec, { order: o }); return true;
});
ipcMain.handle('fence:edge', (e, edge) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w || !w._sec) return false;
  const sec = w._sec; saveFenceCfg(sec, { edge: EDGES.has(edge) ? edge : '' });
  closeFence(sec, false); setTimeout(() => openFence(sec), 200); return true;
});
ipcMain.handle('fence:edgesize', (e, T) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w || !w._edge || w.isDestroyed()) return false;
  T = Math.max(200, Math.min(700, Math.round(Number(T) || 240))); const b = edgeBounds(w._edge, T, require('electron').screen.getPrimaryDisplay().workArea);
  w.setBounds({ x: b.x, y: b.y, width: b.w, height: b.h }); return true;
});
ipcMain.handle('fence:ignore', (e, on) => { const w = BrowserWindow.fromWebContents(e.sender); if (w && w._edge && !w.isDestroyed()) w.setIgnoreMouseEvents(!!on, { forward: true }); return true; });
ipcMain.handle('fence:material', (e, mat) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w || !w._sec || !matOK()) return false;
  const sec = w._sec; saveFenceCfg(sec, { mat: MATS.has(mat) ? mat : '' });
  closeFence(sec, false); setTimeout(() => openFence(sec), 200); return true;
});
ipcMain.handle('fence:style:set', (e, st, all) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w || !w._sec) return false; const c = cleanStyle(st);
  saveFenceCfg(w._sec, { style: c });
  if (all) { fences.forEach((fw, sec) => { if (sec !== w._sec) { saveFenceCfg(sec, { style: c }); try { fw.webContents.send('fence:style', c); } catch (er) {} } }); }
  return true;
});
ipcMain.handle('fence:main', () => { showWin(); return true; });
// أي إضافة/فتح من الحاويات أو البحث السريع يمرّ عبر نافذة خزنة الرئيسية (هي اللي تملك البيانات بالذاكرة) عشان ما نخرّب الحفظ
ipcMain.handle('ext:add', (_e, paths, sec) => { if (!win || win.isDestroyed()) return false; win.webContents.send('ext', { type: 'add', paths: (paths || []).filter(p => typeof p === 'string' && p), sec: sec || '' }); return true; });
ipcMain.handle('ext:run', (_e, gid) => { if (!win || win.isDestroyed()) return false; win.webContents.send('ext', { type: 'run', gid }); return true; });
ipcMain.handle('ext:open', (_e, id, show) => { if (!win || win.isDestroyed()) return false; if (show) showWin(); win.webContents.send('ext', { type: 'open', id }); return true; });

/* ---------- البحث السريع ---------- */
let quick = null;
function openQuick() {
  const wa = require('electron').screen.getDisplayNearestPoint(require('electron').screen.getCursorScreenPoint()).workArea;
  if (quick && !quick.isDestroyed()) {
    if (quick.isVisible()) { quick.hide(); return; }
    quick.setPosition(Math.round(wa.x + (wa.width - 640) / 2), Math.round(wa.y + wa.height * 0.18));
    quick.show(); quick.focus(); quick.webContents.send('quick:reset'); return;
  }
  quick = new BrowserWindow({
    width: 640, height: 76, x: Math.round(wa.x + (wa.width - 640) / 2), y: Math.round(wa.y + wa.height * 0.18),
    frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, show: false,
    minimizable: false, maximizable: false, title: 'بحث خزنة',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  quick.loadFile(uiFile('quick.html'));
  quick.once('ready-to-show', () => { quick.show(); quick.focus(); });
  quick.on('blur', () => { if (quick && !quick.isDestroyed() && quick.isVisible()) quick.hide(); });
  quick.on('closed', () => { quick = null; });
  quick.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  quick.webContents.on('will-navigate', e => e.preventDefault());
}
ipcMain.handle('quick:hide', () => { if (quick && !quick.isDestroyed()) quick.hide(); return true; });
ipcMain.handle('quick:size', (_e, h) => { if (quick && !quick.isDestroyed()) { const b = quick.getBounds(); quick.setBounds({ x: b.x, y: b.y, width: 640, height: Math.max(76, Math.min(560, Math.round(h))) }); } return true; });

function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1100, height: 760, minWidth: 340, minHeight: 420,
    title: 'خزنة', icon: appIcon(), backgroundColor: '#f6f5f1', autoHideMenuBar: true, show: !process.argv.includes('--hidden'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  // إذا فيه مجلد ui بجانب ملف exe نقرأ الواجهة منه (تحديثات صغيرة بدون إعادة بناء)
  win.loadFile(uiFile('index.html'));
  // أي رابط خارجي يُفتح في المتصفح، ولا تتنقل النافذة بعيداً عن التطبيق
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.on('close', e => { if (!quitting && tray && bgOn()) { e.preventDefault(); win.hide(); } });
  win.on('closed', () => { win = null; if (quitting || !tray) fences.forEach(w => { try { w.destroy(); } catch (e) {} }); if (quick && !quick.isDestroyed()) quick.destroy(); });
}

app.setAppUserModelId('local.khazana.app');
app.on('before-quit', () => { quitting = true; vaultFlush(); });
app.whenReady().then(async () => {
  if (!gotLock) return; // البرنامج مفتوح من قبل: النسخة الثانية تسكّر بدون ما تسوي شي
  createWindow();
  await buildTray();
  try {
    globalShortcut.register('Control+Alt+Space', () => {
      if (win && win.isVisible() && win.isFocused()) win.minimize(); else showWin();
    });
  } catch (e) {}
  restoreFences(false);
  autoBackup(); setInterval(autoBackup, 6 * 3600 * 1000);
  setTimeout(playTick, 8000); setInterval(playTick, 30000);
  try { globalShortcut.register('Control+Alt+D', () => toggleFences()); } catch (e) {}
  try { globalShortcut.register('Control+Alt+F', () => openQuick()); } catch (e) {}
  try { globalShortcut.register('Control+Alt+V', () => clipAdd()); } catch (e) {}
  try { globalShortcut.register('Control+Alt+N', () => openCapture()); } catch (e) {}
  setTimeout(bgUpdateCheck, 8000); setInterval(bgUpdateCheck, 3 * 60 * 1000);
  app.on('browser-window-focus', () => { if (Date.now() - updLast > 45000) bgUpdateCheck(); });
  startWatch();
  app.on('activate', () => { if (!win) createWindow(); });
});
app.on('will-quit', () => { vaultFlush(); globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { if (quitting || !tray) app.quit(); });
