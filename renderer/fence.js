const $ = id => document.getElementById(id);
const sec = new URLSearchParams(location.search).get('sec');
const KI = { app: '🧩', image: '🖼️', folder: '📁', link: '🔗', note: '📝', doc: '📄', pdf: '📕', video: '🎬', audio: '🎵', archive: '🗜️' };
const IMG_OK = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);
const clean = n => String(n || '').replace(/(\.(exe|lnk|url|bat))?\s*[-–]\s*(اختصار|shortcut)\s*$/i, '').replace(/\.(exe|lnk|url)$/i, '').trim() || n;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fileURL = p => 'file:///' + String(p).replace(/\\/g, '/').split('/').map((x, i) => i === 0 && /^[A-Za-z]:$/.test(x) ? x : encodeURIComponent(x)).join('/').replace(/^\/+/, '');
let groups = [], items = [], sections = [], ui = {}, cur = sec, sig = '', collapsed = false;

function pv(i) {
  if (i.kind === 'image' && i.path && IMG_OK.has((i.ext || '').toLowerCase())) return `<img class="full" src="${esc(fileURL(i.path))}" data-fb="${esc(i.thumb || '')}" alt="">`;
  if (i.thumb) return `<img src="${esc(i.thumb)}" alt="">`;
  return KI[i.kind] || '📄';
}
const SMART = { recent: ['🕘', 'فتحتها مؤخراً'], used: ['🔥', 'الأكثر استخداماً'], added: ['🆕', 'أضفتها حديثاً'], pinned: ['⭐', 'المثبّتة'] };
const isSmart = sec.startsWith('smart:');
const lockedSec = id => { let g = 0; while (id && g++ < 30) { const s = sections.find(x => x.id === id); if (!s) return false; if (s.lock) return true; id = s.parent || ''; } return false; };
function smartList() {
  const k = sec.slice(6), L = items.filter(i => !lockedSec(i.section) && i.kind !== '_group');
  if (k === 'recent') return L.filter(i => i.lastOpened).sort((a, b) => b.lastOpened - a.lastOpened).slice(0, 18);
  if (k === 'used') return L.filter(i => i.openCount).sort((a, b) => b.openCount - a.openCount).slice(0, 18);
  if (k === 'added') return L.sort((a, b) => (b.added || 0) - (a.added || 0)).slice(0, 18);
  return L.filter(i => i.pinned);
}
function render() {
  if (isSmart) {
    const d = SMART[sec.slice(6)] || ['🪄', 'ذكية'];
    $('ttl').textContent = d[0] + ' ' + d[1]; $('back').hidden = true;
    if (ui.accent) $('box').style.setProperty('--acc', ui.accent);
    const l = smartList();
    $('grid').innerHTML = l.length ? l.map(i => `<div class="it" ${i.color ? `style="--tc:${esc(i.color)}"` : ''} data-id="${i.id}" title="${esc((i.name || '') + (i.desc ? ' — ' + i.desc : ''))}"><div class="ic">${pv(i)}</div><div class="nm">${i.pinned ? '⭐ ' : ''}${esc(clean(i.name))}</div></div>`).join('') : '<div class="empty">ما في عناصر بعد.<br>تتعبّى لحالها وأنت تستخدم خزنة.</div>';
    return;
  }
  const s = sections.find(x => x.id === cur);
  if (s && lockedSec(cur)) { $('ttl').textContent = (s.emoji || '📁') + ' ' + s.name; $('back').hidden = cur === sec; $('grid').innerHTML = '<div class="empty">🔒 هذا القسم مقفل بكلمة سر.<br>افتحه من نافذة خزنة.</div>'; return; }
  if (!s) { $('ttl').textContent = 'القسم انحذف'; $('grid').innerHTML = '<div class="empty">هذا القسم انحذف من الخزنة.<br>اضغط ✕ لإغلاق الحاوية.</div>'; return; }
  const root = sections.find(x => x.id === sec);
  $('ttl').textContent = (s.emoji || '📁') + ' ' + s.name;
  $('back').hidden = cur === sec;
  if (ui.accent) $('box').style.setProperty('--acc', ui.accent);
  const rooms = sections.filter(x => (x.parent || '') === cur);
  const mine = items.filter(i => i.section === cur).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.lastOpened || 0) - (a.lastOpened || 0) || (b.added || 0) - (a.added || 0));
  let h = rooms.map(r => `<div class="it room" data-room="${r.id}" title="${esc(r.name)}"><div class="ic">${esc(r.emoji || '📁')}</div><div class="nm">${esc(r.name)}</div></div>`).join('');
  h += mine.map(i => `<div class="it" ${i.color ? `style="--tc:${esc(i.color)}"` : ''} data-id="${i.id}" title=""${esc((i.name || '') + (i.desc ? ' — ' + i.desc : ''))}"><div class="ic">${pv(i)}</div><div class="nm">${i.pinned ? '⭐ ' : ''}${esc(clean(i.name))}</div></div>`).join('');
  if (!h) h = '<div class="empty">القسم فاضي.<br>اسحب ملفات وأفلتها هنا لإضافتها.</div>';
  $('grid').innerHTML = h;
}
async function load() {
  try {
    const r = await window.api.load(); const list = r.items || [];
    const s = JSON.stringify(list.length) + (list.map(i => i.id + (i.section || '') + (i.name || '') + (i.thumb ? 1 : 0) + (i.pinned ? 1 : 0) + (i.lastOpened || 0) + (i.openCount || 0)).join('|'));
    const meta = list.find(x => x && x.kind === '_meta') || {};
    const ns = JSON.stringify((meta.sections || []).map(x => [x.id, x.name, !!x.lock])) + JSON.stringify(meta.ui || {}) + JSON.stringify(meta.groups || []);
    if (s + ns === sig) return; sig = s + ns;
    items = list.filter(x => x && x.kind !== '_meta'); sections = meta.sections || []; ui = meta.ui || {}; groups = meta.groups || [];
    if (!isSmart && !sections.some(x => x.id === cur)) cur = sec;
    render();
  } catch (e) {}
}
$('grid').addEventListener('click', async e => {
  const r = e.target.closest('[data-room]'); if (r) { cur = r.dataset.room; render(); return; }
  const el = e.target.closest('[data-id]'); if (!el) return;
  const it = items.find(x => x.id === el.dataset.id); if (!it) return;
  if (await window.api.extOpen(it.id, it.kind === 'note')) return;
  let res;
  if (it.kind === 'link') res = { ok: await window.api.openUrl(it.url) };
  else if (it.path) res = await window.api.open(it.path);
  else res = { ok: false, error: 'no_path' };
  if (!res.ok) { el.classList.add('miss'); el.title = 'ما قدرت أفتحه (الملف مو بمكانه؟)'; }
});
document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fb !== undefined && !t.dataset.done) { t.dataset.done = 1; if (t.dataset.fb) { t.src = t.dataset.fb; t.className = ''; } else t.replaceWith(document.createTextNode('🖼️')); }
}, true);
$('back').onclick = () => { const s = sections.find(x => x.id === cur); cur = s && s.parent && sections.some(x => x.id === s.parent) && cur !== sec ? s.parent : sec; render(); };
$('cls').onclick = () => window.api.fenceClose();
function setCol(on) { if (on) { $('gpanel').hidden = true; } collapsed = on; $('box').classList.toggle('col', on); $('col').textContent = on ? '▸' : '▾'; window.api.fenceCollapse(on); }
$('col').onclick = () => setCol(!collapsed);
$('head').ondblclick = e => { if (!e.target.closest('button')) setCol(!collapsed); };
// تغيير الحجم (النوافذ الشفافة في ويندوز ما تدعم السحب من الحافة)
$('grip').onmousedown = e => {
  e.preventDefault(); const sx = e.screenX, sy = e.screenY, w0 = window.outerWidth, h0 = window.outerHeight; const rtl = true;
  const mv = ev => window.api.fenceResize(w0 + (ev.screenX - sx), h0 + (ev.screenY - sy), false);
  const up = ev => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); window.api.fenceResize(w0 + (ev.screenX - sx), h0 + (ev.screenY - sy), true); };
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
};
if (new URLSearchParams(location.search).get('col') === '1') { collapsed = true; $('box').classList.add('col'); $('col').textContent = '▸'; }
load(); setInterval(load, 2500); window.addEventListener('focus', load);

