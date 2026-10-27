const $ = id => document.getElementById(id);
const KIND_ICON = { app: '⚙️', image: '🖼️', video: '🎬', audio: '🎵', doc: '📄', archive: '🗜️', code: '💻', folder: '📁', link: '🔗', note: '📝', other: '📦' };
const KIND_CAT = { app: 'برامج', image: 'صور', video: 'فيديو', audio: 'صوت', doc: 'مستندات', archive: 'أرشيف', code: 'أكواد', folder: 'مجلدات', link: 'روابط', note: 'ملاحظات', other: 'أخرى' };
const OPEN_LABEL = { app: 'تشغيل', link: 'فتح الرابط', note: 'عرض' };
const IMG_OK = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico']);
const EMOJIS = ['⭐', '📁', '💼', '🖼️', '🎮', '📚', '🎵', '🔒', '🏠', '🛠️'];

let groups = [], colorF = '', play = {}, trash = []; const unlocked = new Set();
const TAGC = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
let items = [], sections = [], hasKey = false, missing = new Set(), notes = [], notesMerge = null;
let secF = '', catF = '', laterF = false, result = null, sortBy = 'recent';
let boards = [];
let ui = { view: 'big', showDesc: true, showTags: true, accent: '', theme: 'auto' }, views = {}, collapsed = new Set(), incSub = false;
let selMode = false; const sel = new Set();
let suppressClick = false;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function setBusy(msg) { $('busy').hidden = !msg; $('busyTxt').textContent = msg || ''; }
function toast(m, undo) {
  const t = $('toast'); t.textContent = m;
  if (undo) {
    const b = document.createElement('button'); b.textContent = 'تراجع';
    b.onclick = () => { t.classList.remove('show'); undo(); };
    t.append(b); t.classList.add('act');
  } else t.classList.remove('act');
  t.classList.add('show'); clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), undo ? 8000 : 3000);
}
// الأقسام تُحفظ كعنصر خاص أول القائمة (نفس ملف البيانات)
const persist = () => window.api.save([{ id: '__meta__', kind: '_meta', sections, ui, views, collapsed: [...collapsed], groups, trash, notes, boards }, ...items]);
function fileURL(p) {
  const parts = String(p).replace(/\\/g, '/').split('/'); const first = parts.shift();
  return 'file:///' + first + '/' + parts.map(encodeURIComponent).join('/');
}
function normalizeSections() {
  const ok = new Set(sections.map(s => s.id));
  items.forEach(i => { if (i.section && !ok.has(i.section)) i.section = ''; });
  sections.forEach(s => { if (s.parent && (!ok.has(s.parent) || s.parent === s.id)) s.parent = ''; });
}
/* ---------- شجرة الأقسام (أقسام داخل أقسام) ---------- */
const kids = id => sections.filter(s => (s.parent || '') === id);
function descendants(id) { const out = [], st = [id], seen = new Set([id]); while (st.length) { const x = st.pop(); kids(x).forEach(k => { if (seen.has(k.id)) return; seen.add(k.id); out.push(k.id); st.push(k.id); }); } return out; }
function pathOf(id) { const p = [], seen = new Set(); let c = sections.find(s => s.id === id); while (c && !seen.has(c.id)) { seen.add(c.id); p.unshift(c); c = sections.find(s => s.id === (c.parent || '')); } return p; }
function secOptions(excludeId) {
  const ex = excludeId ? new Set([excludeId, ...descendants(excludeId)]) : new Set(), out = [];
  const walk = (pid, d, seen) => kids(pid).forEach(s => { if (ex.has(s.id) || seen.has(s.id)) return; out.push({ id: s.id, label: '— '.repeat(d) + (s.emoji || '📁') + ' ' + s.name }); walk(s.id, d + 1, new Set([...seen, s.id])); });
  walk('', 0, new Set()); return out;
}
const secOptsHTML = (first, excludeId) => `<option value="">${first}</option>` + secOptions(excludeId).map(o => `<option value="${o.id}">${esc(o.label)}</option>`).join('');
const secTotal = id => { const ids = new Set([id, ...descendants(id)]); return visItems().filter(i => ids.has(i.section)).length; };
function navTo(id) {
  secF = id; catF = ''; laterF = false; result = null; $('q').value = '';
  pathOf(id).forEach(s => collapsed.delete(s.id)); incSub = false; render(); playEnter();
}
/* ---------- المظهر وأشكال العرض ---------- */
const SWATCHES = ['', '#2563eb', '#0ea5e9', '#06b6d4', '#0d9488', '#16a34a', '#84cc16', '#eab308', '#f59e0b', '#ea580c', '#dc2626', '#e11d48', '#db2777', '#c026d3', '#7c3aed', '#4f46e5', '#64748b', '#111827'];
const PRESETS = [['', 'الأساسي', '#f6f5f1', '#ffffff', '#2f6f5e'], ['night', 'ليلي', '#0e1220', '#171c2e', '#7aa2ff'], ['glass', 'زجاجي', '#2a3560', '#4a5a8a', '#8be9fd'], ['paper', 'ورقي', '#f1e8d6', '#fffaf0', '#a0522d'], ['neon', 'نيون', '#08080f', '#11111d', '#00f0ff'],
  ['ocean', 'محيط', '#0a1a24', '#11293a', '#38bdf8'], ['forest', 'غابة', '#0f1a14', '#17261d', '#4ade80'], ['mocha', 'موكا', '#1b1410', '#281f19', '#d89b6a'], ['midnight', 'منتصف الليل', '#000000', '#0c0c0e', '#a78bfa'], ['retro', 'ريترو تيرمنال', '#020a02', '#061506', '#5dff7a'],
  ['sunset', 'غروب', '#fff3e8', '#fffaf5', '#ea580c'], ['rose', 'وردي', '#fdeef2', '#fff8fa', '#db2777'], ['lavender', 'لافندر', '#f1edfb', '#faf8ff', '#7c3aed'], ['mint', 'نعناع', '#e9f8f1', '#f7fffb', '#0f9d6e'], ['sky', 'سماء', '#eaf4ff', '#f9fcff', '#2563eb']];
const WALLS = { g1: 'linear-gradient(135deg,#1b2a52,#4a2c6d 55%,#12485a)', g2: 'linear-gradient(135deg,#ff9a8b,#ff6a88 50%,#ff99ac)', g3: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', g4: 'linear-gradient(135deg,#f6d365,#fda085)', g5: 'linear-gradient(135deg,#84fab0,#8fd3f4)', g6: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', g7: 'radial-gradient(circle at 20% 20%,#3a1c71,#d76d77 50%,#ffaf7b)', g8: 'linear-gradient(160deg,#000,#1a1a2e 60%,#16213e)', g9: 'linear-gradient(135deg,#134e5e,#71b280)', g10: 'linear-gradient(135deg,#232526,#414345)' };
const RADS = { s: '3px', r: '22px', p: '30px' };
const onAcc = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return '#fff'; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) > 165 ? '#10151a' : '#fff'; };
function applyAppearance() {
  const r = document.documentElement, st = r.style;
  if (ui.theme === 'light' || ui.theme === 'dark') r.setAttribute('data-theme', ui.theme); else r.removeAttribute('data-theme');
  const at = (k, v) => { if (v) r.setAttribute(k, v); else r.removeAttribute(k); };
  at('data-preset', ui.preset); at('data-cs', ui.cs); at('data-dn', ui.dn); at('data-ff', ui.ff); at('data-hv', ui.hv); at('data-mo', ui.mo); at('data-rad', RADS[ui.rad] ? ui.rad : '');
  if (RADS[ui.rad]) st.setProperty('--rad', RADS[ui.rad]); else st.removeProperty('--rad');
  if (ui.accent) { st.setProperty('--acc', ui.accent); st.setProperty('--onacc', onAcc(ui.accent)); st.setProperty('--acc2', `color-mix(in srgb, ${ui.accent} 16%, var(--card))`); }
  else ['--acc', '--onacc', '--acc2'].forEach(p => st.removeProperty(p));
  if (+ui.tw) st.setProperty('--tw', (+ui.tw) + 'px'); else st.removeProperty('--tw');
  if (+ui.fs && +ui.fs !== 100) st.setProperty('--fs', (+ui.fs / 100)); else st.removeProperty('--fs');
  const wall = ui.wp === 'img' ? (ui.wimg ? `url("${ui.wimg}")` : '') : (WALLS[ui.wp] || '');
  const w = document.getElementById('wall');
  if (wall) { w.style.backgroundImage = wall; r.setAttribute('data-wall', '1'); st.setProperty('--wb', (+ui.wb || 0) + 'px'); st.setProperty('--wd', ((+ui.wd || 0) / 100)); }
  else { w.style.backgroundImage = ''; r.removeAttribute('data-wall'); st.removeProperty('--wb'); st.removeProperty('--wd'); }
}
const scopeKey = () => secF || 'all';
const curView = () => views[scopeKey()] || ui.view || 'big';
function applyView() {
  const o = $('out'); o.classList.remove('v-big', 'v-small', 'v-list'); o.classList.add('v-' + curView());
  o.classList.toggle('nodesc', !ui.showDesc); o.classList.toggle('notags', !ui.showTags);
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === curView()));
}
function splitLoaded(list) {
  const meta = list.find(x => x && x.kind === '_meta');
  return { meta, rest: list.filter(x => x && x.kind !== '_meta') };
}
const defSec = () => (secF && secF !== '__none') ? secF : '';

