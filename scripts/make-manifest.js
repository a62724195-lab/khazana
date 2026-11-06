// يولّد update/manifest.json (قائمة الملفات + بصمة كل ملف) — يشتغل تلقائياً على GitHub بعد كل رفع
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const files = [];
const add = rel => { const f = path.join(root, rel); if (fs.existsSync(f)) files.push({ path: rel, sha: crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') }); };
fs.readdirSync(path.join(root, 'renderer')).sort().forEach(n => { if (/\.(html|css|js|woff|png)$/.test(n)) add('renderer/' + n); });
['main.js', 'preload.js'].forEach(add);
fs.readdirSync(path.join(root, 'assets')).sort().forEach(n => add('assets/' + n));
const old = fs.existsSync(path.join(root, 'update/manifest.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'update/manifest.json'), 'utf8')) : {};
const same = JSON.stringify(old.files) === JSON.stringify(files);
const out = { version: same && old.version ? old.version : new Date().toISOString().slice(0, 16).replace('T', ' '), files };
// «وش الجديد» اللي يطلع بنافذة التحديث: من update/notes.json لو موجود ({ "ar": [...], "en": [...] })
try { const nf = path.join(root, 'update/notes.json'); if (fs.existsSync(nf)) { const nt = JSON.parse(fs.readFileSync(nf, 'utf8')); if (nt && (Array.isArray(nt.ar) || Array.isArray(nt.en))) out.notes = { ar: nt.ar || [], en: nt.en || [] }; } } catch (e) { console.log('notes.json skipped:', e.message); }
fs.mkdirSync(path.join(root, 'update'), { recursive: true });
fs.writeFileSync(path.join(root, 'update/manifest.json'), JSON.stringify(out, null, 1) + '\n');
console.log('manifest:', files.length, 'files, version', out.version);