// سحب وإفلات ملفات لإضافتها للقسم الحالي
let dragN = 0;
const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
document.addEventListener('dragenter', e => { if (hasFiles(e)) { dragN++; $('box').classList.add('drop'); } });
document.addEventListener('dragleave', e => { if (hasFiles(e) && --dragN <= 0) { dragN = 0; $('box').classList.remove('drop'); } });
document.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
document.addEventListener('drop', async e => {
  e.preventDefault(); dragN = 0; $('box').classList.remove('drop');
  const ps = [...(e.dataTransfer.files || [])].map(f => window.api.pathForFile(f)).filter(Boolean);
  if (!ps.length || isSmart) return;
  const ok = await window.api.extAdd(ps, cur);
  const t = $('ttl'), old = t.textContent; t.textContent = ok ? '✓ انضاف (' + ps.length + ')' : 'افتح خزنة أول';
  setTimeout(() => { t.textContent = old; load(); }, 1600); setTimeout(load, 600);
});

// ⚡ المجموعات
const closeG = () => { $('gpanel').hidden = true; $('grp').classList.remove('on'); };
document.addEventListener('mousedown', e => { if (!$('gpanel').hidden && !e.target.closest('#gpanel,#grp')) closeG(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeG(); });
$('grp').onclick = () => {
  const p = $('gpanel');
  if (!p.hidden) { closeG(); return; }
  $('grp').classList.add('on');
  p.innerHTML = groups.length ? groups.map(g => `<button data-g="${g.id}">▶ ${esc(g.emoji || '⚡')} ${esc(g.name)}</button>`).join('') : '<div class="empty">ما عندك مجموعات.<br>سوّها من خزنة ← ⚡ مجموعات.</div>';
  p.hidden = false;
};
$('gpanel').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; closeG(); window.api.extRun(b.dataset.g); };