/* ---------- بحث محلي ---------- */
const norm = s => (s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const STOP = new Set('ابي ابغي ابغى اريد برنامج تطبيق ملف يسوي يسوون شي شيء اللي يعني عندي في من على الى او مع هذا هذه كذا اسوي اعمل ممكن لو اني ابى'.split(' ').map(norm));
const stem = w => w.replace(/^(وال|بال|لل|ال)/, '');
const toks = s => norm(s).split(/[^a-z0-9ء-ي]+/).filter(w => w.length > 1 && !STOP.has(w)).map(stem).filter(w => w.length > 1);
const secName = id => { const s = sections.find(x => x.id === id); return s ? s.name : ''; };
function localSearch(q) {
  const qt = toks(q); if (!qt.length) return [];
  return visItems().map(i => {
    const hay = [i.name, i.desc, i.category, i.tags, KIND_CAT[i.kind], secName(i.section)].join(' ');
    const name = norm(i.name), all = norm(hay), words = toks(hay);
    let s = 0;
    for (const w of qt) {
      if (name.includes(w)) s += 3;
      if (all.includes(w)) s += 1;
      else if (w.length >= 4 && words.some(x => x.length >= 4 && x.startsWith(w.slice(0, 4)))) s += .5;
    }
    return { id: i.id, score: s };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 40);
}

/* ---------- أدوات ---------- */
const cats = list => [...new Set(list.map(i => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
function cleanName(base, isDir) {
  let n = base; if (!isDir) n = n.replace(/\.[^.]{1,5}$/, '');
  n = n.replace(/_+/g, ' ').replace(/\s*-\s*/g, ' - ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  return n || base;
}
function newItem(o) { return { id: uid(), kind: 'other', name: '', desc: '', category: '', tags: '', status: 'using', section: '', path: '', url: '', size: 0, ext: '', thumb: '', color: '', pinned: false, uri: '', cover: false, added: Date.now(), lastOpened: 0, openCount: 0, ...o }; }
function draftFromInfo(info) {
  return newItem({ kind: info.kind, name: cleanName(info.base, info.isDir), category: KIND_CAT[info.kind] || 'أخرى', path: info.path, size: info.size, ext: info.ext, thumb: info.thumb || '', _snippet: info.snippet || '' });
}
function applyAI(d, a) { if (a.name) d.name = a.name; if (a.desc) d.desc = a.desc; if (a.category) d.category = a.category; if (a.tags) d.tags = a.tags; }
function aiPayload(d) { return { kind: d.kind, path: d.path, base: d.path ? d.path.split(/[\\/]/).pop() : d.name, ext: d.ext, size: d.size, url: d.url, snippet: d._snippet, cats: cats(items) }; }
function commit(d) { delete d._snippet; items.push(d); }

/* ---------- العرض ---------- */
/* ---------- 🔒 قفل الأقسام ---------- */
function lockingSec(id) { let g = 0; while (id && g++ < 30) { const s = sections.find(x => x.id === id); if (!s) return null; if (s.lock && !unlocked.has(s.id)) return s; id = s.parent || ''; } return null; }
const isLocked = id => !!id && !!lockingSec(id);
const vis = i => !isLocked(i.section);
const visItems = () => items.filter(vis);
async function hashPass(p, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);
  const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, k, 256);
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function makeLock(p) { const salt = uid() + uid(); return { salt, hash: await hashPass(p, salt) }; }
function scope() {
  return scope0().filter(vis);
}
function scope0() {
  if (secF === '') return items;
  if (secF === '__none') return items.filter(i => !i.section);
  const ids = new Set([secF]); if (incSub) descendants(secF).forEach(d => ids.add(d));
  return items.filter(i => ids.has(i.section));
}
function headHTML() {
  if (!secF || secF === '__none') return '';
  const path = pathOf(secF); const ks = kids(secF);
  const lk = path.filter(s => s.lock && unlocked.has(s.id)).pop();
  let h = '<div class="crumbs"><span data-sec="">🗄️ الكل</span>' + path.map((s, i) => ` › <span data-sec="${s.id}" class="${i === path.length - 1 ? 'cur' : ''}">${esc(s.emoji || '📁')} ${esc(s.name)}</span>`).join('') + (lk ? ` <button class="sm relock" data-relock="${lk.id}">🔒 أقفل الآن</button>` : '') + '</div>';
  h += '<div class="rooms">' + ks.map(k => `<div class="room" data-sec="${k.id}">${esc(k.emoji || '📁')} <b>${esc(k.name)}</b> <span class="sc">${secTotal(k.id)}</span></div>`).join('')
    + '<button class="sm" data-newroom="1">+ غرفة جديدة</button>'
    + (ks.length ? `<label class="inc"><input type="checkbox" id="incSub" ${incSub ? 'checked' : ''}> مع محتوى الغرف</label>` : '') + '</div>';
  return h;
}
function renderSide() {
  const own = {}; visItems().forEach(i => { const k = i.section || ''; own[k] = (own[k] || 0) + 1; });
  let h = `<div class="sitem ${secF === '' ? 'on' : ''}" data-sec="">🗄️ <span class="sn">الكل</span><span class="sc">${visItems().length}</span></div>`;
  const walk = (pid, d, seen) => kids(pid).forEach(s => {
    if (seen.has(s.id)) return;
    const hasK = kids(s.id).length > 0, open = !collapsed.has(s.id);
    h += `<div class="sitem ${secF === s.id ? 'on' : ''}" data-sec="${s.id}" style="padding-inline-start:${8 + d * 14}px"><span class="tog" ${hasK ? `data-tog="${s.id}"` : ''}>${hasK ? (open ? '▾' : '▸') : ''}</span>${s.color ? `<i class="dot" style="background:${esc(s.color)}"></i>` : ''}${esc(s.emoji || '📁')} <span class="sn" title="${esc(s.name)}">${esc(s.name)}</span>${s.lock ? `<span class="lk">${unlocked.has(s.id) ? '🔓' : '🔒'}</span>` : ''}<span class="sc">${isLocked(s.id) ? '' : (hasK ? secTotal(s.id) : (own[s.id] || 0))}</span><span class="sact"><button data-sfence="${s.id}" title="حاوية على سطح المكتب">🪟</button><button data-sedit="${s.id}" title="تعديل / نقل">✏️</button><button data-sdel="${s.id}" title="حذف القسم">🗑️</button></span></div>`;
    if (hasK && open) walk(s.id, d + 1, new Set([...seen, s.id]));
  });
  walk('', 0, new Set());
  if (sections.length) h += `<div class="sitem ${secF === '__none' ? 'on' : ''}" data-sec="__none">📥 <span class="sn">غير مرتبة</span><span class="sc">${own[''] || 0}</span></div>`;
  $('sideList').innerHTML = h;
}
function renderChips() {
  const sc = scope(); const counts = {}; sc.forEach(i => { if (i.category) counts[i.category] = (counts[i.category] || 0) + 1; });
  const laterN = sc.filter(i => i.status === 'later').length;
  let h = `<span class="chip ${!catF && !laterF ? 'on' : ''}" data-chip="all">الكل (${sc.length})</span>`;
  h += cats(sc).map(c => `<span class="chip ${catF === c ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)} (${counts[c]})</span>`).join('');
  if (laterN) h += `<span class="chip ${laterF ? 'on' : ''}" data-chip="later">⏳ بعدين (${laterN})</span>`;
  const usedC = TAGC.filter(c => c && sc.some(i => i.color === c));
  if (usedC.length) h += `<span class="cdots">` + usedC.map(c => `<button class="cdot ${colorF === c ? 'on' : ''}" data-color="${c}" style="background:${c}" title="فلترة باللون"></button>`).join('') + `</span>`;
  $('chips').innerHTML = h;
  $('catList').innerHTML = cats(items).map(c => `<option value="${esc(c)}">`).join('');
}
function previewHTML(i) {
  if (i.kind === 'image' && i.path && IMG_OK.has((i.ext || '').toLowerCase()))
    return `<img class="full" src="${esc(fileURL(i.path))}" data-fb="${esc(i.thumb || '')}" loading="lazy" draggable="false" alt="">`;
  if (i.thumb) return `<img class="${i.kind === 'image' || i.cover ? 'full' : 'icon'}" src="${esc(i.thumb)}" draggable="false" alt="">`;
  return `<span class="emo">${KIND_ICON[i.kind] || '📄'}</span>`;
}
document.addEventListener('load', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.classList.contains('icon') && t.naturalHeight && t.naturalWidth / t.naturalHeight > 1.4) t.className = 'full';
}, true);
document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fb !== undefined && !t.dataset.done) {
    t.dataset.done = '1';
    if (t.dataset.fb) t.src = t.dataset.fb;
    else { const s = document.createElement('span'); s.className = 'emo'; s.textContent = '🖼️'; t.replaceWith(s); }
  }
}, true);
const fmtDur = s => { const m = Math.round(s / 60); return m < 60 ? m + ' د' : Math.floor(m / 60) + ' س' + (m % 60 ? ' ' + (m % 60) + ' د' : ''); };
async function loadPlay() { try { if (window.api.playGet) play = await window.api.playGet() || {}; } catch (e) {} }
function tileHTML(i, why) {
  const miss = missing.has(i.id); const sn = secName(i.section);
  return `<div class="tile ${sel.has(i.id) ? 'sel' : ''} ${miss ? 'miss' : ''} ${i.color ? 'hc' : ''}" ${i.color ? `style="--tc:${esc(i.color)}"` : ''} data-id="${i.id}" draggable="true">
    <div class="chk">✓</div>
    <div class="pre">${previewHTML(i)}</div>
    <div class="body">
      <div class="nm" title="${esc(i.name)}">${i.pinned ? '⭐ ' : ''}${esc(i.name)}</div>
      <div class="meta">${sn && secF === '' ? `<span class="tag">📁 ${esc(sn)}</span>` : ''}${i.category ? `<span class="tag">${esc(i.category)}</span>` : ''}${i.status === 'later' ? '<span class="tag later">بعدين</span>' : ''}${play[i.id] >= 300 ? `<span class="tag">🕒 ${fmtDur(play[i.id])}</span>` : ''}${miss ? '<span class="tag bad">⚠️ مفقود</span>' : ''}</div>
      ${i.desc ? `<div class="ds">${esc(i.desc)}</div>` : ''}
      ${why ? `<div class="why">💡 ${esc(why)}</div>` : ''}
    </div>
    <div class="acts">
      <button class="open" data-act="open">${OPEN_LABEL[i.kind] || 'فتح'}</button>
      <div class="mini">
        ${i.path ? '<button data-act="reveal" title="إظهار في المجلد">📂</button>' : ''}
        <button data-act="rem" title="ذكّرني بهذا">🔔</button>
        <button data-act="pin" class="${i.pinned ? 'pinon' : ''}" title="${i.pinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}">${i.pinned ? '⭐' : '☆'}</button>
        <button data-act="edit" title="تعديل">✏️</button>
        <button data-act="del" title="حذف">🗑️</button>
      </div>
    </div>
  </div>`;
}
function sortItems(list) {
  const a = [...list];
  if (sortBy === 'name') a.sort((x, y) => x.name.localeCompare(y.name, 'ar'));
  else if (sortBy === 'used') a.sort((x, y) => (y.openCount || 0) - (x.openCount || 0) || y.added - x.added);
  else a.sort((x, y) => Math.max(y.lastOpened || 0, y.added || 0) - Math.max(x.lastOpened || 0, x.added || 0));
  return a.sort((x, y) => (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0));
}
function lockHTML(s) {
  return `<div class="lockscr"><div class="lbig">🔒</div><b>«${esc(s.name)}» مقفل</b><div class="hint">اكتب كلمة السر لعرض محتواه</div><div class="lrow"><input id="lkPass" type="password" class="f" autocomplete="off" placeholder="كلمة السر"><button class="pri" id="lkGo">فتح</button></div><div id="lkErr" class="lkerr"></div></div>`;
}
function render() {
  renderSide(); renderChips(); renderBulk();
  let h = '';
  const ls = secF && secF !== '__none' ? lockingSec(secF) : null;
  if (ls) { $('out').innerHTML = `<div class="crumbs"><span data-sec="">🗄️ الكل</span></div>` + lockHTML(ls); $('out').dataset.lock = ls.id; applyView(); return; }
  delete $('out').dataset.lock;
  if (result) {
    const found = result.matches.map(m => ({ it: items.find(i => i.id === m.id), why: m.why })).filter(x => x.it);
    h += `<div class="sec"><span>نتائج البحث (${found.length})</span><button class="sm" data-act="clear">مسح البحث</button></div>`;
    h += found.length ? `<div class="grid">${found.map(x => tileHTML(x.it, x.why)).join('')}</div>` : `<div class="hint" style="padding:12px">ما لقيت شي مناسب في خزنتك.</div>`;
    if (result.suggestions && result.suggestions.length) {
      h += `<div class="sec"><span>اقتراحات ما عندك</span></div><div class="grid">` + result.suggestions.map((s, k) => `
        <div class="tile"><div class="pre"><span class="emo">⚙️</span></div><div class="body"><div class="nm">${esc(s.name)}</div><div class="ds">${esc(s.desc)}</div></div>
        <div class="acts"><button class="open" data-sug="${k}">+ أضفه لـ«بعدين»</button><div class="mini"><button data-gsug="${k}" title="بحث في قوقل">🌐</button></div></div></div>`).join('') + `</div>`;
    }
  } else {
    const list = sortItems(scope().filter(i => (!catF || i.category === catF) && (!laterF || i.status === 'later') && (!colorF || i.color === colorF)));
    if (!items.length) h = `<div class="hero"><div class="hbig">🗄️</div><b>خزنتك جاهزة</b><p>اسحب أي ملف أو صورة أو برنامج أو مجلد وأفلته هنا،<br>وخزنة تسألك عنه وتحفظه وتعرف تلاقيه بوصفه.</p><div class="hbtns"><button class="pri" data-hero="files">＋ أضف ملفات</button><button data-hero="scan">⚙️ استورد برامجي المثبتة</button><button data-hero="link">🔗 أضف رابط</button><button data-hero="note">📝 ملاحظة</button></div></div>`;
    else if (!list.length) h = `<div class="empty"><b>${secF && secF !== '__none' ? 'ما في عناصر هنا' : 'ما في عناصر هنا'}</b>${secF && secF !== '__none' ? 'اسحب ملفات جديدة هنا، أو اسحب عناصر من الخزنة وأفلتها على هذا القسم أو على إحدى غرفه.' : ''}</div>`;
    else h = `<div class="grid">${list.map(i => tileHTML(i)).join('')}</div>`;
    h = headHTML() + h;
  }
  $('out').innerHTML = h; applyView();
}

/* ---------- التحديد الجماعي ---------- */
function renderBulk() {
  $('bMove').innerHTML = '<option value="__">نقل إلى قسم…</option>' + secOptions().map(o => `<option value="${o.id}">${esc(o.label)}</option>`).join('') + '<option value="">📥 بدون قسم</option>';
  $('bulkN').textContent = sel.size;
  $('bDel').disabled = !sel.size; $('bMove').disabled = !sel.size; $('bColor').disabled = !sel.size;
}
function applySelUI() {
  document.querySelectorAll('#out .tile[data-id]').forEach(t => t.classList.toggle('sel', sel.has(t.dataset.id)));
  $('bulkN').textContent = sel.size; $('bDel').disabled = !sel.size; $('bMove').disabled = !sel.size; $('bColor').disabled = !sel.size;
}
function enterSel() { selMode = true; document.body.classList.add('selmode'); $('bulk').hidden = false; $('selBtn').classList.add('on'); renderBulk(); }
function exitSel() { selMode = false; sel.clear(); document.body.classList.remove('selmode'); $('bulk').hidden = true; $('selBtn').classList.remove('on'); applySelUI(); }
function selectAllVisible() { document.querySelectorAll('#out .tile[data-id]').forEach(t => sel.add(t.dataset.id)); applySelUI(); }
$('selBtn').onclick = () => selMode ? exitSel() : enterSel();
$('bCancel').onclick = exitSel;
$('bAll').onclick = selectAllVisible;
$('bDel').onclick = () => { const ids = [...sel]; if (!ids.length) return; exitSel(); deleteMany(ids); };
$('bColor').onchange = async e => { const v = e.target.value; e.target.value = '__'; if (v === '__' || !sel.size) return; items.forEach(i => { if (sel.has(i.id)) i.color = v; }); await persist(); render(); toast('تم تلوين ' + sel.size + ' عنصر'); };
$('bMove').onchange = e => { const v = e.target.value; if (v === '__' || !sel.size) return; const ids = [...sel]; exitSel(); moveItems(ids, v); };

async function deleteMany(ids) {
  const set = new Set(ids); const removed = items.filter(i => set.has(i.id));
  items = items.filter(i => !set.has(i.id));
  groups.forEach(g => { g.ids = (g.ids || []).filter(x => !set.has(x)); });
  trash = [...removed.map(i => ({ ...i, _del: Date.now() })), ...trash].slice(0, 300);
  if (result) result.matches = result.matches.filter(m => !set.has(m.id));
  await persist(); render();
  toast(`انحذف ${removed.length} عنصر (يبقى في السلة 30 يوم)`, async () => { items.push(...removed); trash = trash.filter(x => !set.has(x.id)); await persist(); render(); toast('تم التراجع'); });
}
async function moveItems(ids, secId) {
  const set = new Set(ids); items.forEach(i => { if (set.has(i.id)) i.section = secId; });
  await persist(); render();
  toast(secId ? `انتقل ${ids.length} عنصر إلى «${secName(secId)}»` : `أُخرج ${ids.length} عنصر من القسم`);
}

