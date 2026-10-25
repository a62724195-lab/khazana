const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, globalShortcut, nativeImage, Menu, Tray, net, clipboard, Notification } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const MODEL = 'claude-haiku-5-5';
let win = null, tray = null, quitting = false;
const ICON = path.join(__dirname, 'assets', 'icon.png');
const appIcon = () => { try { const i = nativeImage.createFromPath(ICON); return i.isEmpty() ? undefined : i; } catch (e) { return undefined; } };

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => showWin());

/* ---------- تخزين ---------- */
const dataDir = () => app.getPath('userData');
const profName = () => { try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8')).profile || 'default'; } catch (e) { return 'default'; } };
const safeProf = n => String(n || '').trim().replace(/[^\p{L}\p{N}_ -]/gu, '').slice(0, 24).trim().replace(/ +/g, '_');
const vaultFile = () => path.join(dataDir(), profName() === 'default' ? 'vault.json' : 'vault-' + profName() + '.json');
const settingsFile = () => path.join(dataDir(), 'settings.json');
function readJSON(f, def) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } }
function writeJSON(f, d) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  try { if (fs.existsSync(f)) fs.copyFileSync(f, f.replace(/\.json$/, '.bak.json')); } catch (e) {}
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d));
  fs.renameSync(tmp, f);
}

