const $ = id => document.getElementById(id);
const sec = new URLSearchParams(location.search).get('sec');
const KI = { game: '🎮', app: '🪟', image: '🖼', folder: '📁', link: '🔗', note: '📝', doc: '📄', pdf: '📕', video: '🎬', audio: '🎵', archive: '🗜' };
const IMG_OK = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);
const clean = n => String(n || '').replace(/(\.(exe|lnk|url|bat))?\s*[-–]\s*(اختصار|shortcut)\s*$/i, '').replace(/\.(exe|lnk|url)$/i, '').trim() || n;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fileURL = p => 'file:///' + String(p).replace(/\\/g, '/').split('/').map((x, i) => i === 0 && /^[A-Za-z]:$/.test(x) ? x : encodeURIComponent(x)).join('/').replace(/^\/+/, '');
let st = { d: 'glass', op: 100, r: 14, ra: true, t3: true, sz: 'm', lay: 'grid', nm: true, acc: '', mat: '', matOK: false };
const APP_R = { s: 5, r: 22, p: 30 };
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
function renderCore() {
  if (isSmart) {
    const d = SMART[sec.slice(6)] || ['🪄', 'ذكية'];
    $('ttl').textContent = d[0] + ' ' + d[1]; $('back').hidden = true;
    if (!st.acc && ui.accent) $('box').style.setProperty('--acc', ui.accent);
    const l = smartList();
    $('grid').innerHTML = l.length ? l.map(i => `<div class="it" data-k="${esc(i.kind || '')}" ${i.color ? `style="--tc:${esc(i.color)}"` : ''} data-id="${i.id}" title="${esc((i.name || '') + (i.desc ? ' — ' + i.desc : ''))}"><div class="ic">${pv(i)}</div><div class="nm">${i.pinned ? '⭐ ' : ''}${esc(clean(i.name))}</div></div>`).join('') : '<div class="empty">ما في عناصر بعد.<br>تتعبّى لحالها وأنت تستخدم خزنة.</div>';
    return;
  }
  const s = sections.find(x => x.id === cur);
  if (s && lockedSec(cur)) { $('ttl').textContent = (s.emoji || '📁') + ' ' + s.name; $('back').hidden = cur === sec; $('grid').innerHTML = '<div class="empty">🔒 هذا القسم مقفل بكلمة سر.<br>افتحه من نافذة خزنة.</div>'; return; }
  if (!s) { $('ttl').textContent = 'القسم انحذف'; $('grid').innerHTML = '<div class="empty">هذا القسم انحذف من الخزنة.<br>اضغط ✕ لإغلاق الحاوية.</div>'; return; }
  const root = sections.find(x => x.id === sec);
  $('ttl').textContent = (s.emoji || '📁') + ' ' + s.name;
  $('back').hidden = cur === sec;
  if (!st.acc && ui.accent) $('box').style.setProperty('--acc', ui.accent);
  const rooms = sections.filter(x => (x.parent || '') === cur);
  const mine = items.filter(i => i.section === cur).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.lastOpened || 0) - (a.lastOpened || 0) || (b.added || 0) - (a.added || 0));
  let h = rooms.map(r => `<div class="it room" data-room="${r.id}" title="${esc(r.name)}"><div class="ic">${esc(r.emoji || '📁')}</div><div class="nm">${esc(r.name)}</div></div>`).join('');
  h += mine.map(i => `<div class="it" data-k="${esc(i.kind || '')}" ${i.color ? `style="--tc:${esc(i.color)}"` : ''} data-id="${i.id}" title=""${esc((i.name || '') + (i.desc ? ' — ' + i.desc : ''))}"><div class="ic">${pv(i)}</div><div class="nm">${i.pinned ? '⭐ ' : ''}${esc(clean(i.name))}</div></div>`).join('');
  if (!h) h = '<div class="empty">القسم فاضي.<br>اسحب ملفات وأفلتها هنا لإضافتها.</div>';
  $('grid').innerHTML = h;
}
const EDGE = new URLSearchParams(location.search).get('edge') || '';
const SZ_IC = { s: 32, m: 46, l: 66 };
let popItems = [], popKind = '', popAnchor = null;
const vertical = () => EDGE === 'left' || EDGE === 'right';
function render() {
  renderCore();
  if (!EDGE) return;
  const g = $('grid'); g.querySelectorAll('.empty').forEach(e => e.remove());
  let els = [...g.querySelectorAll('.it')];
  const hasBack = !isSmart && cur !== sec;
  const sz = SZ_IC[st.sz] || 46, slot = sz + 24, avail = (vertical() ? window.innerHeight : window.innerWidth) - 30 - 36 - 20;
  const capacity = Math.max(3, Math.floor(avail / slot) - 2 - (hasBack ? 1 : 0));
  let rest = [];
  if (els.length > capacity) { const keep = capacity - 1; rest = els.slice(keep); rest.forEach(e => e.remove()); }
  popItems = rest.map(e => e.outerHTML);
  if (hasBack) g.insertAdjacentHTML('afterbegin', '<div class="it ctl" data-back="1" title="رجوع"><div class="ic">←</div></div>');
  let h = '';
  if (rest.length) h += `<div class="it ctl more" data-ctl="more" title="${rest.length} ${'عنصر إضافي'}"><div class="ic">▦</div><b class="bdg">+${rest.length}</b></div>`;
  h += '<i class="sep"></i><div class="it ctl" data-ctl="set" title="إعدادات الشريط"><div class="ic">⚙</div></div>';
  g.insertAdjacentHTML('beforeend', h);
  $('box').style.setProperty('--ic', sz + 'px');
  if (popKind === 'more') { if (rest.length) $('pop').innerHTML = `<div class="pgrid">${popItems.join('')}</div>`; else closePop(); }
}
async function sizeWin(T) { try { if (window.api.fenceEdgeSize) await window.api.fenceEdgeSize(T); } catch (e) {} }
function setHTML() {
  const seg = (k, arr, cur2) => `<div class="seg">${arr.map(([v, n]) => `<button data-${k}="${v}" class="${String(cur2) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  return `<div class="ptt">⚙ إعدادات الشريط</div>
  <div class="pl">الموضع</div>${seg('pe', [['bottom', 'أسفل'], ['top', 'أعلى'], ['left', 'يسار'], ['right', 'يمين']], EDGE)}
  <div class="pl">حجم الأيقونات</div>${seg('psz', [['s', 'صغير'], ['m', 'وسط'], ['l', 'كبير']], st.sz)}
  <div class="pl">إخفاء تلقائي</div>${seg('peh', [['0', 'لا'], ['1', 'نعم']], st.eh ? 1 : 0)}
  <div class="pl">اللون</div><div class="acs">${ACCS.map(c => `<i data-pacc="${c}" class="${st.acc === c ? 'on' : ''}" style="background:${c}"></i>`).join('')}</div>
  <button class="pbtn" data-pnormal="1">▦ رجوع للحاوية العادية (المربعة)</button>
  <button class="pbtn red" data-pclose="1">✕ إغلاق هذي الحاوية</button>`;
}
function placePop(anchor) {
  const p = $('pop'), g = $('grid'), gr = g.getBoundingClientRect(), a = anchor.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
  p.style.cssText = ''; p.style.display = 'block';
  if (EDGE === 'bottom') { p.style.bottom = (H - gr.top + 14) + 'px'; p.style.maxHeight = (gr.top - 26) + 'px'; }
  else if (EDGE === 'top') { p.style.top = (gr.bottom + 14) + 'px'; p.style.maxHeight = (H - gr.bottom - 26) + 'px'; }
  else if (EDGE === 'left') { p.style.left = (gr.right + 14) + 'px'; p.style.maxWidth = (W - gr.right - 26) + 'px'; }
  else { p.style.right = (W - gr.left + 14) + 'px'; p.style.maxWidth = (gr.left - 26) + 'px'; }
  if (vertical()) { p.style.maxHeight = (H - 24) + 'px'; } else { p.style.maxWidth = Math.min(620, W - 24) + 'px'; }
  const pw = p.offsetWidth, ph = p.offsetHeight;
  if (vertical()) p.style.top = Math.max(12, Math.min(H - ph - 12, a.top + a.height / 2 - ph / 2)) + 'px';
  else p.style.left = Math.max(12, Math.min(W - pw - 12, a.left + a.width / 2 - pw / 2)) + 'px';
  p.style.transformOrigin = EDGE === 'bottom' ? 'bottom center' : EDGE === 'top' ? 'top center' : EDGE === 'left' ? 'left center' : 'right center';
}
async function openPop(kind, anchor) {
  popKind = kind; popAnchor = anchor; const p = $('pop');
  p.innerHTML = kind === 'more' ? `<div class="pgrid">${popItems.join('')}</div>` : setHTML(); p.hidden = false; p.classList.remove('show'); p.classList.toggle('big', kind === 'more');
  window.api.fenceIgnore && window.api.fenceIgnore(false); ign = false;
  await sizeWin(520); await new Promise(r => setTimeout(r, 90));
  if (popKind !== kind) return; placePop(anchor); void p.offsetWidth; p.classList.add('show');
}
function closePop() {
  if (!popKind) return; popKind = ''; const p = $('pop'); p.classList.remove('show'); p.hidden = true; p.style.display = ''; sizeWin(240);
}
let ign = true;
async function load() {
  try {
    const r = await window.api.load(); const list = r.items || [];
    const s = JSON.stringify(list.length) + (list.map(i => i.id + (i.section || '') + (i.name || '') + (i.thumb ? 1 : 0) + (i.pinned ? 1 : 0) + (i.lastOpened || 0) + (i.openCount || 0)).join('|'));
    const meta = list.find(x => x && x.kind === '_meta') || {};
    const ns = JSON.stringify((meta.sections || []).map(x => [x.id, x.name, !!x.lock])) + JSON.stringify(meta.ui || {}) + JSON.stringify(meta.groups || []);
    if (s + ns === sig) return; sig = s + ns;
    items = list.filter(x => x && x.kind !== '_meta'); sections = meta.sections || []; ui = meta.ui || {}; groups = meta.groups || []; if (window.I18N) window.I18N.set(ui.lang || window.I18N.auto());
    if (!isSmart && !sections.some(x => x.id === cur)) cur = sec;
    render();
  } catch (e) {}
}
const onGridClick = async e => {
  if (EDGE) { const c = e.target.closest('[data-ctl],[data-back]'); if (c && !c.closest('#pop')) { if (c.dataset.back) $('back').onclick(); else if (c.dataset.ctl === 'more' || c.dataset.ctl === 'set') { if (popKind === c.dataset.ctl) closePop(); else openPop(c.dataset.ctl, c); } return; } const it0 = e.target.closest('.it'); if (it0 && !it0.closest('#pop')) { it0.classList.remove('bnc'); void it0.offsetWidth; it0.classList.add('bnc'); } }
  const r = e.target.closest('[data-room]'); if (r) { cur = r.dataset.room; render(); return; }
  const el = e.target.closest('[data-id]'); if (!el) return;
  const it = items.find(x => x.id === el.dataset.id); if (!it) return;
  if (await window.api.extOpen(it.id, it.kind === 'note')) return;
  let res;
  if (it.kind === 'link') res = { ok: await window.api.openUrl(it.url) };
  else if (it.path) res = await window.api.open(it.path);
  else res = { ok: false, error: 'no_path' };
  if (!res.ok) { el.classList.add('miss'); el.title = 'ما قدرت أفتحه (الملف مو بمكانه؟)'; }
  if (EDGE && el.closest('#pop')) closePop();
};
$('grid').addEventListener('click', onGridClick); $('pop').addEventListener('click', onGridClick);
document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fb !== undefined && !t.dataset.done) { t.dataset.done = 1; if (t.dataset.fb) { t.src = t.dataset.fb; t.className = ''; } else t.replaceWith(document.createTextNode('🖼')); }
}, true);
$('back').onclick = () => { const s = sections.find(x => x.id === cur); cur = s && s.parent && sections.some(x => x.id === s.parent) && cur !== sec ? s.parent : sec; render(); };
$('cls').onclick = () => window.api.fenceClose();
function replayAnim() { const g = $('grid'); g.classList.remove('anim'); void g.offsetWidth; g.classList.add('anim'); setTimeout(() => g.classList.remove('anim'), 900); }
function setCol(on) { if (!on) replayAnim(); if (on) { $('gpanel').hidden = true; } collapsed = on; $('box').classList.toggle('col', on); $('col').textContent = on ? '▸' : '▾'; window.api.fenceCollapse(on); }
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
load(); replayAnim(); setInterval(load, 2500); window.addEventListener('focus', load);

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

/* 🎨 تصميم الحاوية */
const DESIGNS = [
  ['glass', 'زجاجي', 'linear-gradient(160deg,#2a3148,#10131d)', 14], ['midnight', 'ليلي', '#0d1117', 10], ['paper', 'ورقي', '#f6f1e7', 12], ['neon', 'نيون', 'radial-gradient(#1a0f3a,#07060f)', 16], ['aurora', 'شفق', 'linear-gradient(120deg,#3b2dd1,#b51fd9,#0ea5e9)', 18],
  ['minimal', 'بسيط', 'repeating-linear-gradient(45deg,#222 0 6px,#2b2b2b 6px 12px)', 14], ['sticky', 'لاصقة', 'linear-gradient(#fff6ae,#ffed7d)', 4], ['retro', 'ريترو', 'linear-gradient(#1b1b2f,#2a1b4f)', 0], ['sunset', 'غروب', 'linear-gradient(160deg,#ff7e5f,#b24592,#2b1055)', 18], ['mica', 'ميكا', 'linear-gradient(#3a3a40,#222226)', 8]
];
const ACCS = ['#2f7a5e', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#14b8a6', '#e5e7eb'];
function applyStyle() {
  const b = $('box'); b.dataset.d = st.d; b.dataset.sz = st.sz; b.dataset.lay = st.lay; b.dataset.nm = st.nm ? 'on' : 'off';
  b.style.setProperty('--op', st.op / 100); b.style.setProperty('--r', (st.mat ? 0 : (st.ra ? (APP_R[ui.rad] ?? 14) : st.r)) + 'px');
  if (st.mat) b.dataset.mat = st.mat; else delete b.dataset.mat;
  document.documentElement.dataset.ff = ui.ff || ''; b.dataset.mo = ui.mo || ''; b.dataset.t3 = st.t3 === false ? '' : '1';
  if (EDGE) { b.dataset.edge = EDGE; b.dataset.lay = 'edge'; b.classList.toggle('eh', !!st.eh); }
  if (st.acc) b.style.setProperty('--acc', st.acc); else if (ui.accent) b.style.setProperty('--acc', ui.accent); else b.style.removeProperty('--acc');
}
let saveT = null;
function saveStyle(all) { applyStyle(); clearTimeout(saveT); saveT = setTimeout(() => window.api.fenceStyleSet && window.api.fenceStyleSet(st, !!all), all ? 0 : 250); }
function drawStyle() {
  const p = $('spanel');
  p.innerHTML = `<div><div class="sl">🎨 التصميم</div><div class="dg">${DESIGNS.map(d => `<button class="dsw ${st.d === d[0] ? 'on' : ''}" data-kd="${d[0]}" style="background:${d[2]}">${d[1]}</button>`).join('')}</div></div>
  <div><div class="sl">اللون</div><div class="acs">${ACCS.map(c => `<i data-acc="${c}" class="${st.acc === c ? 'on' : ''}" style="background:${c}"></i>`).join('')}<input type="color" id="accC" value="${st.acc || '#2f7a5e'}" title="لون مخصص"><button class="sm" data-acc="" style="width:auto;height:24px;padding:0 8px;margin:0;font-size:11px">تلقائي</button></div></div>
  <div><div class="sl">الشفافية <b id="opv">${st.op}%</b></div><input type="range" id="opR" min="30" max="100" value="${st.op}"></div>
  <div><div class="sl">استدارة الزوايا <b id="rv">${st.ra ? 'تلقائي' : st.r}</b></div><input type="range" id="rR" min="0" max="30" value="${st.ra ? (APP_R[ui.rad] ?? 14) : st.r}"></div>
  <div><div class="sl">حجم الأيقونات</div><div class="seg">${[['s', 'صغير'], ['m', 'وسط'], ['l', 'كبير']].map(([k, n]) => `<button data-ksz="${k}" class="${st.sz === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
  <div><div class="sl">طريقة العرض</div><div class="seg">${[['grid', 'شبكة'], ['list', 'قائمة'], ['dock', 'شريط Dock']].map(([k, n]) => `<button data-klay="${k}" class="${st.lay === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
  <div><div class="seg"><button data-knm="1" class="${st.nm ? 'on' : ''}">الأسماء ظاهرة</button><button data-knm="0" class="${st.nm ? '' : 'on'}">بدون أسماء</button></div></div>
  ${st.matOK ? `<div><div class="sl">خلفية الحاوية (ويندوز 11)</div><div class="seg">${[['', 'عادي'], ['acrylic', 'زجاج أكريليك'], ['mica', 'ميكا']].map(([k, n]) => `<button data-kmat="${k}" class="${(st.mat || '') === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>` : ''}
  <div><div class="sl">أيقونات 3D وحركة الميلان</div><div class="seg"><button data-kt3="1" class="${st.t3 === false ? '' : 'on'}">تشغيل</button><button data-kt3="0" class="${st.t3 === false ? 'on' : ''}">إيقاف</button></div></div>
  <div><div class="sl">شكل الحاوية</div><div class="seg">${[['', 'عادية'], ['bottom', 'شريط أسفل'], ['top', 'شريط أعلى'], ['left', 'يسار'], ['right', 'يمين']].map(([k, n]) => `<button data-kedge="${k}" class="${EDGE === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
  <div><div class="sl">إخفاء الشريط تلقائياً (يظهر لما تلمس الحافة)</div><div class="seg"><button data-keh="0" class="${st.eh ? '' : 'on'}">لا</button><button data-keh="1" class="${st.eh ? 'on' : ''}">نعم</button></div></div>
  <div class="foot"><button data-all="1">طبّق على كل الحاويات</button><button data-reset="1">إعادة الضبط</button></div>`;
}
const closeS = () => { $('spanel').hidden = true; $('sty').classList.remove('on'); };
$('sty').onclick = () => { if (!$('spanel').hidden) { closeS(); return; } closeG(); $('sty').classList.add('on'); drawStyle(); $('spanel').hidden = false; };
document.addEventListener('mousedown', e => { if (!$('spanel').hidden && !e.target.closest('#spanel,#sty')) closeS(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeS(); });
$('spanel').addEventListener('click', e => {
  const t = e.target;
  const d = t.closest('[data-kd]'); if (d) { st.d = d.dataset.kd; st.r = (DESIGNS.find(x => x[0] === st.d) || [])[3] ?? st.r; st.ra = false; saveStyle(); drawStyle(); return; }
  const a = t.closest('[data-acc]'); if (a) { st.acc = a.dataset.acc; saveStyle(); drawStyle(); return; }
  const z = t.closest('[data-ksz]'); if (z) { st.sz = z.dataset.ksz; saveStyle(); drawStyle(); return; }
  const l = t.closest('[data-klay]'); if (l) { st.lay = l.dataset.klay; saveStyle(); drawStyle(); return; }
  const k3 = t.closest('[data-kt3]'); if (k3) { st.t3 = k3.dataset.kt3 === '1'; saveStyle(); drawStyle(); return; }
  const eh = t.closest('[data-keh]'); if (eh) { st.eh = eh.dataset.keh === '1'; saveStyle(); drawStyle(); return; }
  const eg = t.closest('[data-kedge]'); if (eg) { if (eg.dataset.kedge !== EDGE) window.api.fenceEdge(eg.dataset.kedge); return; }
  const mt = t.closest('[data-kmat]'); if (mt) { window.api.fenceMaterial && window.api.fenceMaterial(mt.dataset.kmat); return; }
  const n = t.closest('[data-knm]'); if (n) { st.nm = n.dataset.knm === '1'; saveStyle(); drawStyle(); return; }
  if (t.closest('[data-all]')) { saveStyle(true); const b = t.closest('[data-all]'); b.textContent = '✓ تم'; setTimeout(() => b.textContent = 'طبّق على كل الحاويات', 1200); return; }
  if (t.closest('[data-reset]')) { st = { ...st, d: 'glass', op: 100, r: 14, ra: true, sz: 'm', lay: 'grid', nm: true, acc: '' }; saveStyle(); drawStyle(); }
});
$('spanel').addEventListener('input', e => {
  if (e.target.id === 'opR') { st.op = +e.target.value; $('opv').textContent = st.op + '%'; saveStyle(); }
  else if (e.target.id === 'rR') { st.ra = false; st.r = +e.target.value; $('rv').textContent = st.r; saveStyle(); }
  else if (e.target.id === 'accC') { st.acc = e.target.value; saveStyle(); }
});
(async () => { try { const s = window.api.fenceStyleGet && await window.api.fenceStyleGet(); if (s) st = { ...st, ...s }; } catch (e) {} applyStyle(); })();
if (window.api.onFenceStyle) window.api.onFenceStyle(s => { st = { ...st, ...s }; applyStyle(); if (!$('spanel').hidden) drawStyle(); });

/* Dock: الأيقونة تكبر والمجاورة لها تكبر معها */
(() => {
  const g = $('grid');
  g.addEventListener('mousemove', e => {
    const lay = $('box').dataset.lay; if (lay !== 'dock' && lay !== 'edge') return;
    const vert = EDGE === 'left' || EDGE === 'right', sgn = EDGE === 'top' ? 1 : EDGE === 'left' ? 1 : -1;
    g.querySelectorAll('.it:not(.ctl)').forEach(el => {
      const r = el.getBoundingClientRect(), d = Math.abs(vert ? e.clientY - (r.top + r.height / 2) : e.clientX - (r.left + r.width / 2)), k = Math.max(0, 1 - d / (lay === 'edge' ? 150 : 120));
      const sc = 1 + (lay === 'edge' ? 0.85 : 0.75) * k * k, sh = sgn * (sc - 1) * (lay === 'edge' ? 16 : 14) * (EDGE === 'top' || EDGE === 'left' ? 1 : 1);
      const sd = vert ? (e.clientY - (r.top + r.height / 2)) : (e.clientX - (r.left + r.width / 2)), tilt = lay === 'edge' ? Math.max(-1, Math.min(1, sd / 90)) * 26 * k : 0;
      el.style.transform = vert ? `translateX(${-sh}px) scale(${sc}) rotateX(${-tilt}deg)` : `translateY(${sh}px) scale(${sc}) rotateY(${tilt}deg)`; el.style.zIndex = Math.round(k * 10);
    });
  });
  g.addEventListener('mouseleave', () => g.querySelectorAll('.it').forEach(el => { el.style.transform = ''; el.style.zIndex = ''; }));
})();

/* الشريط الممتد: النافذة شفافة وتمرّر النقرات لسطح المكتب إلا فوق الشريط نفسه */
if (EDGE) {
  const g = $('grid'); let hideT = null;
  const setIgn = v => { if (v !== ign) { ign = v; window.api.fenceIgnore && window.api.fenceIgnore(v); } };
  const hide = on => { g.classList.toggle('hid', on); };
  setTimeout(() => { if (st.eh && !popKind) hide(true); }, 2500);
  document.addEventListener('mousemove', e => {
    const r = g.getBoundingClientRect(), m = 8;
    const over = e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m;
    setIgn(!over && !popKind);
    if (st.eh && !popKind) { if (over) { clearTimeout(hideT); hideT = null; hide(false); } else if (!hideT && !g.classList.contains('hid')) hideT = setTimeout(() => { hideT = null; hide(true); }, 900); }
  });
  document.addEventListener('mousedown', e => { if (popKind && !e.target.closest('#pop,[data-ctl]')) closePop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  $('pop').addEventListener('click', e => {
    const t = e.target, q = a => t.closest(a);
    if (q('[data-pe]')) { window.api.fenceEdge(q('[data-pe]').dataset.pe); return; }
    if (q('[data-psz]')) { st.sz = q('[data-psz]').dataset.psz; saveStyle(); render(); $('pop').innerHTML = setHTML(); return; }
    if (q('[data-peh]')) { st.eh = q('[data-peh]').dataset.peh === '1'; saveStyle(); $('pop').innerHTML = setHTML(); return; }
    if (q('[data-pacc]')) { st.acc = q('[data-pacc]').dataset.pacc; saveStyle(); $('pop').innerHTML = setHTML(); return; }
    if (q('[data-pnormal]')) { window.api.fenceEdge(''); return; }
    if (q('[data-pclose]')) { window.api.fenceClose(); }
  });
}

/* حاويات مربعة: الأيقونة تميل ناحية الماوس (3D) وتنط لما تفتحها */
(() => {
  const g = $('grid');
  g.addEventListener('mousemove', e => {
    if (EDGE) return; const it = e.target.closest('.it'); if (!it || g.closest('#box').dataset.lay === 'dock') return;
    const ic = it.querySelector('.ic'); if (!ic) return; const r = it.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
    ic.style.setProperty('--ry', (px * 34) + 'deg'); ic.style.setProperty('--rx', (-py * 34) + 'deg');
  });
  g.addEventListener('mouseout', e => { const it = e.target.closest('.it'); if (!it || it.contains(e.relatedTarget)) return; const ic = it.querySelector('.ic'); if (ic) { ic.style.setProperty('--ry', '0deg'); ic.style.setProperty('--rx', '0deg'); } });
  g.addEventListener('click', e => { if (EDGE) return; const it = e.target.closest('.it'); if (!it) return; it.classList.remove('bnc'); void it.offsetWidth; it.classList.add('bnc'); });
})();

/* ميلان ثلاثي الأبعاد للأيقونة حسب مكان الماوس عليها */
(() => {
  const g = $('grid');
  const reset = el => { el.classList.remove('tl'); el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); el.style.removeProperty('--sx'); el.style.removeProperty('--sy'); };
  g.addEventListener('mousemove', e => {
    const b = $('box'); if (EDGE || b.dataset.t3 !== '1' || b.dataset.lay === 'dock') return;
    const it = e.target.closest('.it'); g.querySelectorAll('.it.tl').forEach(x => { if (x !== it) reset(x); });
    if (!it) return; const ic = it.querySelector('.ic'); if (!ic) return;
    const r = ic.getBoundingClientRect(), px = Math.max(-.7, Math.min(.7, (e.clientX - r.left) / r.width - .5)), py = Math.max(-.7, Math.min(.7, (e.clientY - r.top) / r.height - .5));
    it.classList.add('tl'); it.style.setProperty('--rx', (-py * 34) + 'deg'); it.style.setProperty('--ry', (px * 34) + 'deg'); it.style.setProperty('--sx', (-px * 8) + 'px'); it.style.setProperty('--sy', (-py * 8 + 10) + 'px');
  });
  g.addEventListener('mouseleave', () => g.querySelectorAll('.it.tl').forEach(reset));
})();