/* تحديد بالسحب بالماوس (مربع) */
let mq = null;
$('out').addEventListener('mousedown', e => {
  if (e.button !== 0 || e.target.closest('button,input,select,a,.chip,.room,.crumbs,label')) return;
  const onTile = !!e.target.closest('.tile');
  if (onTile && !selMode) return;
  mq = { sx: e.pageX, sy: e.pageY, cx: e.clientX, cy: e.clientY, active: false, add: e.ctrlKey || e.shiftKey, base: new Set(sel), onTile, box: null };
  e.preventDefault();
});
function updateMarquee() {
  if (!mq || !mq.active) return;
  const px = mq.cx + window.scrollX, py = mq.cy + window.scrollY;
  const x1 = Math.min(mq.sx, px), x2 = Math.max(mq.sx, px), y1 = Math.min(mq.sy, py), y2 = Math.max(mq.sy, py);
  Object.assign(mq.box.style, { left: (x1 - window.scrollX) + 'px', top: (y1 - window.scrollY) + 'px', width: (x2 - x1) + 'px', height: (y2 - y1) + 'px' });
  sel.clear(); if (mq.add) mq.base.forEach(id => sel.add(id));
  document.querySelectorAll('#out .tile[data-id]').forEach(t => {
    const r = t.getBoundingClientRect();
    const tx1 = r.left + window.scrollX, tx2 = r.right + window.scrollX, ty1 = r.top + window.scrollY, ty2 = r.bottom + window.scrollY;
    if (tx1 < x2 && tx2 > x1 && ty1 < y2 && ty2 > y1) sel.add(t.dataset.id);
  });
  applySelUI();
}
function mqLoop() {
  if (!mq || !mq.active) return;
  if (mq.cy < 90) window.scrollBy(0, -(90 - mq.cy) / 4 - 4);
  else if (mq.cy > window.innerHeight - 90) window.scrollBy(0, (mq.cy - (window.innerHeight - 90)) / 4 + 4);
  updateMarquee(); requestAnimationFrame(mqLoop);
}
window.addEventListener('mousemove', e => {
  if (!mq) return;
  mq.cx = e.clientX; mq.cy = e.clientY;
  if (!mq.active) {
    if (Math.abs(e.pageX - mq.sx) < 6 && Math.abs(e.pageY - mq.sy) < 6) return;
    mq.active = true; if (!selMode) enterSel();
    mq.box = document.createElement('div'); mq.box.id = 'mbox'; document.body.appendChild(mq.box);
    requestAnimationFrame(mqLoop);
  }
  updateMarquee();
});
window.addEventListener('mouseup', () => {
  if (!mq) return;
  if (mq.box) mq.box.remove();
  if (mq.active) { suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
  else if (selMode && !mq.onTile) { sel.clear(); applySelUI(); }
  mq = null;
});

function swatchRow(el, get, set) {
  const draw = () => { el.innerHTML = TAGC.map(c => `<button type="button" class="sw ${c ? '' : 'def'} ${get() === c ? 'on' : ''}" data-c="${c}" style="${c ? 'background:' + c : 'background:var(--line)'}" title="${c || 'بدون لون'}"></button>`).join(''); };
  el.onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; set(b.dataset.c); draw(); };
  draw();
}
/* ---------- نافذة الإضافة/التعديل ---------- */
function askDraft(d, o = {}) {
  return new Promise(res => {
    const dlg = $('dlg'); let dirty = {}, done = false;
    const cur = { path: d.path || '', thumb: d.thumb || '', color: d.color || '' };
    swatchRow($('fColorRow'), () => cur.color, v => { cur.color = v; });
    $('dTitle').textContent = o.title || ''; $('dProg').textContent = o.progress || '';
    $('fName').value = d.name || ''; $('fDesc').value = d.desc || ''; $('fCat').value = d.category || '';
    $('fTags').value = d.tags || ''; $('fStatus').value = d.status || 'using'; $('fUrl').value = d.url || '';
    $('fSection').innerHTML = secOptsHTML('بدون قسم');
    $('fSection').value = d.section || '';
    $('rowUrl').hidden = d.kind !== 'link';
    $('fDesc').rows = d.kind === 'note' ? 8 : 3;
    $('descLabel').textContent = d.kind === 'note' ? 'نص الملاحظة' : 'وصف (شنو هذا ولشنو تستخدمه؟)';
    const setPv = () => { $('pvIco').innerHTML = cur.thumb ? `<img src="${esc(cur.thumb)}" alt="">` : (KIND_ICON[d.kind] || '📄'); $('pvPath').textContent = cur.path || $('fUrl').value || ''; };
    setPv();
    $('pvPath').parentElement.hidden = d.kind === 'note';
    $('rowPath').hidden = !(o.edit && d.path);
    $('allBtn').hidden = !o.canAll;
    $('skipBtn').textContent = (o.canAll || o.progress) ? 'تخطي' : 'إلغاء';
    $('aiNote').textContent = '';
    ['fName', 'fDesc', 'fCat', 'fTags'].forEach(id => { $(id).oninput = () => { dirty[id] = true; }; });
    $('fUrl').oninput = setPv;

    const runAI = async force => {
      if (!hasKey) { $('aiNote').textContent = 'فعّل الذكاء الاصطناعي من ⋯ ← 🔑 عشان يتعرّف عليه تلقائياً'; return; }
      if (force) dirty = {};
      $('aiNote').textContent = '✨ الذكاء الاصطناعي يحلل العنصر...';
      const r = await window.api.aiSuggest(aiPayload({ ...d, url: $('fUrl').value.trim() || d.url, name: $('fName').value }));
      if (done) return;
      if (!r.ok) { $('aiNote').textContent = 'تعذّر التحليل: ' + r.error; return; }
      const a = r.data || {};
      if (a.name && !dirty.fName) $('fName').value = a.name;
      if (a.desc && !dirty.fDesc) $('fDesc').value = a.desc;
      if (a.category && !dirty.fCat) $('fCat').value = a.category;
      if (a.tags && !dirty.fTags) $('fTags').value = a.tags;
      $('aiNote').textContent = '✨ تم التعرّف تلقائياً — عدّل أي شي تبيه ثم احفظ';
    };
    const values = () => ({
      name: $('fName').value.trim(), desc: $('fDesc').value.trim(), category: $('fCat').value.trim(), tags: $('fTags').value.trim(),
      status: $('fStatus').value, url: $('fUrl').value.trim(), section: $('fSection').value, path: cur.path, thumb: cur.thumb, color: cur.color
    });
    const finish = a => { if (done) return; done = true; const v = values(); dlg.close(); res({ action: a, values: v }); };
    $('form').onsubmit = e => { e.preventDefault(); if (!$('fName').value.trim()) { $('fName').focus(); return; } finish('save'); };
    $('skipBtn').onclick = () => finish('skip');
    $('allBtn').onclick = () => { if ($('fName').value.trim()) finish('all'); };
    $('aiBtn').onclick = () => runAI(true);
    $('relinkBtn').onclick = async () => {
      const ps = await window.api.pick({ dirs: d.kind === 'folder' }); if (!ps[0]) return;
      const info = await window.api.inspect(ps[0]);
      if (info && !info.error) { cur.path = info.path; cur.thumb = info.thumb || cur.thumb; setPv(); }
    };
    dlg.oncancel = e => { e.preventDefault(); finish('cancel'); };
    dlg.showModal(); $('fName').focus(); $('fName').select();
    if (o.auto) runAI(false);
  });
}
async function autoFill(d) { if (!hasKey) return; const r = await window.api.aiSuggest(aiPayload(d)); if (r.ok) applyAI(d, r.data || {}); }

/* ---------- الأقسام ---------- */
$('emojiRow').innerHTML = EMOJIS.map(e => `<button type="button" data-e="${e}">${e}</button>`).join('');
function askSection(s, defParent) {
  return new Promise(res => {
    const dlg = $('secDlg'); let done = false;
    $('secTitle').textContent = s ? 'تعديل القسم' : (defParent ? 'غرفة جديدة' : 'قسم جديد');
    $('secName').value = s ? s.name : ''; $('secEmoji').value = s ? (s.emoji || '📁') : (defParent ? '⭐' : '📁');
    $('secParent').innerHTML = secOptsHTML('— قسم رئيسي (بدون أب)', s ? s.id : null);
    $('secParent').value = s ? (s.parent || '') : (defParent || '');
    $('secPass').value = ''; $('secRmLock').checked = false; $('secUnlockRow').hidden = !(s && s.lock); $('secLockHint').textContent = s && s.lock ? '(مقفل حالياً — اكتب كلمة جديدة للتغيير)' : '';
    let scol = s ? (s.color || '') : ''; swatchRow($('secColorRow'), () => scol, v => { scol = v; });
    const fin = v => { if (done) return; done = true; dlg.close(); res(v); };
    $('secForm').onsubmit = async e => { e.preventDefault(); const n = $('secName').value.trim(); if (!n) return; const o = { name: n, emoji: $('secEmoji').value.trim() || '📁', parent: $('secParent').value, color: scol }; const pw = $('secPass').value; if (pw) o.lock = await makeLock(pw); else if ($('secRmLock').checked) o.lock = null; fin(o); };
    $('secCancel').onclick = () => fin(null);
    dlg.oncancel = e => { e.preventDefault(); fin(null); };
    $('emojiRow').onclick = e => { const b = e.target.closest('[data-e]'); if (b) $('secEmoji').value = b.dataset.e; };
    dlg.showModal(); $('secName').focus(); $('secName').select();
  });
}
async function newSection(parent) {
  const r = await askSection(null, parent); if (!r) return;
  const s = { id: uid(), name: r.name, emoji: r.emoji, parent: r.parent || '', color: r.color || '' }; if (r.lock) { s.lock = r.lock; unlocked.add(s.id); } sections.push(s);
  await persist(); navTo(s.id);
}
$('addSec').onclick = () => newSection('');
$('sideList').addEventListener('click', async e => {
  const tg = e.target.closest('[data-tog]'), ed = e.target.closest('[data-sedit]'), del = e.target.closest('[data-sdel]');
  if (tg) { e.stopPropagation(); const id = tg.dataset.tog; collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); await persist(); render(); return; }
  const fc = e.target.closest('[data-sfence]');
  if (fc) { e.stopPropagation(); if (!window.api.fenceToggle) return toast('حدّث ملفات resources أيضاً (main.js)'); const on = await window.api.fenceToggle(fc.dataset.sfence); toast(on ? 'انفتحت حاوية على سطح المكتب 🪟 (Ctrl+Alt+D للإظهار فوق كل شيء)' : 'انقفلت الحاوية'); return; }
  if (ed) { e.stopPropagation(); const s = sections.find(x => x.id === ed.dataset.sedit); const r = await askSection(s); if (r) { Object.assign(s, r); if (s.lock === null) { delete s.lock; unlocked.delete(s.id); } else if (r.lock) unlocked.add(s.id); normalizeSections(); await persist(); render(); } return; }
  if (del) {
    e.stopPropagation(); const s = sections.find(x => x.id === del.dataset.sdel); const par = s.parent || '';
    if (!confirm(`حذف القسم «${s.name}»؟ ما يتحذف شي من محتواه: عناصره وغرفه تنتقل للقسم الأعلى.`)) return;
    items.forEach(i => { if (i.section === s.id) i.section = par; });
    sections.forEach(x => { if ((x.parent || '') === s.id) x.parent = par; });
    sections = sections.filter(x => x.id !== s.id); collapsed.delete(s.id); if (secF === s.id) secF = par;
    await persist(); render(); return;
  }
  const it = e.target.closest('.sitem'); if (it) navTo(it.dataset.sec);
});

/* ---------- إضافة ---------- */
async function addPaths(paths, forceSec) {
  paths = [...new Set(paths)].filter(p => p && !items.some(i => i.path === p));
  if (!paths.length) { toast('هذي العناصر مضافة من قبل'); return; }
  let all = false, n = 0;
  for (let k = 0; k < paths.length; k++) {
    const info = await window.api.inspect(paths[k]);
    if (!info || info.error) { toast('تعذّر قراءة: ' + paths[k]); continue; }
    const d = draftFromInfo(info); d.section = forceSec !== undefined && forceSec !== null ? forceSec : defSec();
    if (all) { setBusy(`أضيف ${k + 1} من ${paths.length}...`); await autoFill(d); commit(d); n++; continue; }
    const r = await askDraft(d, { title: 'إضافة إلى الخزنة', progress: paths.length > 1 ? `${k + 1} من ${paths.length}` : '', canAll: k < paths.length - 1, auto: true });
    if (r.action === 'cancel') break;
    if (r.action === 'skip') continue;
    Object.assign(d, r.values); commit(d); n++;
    if (r.action === 'all') all = true;
  }
  setBusy(''); await persist(); render(); checkMissing();
  if (n) toast(`انضاف ${n} عنصر`);
}
async function addLink(url) {
  let host = ''; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
  const d = newItem({ kind: 'link', name: host || 'رابط', category: KIND_CAT.link, url: url || '', section: defSec() });
  const r = await askDraft(d, { title: 'إضافة رابط', auto: !!url });
  if (r.action !== 'save') return;
  Object.assign(d, r.values); if (d.url && !/^https?:\/\//i.test(d.url)) d.url = 'https://' + d.url;
  commit(d); await persist(); render(); toast('انضاف');
}
async function addNote() {
  const d = newItem({ kind: 'note', category: KIND_CAT.note, section: defSec() });
  const r = await askDraft(d, { title: 'ملاحظة جديدة' });
  if (r.action !== 'save') return;
  Object.assign(d, r.values); commit(d); await persist(); render(); toast('انضافت');
}

/* ---------- أحداث العناصر ---------- */
async function openItem(it) {
  if (it.kind === 'note') return editItem(it);
  let r;
  if (it.kind === 'link') r = { ok: await window.api.openUrl(it.url) };
  else if (it.uri) r = { ok: await window.api.openUri(it.uri) };
  else if (!it.path && it.kind === 'app') r = { ok: await window.api.openUrl('https://www.google.com/search?q=' + encodeURIComponent(it.name + ' download')) };
  else r = await window.api.open(it.path);
  if (!r.ok) {
    if (r.error === 'missing') { missing.add(it.id); render(); toast('الملف مو موجود في مكانه. اضغط ✏️ ثم «تغيير المسار»'); }
    else toast('ما قدرت أفتحه' + (r.error ? ': ' + r.error : ''));
    return;
  }
  it.openCount = (it.openCount || 0) + 1; it.lastOpened = Date.now(); (it.hist = it.hist || []).push(it.lastOpened); if (it.hist.length > 120) it.hist = it.hist.slice(-120); persist();
}
async function editItem(it) {
  const r = await askDraft({ ...it }, { title: 'تعديل', edit: true });
  if (r.action !== 'save') return;
  Object.assign(it, r.values);
  if (it.kind === 'link' && it.url && !/^https?:\/\//i.test(it.url)) it.url = 'https://' + it.url;
  await persist(); checkMissing(); render();
}
$('out').addEventListener('click', async e => {
  if (suppressClick) return;
  if (!selMode) {
    const nr = e.target.closest('[data-newroom]'); if (nr) { newSection(secF); return; }
    const n = e.target.closest('[data-sec]'); if (n && !e.target.closest('input,label')) { navTo(n.dataset.sec); return; }
  }
  if (selMode) {
    const t = e.target.closest('.tile[data-id]'); if (!t) return;
    const id = t.dataset.id; sel.has(id) ? sel.delete(id) : sel.add(id); applySelUI(); return;
  }
  const b = e.target.closest('[data-act],[data-sug],[data-gsug]'); if (!b) return;
  if (b.dataset.act === 'clear') { $('q').value = ''; result = null; render(); return; }
  if (b.dataset.sug !== undefined || b.dataset.gsug !== undefined) {
    const k = +(b.dataset.sug ?? b.dataset.gsug); const s = result.suggestions[k];
    if (b.dataset.gsug !== undefined) { window.api.openUrl('https://www.google.com/search?q=' + encodeURIComponent(s.name + ' download')); return; }
    items.push(newItem({ kind: 'app', name: s.name, desc: s.desc || '', category: s.category || 'برامج', status: 'later', section: defSec() }));
    result.suggestions.splice(k, 1); await persist(); toast('انضاف لقائمة «بعدين»'); render(); return;
  }
  const tile = b.closest('.tile'); const it = items.find(i => i.id === tile.dataset.id); if (!it) return;
  if (b.dataset.act === 'open') openItem(it);
  else if (b.dataset.act === 'reveal') window.api.reveal(it.path);
  else if (b.dataset.act === 'rem') openRem(it);
  else if (b.dataset.act === 'pin') { it.pinned = !it.pinned; await persist(); render(); toast(it.pinned ? 'تثبّت في الأعلى ⭐' : 'انلغى التثبيت'); }
  else if (b.dataset.act === 'edit') editItem(it);
  else if (b.dataset.act === 'del') deleteMany([it.id]);
});
$('out').addEventListener('change', e => { if (e.target.id === 'incSub') { incSub = e.target.checked; render(); } });
$('out').addEventListener('dblclick', e => {
  if (selMode) return;
  const t = e.target.closest('.tile[data-id]'); if (t && !e.target.closest('button')) { const it = items.find(i => i.id === t.dataset.id); if (it) openItem(it); }
});
$('chips').addEventListener('click', e => {
  const cd = e.target.closest('[data-color]'); if (cd) { colorF = colorF === cd.dataset.color ? '' : cd.dataset.color; render(); return; }
  const c = e.target.closest('.chip'); if (!c) return;
  if (c.dataset.chip === 'all') { catF = ''; laterF = false; colorF = ''; }
  else if (c.dataset.chip === 'later') laterF = !laterF;
  else catF = catF === c.dataset.cat ? '' : c.dataset.cat;
  result = null; $('q').value = ''; render();
});
$('sortSel').onchange = e => { sortBy = e.target.value; render(); };

/* ---------- البحث ---------- */
let liveT;
$('q').addEventListener('input', () => {
  clearTimeout(liveT);
  liveT = setTimeout(() => { const q = $('q').value.trim(); result = q ? { matches: localSearch(q).map(x => ({ id: x.id })), suggestions: [] } : null; render(); }, 150);
});
async function smartSearch() {
  const q = $('q').value.trim(); if (!q) { result = null; render(); return; }
  clearTimeout(liveT);
  if (!hasKey) { result = { matches: localSearch(q).map(x => ({ id: x.id })), suggestions: [] }; render(); return; }
  $('goBtn').disabled = true; $('goBtn').textContent = '…';
  const compact = visItems().slice(0, 800).map(i => ({ id: i.id, name: i.name, kind: i.kind, desc: (i.desc || '').slice(0, 160), cat: i.category, tags: i.tags, section: secName(i.section) }));
  const r = await window.api.aiSearch({ query: q, items: compact });
  $('goBtn').disabled = false; $('goBtn').textContent = '🔎';
  if (r.ok) result = { matches: (r.data.matches || []).map(m => ({ id: m.id, why: m.reason })), suggestions: r.data.suggestions || [] };
  else { toast('تعذّر الذكاء الاصطناعي (' + r.error + ') — استخدمت البحث المحلي'); result = { matches: localSearch(q).map(x => ({ id: x.id })), suggestions: [] }; }
  render();
}
$('goBtn').onclick = smartSearch;
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); smartSearch(); } });
window.api.onFocusSearch(() => { $('q').focus(); $('q').select(); });