/* ---------- مفتاح API (مشفّر بحساب ويندوز) ---------- */
function getKey() {
  const s = readJSON(settingsFile(), {});
  try {
    if (s.keyEnc && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(s.keyEnc, 'base64'));
    if (s.keyPlain) return Buffer.from(s.keyPlain, 'base64').toString('utf8');
  } catch (e) {}
  return '';
}
function setKey(k) {
  const s = readJSON(settingsFile(), {});
  delete s.keyEnc; delete s.keyPlain;
  if (k) {
    if (safeStorage.isEncryptionAvailable()) s.keyEnc = safeStorage.encryptString(k).toString('base64');
    else s.keyPlain = Buffer.from(k, 'utf8').toString('base64');
  }
  writeJSON(settingsFile(), s);
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

/* أيقونة حقيقية من داخل الاختصارات (.lnk / .url) بدل الأيقونة العامة */
const expandEnv = v => String(v || '').replace(/"/g, '').replace(/%([^%]+)%/g, (m, k) => process.env[k] || m);
async function iconFromFile(f) {
  try {
    f = expandEnv(f).trim();
    if (!f || !fs.existsSync(f)) return '';
    const e = path.extname(f).toLowerCase();
    if (['.ico', '.png', '.jpg', '.jpeg', '.bmp'].includes(e)) {
      const n = nativeImage.createFromPath(f);
      if (!n.isEmpty()) return n.toDataURL();
    }
    const ic = await app.getFileIcon(f, { size: 'large' });
    if (!ic.isEmpty()) return ic.toDataURL();
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

/* صورة مصغّرة لأي عنصر: معاينة ويندوز الحقيقية (صور، فيديو، PDF، مستندات، برامج) ثم بدائل */
async function makeThumb(p, kind) {
  const isIcon = kind === 'app' || kind === 'folder';
  const ext0 = path.extname(p).toLowerCase();
  if (ext0 === '.lnk' || ext0 === '.url') { const sc = await shortcutThumb(p, ext0); if (sc) return sc; }
  try {
    if (process.platform === 'win32' && typeof nativeImage.createThumbnailFromPath === 'function') {
      const t = await nativeImage.createThumbnailFromPath(p, { width: 256, height: 256 });
      if (t && !t.isEmpty()) return isIcon ? t.toDataURL() : 'data:image/jpeg;base64,' + t.toJPEG(78).toString('base64');
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
  try {
    const ic = await app.getFileIcon(p, { size: 'large' });
    if (!ic.isEmpty()) return ic.toDataURL();
  } catch (e) {}
  return '';
}

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
      body: JSON.stringify({ model: MODEL, max_tokens: max, system, messages: [{ role: 'user', content }] })
    });
    const d = await r.json();
    if (!r.ok) return { ok: false, error: (d && d.error && d.error.message) || ('HTTP ' + r.status) };
    const t = (d.content || []).map(c => c.text || '').join('');
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: 'bad_reply' };
    return { ok: true, data: JSON.parse(m[0]) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
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
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  capWin.loadFile(uiFile('capture.html'));
  capWin.once('ready-to-show', () => { capWin.show(); capWin.focus(); });
  capWin.on('blur', () => { if (capWin && !capWin.isDestroyed() && capWin.isVisible()) capWin.webContents.send('cap:blur'); });
  capWin.on('closed', () => { capWin = null; });
  capWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  capWin.webContents.on('will-navigate', e => e.preventDefault());
}
ipcMain.handle('cap:hide', () => { if (capWin && !capWin.isDestroyed()) capWin.hide(); return true; });
ipcMain.handle('cap:save', (_e, d) => { if (!win || win.isDestroyed()) return false; win.webContents.send('ext', { type: 'note', text: String((d && d.text) || '').slice(0, 20000), tags: String((d && d.tags) || '').slice(0, 200) }); if (capWin && !capWin.isDestroyed()) capWin.hide(); return true; });
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
ipcMain.handle('vault:load', () => {
  const v = readJSON(vaultFile(), { items: [] });
  return { items: Array.isArray(v.items) ? v.items : [], hasKey: !!getKey() };
});
ipcMain.handle('vault:save', (_e, items) => { writeJSON(vaultFile(), { items }); return true; });
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
ipcMain.handle('items:exists', (_e, paths) => (paths || []).map(p => { try { return fs.existsSync(p); } catch (e) { return false; } }));
ipcMain.handle('key:has', () => !!getKey());
ipcMain.handle('key:set', (_e, k) => { setKey(String(k || '').trim()); return !!getKey(); });
ipcMain.handle('data:path', () => dataDir());

ipcMain.handle('backup:export', async () => {
  const r = await dialog.showSaveDialog(win, { defaultPath: 'khazana-backup.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return false;
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
  for (let i = 0; i < list.length; i += 20) {
    await Promise.all(list.slice(i, i + 20).map(async it => {
      try { it.thumb = await makeThumb(it.path, 'app'); } catch (e) {}
    }));
  }
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
  try { const { man, changed } = await updCheck(); return { ok: true, version: man.version, count: changed.length, names: changed.map(f => f.path) }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
});
ipcMain.handle('update:apply', async () => {
  try {
    const { man, files, changed } = await updCheck();
    const bufs = new Map();
    for (const f of changed) { const b = await fetchBuf(f.path); if (sha(b) !== f.sha) throw new Error('hash mismatch ' + f.path); bufs.set(f.path, b); }
    for (const f of files) {
      const dst = destPathU(f.path); fs.mkdirSync(path.dirname(dst), { recursive: true });
      let b = bufs.get(f.path);
      if (!b) { if (!f.path.startsWith('renderer/') || !app.isPackaged || fs.existsSync(dst)) continue; try { b = fs.readFileSync(path.join(__dirname, f.path)); } catch (e) { continue; } }
      fs.writeFileSync(dst + '.new', b); fs.renameSync(dst + '.new', dst);
    }
    setSet('updVersion', man.version);
    setTimeout(() => { quitting = true; app.relaunch(); app.exit(0); }, 900);
    return { ok: true, count: changed.length };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});

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
    const v = readJSON(vaultFile(), { items: [] });
    const apps = (v.items || []).filter(i => i && i.kind === 'app' && i.path);
    if (!apps.length) return;
    const run = await runningExes(); if (!run) return;
    if (!play) play = readJSON(playFile(), {});
    for (const it of apps) { const e = exeOf(it); if (e && run.has(e)) { play[it.id] = (play[it.id] || 0) + 30; playDirty = true; } }
    if (playDirty) { writeJSON(playFile(), play); playDirty = false; }
  } catch (e) {}
}
ipcMain.handle('play:get', () => { if (!play) play = readJSON(playFile(), {}); return play; });

/* ---------- نسخ احتياطي تلقائي ---------- */
const backupDir = () => getSet().backupDir || path.join(dataDir(), 'backups');
function autoBackup() {
  try {
    if (getSet().autoBackup === false) return null;
    const dir = backupDir(); fs.mkdirSync(dir, { recursive: true });
    const d = new Date(); const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    let last = null;
    fs.readdirSync(dataDir()).filter(n => /^vault(-.+)?\.json$/.test(n) && !/\.bak\./.test(n)).forEach(n => {
      const tag = n === 'vault.json' ? '' : n.slice(6, -5) + '-';
      const f = path.join(dir, 'khazana-backup-' + tag + day + '.json');
      fs.copyFileSync(path.join(dataDir(), n), f); last = f;
      const re = new RegExp('^khazana-backup-' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\d{4}-\\d\\d-\\d\\d\\.json$');
      const all = fs.readdirSync(dir).filter(x => re.test(x)).sort();
      all.slice(0, Math.max(0, all.length - 14)).forEach(x => { try { fs.unlinkSync(path.join(dir, x)); } catch (e) {} });
    });
    return last;
  } catch (e) { return null; }
}
ipcMain.handle('backup:now', () => { const s = getSet(); const was = s.autoBackup; const f = autoBackup(); return f || (was === false ? 'off' : null); });
ipcMain.handle('backup:open', async () => { const d = backupDir(); fs.mkdirSync(d, { recursive: true }); await shell.openPath(d); return d; });
ipcMain.handle('backup:choose', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  setSet('backupDir', r.filePaths[0]); autoBackup(); return r.filePaths[0];
});

/* ---------- الملفات الشخصية (خزنة منفصلة لكل غرض) ---------- */
ipcMain.handle('profile:list', () => {
  const list = ['default'];
  try { fs.readdirSync(dataDir()).forEach(n => { const m = /^vault-(.+)\.json$/.exec(n); if (m && !/\.bak$/.test(m[1])) list.push(m[1]); }); } catch (e) {}
  return { current: profName(), list: [...new Set(list)] };
});
ipcMain.handle('profile:switch', (_e, name) => {
  const n = name === 'default' ? 'default' : safeProf(name); if (!n) return false;
  if (n !== 'default' && !fs.existsSync(path.join(dataDir(), 'vault-' + n + '.json'))) writeJSON(path.join(dataDir(), 'vault-' + n + '.json'), { items: [] });
  [...fences.keys()].forEach(s => closeFence(s, false));
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
function openFence(sec) {
  if (fences.has(sec)) { fences.get(sec).showInactive(); return; }
  const wa = require('electron').screen.getPrimaryDisplay().workArea;
  const n = fences.size, cfg = getFenceCfg()[sec] || {};
  const b = { x: cfg.x ?? (wa.x + 40 + n * 30), y: cfg.y ?? (wa.y + 60 + n * 30), w: cfg.w || 340, h: cfg.h || 300 };
  const full = b.h;
  const w = new BrowserWindow({
    x: b.x, y: b.y, width: b.w, height: cfg.collapsed ? 40 : b.h, minWidth: 180, minHeight: 40,
    frame: false, transparent: true, resizable: false, skipTaskbar: true, hasShadow: false, show: false,
    minimizable: false, maximizable: false, fullscreenable: false, title: 'حاوية خزنة',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  w._sec = sec; w._full = full; w._collapsed = !!cfg.collapsed;
  w.loadFile(uiFile('fence.html'), { query: { sec, col: cfg.collapsed ? '1' : '0' } });
  w.once('ready-to-show', () => w.showInactive());
  w.on('moved', () => { const r = w.getBounds(); saveFenceCfg(sec, { x: r.x, y: r.y }); });
  w.on('blur', () => setTimeout(() => { if (raised && ![...fences.values()].some(x => !x.isDestroyed() && x.isFocused())) lowerFences(); }, 150));
  w.on('closed', () => { fences.delete(sec); });
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', e => e.preventDefault());
  fences.set(sec, w);
  const f = getFenceCfg(); saveFenceCfg(sec, { open: true });
}
function closeFence(sec, forget = true) {
  const w = fences.get(sec);
  if (forget) saveFenceCfg(sec, { open: false });
  if (w && !w.isDestroyed()) w.destroy();
  fences.delete(sec);
}
function raiseFences() { raised = true; fences.forEach(w => { if (!w.isDestroyed()) { w.setAlwaysOnTop(true, 'floating'); w.show(); } }); const f = [...fences.values()][0]; if (f && !f.isDestroyed()) f.focus(); }
function lowerFences() { raised = false; fences.forEach(w => { if (!w.isDestroyed()) w.setAlwaysOnTop(false); }); }
function toggleFences() {
  if (!fences.size) { restoreFences(true); return; }
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
  return { d: FSTYLE_OK.has(s.d) ? s.d : 'glass', op: n(s.op, 30, 100, 100), r: n(s.r, 0, 30, 14), sz: ['s', 'm', 'l'].includes(s.sz) ? s.sz : 'm', lay: ['grid', 'list', 'dock'].includes(s.lay) ? s.lay : 'grid', nm: s.nm !== false, acc: /^#[0-9a-fA-F]{6}$/.test(s.acc || '') ? s.acc : '' };
}
ipcMain.handle('fence:style:get', e => { const w = BrowserWindow.fromWebContents(e.sender); const st = w && w._sec ? (getFenceCfg()[w._sec] || {}).style : null; return st ? cleanStyle(st) : null; });
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
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
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
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
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
app.on('before-quit', () => { quitting = true; });
app.whenReady().then(async () => {
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
  startWatch();
  app.on('activate', () => { if (!win) createWindow(); });
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (quitting || !tray) app.quit(); });