/* ---------- القوائم ---------- */
function closeMenus() { $('grpMenu').hidden = true; $('addMenu').hidden = true; $('moreMenu').hidden = true; $('custMenu').hidden = true; }
$('addBtn').onclick = e => { e.stopPropagation(); const h = $('addMenu').hidden; closeMenus(); $('addMenu').hidden = !h; };
$('moreBtn').onclick = e => { e.stopPropagation(); const h = $('moreMenu').hidden; closeMenus(); $('moreMenu').hidden = !h; };
document.addEventListener('click', closeMenus);
$('addMenu').addEventListener('click', async e => {
  const k = e.target.closest('[data-add]'); if (!k) return; closeMenus();
  if (k.dataset.add === 'files') { const ps = await window.api.pick({ multi: true }); if (ps.length) addPaths(ps); }
  else if (k.dataset.add === 'folder') { const ps = await window.api.pick({ dirs: true, multi: true }); if (ps.length) addPaths(ps); }
  else if (k.dataset.add === 'link') addLink('');
  else if (k.dataset.add === 'note') addNote();
});
$('moreMenu').addEventListener('click', async e => {
  const k = e.target.closest('[data-more]'); if (!k) return; closeMenus();
  const a = k.dataset.more;
  if (a === 'settings') { $('apiKey').value = ''; $('apiKey').placeholder = hasKey ? '•••••••• (محفوظ — اكتب مفتاحاً جديداً للتغيير)' : 'sk-ant-...'; $('dataPath').textContent = 'مكان بياناتك: ' + await window.api.dataPath(); $('setDlg').showModal(); }
  else if (a === 'clean') openClean();
  else if (a === 'update') {
    if (!window.api.updateCheck) return toast('حدّث ملفات resources أول مرة يدوياً (main.js)');
    toast('أبحث عن تحديث…'); const r = await window.api.updateCheck();
    if (!r.ok) return toast('تعذّر الاتصال بـ GitHub: ' + r.error);
    if (!r.count) return toast('✅ عندك آخر نسخة');
    if (!confirm(`فيه تحديث جديد (${r.count} ملف).\nأحدّث الحين؟ التطبيق بيعيد تشغيل نفسه وبياناتك ما تتأثر.`)) return;
    toast('أنزّل التحديث…'); const u = await window.api.updateApply();
    toast(u.ok ? '✅ تم! يعيد التشغيل…' : 'فشل التحديث: ' + u.error);
  }
  else if (a === 'prefs') openPrefs();
  else if (a === 'stats2') openStats();
  else if (a === 'palette2') openPalette();
  else if (a === 'update2') document.querySelector('[data-more="update"]').click();
  else if (a === 'stats') openStats();
  else if (a === 'games') importGames();
  else if (a === 'bookmarks') importBookmarks();
  else if (a === 'trash') openTrash();
  else if (a === 'profiles') openProfiles();
  else if (a === 'watch') { if (!window.api.watchChoose) return toast('حدّث resources أيضاً'); const d = await window.api.watchChoose(); if (d) toast('أراقب الآن: ' + d + ' (إشعار لكل ملف جديد)'); }
  else if (a === 'palette') openPalette();
  else if (a.startsWith('smart-')) { if (!window.api.fenceToggle) return toast('حدّث resources أيضاً'); const on = await window.api.fenceToggle('smart:' + a.slice(6)); toast(on ? 'انفتحت الحاوية الذكية 🪟 (تتحدث لحالها)' : 'انقفلت الحاوية'); }
  else if (a === 'bk-open') { if (!window.api.backupOpen) return toast('حدّث resources أيضاً'); await window.api.backupOpen(); }
  else if (a === 'bk-choose') { const d = await window.api.backupChoose(); if (d) toast('النسخ التلقائية صارت في: ' + d); }
  else if (a === 'export') { const ok = await window.api.exportBackup(); if (ok) toast('تم حفظ النسخة الاحتياطية'); }
  else if (a === 'import') {
    const list = await window.api.importBackup(); if (!list) return toast('الملف غير صالح');
    const { meta, rest } = splitLoaded(list); let n = 0;
    if (meta && Array.isArray(meta.sections)) meta.sections.forEach(s => { if (s && s.id && !sections.some(x => x.id === s.id)) sections.push(s); });
    for (const x of rest) {
      if (!x || !x.name) continue;
      if (items.some(i => i.id === x.id || (x.path && i.path === x.path) || (!x.path && i.name === x.name && i.kind === x.kind))) continue;
      items.push(newItem({ ...x, id: x.id || uid() })); n++;
    }
    normalizeSections(); await persist(); render(); checkMissing(); toast(`انضاف ${n} عنصر`);
  }
  else if (a === 'scan') {
    setBusy('أقرأ البرامج المثبتة من قائمة ابدأ...');
    const apps = await window.api.scanApps(); setBusy('');
    if (!apps.length) return toast('ما لقيت برامج (هذي الميزة تشتغل على ويندوز فقط)');
    const have = new Set(items.filter(i => i.kind === 'app').map(i => norm(i.name)));
    const fresh = apps.filter(x => !have.has(norm(x.name)));
    if (!fresh.length) return toast('كل برامجك مضافة من قبل');
    if (!confirm(`لقيت ${fresh.length} برنامج جديد. أضيفها كلها؟`)) return;
    fresh.forEach(x => items.push(newItem({ kind: 'app', name: x.name, category: 'برامج', path: x.path, ext: '.lnk', thumb: x.thumb || '', section: defSec() })));
    await persist(); render(); toast(`انضاف ${fresh.length} برنامج` + (hasKey ? ' — اضغط ⋯ ← ✨ لكتابة أوصافها' : ''));
  }
  else if (a === 'thumbs') {
    const todo = items.filter(i => i.path); let n = 0;
    for (let k = 0; k < todo.length; k++) {
      setBusy(`أحدّث الصور... ${k + 1} من ${todo.length}`);
      try { const t = await window.api.makeThumb(todo[k].path, todo[k].kind); if (t) { todo[k].thumb = t; n++; } }
      catch (e) { setBusy(''); return toast('ملف main.js قديم، انسخه من التحديث داخل resources\\app ثم أعد التشغيل'); }
      if (k % 10 === 9) render();
    }
    setBusy(''); await persist(); render(); toast(`تم تحديث ${n} من ${todo.length}`);
  }
  else if (a === 'fill') {
    if (!hasKey) return toast('فعّل الذكاء الاصطناعي أول (⋯ ← 🔑)');
    let total = 0;
    for (let round = 0; round < 10; round++) {
      const todo = items.filter(i => !i.desc && i.kind !== 'note' && !i._skipFill).slice(0, 30);
      if (!todo.length) break;
      setBusy(`أكتب الأوصاف... (${total} تمت)`);
      const r = await window.api.aiFill({ items: todo.map(i => ({ id: i.id, name: i.name, kind: i.kind, ext: i.ext })) });
      if (!r.ok) { setBusy(''); toast('فشل: ' + r.error); break; }
      const got = new Set();
      for (const x of (r.data.items || [])) { const it = todo.find(t => t.id === x.id); if (it && x.desc) { it.desc = x.desc; if (x.category && (!it.category || it.category === KIND_CAT[it.kind])) it.category = x.category; if (x.tags && !it.tags) it.tags = x.tags; got.add(it.id); total++; } }
      todo.forEach(t => { if (!got.has(t.id)) t._skipFill = true; });
      await persist(); render();
    }
    items.forEach(i => delete i._skipFill);
    setBusy(''); toast(`تمت كتابة ${total} وصف`);
  }
});
$('saveKey').onclick = async () => {
  const v = $('apiKey').value.trim();
  if (v) { hasKey = await window.api.setKey(v); toast(hasKey ? 'تم حفظ المفتاح' : 'تعذّر الحفظ'); }
  $('setDlg').close();
};
$('delKey').onclick = async () => { await window.api.setKey(''); hasKey = false; $('setDlg').close(); toast('انحذف المفتاح'); };
$('closeSet').onclick = () => $('setDlg').close();

/* ---------- السحب والإفلات ---------- */
const isInternal = e => e.dataTransfer && [...e.dataTransfer.types].includes('application/x-khazana');
const isExternal = e => e.dataTransfer && [...e.dataTransfer.types].some(t => t === 'Files' || t === 'text/uri-list');
const clearOver = () => document.querySelectorAll('[data-sec].over').forEach(x => x.classList.remove('over'));
$('out').addEventListener('dragstart', e => {
  const t = e.target.closest && e.target.closest('.tile[data-id]');
  if (!t || selMode) { e.preventDefault(); return; }
  e.dataTransfer.setData('application/x-khazana', JSON.stringify([t.dataset.id]));
  e.dataTransfer.effectAllowed = 'move';
});
let dragDepth = 0;
window.addEventListener('dragenter', e => { if (!isExternal(e)) return; e.preventDefault(); dragDepth++; $('drop').classList.add('on'); });
window.addEventListener('dragover', e => {
  if (!isExternal(e) && !isInternal(e)) return;
  e.preventDefault(); clearOver();
  const s = e.target.closest && e.target.closest('[data-sec]'); if (s && (isExternal(e) || s.dataset.sec !== '')) s.classList.add('over');
});
window.addEventListener('dragleave', e => { if (!isExternal(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('drop').classList.remove('on'); });
window.addEventListener('dragend', clearOver);
window.addEventListener('drop', e => {
  e.preventDefault(); dragDepth = 0; $('drop').classList.remove('on'); clearOver();
  if (document.querySelector('dialog[open]')) return;
  const s = e.target.closest && e.target.closest('[data-sec]');
  const targetSec = s ? (s.dataset.sec === '__none' ? '' : s.dataset.sec) : null;
  if (isInternal(e)) {
    if (targetSec === null || (s && s.dataset.sec === '')) return;
    try { const ids = JSON.parse(e.dataTransfer.getData('application/x-khazana')); moveItems(ids, targetSec); } catch (err) {}
    return;
  }
  const files = [...(e.dataTransfer.files || [])];
  if (files.length) { addPaths(files.map(f => window.api.pathForFile(f)).filter(Boolean), targetSec === '' && s && s.dataset.sec === '' ? null : targetSec); return; }
  const txt = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').trim().split(/\r?\n/)[0];
  if (/^https?:\/\//i.test(txt)) addLink(txt);
});

/* ---------- لوحة المفاتيح ---------- */
document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]')) return;
  if (selMode && e.key === 'Escape') exitSel();
  else if (selMode && e.key === 'Delete' && sel.size) { const ids = [...sel]; exitSel(); deleteMany(ids); }
  else if (selMode && e.ctrlKey && e.key.toLowerCase() === 'a' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); selectAllVisible(); }
});

/* ---------- الملفات المفقودة ---------- */
let lastCheck = 0;
async function checkMissing() {
  lastCheck = Date.now();
  const withPath = items.filter(i => i.path); if (!withPath.length) { missing = new Set(); return render(); }
  const res = await window.api.exists(withPath.map(i => i.path));
  missing = new Set(withPath.filter((_, k) => !res[k]).map(i => i.id)); render();
}
window.addEventListener('focus', () => { if (Date.now() - lastCheck > 15000) checkMissing(); loadPlay(); });

/* ---------- أشكال العرض والتخصيص ---------- */
$('viewSeg').addEventListener('click', async e => { const b = e.target.closest('button[data-v]'); if (!b) return; views[scopeKey()] = b.dataset.v; await persist(); applyView(); });
$('presetSel').innerHTML = PRESETS.map(p => `<option value="${p[0]}">${p[1]}</option>`).join('');
$('swatches').innerHTML = SWATCHES.map(c => `<button type="button" class="sw ${c ? '' : 'def'}" data-c="${c}" style="${c ? 'background:' + c : ''}" title="${c || 'الأخضر الافتراضي'}"></button>`).join('');
function syncCust() {
  $('presetSel').value = ui.preset || ''; $('langSel').value = ui.lang || window.I18N.get(); $('themeSel').value = ui.theme; $('optDesc').checked = ui.showDesc; $('optTags').checked = ui.showTags;
  document.querySelectorAll('#swatches .sw').forEach(b => b.classList.toggle('on', b.dataset.c === (ui.accent || '')));
}
$('custBtn').onclick = e => { e.stopPropagation(); const h = $('custMenu').hidden; closeMenus(); syncCust(); $('custMenu').hidden = !h; };
$('custMenu').addEventListener('click', async e => {
  e.stopPropagation();
  const sw = e.target.closest('.sw'); if (sw) { ui.accent = sw.dataset.c; applyAppearance(); syncCust(); await persist(); return; }
  if (e.target.id === 'viewAll') { ui.view = curView(); views = {}; await persist(); applyView(); toast('طُبّق شكل العرض على كل الأقسام'); }
});
$('themeSel').onchange = async e => { ui.theme = e.target.value; applyAppearance(); await persist(); };
$('optDesc').onchange = async e => { ui.showDesc = e.target.checked; applyView(); await persist(); };
$('optTags').onchange = async e => { ui.showTags = e.target.checked; applyView(); await persist(); };

/* ---------- تبويب ذكّرني ---------- */
function showView(v) {
  if (selMode) exitSel();
  const B = document.body.classList;
  [['zk', 'zkview'], ['nt', 'ntview'], ['td', 'tdview'], ['cv', 'cvview']].forEach(([k, c]) => { B.toggle(c, v === k); $(k).hidden = v !== k; });
  [['navVault', 'vault'], ['navZk', 'zk'], ['navNt', 'nt'], ['navTd', 'td'], ['navCv', 'cv']].forEach(([id, k]) => $(id).classList.toggle('on', k === v || (k === 'vault' && !['zk', 'nt', 'td', 'cv'].includes(v))));
  if (v === 'nt') window.Notes.draw();
  if (v === 'td') drawToday();
  if (v === 'cv') window.Canvas.draw();
}
$('navVault').onclick = () => showView('vault'); $('navZk').onclick = () => showView('zk'); $('navNt').onclick = () => showView('nt'); $('navTd').onclick = () => showView('td'); $('navCv').onclick = () => showView('cv');
window.Canvas.mount($('cv'), { get: () => boards, save: () => persist(), items: () => visItems(), notes: () => window.Notes.list(), open: id => { const it = items.find(i => i.id === id); if (it) { showView('vault'); openItem(it); } }, openNote: id => { showView('nt'); window.Notes.select(id); }, confirm: m => Promise.resolve(window.confirm(m)) });
/* ---------- صفحة اليوم ---------- */
function drawToday() {
  const ar = (ui.lang || window.I18N.get()) !== 'en', now = new Date(), h = now.getHours();
  const hi = h < 5 ? '🌙 سهران؟' : h < 12 ? '☀️ صباح الخير' : h < 17 ? '🌤️ طاب يومك' : h < 21 ? '🌆 مساء الخير' : '🌙 تصبح على خير';
  const dt = now.toLocaleDateString(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  const endDay = new Date(now); endDay.setHours(23, 59, 59, 999);
  const rems = (window.Zakker.list ? window.Zakker.list() : []).filter(r => !r.done && r.when && r.when <= endDay.getTime()).sort((a, b) => a.when - b.when).slice(0, 6);
  const nts = window.Notes.list().slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0)).slice(0, 5);
  const top = visItems().filter(i => i.openCount > 0).sort((a, b) => b.openCount - a.openCount).slice(0, 6);
  const rec = visItems().filter(i => i.lastOpened).sort((a, b) => b.lastOpened - a.lastOpened).slice(0, 6);
  const itm = i => `<div class="tdi" data-it="${i.id}">${i.thumb ? `<img src="${i.thumb}">` : '<span>📄</span>'}<b>${esc(i.name)}</b></div>`;
  const tm = r => new Date(r.when).toLocaleTimeString(ar ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  $('td').innerHTML = `<div class="tdw"><div class="tdh"><h1>${hi}</h1><span>${esc(dt)}</span></div>
    <div class="tdq"><button data-tq="note">📝 ملاحظة سريعة</button><button data-tq="add">➕ إضافة عنصر</button><button data-tq="rem">🔔 تذكير</button><button data-tq="cv">🎨 لوحتي</button><button data-tq="srch">🔎 بحث شامل (Ctrl+K)</button></div>
    <div class="tdg">
      <section><h3>🔔 تذكيرات اليوم</h3>${rems.map(r => `<div class="tdr ${r.when < Date.now() ? 'late' : ''}" data-tq="rem"><b>${esc(r.title)}</b><small>${tm(r)}</small></div>`).join('') || '<div class="hint">ما عندك تذكيرات اليوم 🎉</div>'}</section>
      <section><h3>📝 ملاحظاتك</h3>${nts.map(n => `<div class="tdr" data-nt="${n.id}"><b>${n.pinned ? '📌 ' : ''}${n.lock ? '🔒 ' : ''}${esc(n.title || 'بدون عنوان')}</b></div>`).join('') || '<div class="hint">لسا ما كتبت ملاحظات.</div>'}</section>
      <section><h3>⭐ الأكثر استخداماً</h3><div class="tdit">${top.map(itm).join('') || '<div class="hint">افتح عناصرك وبتظهر هنا.</div>'}</div></section>
      <section><h3>🕘 فتحتها مؤخراً</h3><div class="tdit">${rec.map(itm).join('') || '<div class="hint">ما فتحت شي لسا.</div>'}</div></section>
    </div>
    <div class="tdf">🗄️ ${visItems().length} عنصر · 📝 ${nts.length ? window.Notes.count() : 0} ملاحظة · 🎨 ${window.Canvas.count()} بطاقة في اللوحة</div></div>`;
}
$('td').addEventListener('click', e => {
  const it = e.target.closest('[data-it]'); if (it) { const x = items.find(i => i.id === it.dataset.it); if (x) openItem(x); return; }
  const nt = e.target.closest('[data-nt]'); if (nt) { showView('nt'); window.Notes.select(nt.dataset.nt); return; }
  const q = e.target.closest('[data-tq]'); if (!q) return; const k = q.dataset.tq;
  if (k === 'note') { showView('nt'); window.Notes.create('blank'); } else if (k === 'add') { showView('vault'); $('addBtn').click(); } else if (k === 'rem') showView('zk') ; else if (k === 'cv') showView('cv'); else if (k === 'srch') openPalette();
});
window.Notes.mount($('nt'), {
  get: () => notes, save: () => persist(), items: () => visItems(), open: it => { showView('vault'); openItem(it); },
  hash: (p, s) => hashPass(p, s), salt: () => uid() + uid(), signedIn: () => window.Zakker.signedIn(), docs: () => window.Zakker.getDocs(), setDoc: (id, d, del) => window.Zakker.setDoc(id, d, del), onDocs: cb => { notesMerge = cb; },
  remind: (title, when, noteId) => window.Zakker.addRem(title, when, { note: noteId }), ai: d => window.api.aiNote(d),
  url: u => window.api.openUrl(u), toast: m => toast(m), confirm: m => Promise.resolve(window.confirm(m)),
  importVault: list => { let c = 0; list.forEach(i => { notes.unshift({ id: 'n' + uid(), title: i.name || '', body: i.desc || '', color: i.color || '', pinned: !!i.pinned, tags: i.tags || '', links: [], created: i.added || Date.now(), updated: Date.now() }); i._imp = true; c++; }); persist(); return c; }
});
window.Zakker.init({ platform: 'desktop', onDocs: () => { if (notesMerge) notesMerge(); }, onRing: () => { try { window.api.alertUser(); } catch (e) {} }, onChange: s => { $('navBadge').textContent = s.overdue || ''; } });
window.Zakker.mount($('zk'));

/* ---------- البداية ---------- */
(async () => {
  const s = await window.api.load(); hasKey = s.hasKey;
  const { meta, rest } = splitLoaded(s.items || []);
  sections = meta && Array.isArray(meta.sections) ? meta.sections : [];
  if (meta) { ui = { ...ui, ...(meta.ui || {}) }; views = meta.views || {}; collapsed = new Set(meta.collapsed || []); groups = Array.isArray(meta.groups) ? meta.groups : []; notes = Array.isArray(meta.notes) ? meta.notes : []; boards = Array.isArray(meta.boards) ? meta.boards : []; trash = (Array.isArray(meta.trash) ? meta.trash : []).filter(x => x && Date.now() - (x._del || 0) < 30 * 864e5); }
  applyAppearance(); window.I18N.set(ui.lang || window.I18N.auto());
  if (window.Splash) window.Splash.ready(!ui.welcomed, lg => { ui.lang = lg; ui.welcomed = true; window.I18N.set(lg); render(); persist(); }, ui.lang);
  items = rest.map(x => newItem(x)); normalizeSections();
  render(); playEnter(); checkMissing(); loadPlay().then(render);
  if (ui.startToday !== false) showView('td');
})();

/* ---------- أوامر من الحاويات والبحث السريع ---------- */
if (window.api.onExt) window.api.onExt(async d => {
  if (d.type === 'addLink') {
    if (items.some(i => i.url === d.url)) return window.api.notify('هذا الرابط مضاف من قبل');
    let host = ''; try { host = new URL(d.url).hostname.replace(/^www\./, ''); } catch (e) {}
    const dr = newItem({ kind: 'link', name: host || 'رابط', category: KIND_CAT.link, url: d.url, section: '' }); try { await autoFill(dr); } catch (e) {}
    commit(dr); await persist(); render(); window.api.notify('انضاف الرابط: ' + dr.name + ' ✓'); return;
  }
  if (d.type === 'note') { window.Notes.quick(d.text, d.tags); window.api.notify('📝 انحفظت الملاحظة'); return; }
  if (d.type === 'open') { const it = items.find(i => i.id === d.id); if (it) openItem(it); return; }
  if (d.type === 'add') {
    const paths = [...new Set(d.paths)].filter(p => !items.some(i => i.path === p));
    if (!paths.length) return;
    let n = 0;
    for (const p of paths) {
      const info = await window.api.inspect(p); if (!info || info.error) continue;
      const dr = draftFromInfo(info); dr.section = d.sec || ''; try { await autoFill(dr); } catch (e) {}
      commit(dr); n++;
    }
    await persist(); render(); checkMissing(); if (n) { toast(`انضاف ${n} عنصر`); if (d.notify) window.api.notify(`انضاف ${n} عنصر للخزنة ✓`); }
  }
});

/* ---------- ⚡ المجموعات ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function runGroup(g) {
  const list = (g.ids || []).map(id => items.find(i => i.id === id)).filter(i => i && i.kind !== 'note' && vis(i));
  if (!list.length) return toast('المجموعة فاضية');
  toast(`⚡ أشغّل «${g.name}» (${list.length})`);
  for (const it of list) { await openItem(it); await sleep(450); }
}
function renderGrpMenu() {
  $('grpMenu').innerHTML = (groups.length ? groups.map(g => `<div class="grow" data-g="${g.id}"><button class="grun" data-grun="${g.id}" title="تشغيل">▶ ${esc(g.emoji || '⚡')} ${esc(g.name)} <span class="hint">(${(g.ids || []).length})</span>${g.sched && g.sched.on ? ` <span class="hint">⏰ ${esc(g.sched.time)}</span>` : ''}</button><button data-gedit="${g.id}" title="تعديل">✏️</button><button data-gdel="${g.id}" title="حذف">🗑️</button></div>`).join('') : '<div class="hint" style="padding:6px 4px">ما عندك مجموعات. مثلاً «وضع الدراسة» تفتح متصفح + ملفاتك + ملاحظاتك بضغطة.</div>')
    + '<button class="sm" id="grpNew" style="margin-top:6px">+ مجموعة جديدة</button>';
}
$('grpBtn').onclick = e => { e.stopPropagation(); const h = $('grpMenu').hidden; closeMenus(); renderGrpMenu(); $('grpMenu').hidden = !h; };
$('grpMenu').addEventListener('click', async e => {
  e.stopPropagation();
  const run = e.target.closest('[data-grun]'), ed = e.target.closest('[data-gedit]'), del = e.target.closest('[data-gdel]');
  if (run) { closeMenus(); runGroup(groups.find(g => g.id === run.dataset.grun)); return; }
  if (ed) { closeMenus(); editGroup(groups.find(g => g.id === ed.dataset.gedit)); return; }
  if (del) { const g = groups.find(x => x.id === del.dataset.gdel); if (g && confirm(`حذف المجموعة «${g.name}»؟ (العناصر نفسها ما تتحذف)`)) { groups = groups.filter(x => x !== g); await persist(); renderGrpMenu(); } return; }
  if (e.target.id === 'grpNew') { closeMenus(); editGroup(null); }
});
function editGroup(g) {
  const dlg = $('grpDlg'); const chosen = new Set(g ? g.ids : []);
  $('grpTitle').textContent = g ? 'تعديل المجموعة' : 'مجموعة جديدة';
  $('grpName').value = g ? g.name : ''; $('grpEmoji').value = g ? (g.emoji || '⚡') : '⚡'; $('grpFilter').value = '';
  const all = visItems().filter(i => i.kind !== 'note').sort((x, y) => (chosen.has(y.id) ? 1 : 0) - (chosen.has(x.id) ? 1 : 0) || x.name.localeCompare(y.name, 'ar'));
  const draw = () => {
    const f = norm($('grpFilter').value.trim());
    $('grpList').innerHTML = all.filter(i => !f || norm(i.name).includes(f)).map(i => `<label class="chk-row"><input type="checkbox" data-id="${i.id}" ${chosen.has(i.id) ? 'checked' : ''}> <span class="ci">${i.thumb ? `<img src="${esc(i.thumb)}" alt="">` : (KIND_ICON[i.kind] || '📄')}</span> ${esc(i.name)}</label>`).join('') || '<div class="hint" style="padding:8px">ما في عناصر</div>';
    $('grpCount').textContent = `(${chosen.size} محدد)`;
  };
  const sc = (g && g.sched) || {}; $('grpSched').checked = !!sc.on; $('grpTime').value = sc.time || '16:00'; $('grpBoot').checked = !!sc.boot;
  document.querySelectorAll('#grpDays input').forEach(c => { c.checked = !sc.days || !sc.days.length || sc.days.includes(+c.value); });
  $('grpFilter').oninput = draw;
  $('grpList').onchange = e => { const c = e.target.closest('input[data-id]'); if (!c) return; c.checked ? chosen.add(c.dataset.id) : chosen.delete(c.dataset.id); $('grpCount').textContent = `(${chosen.size} محدد)`; };
  $('grpCancel').onclick = () => dlg.close();
  $('grpForm').onsubmit = async e => {
    e.preventDefault(); const name = $('grpName').value.trim(); if (!name) return;
    const ids = all.filter(i => chosen.has(i.id)).map(i => i.id);
    // نحافظ على ترتيب الاختيار الأصلي إن وُجد
    if (g) { g.ids.forEach(() => {}); const old = g.ids.filter(x => chosen.has(x)); ids.sort((x, y) => { const a = old.indexOf(x), b = old.indexOf(y); return (a < 0 ? 1e9 : a) - (b < 0 ? 1e9 : b); }); }
    const sched = { on: $('grpSched').checked, time: $('grpTime').value || '16:00', boot: $('grpBoot').checked, days: [...document.querySelectorAll('#grpDays input:checked')].map(c => +c.value) };
    if (g) Object.assign(g, { name, emoji: $('grpEmoji').value.trim() || '⚡', ids, sched }); else groups.push({ id: uid(), name, emoji: $('grpEmoji').value.trim() || '⚡', ids, sched });
    await persist(); dlg.close(); toast('انحفظت المجموعة ⚡');
  };
  draw(); dlg.showModal();
}
if (window.api.onExt) window.api.onExt(d => { if (d.type === 'run') { const g = groups.find(x => x.id === d.gid); if (g) runGroup(g); } });

/* ---------- 🧹 فحص الملفات الميتة والمكررة ---------- */
async function openClean() {
  const dlg = $('cleanDlg'), body = $('cleanBody'); $('cleanDel').hidden = true; body.innerHTML = '<div class="hint" style="padding:14px">⏳ أفحص ملفاتك…</div>'; dlg.showModal();
  const withPath = visItems().filter(i => i.path);
  const ex = withPath.length ? await window.api.exists(withPath.map(i => i.path)) : [];
  const dead = withPath.filter((_, k) => !ex[k]);
  const nrm = p => String(p).replace(/\\/g, '/').toLowerCase();
  const buckets = {};
  visItems().forEach(i => {
    if (i.kind === 'note') return;
    let k = null;
    if (i.path) k = 'p:' + nrm(i.path);
    else if (i.kind === 'link' && i.url) k = 'u:' + i.url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '').toLowerCase();
    if (k) (buckets[k] = buckets[k] || []).push(i);
    if (i.path && i.size > 0 && !i.isDir) { const k2 = 's:' + norm(i.name) + '|' + i.size + '|' + (i.ext || '').toLowerCase(); (buckets[k2] = buckets[k2] || []).push(i); }
  });
  const seen = new Set(); const dups = [];
  Object.entries(buckets).forEach(([k, g]) => {
    const uniq = [...new Map(g.map(x => [x.id, x])).values()]; if (uniq.length < 2) return;
    const key = uniq.map(x => x.id).sort().join(','); if (seen.has(key)) return; seen.add(key);
    uniq.sort((x, y) => (y.openCount || 0) - (x.openCount || 0) || (x.added || 0) - (y.added || 0));
    dups.push({ why: k[0] === 'p' ? 'نفس المسار' : k[0] === 'u' ? 'نفس الرابط' : 'نفس الاسم والحجم', list: uniq });
  });
  const row = (i, chk, extra) => `<label class="chk-row"><input type="checkbox" data-cid="${i.id}" ${chk ? 'checked' : ''}> <span class="ci">${i.thumb ? `<img src="${esc(i.thumb)}" alt="">` : (KIND_ICON[i.kind] || '📄')}</span><span class="cn"><b>${esc(i.name)}</b><span class="hint" dir="ltr">${esc(i.path || i.url || '')}</span></span>${extra || ''}</label>`;
  let h = '';
  h += `<div class="sec"><span>⚠️ ملفات مفقودة (${dead.length})</span></div>`;
  h += dead.length ? dead.map(i => row(i, false, `<button type="button" class="sm" data-relink="${i.id}">📍 غيّر المسار</button>`)).join('') : '<div class="hint" style="padding:6px 4px">✅ كل ملفاتك موجودة في أماكنها.</div>';
  h += `<div class="sec"><span>👯 مكررات (${dups.length} مجموعة)</span></div>`;
  h += dups.length ? dups.map(g => `<div class="dgrp"><div class="hint">${g.why} — العلامة على اللي يتحذف، واحد منهم يبقى</div>${g.list.map((i, k) => row(i, k > 0, k === 0 ? '<span class="tag">يبقى</span>' : '')).join('')}</div>`).join('') : '<div class="hint" style="padding:6px 4px">✅ ما في مكررات.</div>';
  body.innerHTML = h;
  const upd = () => { $('cleanDel').hidden = !body.querySelector('input:checked'); $('cleanDel').textContent = `🗑️ احذف المحدد (${body.querySelectorAll('input:checked').length}) من الخزنة`; };
  body.onchange = upd; upd();
  body.onclick = async e => {
    const b = e.target.closest('[data-relink]'); if (!b) return; e.preventDefault();
    const it = items.find(i => i.id === b.dataset.relink); if (!it) return;
    const ps = await window.api.pick({ dirs: it.kind === 'folder' }); if (!ps[0]) return;
    const info = await window.api.inspect(ps[0]); if (!info || info.error) return toast('تعذّر قراءة الملف');
    it.path = info.path; it.thumb = info.thumb || it.thumb; it.size = info.size || it.size; missing.delete(it.id); await persist(); render();
    b.closest('label').remove(); toast('تم تصحيح المسار ✅');
  };
  $('cleanDel').onclick = async () => { const ids = [...body.querySelectorAll('input:checked')].map(c => c.dataset.cid); if (!ids.length) return; dlg.close(); await deleteMany(ids); checkMissing(); };
  $('cleanClose').onclick = () => dlg.close();
}

$('out').addEventListener('click', async e => {
  const rl = e.target.closest('[data-relock]'); if (rl) { unlocked.delete(rl.dataset.relock); render(); toast('انقفل 🔒'); return; }
  if (e.target.id === 'lkGo') tryUnlock();
});
$('out').addEventListener('keydown', e => { if (e.target.id === 'lkPass' && e.key === 'Enter') tryUnlock(); });
async function tryUnlock() {
  const id = $('out').dataset.lock, s = sections.find(x => x.id === id); if (!s || !s.lock) return;
  const h = await hashPass($('lkPass').value, s.lock.salt);
  if (h === s.lock.hash) { unlocked.add(id); render(); toast('انفتح 🔓'); }
  else { $('lkErr').textContent = 'كلمة السر غلط'; $('lkPass').select(); }
}

$('presetSel').onchange = async e => { ui.preset = e.target.value; applyAppearance(); await persist(); };
$('presetSel').onclick = e => e.stopPropagation();
$('langSel').onclick = e => e.stopPropagation();
$('langSel').onchange = async e => { ui.lang = e.target.value; window.I18N.set(ui.lang); render(); await persist(); };
function playEnter() {
  const o = $('out'); o.classList.add('enter');
  o.querySelectorAll('.tile,.room').forEach((t, k) => t.style.setProperty('--i', Math.min(k, 18)));
  clearTimeout(playEnter._t); playEnter._t = setTimeout(() => o.classList.remove('enter'), 900);
}
document.addEventListener('click', e => { const hb = e.target.closest('[data-hero]'); if (!hb) return; const k = hb.dataset.hero; const b = k === 'scan' ? document.querySelector('[data-more="scan"]') : document.querySelector('[data-add="' + k + '"]'); if (b) b.click(); });
/* ---------- 📊 الإحصائيات ---------- */
async function openStats() {
  await loadPlay();
  const L = visItems(), now = Date.now(), DAY = 864e5;
  const bar = (v, max, c) => `<div class="sbar"><i style="width:${max ? Math.max(3, Math.round(v / max * 100)) : 0}%;background:${c || 'var(--acc)'}"></i></div>`;
  const nm = i => `${i.thumb ? `<img class="si" src="${esc(i.thumb)}" alt="">` : `<span class="si">${KIND_ICON[i.kind] || '📄'}</span>`}<span class="sn2">${esc(i.name)}</span>`;
  const top = [...L].filter(i => i.openCount).sort((x, y) => y.openCount - x.openCount).slice(0, 10);
  const topP = [...L].filter(i => play[i.id] >= 60).sort((x, y) => play[y.id] - play[x.id]).slice(0, 10);
  const days = [...Array(7)].map((_, k) => { const d0 = new Date(now - (6 - k) * DAY); d0.setHours(0, 0, 0, 0); const s = +d0; return { s, n: 0, l: d0.toLocaleDateString('ar', { weekday: 'short' }) }; });
  L.forEach(i => (i.hist || []).forEach(t => { const d = days.find(x => t >= x.s && t < x.s + DAY); if (d) d.n++; }));
  const kinds = {}; L.forEach(i => { kinds[i.kind] = (kinds[i.kind] || 0) + 1; });
  const dead = L.filter(i => i.path && missing.has(i.id)).length, never = L.filter(i => !i.openCount && i.kind !== 'note').length;
  const totalOpens = L.reduce((n, i) => n + (i.openCount || 0), 0), totalPlay = L.reduce((n, i) => n + (play[i.id] || 0), 0);
  const mx = top[0] ? top[0].openCount : 0, mp = topP[0] ? play[topP[0].id] : 0, md = Math.max(1, ...days.map(d => d.n));
  let h = `<div class="stiles"><div class="st"><b>${L.length}</b><span>عنصر</span></div><div class="st"><b>${totalOpens}</b><span>مرة فتح</span></div><div class="st"><b>${totalPlay ? fmtDur(totalPlay) : '—'}</b><span>وقت استخدام</span></div><div class="st"><b>${never}</b><span>ما فتحتها أبداً</span></div><div class="st ${dead ? 'bad' : ''}"><b>${dead}</b><span>مفقودة</span></div></div>`;
  h += `<div class="sec"><span>🔥 الأكثر فتحاً</span></div>` + (top.length ? top.map(i => `<div class="srow">${nm(i)}${bar(i.openCount, mx)}<span class="sv">${i.openCount}</span></div>`).join('') : '<div class="hint" style="padding:6px">لسا ما فتحت شي من خزنة.</div>');
  h += `<div class="sec"><span>🕒 أكثر وقت استخدام</span></div>` + (topP.length ? topP.map(i => `<div class="srow">${nm(i)}${bar(play[i.id], mp, '#ea580c')}<span class="sv">${fmtDur(play[i.id])}</span></div>`).join('') : '<div class="hint" style="padding:6px">يبدأ الحساب لما تشغّل برنامج أو لعبة (.exe) من خزنة أو من ويندوز وخزنة شغّالة في الخلفية.</div>');
  h += `<div class="sec"><span>📅 آخر 7 أيام (مرات الفتح)</span></div><div class="sdays">` + days.map(d => `<div class="sd"><div class="sdb"><i style="height:${Math.round(d.n / md * 100)}%"></i></div><b>${d.n}</b><span>${esc(d.l)}</span></div>`).join('') + '</div>';
  h += `<div class="sec"><span>🗂️ حسب النوع</span></div><div class="skinds">` + Object.entries(kinds).sort((x, y) => y[1] - x[1]).map(([k, n]) => `<span class="tag">${KIND_ICON[k] || '📦'} ${KIND_CAT[k] || k} ${n}</span>`).join('') + '</div>';
  $('statsBody').innerHTML = h; $('statsClose').onclick = () => $('statsDlg').close(); $('statsDlg').showModal();
}

// فحص هادي عند التشغيل (مرة كل 12 ساعة)
setTimeout(async () => {
  try {
    if (!window.api.updateCheck) return;
    const last = +localStorage.getItem('zkUpdChk') || 0; if (Date.now() - last < 12 * 3600e3) return;
    localStorage.setItem('zkUpdChk', Date.now());
    const r = await window.api.updateCheck(); if (r.ok && r.count) toast('🔄 فيه تحديث جديد لخزنة — من ⋯ اختر «تحديث التطبيق»');
  } catch (e) {}
}, 12000);

/* ---------- ⏰ تشغيل المجموعات تلقائياً ---------- */
const schedRan = {};
setInterval(() => {
  const n = new Date(), hm = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  groups.forEach(g => {
    const s = g.sched; if (!s || !s.on || s.time !== hm) return;
    if (s.days && s.days.length && !s.days.includes(n.getDay())) return;
    const key = g.id + n.toDateString() + hm; if (schedRan[key]) return; schedRan[key] = 1; runGroup(g);
  });
}, 15000);
setTimeout(() => groups.forEach(g => { if (g.sched && g.sched.boot) runGroup(g); }), 12000);

/* ---------- 🎮 استيراد ألعاب ---------- */
function ensureSection(name, emoji, parent) {
  let s = sections.find(x => (x.parent || '') === (parent || '') && x.name === name);
  if (!s) { s = { id: uid(), name, emoji, parent: parent || '', color: '' }; sections.push(s); }
  return s;
}
async function importGames() {
  if (!window.api.scanGames) return toast('حدّث resources أيضاً');
  setBusy('أدوّر على ألعابك في Steam و Epic…'); const r = await window.api.scanGames(); setBusy('');
  const have = new Set(items.map(i => i.uri || i.path).filter(Boolean));
  const fresh = [...r.steam.map(x => ({ ...x, src: 'steam' })), ...r.epic.map(x => ({ ...x, src: 'epic' }))].filter(x => !have.has(x.uri || x.path));
  if (!fresh.length) return toast(r.steam.length + r.epic.length ? '✅ كل ألعابك مضافة من قبل' : 'ما لقيت ألعاب Steam أو Epic على جهازك');
  if (!confirm(`لقيت ${fresh.length} لعبة جديدة (Steam: ${fresh.filter(x => x.src === 'steam').length}، Epic: ${fresh.filter(x => x.src === 'epic').length}).\nأضيفها لقسم «ألعاب»؟`)) return;
  const sec = ensureSection('ألعاب', '🎮', '');
  fresh.forEach(x => items.push(newItem({ kind: 'app', name: x.name, category: 'ألعاب', uri: x.uri || '', path: x.path || '', ext: x.path ? '.exe' : '', thumb: x.thumb || '', cover: x.src === 'steam' && !!x.thumb, section: sec.id })));
  normalizeSections(); await persist(); navTo(sec.id); toast(`انضافت ${fresh.length} لعبة 🎮`);
}
async function importBookmarks() {
  if (!window.api.scanBookmarks) return toast('حدّث resources أيضاً');
  const list = await window.api.scanBookmarks(); const have = new Set(items.map(i => i.url).filter(Boolean));
  const fresh = []; const seen = new Set(); list.forEach(b => { if (have.has(b.url) || seen.has(b.url)) return; seen.add(b.url); fresh.push(b); });
  if (!fresh.length) return toast(list.length ? '✅ كل مفضلتك مضافة من قبل' : 'ما لقيت مفضلة Chrome أو Edge');
  if (!confirm(`لقيت ${fresh.length} رابط جديد في مفضلة المتصفح.\nأضيفها في قسم «مفضلة المتصفح» مع غرفة لكل مجلد؟`)) return;
  const root = ensureSection('مفضلة المتصفح', '🔖', ''); const rooms = {};
  fresh.forEach(b => {
    let sid = root.id; if (b.folder) { const k = b.folder; if (!rooms[k]) rooms[k] = ensureSection(k, '📂', root.id).id; sid = rooms[k]; }
    items.push(newItem({ kind: 'link', name: (b.name || b.url).slice(0, 120), category: KIND_CAT.link, url: b.url, section: sid }));
  });
  normalizeSections(); await persist(); navTo(root.id); toast(`انضاف ${fresh.length} رابط 🔖`);
}

/* ---------- 🗑️ سلة المحذوفات ---------- */
function openTrash() {
  const dlg = $('trashDlg'), body = $('trashBody');
  const draw = () => {
    body.innerHTML = trash.length ? trash.map(x => `<div class="chk-row"><span class="ci">${x.thumb ? `<img src="${esc(x.thumb)}" alt="">` : (KIND_ICON[x.kind] || '📄')}</span><span class="cn"><b>${esc(x.name)}</b><span class="hint">حُذف ${new Date(x._del).toLocaleDateString('ar')}</span></span><button type="button" class="sm" data-tr="${x.id}">↩️ استرجاع</button></div>`).join('') : '<div class="hint" style="padding:14px">السلة فاضية.</div>';
    $('trashEmpty').disabled = !trash.length;
  };
  body.onclick = async e => {
    const b = e.target.closest('[data-tr]'); if (!b) return; const x = trash.find(t => t.id === b.dataset.tr); if (!x) return;
    const { _del, ...it } = x; if (it.section && !sections.some(s => s.id === it.section)) it.section = '';
    items.push(newItem(it)); trash = trash.filter(t => t !== x); await persist(); render(); draw(); toast('انسترجع «' + it.name + '»');
  };
  $('trashEmpty').onclick = async () => { if (!confirm('إفراغ السلة نهائياً؟ ما يمديك ترجّعها بعدها.')) return; trash = []; await persist(); draw(); };
  $('trashClose').onclick = () => dlg.close(); draw(); dlg.showModal();
}

/* ---------- 👤 الملفات الشخصية ---------- */
async function openProfiles() {
  if (!window.api.profileList) return toast('حدّث resources أيضاً');
  const dlg = $('profDlg'); const r = await window.api.profileList();
  $('profList').innerHTML = r.list.map(n => `<div class="grow"><button class="grun" data-pf="${esc(n)}">${n === r.current ? '✅' : '▶'} ${esc(n === 'default' ? 'الأساسي' : n.replace(/_/g, ' '))}</button></div>`).join('');
  $('profList').onclick = async e => { const b = e.target.closest('[data-pf]'); if (!b || b.dataset.pf === r.current) return; dlg.close(); await window.api.profileSwitch(b.dataset.pf); };
  $('profAdd').onclick = async () => { const n = $('profNew').value.trim(); if (!n) return; dlg.close(); await window.api.profileSwitch(n); };
  $('profClose').onclick = () => dlg.close(); $('profNew').value = ''; dlg.showModal();
}
(async () => { try { if (!window.api.profileList) return; const r = await window.api.profileList(); if (r.current !== 'default') $('brandName').textContent = ' · ' + r.current.replace(/_/g, ' '); } catch (e) {} })();

/* ---------- 🔔 ذكّرني بعنصر ---------- */
let remItem = null;
function openRem(it) {
  remItem = it; $('remName').textContent = it.name;
  const d = new Date(Date.now() + 3600e3); d.setMinutes(0, 0, 0); const p = n => String(n).padStart(2, '0');
  $('remWhen').value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; $('remDlg').showModal();
}
$('remDlg').addEventListener('click', e => {
  const q = e.target.closest('[data-rq]'); if (!q) return; const d = new Date(), p = n => String(n).padStart(2, '0');
  if (q.dataset.rq === '1h') d.setTime(Date.now() + 3600e3); else if (q.dataset.rq === 'eve') { d.setHours(21, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); } else { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  $('remWhen').value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
});
$('remCancel').onclick = () => $('remDlg').close();
$('remSave').onclick = async () => {
  const ts = +new Date($('remWhen').value); if (!ts || !remItem) return toast('اختر الوقت');
  if (!window.Zakker || !window.Zakker.addRem) return toast('حدّث ملفات ذكّرني (zakker.js)');
  await window.Zakker.addRem('افتح: ' + remItem.name, ts, { ref: remItem.id }); $('remDlg').close(); toast('🔔 تم! يذكّرك في تبويب ذكّرني');
};

/* ---------- ⌨️ لوحة الأوامر Ctrl+K ---------- */
let cmdList = [], cmdSel = 0;
function cmdAll() {
  const mc = k => () => { const b = document.querySelector('[data-more="' + k + '"]'); if (b) b.click(); };
  const ad = k => () => { const b = document.querySelector('[data-add="' + k + '"]'); if (b) b.click(); };
  const c = [
    ['➕ إضافة ملفات', 'add file ملف اضافة', ad('files')], ['🔗 إضافة رابط', 'link رابط', ad('link')], ['📝 ملاحظة جديدة', 'note ملاحظة', ad('note')], ['📁 إضافة مجلد', 'folder مجلد', ad('folder')],
    ['📁 قسم جديد', 'section new قسم', () => newSection('')],
    ['📊 الإحصائيات', 'stats احصائيات', mc('stats')], ['🧹 فحص الملفات الميتة والمكررة', 'clean dead duplicate مكرر ميت', mc('clean')],
    ['🎮 استيراد ألعاب Steam و Epic', 'games steam epic العاب', mc('games')], ['🔖 استيراد مفضلة المتصفح', 'bookmarks مفضلة', mc('bookmarks')],
    ['🗑️ سلة المحذوفات', 'trash سلة', mc('trash')], ['👤 الملفات الشخصية', 'profile ملف شخصي', mc('profiles')],
    ['🔄 تحديث التطبيق', 'update تحديث', mc('update')], ['💾 نسخة احتياطية', 'backup نسخة', mc('export')], ['🔑 الذكاء الاصطناعي', 'ai مفتاح', mc('settings')],
    ['🗄️ الخزنة', 'vault خزنة', () => showView('vault')], ['📝 ملاحظاتي', 'notes ملاحظات افكار', () => showView('nt')], ['📝 ملاحظة جديدة', 'new note ملاحظة جديدة فكرة', () => { showView('nt'); window.Notes.create('blank'); }], ['✅ قائمة مهام جديدة', 'todo checklist مهام', () => { showView('nt'); window.Notes.create('todo'); }], ['💡 فكرة جديدة', 'idea فكرة', () => { showView('nt'); window.Notes.create('idea'); }], ['🔔 ذكّرني', 'reminders تذكير', () => showView('zk')], ['🏠 صفحة اليوم', 'today اليوم home', () => showView('td')], ['🎨 لوحتي', 'canvas board لوحة', () => showView('cv')],
    ['🎨 التخصيص', 'customize تخصيص', () => $('custBtn').click()], ['☑️ تحديد عدة عناصر', 'select تحديد', () => $('selBtn').click()],
    ['▦ عرض: بطاقات كبيرة', 'view big', () => document.querySelector('[data-v="big"]').click()], ['▪▪ عرض: بطاقات صغيرة', 'view small', () => document.querySelector('[data-v="small"]').click()], ['☰ عرض: قائمة', 'view list', () => document.querySelector('[data-v="list"]').click()],
    ['⚡ مجموعة جديدة', 'group مجموعة', () => editGroup(null)]
  ];
  PRESETS.forEach(([k, n]) => c.push(['🎨 ثيم: ' + n, 'theme ثيم', async () => { ui.preset = k; applyAppearance(); await persist(); }]));
  sections.forEach(s => c.push(['📂 اذهب إلى: ' + pathOf(s.id).map(x => x.name).join(' › '), 'go section قسم', () => { showView('vault'); navTo(s.id); }]));
  groups.forEach(g => c.push(['▶ شغّل: ' + g.name, 'run group مجموعة', () => runGroup(g)]));
  return c;
}
function cmdFilter() {
  const q = $('cmdkQ').value.trim(), nq = norm(q), out = [];
  if (!q) { cmdList = cmdAll().slice(0, 9).map(([t, , f]) => ({ t, f })); }
  else {
    const qt = nq.split(/\s+/).filter(Boolean);
    cmdList = cmdAll().filter(([t, k]) => { const h = norm(t + ' ' + k); return qt.every(w => h.includes(w)); }).slice(0, 5).map(([t, , f]) => ({ t, f }));
    localSearch(q).slice(0, 6).forEach(m => { const it = items.find(i => i.id === m.id); if (it && vis(it)) cmdList.push({ t: '📄 افتح: ' + it.name, f: () => openItem(it) }); });
    window.Notes.list().filter(n => qt.every(w => norm((n.title || '') + ' ' + [].concat(n.tags || []).join(' ') + ' ' + (n.lock ? '' : n.body || '')).includes(w))).slice(0, 5).forEach(n => cmdList.push({ t: '📝 ملاحظة: ' + (n.title || 'بدون عنوان'), f: () => { showView('nt'); window.Notes.select(n.id); } }));
    (window.Zakker.list ? window.Zakker.list() : []).filter(r => qt.every(w => norm(r.title || '').includes(w))).slice(0, 4).forEach(r => cmdList.push({ t: '🔔 تذكير: ' + r.title, f: () => showView('zk') }));
    boards.forEach(b => { if (qt.every(w => norm(b.name + ' ' + b.nodes.map(n => n.txt || '').join(' ')).includes(w))) cmdList.push({ t: '🎨 لوحة: ' + b.name, f: () => { showView('cv'); window.Canvas.open && window.Canvas.open(b.id); } }); });
  }
  cmdSel = 0; drawCmd();
}
function drawCmd() { $('cmdkList').innerHTML = cmdList.map((c, k) => `<div class="ci2 ${k === cmdSel ? 'on' : ''}" data-k="${k}">${esc(c.t)}</div>`).join('') || '<div class="hint" style="padding:12px">ما لقيت شي</div>'; }
function openPalette() { $('cmdk').hidden = false; $('cmdkQ').value = ''; cmdFilter(); setTimeout(() => $('cmdkQ').focus(), 30); }
function closePalette() { $('cmdk').hidden = true; }
$('cmdkQ').addEventListener('input', cmdFilter);
$('cmdkQ').addEventListener('keydown', e => {
  if (e.key === 'Escape') closePalette();
  else if (e.key === 'ArrowDown') { e.preventDefault(); cmdSel = Math.min(cmdList.length - 1, cmdSel + 1); drawCmd(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cmdSel = Math.max(0, cmdSel - 1); drawCmd(); }
  else if (e.key === 'Enter') { e.preventDefault(); const c = cmdList[cmdSel]; closePalette(); if (c) setTimeout(c.f, 30); }
});
$('cmdkList').addEventListener('click', e => { const r = e.target.closest('[data-k]'); if (!r) return; const c = cmdList[+r.dataset.k]; closePalette(); if (c) setTimeout(c.f, 30); });
$('cmdk').addEventListener('mousedown', e => { if (e.target.id === 'cmdk') closePalette(); });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); $('cmdk').hidden ? openPalette() : closePalette(); } });

/* ---------- ⚙️ صفحة الإعدادات ---------- */
const PREFS = [
  { id: 'look', ico: '🎨', t: 'المظهر', rows: [
    { t: 'اللغة', d: 'لغة واجهة التطبيق.', c: { sel: 'lang', o: [['ar', 'العربية'], ['en', 'English']] } },
    { t: 'الثيم', d: 'شكل التطبيق الكامل.', c: { sel: 'preset', o: PRESETS.map(p => [p[0], p[1]]) } },
    { t: 'المظهر', d: 'فاتح أو داكن أو حسب الويندوز (للثيم الأساسي).', c: { sel: 'theme', o: [['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']] } },
    { t: 'لون التطبيق', d: 'اللون الرئيسي للأزرار والتحديد.', c: { sw: 1 } },
    { t: 'شكل العرض الافتراضي', d: 'بطاقات كبيرة أو صغيرة أو قائمة (سطر لكل عنصر).', c: { sel: 'view', o: [['big', '▦ بطاقات كبيرة'], ['small', '▪▪ بطاقات صغيرة'], ['list', '☰ قائمة']] } },
    { t: 'يفتح على صفحة اليوم', d: 'أول ما تفتح البرنامج تشوف ملخص يومك.', c: { tg: 'startToday', def: 1 } },
    { t: 'إظهار الوصف', d: 'الوصف تحت اسم العنصر.', c: { tg: 'showDesc' } },
    { t: 'إظهار التصنيف والوسوم', d: 'الشارات الصغيرة على البطاقة.', c: { tg: 'showTags' } }
  ] },
  { id: 'design', ico: '🖌️', t: 'التصميم', rows: [
    { t: 'الثيمات', d: 'اختر شكل التطبيق الكامل.', col: 1, c: { pre: 1 } },
    { t: 'لون التطبيق', d: 'اختر من الألوان أو اصنع لونك من القوس الملوّن.', col: 1, c: { sw: 1, cu: 1 } },
    { t: 'زوايا البطاقات', d: 'حادة أو دائرية أو كبسولة.', c: { sg: 'rad', o: [['', 'عادي'], ['s', 'حادة'], ['r', 'دائرية'], ['p', 'كبسولة']] } },
    { t: 'ستايل البطاقات', d: 'شكل البطاقة نفسها.', c: { sg: 'cs', o: [['', 'عادي'], ['flat', 'مسطّح'], ['outline', 'إطار'], ['shadow', 'ظل'], ['grad', 'تدرّج'], ['glass', 'زجاج'], ['neo', 'بارز'], ['bar', 'شريط']] } },
    { t: 'الكثافة', d: 'المسافات بين العناصر.', c: { sg: 'dn', o: [['c', 'مضغوط'], ['', 'عادي'], ['r', 'واسع']] } },
    { t: 'حجم البطاقات الكبيرة', d: 'عرض البطاقة في العرض الكبير.', c: { rg: 'tw', min: 150, max: 340, step: 10, def: 205, u: 'px' } },
    { t: 'نوع الخط', d: 'خطوط موجودة في ويندوز.', c: { sg: 'ff', o: [['', 'عادي'], ['tahoma', 'تاهوما'], ['soft', 'ناعم'], ['serif', 'كلاسيكي'], ['hand', 'يدوي'], ['mono', 'برمجي']] } },
    { t: 'حجم الخط', d: 'كبّر أو صغّر كل النصوص.', c: { rg: 'fs', min: 85, max: 130, step: 5, def: 100, u: '%' } },
    { t: 'الخلفية', d: 'تدرّج أو صورتك. تتغطّى بالبطاقات الشفافة.', col: 1, c: { wp: 1 } },
    { t: 'تغبيش الخلفية', d: 'يخلي الصورة ناعمة.', c: { rg: 'wb', min: 0, max: 24, step: 2, def: 0, u: 'px' } },
    { t: 'تعتيم الخلفية', d: 'يحسّن قراءة النص فوق الصورة.', c: { rg: 'wd', min: 0, max: 80, step: 5, def: 0, u: '%' } },
    { t: 'حركة الماوس على البطاقة', d: 'وش يصير لما تمرّر الماوس.', c: { sg: 'hv', o: [['', 'عادي'], ['lift', 'ارتفاع'], ['glow', 'توهّج'], ['zoom', 'تكبير'], ['tilt', 'ميلان'], ['none', 'بدون']] } },
    { t: 'الحركات', d: 'سلسة أو نطّاطة أو بدون حركات (للأجهزة الضعيفة).', c: { sg: 'mo', o: [['off', 'بدون'], ['', 'عادي'], ['lively', 'نطّاط']] } },
    { t: 'مفاجأة', d: 'ثيم ولون وستايل عشوائي. جرّب أكثر من مرة!', c: { fn: 'rand', l: '🎲 عشوائي' } },
    { t: 'رجّع الافتراضي', d: 'يرجّع كل التصميم لأصله (بياناتك ما تتأثر).', c: { fn: 'dreset', l: 'إعادة ضبط' } }
  ] },
  { id: 'data', ico: '💾', t: 'البيانات والنسخ', rows: [
    { t: 'نسخة احتياطية الآن', d: 'احفظ نسخة كاملة من خزنتك في ملف.', c: { b: 'more:export', l: 'حفظ نسخة' } },
    { t: 'استعادة نسخة', d: 'ادمج عناصر من ملف نسخة احتياطية.', c: { b: 'more:import', l: 'اختيار ملف' } },
    { t: 'النسخ التلقائي اليومي', d: 'تُحفظ نسخة كل يوم وتبقى آخر 14. (تشغيله وإيقافه من أيقونة التراي)', c: { b: 'more:bk-open', l: 'فتح المجلد' } },
    { t: 'مكان النسخ التلقائية', d: 'غيّره إلى OneDrive أو فلاشة مثلاً.', c: { b: 'more:bk-choose', l: 'تغيير المجلد' } },
    { t: 'سلة المحذوفات', d: 'المحذوفات تبقى 30 يوم قبل ما تُمسح.', c: { b: 'more:trash', l: 'فتح السلة' } },
    { t: 'الملفات الشخصية', d: 'خزنة منفصلة لكل غرض (دراسة، عمل، ألعاب).', c: { b: 'more:profiles', l: 'إدارة' } }
  ] },
  { id: 'import', ico: '📥', t: 'الاستيراد', rows: [
    { t: 'برامجي المثبتة', d: 'من قائمة ابدأ مع أيقوناتها.', c: { b: 'more:scan', l: 'استيراد' } },
    { t: 'ألعاب Steam و Epic', d: 'تُضاف بأغلفتها لقسم «ألعاب».', c: { b: 'more:games', l: 'استيراد' } },
    { t: 'مفضلة Chrome و Edge', d: 'روابطك في قسم مع غرفة لكل مجلد.', c: { b: 'more:bookmarks', l: 'استيراد' } },
    { t: 'تحديث صور كل العناصر', d: 'يعيد قراءة أيقونات وصور الملفات.', c: { b: 'more:thumbs', l: 'تحديث' } },
    { t: 'عبّي الأوصاف الناقصة', d: 'بالذكاء الاصطناعي (يحتاج مفتاح).', c: { b: 'more:fill', l: 'تعبئة' } }
  ] },
  { id: 'tools', ico: '🧰', t: 'الأدوات', rows: [
    { t: 'فحص الملفات الميتة والمكررة', d: 'اعثر على الملفات المفقودة والمكررات ونظّفها.', c: { b: 'more:clean', l: 'فحص' } },
    { t: 'إحصائيات خزنتي', d: 'الأكثر فتحاً، ووقت الاستخدام، وآخر 7 أيام.', c: { b: 'more:stats', l: 'عرض' } },
    { t: 'لوحة الأوامر', d: 'اكتب أي أمر أو عنصر وانفّذه (Ctrl+K).', c: { b: 'more:palette', l: 'فتح' } },
    { t: 'المجموعات', d: 'افتح عدة عناصر بضغطة، مع جدولة بوقت.', c: { fn: 'groups', l: 'إدارة' } },
    { t: 'مراقبة مجلد', d: 'إشعار لكل ملف جديد في مجلد (مثل التنزيلات).', c: { b: 'more:watch', l: 'اختيار مجلد' } }
  ] },
  { id: 'desk', ico: '🪟', t: 'سطح المكتب', rows: [
    { t: 'حاوية ذكية: فتحتها مؤخراً', d: 'تتعبّى لحالها.', c: { b: 'more:smart-recent', l: 'تشغيل / إيقاف' } },
    { t: 'حاوية ذكية: الأكثر استخداماً', d: 'أكثر ما تفتحه.', c: { b: 'more:smart-used', l: 'تشغيل / إيقاف' } },
    { t: 'حاوية ذكية: أضفتها حديثاً', d: 'آخر ما أضفته.', c: { b: 'more:smart-added', l: 'تشغيل / إيقاف' } },
    { t: 'حاوية ذكية: المثبّتة', d: 'عناصرك المثبّتة ⭐.', c: { b: 'more:smart-pinned', l: 'تشغيل / إيقاف' } },
    { t: 'حاوية لقسم', d: 'من القائمة الجانبية: حط الماوس على أي قسم واضغط 🪟.', c: { txt: '' } },
    { t: 'اختصارات لوحة المفاتيح', d: 'Ctrl+Alt+Space فتح خزنة · Ctrl+Alt+F بحث سريع · Ctrl+Alt+D إظهار الحاويات · Ctrl+Alt+V إضافة من الحافظة · Ctrl+K لوحة الأوامر', c: { txt: '' } }
  ] },
  { id: 'ai', ico: '✨', t: 'الذكاء الاصطناعي', rows: [
    { t: 'مفتاح Anthropic API (اختياري)', d: 'بدون مفتاح كل شي يشتغل بالكلمات. بالمفتاح: تعرّف تلقائي على الملفات وبحث بالوصف. المفتاح مشفّر على جهازك.', c: { b: 'more:settings', l: 'إدارة المفتاح' } }
  ] },
  { id: 'about', ico: 'ℹ️', t: 'حول والتحديث', rows: [
    { t: 'تحديث التطبيق', d: 'يجيب أحدث الملفات من GitHub ويعيد التشغيل.', c: { b: 'more:update', l: 'تحقق من التحديث' } },
    { t: 'مزامنة ذكّرني مع الجوال', d: 'حساب Supabase مجاني (اختياري).', c: { fn: 'sync', l: 'إعداد المزامنة' } },
    { t: 'خزنة مفتوحة المصدر ومجانية', d: 'الكود والتحميل والتحديثات على GitHub.', c: { fn: 'github', l: 'فتح GitHub' } }
  ] }
];
let prefsTab = 'look';
function prefsVal(k) { if (k === 'lang') return ui.lang || window.I18N.get(); if (k === 'preset') return ui.preset || ''; if (k === 'theme') return ui.theme || 'auto'; if (k === 'view') return ui.view || 'big'; return ''; }
const dval = k => ui[k] === undefined || ui[k] === null ? '' : String(ui[k]);
function prefsCtl(c) {
  if (c.sel) return `<select data-ps="${c.sel}">${c.o.map(([v, l]) => `<option value="${v}" ${prefsVal(c.sel) === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  if (c.tg) return `<label class="tgl"><input type="checkbox" data-pt="${c.tg}" ${(c.def ? ui[c.tg] !== false : ui[c.tg]) ? 'checked' : ''}><i></i></label>`;
  if (c.sw) return `<div class="swatches">${SWATCHES.map(x => `<button type="button" class="sw ${x ? '' : 'def'} ${(ui.accent || '') === x ? 'on' : ''}" data-pc="${x}" style="${x ? 'background:' + x : ''}"></button>`).join('')}${c.cu ? `<span class="sw cust ${ui.accent && !SWATCHES.includes(ui.accent) ? 'on' : ''}" title="لون مخصّص"><input type="color" data-pcc value="${/^#[0-9a-f]{6}$/i.test(ui.accent || '') ? ui.accent : '#2f6f5e'}"></span>` : ''}</div>`;
  if (c.pre) return `<div class="pgal">${PRESETS.map(([k, n, b, cd, a]) => `<button type="button" class="pcard ${(ui.preset || '') === k ? 'on' : ''}" data-pp="${k}"><span class="pv" style="background:${b}"><i style="background:${cd}"></i><i style="background:${cd}"></i><b style="background:${a}"></b></span>${esc(n)}</button>`).join('')}</div>`;
  if (c.sg) return `<div class="seg2">${c.o.map(([v, l]) => `<button type="button" class="${dval(c.sg) === v ? 'on' : ''}" data-sg="${c.sg}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
  if (c.rg) { const v = +ui[c.rg] || c.def; return `<div class="rg"><input type="range" data-rg="${c.rg}" min="${c.min}" max="${c.max}" step="${c.step}" value="${v}"><output>${v}${c.u}</output></div>`; }
  if (c.wp) return `<div class="wgal"><button type="button" class="wsw none ${!ui.wp ? 'on' : ''}" data-wp="" title="بدون"></button>${Object.keys(WALLS).map(k => `<button type="button" class="wsw ${ui.wp === k ? 'on' : ''}" data-wp="${k}" style="background-image:${WALLS[k]}"></button>`).join('')}<button type="button" class="sm" data-wpup="1">🖼️ صورتي</button></div>`;
  if (c.b) return `<button class="sm" data-pa="${c.b}">${esc(c.l)}</button>`;
  if (c.fn) return `<button class="sm" data-pf="${c.fn}">${esc(c.l)}</button>`;
  return '';
}
function drawPrefs() {
  $('prefsNav').innerHTML = PREFS.map(p => `<button class="pn ${p.id === prefsTab ? 'on' : ''}" data-ptab="${p.id}"><span>${p.ico}</span> ${esc(p.t)}</button>`).join('');
  const p = PREFS.find(x => x.id === prefsTab);
  $('prefsPane').innerHTML = `<h2>${p.ico} ${esc(p.t)}</h2>` + p.rows.map(r => `<div class="prow ${r.col ? 'col' : ''}"><div class="pt"><b>${esc(r.t)}</b><span>${esc(r.d)}</span></div><div class="pc">${prefsCtl(r.c)}</div></div>`).join('');
}
function openPrefs() { $('prefs').hidden = false; drawPrefs(); }
function closePrefs() { $('prefs').hidden = true; }
$('prefsClose').onclick = closePrefs;
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('prefs').hidden && !document.querySelector('dialog[open]') && $('cmdk').hidden) closePrefs(); });
$('prefsNav').addEventListener('click', e => { const b = e.target.closest('[data-ptab]'); if (!b) return; prefsTab = b.dataset.ptab; drawPrefs(); });
$('prefsPane').addEventListener('click', async e => {
  const sw = e.target.closest('[data-pc]'); if (sw) { ui.accent = sw.dataset.pc; applyAppearance(); await persist(); drawPrefs(); return; }
  const pp = e.target.closest('[data-pp]'); if (pp) { ui.preset = pp.dataset.pp; applyAppearance(); await persist(); drawPrefs(); return; }
  const sg = e.target.closest('[data-sg]'); if (sg) { ui[sg.dataset.sg] = sg.dataset.v; applyAppearance(); await persist(); drawPrefs(); return; }
  const wp = e.target.closest('[data-wp]'); if (wp) { ui.wp = wp.dataset.wp; applyAppearance(); await persist(); drawPrefs(); return; }
  if (e.target.closest('[data-wpup]')) { pickWall(); return; }
  const pa = e.target.closest('[data-pa]'); if (pa) { const k = pa.dataset.pa.split(':')[1]; const b = document.querySelector('[data-more="' + k + '"]'); if (b) b.click(); return; }
  const pf = e.target.closest('[data-pf]'); if (!pf) return;
  if (pf.dataset.pf === 'rand') { randomLook(); await persist(); drawPrefs(); }
  else if (pf.dataset.pf === 'dreset') { DKEYS.forEach(k => delete ui[k]); applyAppearance(); await persist(); drawPrefs(); toast('🎨 رجع التصميم الافتراضي'); }
  else if (pf.dataset.pf === 'groups') { closePrefs(); $('grpBtn').click(); }
  else if (pf.dataset.pf === 'sync') window.Zakker.openSync();
  else if (pf.dataset.pf === 'github') window.api.openUrl('https://github.com/a62724195-lab/khazana');
});
const DKEYS = ['preset', 'accent', 'rad', 'cs', 'dn', 'tw', 'ff', 'fs', 'wp', 'wimg', 'wb', 'wd', 'hv', 'mo'];
function randomLook() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  ui.preset = pick(PRESETS)[0]; ui.accent = Math.random() < .6 ? pick(SWATCHES.slice(1)) : ''; ui.rad = pick(['', 's', 'r', 'p']); ui.cs = pick(['', 'flat', 'outline', 'shadow', 'grad', 'glass', 'neo', 'bar']);
  ui.hv = pick(['', 'lift', 'glow', 'zoom', 'tilt']); ui.wp = Math.random() < .4 ? pick(Object.keys(WALLS)) : ''; ui.wb = 0; ui.wd = ui.wp ? 20 : 0; applyAppearance();
}
function pickWall() {
  const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*';
  f.onchange = () => {
    const file = f.files && f.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => { const im = new Image(); im.onload = async () => {
      const k = Math.min(1, 1600 / im.width), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ui.wimg = c.toDataURL('image/jpeg', .72); ui.wp = 'img'; if (!ui.wd) ui.wd = 25;
      applyAppearance(); await persist(); drawPrefs(); toast('🖼️ انضافت الخلفية');
    }; im.src = rd.result; };
    rd.readAsDataURL(file);
  };
  f.click();
}
$('prefsPane').addEventListener('input', e => {
  const r = e.target.closest('[data-rg]'); if (r) { ui[r.dataset.rg] = +r.value; applyAppearance(); const o = r.parentNode.querySelector('output'); if (o) o.textContent = r.value + (o.textContent.replace(/[\d.]/g, '')); }
  const cc = e.target.closest('[data-pcc]'); if (cc) { ui.accent = cc.value; applyAppearance(); }
});
$('prefsPane').addEventListener('change', async e => {
  if (e.target.closest('[data-rg]') || e.target.closest('[data-pcc]')) { await persist(); if (e.target.closest('[data-pcc]')) drawPrefs(); return; }
  const s = e.target.closest('[data-ps]'), t = e.target.closest('[data-pt]'); if (!s && !t) return;
  if (t) { ui[t.dataset.pt] = t.checked; applyView(); await persist(); return; }
  const k = s.dataset.ps, v = s.value;
  if (k === 'lang') { ui.lang = v; window.I18N.set(v); render(); }
  else if (k === 'preset') { ui.preset = v; applyAppearance(); }
  else if (k === 'theme') { ui.theme = v; applyAppearance(); }
  else if (k === 'view') { ui.view = v; views = {}; applyView(); render(); }
  await persist(); drawPrefs();
});
